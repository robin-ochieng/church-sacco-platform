import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { LoanStatus, ScheduleStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LoanScheduleItemDto, LoanScheduleResponseDto, LoanScheduleSummaryDto } from './dto/loan-schedule.dto';

@Injectable()
export class LoanScheduleService {
  constructor(private prisma: PrismaService) {}

  /**
   * Generate amortization schedule for a loan using reducing balance method
   * Interest: 12% p.a. (1% per month on reducing balance)
   * Repayment starts 30 days after disbursement
   */
  async generateSchedule(loanId: string): Promise<LoanScheduleItemDto[]> {
    const loan = await this.prisma.loan.findUnique({
      where: { id: loanId },
    });

    if (!loan) {
      throw new NotFoundException('Loan not found');
    }

    if (loan.status !== LoanStatus.APPROVED && loan.status !== LoanStatus.DISBURSED) {
      throw new BadRequestException('Cannot generate schedule for a loan that is not approved or disbursed');
    }

    // Check if schedule already exists
    const existingSchedule = await this.prisma.loanSchedule.findMany({
      where: { loanId },
    });

    if (existingSchedule.length > 0) {
      // Return existing schedule
      return existingSchedule.map(this.mapToDto);
    }

    // Calculate amortization schedule using reducing balance method
    const principal = Number(loan.amount);
    const monthlyRate = Number(loan.interestRate) / 100; // Convert to decimal (1% = 0.01)
    const durationMonths = loan.durationMonths;
    
    // Calculate fixed monthly payment using PMT formula for reducing balance
    // PMT = P * [r(1+r)^n] / [(1+r)^n - 1]
    const monthlyPayment = this.calculateMonthlyPayment(principal, monthlyRate, durationMonths);

    // Determine start date (30 days after disbursement or approval)
    const startDate = loan.disbursementDate 
      ? new Date(loan.disbursementDate)
      : loan.approvalDate 
        ? new Date(loan.approvalDate)
        : new Date();
    
    startDate.setDate(startDate.getDate() + 30); // First payment 30 days after

    // Generate schedule entries
    const scheduleEntries: any[] = [];
    let remainingBalance = principal;

    for (let i = 1; i <= durationMonths; i++) {
      const dueDate = new Date(startDate);
      dueDate.setMonth(dueDate.getMonth() + (i - 1));

      // Calculate interest for this month (on remaining balance)
      const interestDue = remainingBalance * monthlyRate;
      
      // Principal for this month = monthly payment - interest
      // For the last payment, adjust to clear the balance
      let principalDue: number;
      if (i === durationMonths) {
        principalDue = remainingBalance;
      } else {
        principalDue = monthlyPayment - interestDue;
      }

      // Ensure principal doesn't exceed remaining balance
      principalDue = Math.min(principalDue, remainingBalance);

      // Update remaining balance
      remainingBalance -= principalDue;

      // Ensure no negative balance due to rounding
      if (remainingBalance < 0.01) {
        remainingBalance = 0;
      }

      const totalDue = principalDue + interestDue;

      scheduleEntries.push({
        loanId,
        installmentNo: i,
        dueDate,
        principalDue: this.roundToTwoDecimals(principalDue),
        interestDue: this.roundToTwoDecimals(interestDue),
        penaltyDue: 0,
        principalPaid: 0,
        interestPaid: 0,
        penaltyPaid: 0,
        totalDue: this.roundToTwoDecimals(totalDue),
        totalPaid: 0,
        balanceAfter: this.roundToTwoDecimals(remainingBalance),
        status: ScheduleStatus.PENDING,
      });
    }

    // Save schedule to database
    await this.prisma.loanSchedule.createMany({
      data: scheduleEntries,
    });

    // Update loan with monthly payment
    await this.prisma.loan.update({
      where: { id: loanId },
      data: {
        monthlyPayment: this.roundToTwoDecimals(monthlyPayment),
      },
    });

    // Fetch and return created schedule
    const createdSchedule = await this.prisma.loanSchedule.findMany({
      where: { loanId },
      orderBy: { installmentNo: 'asc' },
    });

    return createdSchedule.map(this.mapToDto);
  }

  /**
   * Get complete schedule with loan details
   */
  async getScheduleWithDetails(loanId: string): Promise<LoanScheduleResponseDto> {
    const loan = await this.prisma.loan.findUnique({
      where: { id: loanId },
      include: {
        schedules: {
          orderBy: { installmentNo: 'asc' },
        },
      },
    });

    if (!loan) {
      throw new NotFoundException('Loan not found');
    }

    const schedule = loan.schedules.map(this.mapToDto);
    
    // Calculate totals
    const totalInterest = schedule.reduce((sum, item) => sum + item.interestDue, 0);
    const totalPayable = Number(loan.amount) + totalInterest;
    const monthlyPayment = schedule.length > 0 ? schedule[0].principalDue + schedule[0].interestDue : 0;

    return {
      loanId: loan.id,
      loanNumber: loan.loanNumber,
      loanAmount: Number(loan.amount),
      interestRate: Number(loan.interestRate),
      durationMonths: loan.durationMonths,
      monthlyPayment: loan.monthlyPayment ? Number(loan.monthlyPayment) : monthlyPayment,
      totalInterest: this.roundToTwoDecimals(totalInterest),
      totalPayable: this.roundToTwoDecimals(totalPayable),
      disbursementDate: loan.disbursementDate ?? undefined,
      schedule,
    };
  }

