import { InjectQueue } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { TransactionChannel, TransactionStatus, TransactionType } from '@prisma/client';
import { Queue } from 'bull';
import { PrismaService } from '../prisma/prisma.service';

export interface MonthlyChargeJobData {
  from: string;
  to: string;
  triggeredBy?: string;
  manual?: boolean;
}

export interface MonthlyChargeResult {
  totalMembers: number;
  successCount: number;
  failureCount: number;
  totalAmount: number;
  errors: Array<{ memberId: string; error: string }>;
}

@Injectable()
export class MonthlyChargesService {
  private readonly logger = new Logger(MonthlyChargesService.name);
  private readonly MONTHLY_CHARGE_AMOUNT = 100;

  constructor(
    @InjectQueue('monthly-charges') private readonly monthlyChargesQueue: Queue,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Schedule monthly charges job
   */
  async scheduleMonthlyCharges(data: MonthlyChargeJobData) {
    this.logger.log(`Scheduling monthly charges for period: ${data.from} to ${data.to}`);
    
    const job = await this.monthlyChargesQueue.add('process-monthly-charges', data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: 100,
      removeOnFail: 100,
    });

    return {
      jobId: job.id,
      status: 'scheduled',
      data,
    };
  }

  /**
   * Process monthly charges for all active members
   */
  async processMonthlyCharges(data: MonthlyChargeJobData): Promise<MonthlyChargeResult> {
    const { from, to, triggeredBy = 'system', manual = false } = data;
    
    this.logger.log(`Processing monthly charges from ${from} to ${to}`);
    this.logger.log(`Triggered by: ${triggeredBy}, Manual: ${manual}`);

    const result: MonthlyChargeResult = {
      totalMembers: 0,
      successCount: 0,
      failureCount: 0,
      totalAmount: 0,
      errors: [],
    };

    try {
      // Get all active members
      const activeMembers = await this.prisma.member.findMany({
        where: {
          membershipStatus: 'ACTIVE',
          joiningDate: {
            lte: new Date(to),
          },
        },
        select: {
          id: true,
          memberNumber: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      });

      result.totalMembers = activeMembers.length;
      this.logger.log(`Found ${result.totalMembers} active members`);

      // Process each member
      for (const member of activeMembers) {
        try {
          await this.applyMonthlyCharge(member.id, member.memberNumber, from, to, triggeredBy);
          result.successCount++;
          result.totalAmount += this.MONTHLY_CHARGE_AMOUNT;
        } catch (error) {
          const err = error as Error;
          result.failureCount++;
          result.errors.push({
            memberId: member.id,
            error: err.message,
          });
          this.logger.error(
            `Failed to apply charge for member ${member.memberNumber}: ${err.message}`,
          );
        }
      }

      // Write audit log
      await this.writeAuditLog({
        action: 'MONTHLY_CHARGES_PROCESSED',
        triggeredBy,
        manual,
        period: { from, to },
        result,
      });

      this.logger.log(
        `Monthly charges completed: ${result.successCount} success, ${result.failureCount} failures`,
      );

      return result;
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error processing monthly charges: ${err.message}`, err.stack);
      throw error;
    }
  }

  /**
   * Apply monthly charge to a specific member
   */
  private async applyMonthlyCharge(
    memberId: string,
    memberNumber: string,
    from: string,
    to: string,
    triggeredBy: string,
  ): Promise<void> {
    const chargeDate = new Date(from);
    const month = chargeDate.toLocaleString('default', { month: 'long', year: 'numeric' });

    // Check if charge already exists for this period
    const existingCharge = await this.prisma.transaction.findFirst({
      where: {
        memberId,
        type: TransactionType.MONTHLY_CHARGE,
        valueDate: {
          gte: new Date(from),
          lte: new Date(to),
        },
      },
    });

    if (existingCharge) {
      this.logger.debug(
        `Monthly charge already exists for member ${memberNumber} for period ${month}`,
      );
      return;
    }

    // Get current balance
    const lastTransaction = await this.prisma.transaction.findFirst({
      where: { memberId },
      orderBy: { createdAt: 'desc' },
      select: { balanceAfter: true },
    });

    const currentBalance = lastTransaction?.balanceAfter || 0;
    const newBalance = Number(currentBalance) - this.MONTHLY_CHARGE_AMOUNT;

    // Generate receipt number
    const receiptNumber = await this.generateReceiptNumber();

    // Create transaction
    await this.prisma.transaction.create({
      data: {
        memberId,
        amount: this.MONTHLY_CHARGE_AMOUNT,
        type: TransactionType.MONTHLY_CHARGE,
        channel: TransactionChannel.SYSTEM,
        status: TransactionStatus.POSTED,
        narration: `Monthly charge for ${month}`,
        receiptNumber,
        valueDate: new Date(from),
        balanceAfter: newBalance,
        metadata: {
          triggeredBy,
          period: { from, to },
          chargeType: 'monthly',
        },
      },
    });

    this.logger.debug(`Applied monthly charge for member ${memberNumber}`);
  }

  /**
   * Generate unique receipt number
   */
  private async generateReceiptNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const lastReceipt = await this.prisma.transaction.findFirst({
      where: {
        receiptNumber: {
          startsWith: `RCP-${year}-`,
        },
      },
      orderBy: {
        receiptNumber: 'desc',
      },
      select: {
        receiptNumber: true,
      },
    });

    let sequence = 1;
    if (lastReceipt?.receiptNumber) {
      const match = lastReceipt.receiptNumber.match(/RCP-\d{4}-(\d+)/);
      if (match && match[1]) {
        sequence = parseInt(match[1], 10) + 1;
      }
    }

    return `RCP-${year}-${sequence.toString().padStart(6, '0')}`;
  }

  /**
   * Write audit log entry
   */
  private async writeAuditLog(data: any): Promise<void> {
    try {
      // Store in database as JSON for now
      // In production, consider using a dedicated audit log table or service
      this.logger.log('Audit Log:', JSON.stringify(data, null, 2));
      
      // TODO: Implement proper audit log storage
      // await this.prisma.auditLog.create({ data });
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to write audit log: ${err.message}`);
    }
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string) {
    const job = await this.monthlyChargesQueue.getJob(jobId);
    
    if (!job) {
      return { status: 'not_found' };
    }

    const state = await job.getState();
    const progress = job.progress();
    const result = job.returnvalue;

    return {
      id: job.id,
      status: state,
      progress,
      result,
      createdAt: new Date(job.timestamp),
      processedAt: job.processedOn ? new Date(job.processedOn) : null,
      finishedAt: job.finishedOn ? new Date(job.finishedOn) : null,
    };
  }

  /**
   * Calculate date range for current month
   */
  calculateCurrentMonthRange(): { from: string; to: string } {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    return {
      from: firstDay.toISOString().split('T')[0] as string,
      to: lastDay.toISOString().split('T')[0] as string,
    };
  }
}