  /**
   * Get schedule summary for dashboard
   */
  async getScheduleSummary(loanId: string): Promise<LoanScheduleSummaryDto> {
    const loan = await this.prisma.loan.findUnique({
      where: { id: loanId },
      include: {
        schedules: {
          orderBy: { installmentNo: 'asc' },
        },
      },
    });

    if (!loan) {
      throw new NotFoundException('Loan not found');
    }

    const schedule = loan.schedules.map(this.mapToDto);
    const now = new Date();

    const totalPrincipalDue = schedule.reduce((sum, item) => sum + item.principalDue, 0);
    const totalInterestDue = schedule.reduce((sum, item) => sum + item.interestDue, 0);
    const totalPenaltyDue = schedule.reduce((sum, item) => sum + item.penaltyDue, 0);
    const totalPaid = schedule.reduce((sum, item) => sum + item.totalPaid, 0);

    const paidInstallments = schedule.filter(s => s.status === ScheduleStatus.PAID).length;
    const overdueInstallments = schedule.filter(
      s => s.status !== ScheduleStatus.PAID && new Date(s.dueDate) < now
    ).length;
    const remainingInstallments = schedule.filter(
      s => s.status !== ScheduleStatus.PAID
    ).length;

    // Find next installment (first unpaid)
    const nextInstallment = schedule.find(s => s.status !== ScheduleStatus.PAID);

    const totalOutstanding = totalPrincipalDue + totalInterestDue + totalPenaltyDue - totalPaid;

    return {
      totalPrincipalDue: this.roundToTwoDecimals(totalPrincipalDue),
      totalInterestDue: this.roundToTwoDecimals(totalInterestDue),
      totalPenaltyDue: this.roundToTwoDecimals(totalPenaltyDue),
      totalPaid: this.roundToTwoDecimals(totalPaid),
      totalOutstanding: this.roundToTwoDecimals(totalOutstanding),
      nextInstallment,
      overdueInstallments,
      paidInstallments,
      remainingInstallments,
    };
  }

  /**
   * Update schedule status based on current date
   * Called by scheduled job or on demand
   */
  async updateScheduleStatuses(): Promise<number> {
    const now = new Date();
    
    // Update PENDING to DUE where due date has passed
    const result = await this.prisma.loanSchedule.updateMany({
      where: {
        status: ScheduleStatus.PENDING,
        dueDate: { lte: now },
      },
      data: {
        status: ScheduleStatus.DUE,
      },
    });

    // Update DUE to OVERDUE where 5+ days past due
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

    const overdueResult = await this.prisma.loanSchedule.updateMany({
      where: {
        status: { in: [ScheduleStatus.DUE, ScheduleStatus.PARTIAL] },
        dueDate: { lte: fiveDaysAgo },
      },
      data: {
        status: ScheduleStatus.OVERDUE,
      },
    });

    return result.count + overdueResult.count;
  }

  /**
   * Calculate monthly payment using PMT formula (reducing balance)
   * PMT = P * [r(1+r)^n] / [(1+r)^n - 1]
   */
  private calculateMonthlyPayment(principal: number, monthlyRate: number, months: number): number {
    if (monthlyRate === 0) {
      return principal / months;
    }

    const factor = Math.pow(1 + monthlyRate, months);
    const payment = principal * (monthlyRate * factor) / (factor - 1);
    
    return this.roundToTwoDecimals(payment);
  }

  private roundToTwoDecimals(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private mapToDto(schedule: any): LoanScheduleItemDto {
    return {
      id: schedule.id,
      installmentNo: schedule.installmentNo,
      dueDate: schedule.dueDate,
      principalDue: Number(schedule.principalDue),
      interestDue: Number(schedule.interestDue),
      penaltyDue: Number(schedule.penaltyDue),
      principalPaid: Number(schedule.principalPaid),
      interestPaid: Number(schedule.interestPaid),
      penaltyPaid: Number(schedule.penaltyPaid),
      totalDue: Number(schedule.totalDue),
      totalPaid: Number(schedule.totalPaid),
      balanceAfter: Number(schedule.balanceAfter),
      status: schedule.status,
      paidAt: schedule.paidAt ?? undefined,
    };
  }
}
