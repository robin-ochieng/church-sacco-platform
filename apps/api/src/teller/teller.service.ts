import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, TransactionStatus, TransactionType } from '@prisma/client';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { PrismaService } from '../prisma/prisma.service';
import { GetTellerSummaryQueryDto } from './dto/get-teller-summary.dto';
import {
    CloseDayDryRunDto,
    TellerSummaryReceiptDto,
    TellerSummaryResponseDto,
    TellerSummaryTopMemberDto,
    TellerSummaryTotalsDto,
} from './dto/teller-summary-response.dto';

const DEPOSIT_TYPES: TransactionType[] = [
  TransactionType.SAVINGS_DEPOSIT,
  TransactionType.SHARES_DEPOSIT,
  TransactionType.SPECIAL_CONTRIBUTION,
];

const OUTFLOW_TYPES: TransactionType[] = [
  TransactionType.WITHDRAWAL,
  TransactionType.MAINTENANCE_FEE,
  TransactionType.MONTHLY_CHARGE,
  TransactionType.ADJUSTMENT,
];

interface DateRange {
  start: Date;
  end: Date;
}

@Injectable()
export class TellerService {
  private readonly logger = new Logger(TellerService.name);
  private readonly bankTimeZone: string;

  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {
    this.bankTimeZone = this.config.get<string>('BANK_TIMEZONE') ?? 'Africa/Nairobi';
  }

  async getSummary(query: GetTellerSummaryQueryDto): Promise<TellerSummaryResponseDto> {
    const requestedDate = query.date ?? this.getTodayIso();
    const limit = Math.min(query.limit ?? 10, 50);
    const range = this.resolveRange(requestedDate);

    const [totals, topMembers, recentReceipts, closeDayDryRun] = await Promise.all([
      this.computeTotals(range),
      this.computeTopMembers(range),
      this.fetchRecentReceipts(range, limit),
      this.computeCloseDayDryRun(range),
    ]);

    return {
      date: requestedDate,
      meta: {
        generatedAt: new Date().toISOString(),
      },
      totals,
      topMembers,
      recentReceipts,
      closeDayDryRun,
    };
  }

  private async computeTotals(range: DateRange): Promise<TellerSummaryTotalsDto> {
    const where = this.baseWhere(range, {
      type: { in: DEPOSIT_TYPES },
      status: TransactionStatus.POSTED,
    });

    const [aggregate, uniqueMembers] = await Promise.all([
      this.prisma.transaction.aggregate({
        _count: { _all: true },
        _sum: { amount: true },
        where,
      }),
      this.countUniqueMembers(where),
    ]);

    return {
      depositCount: aggregate._count._all ?? 0,
      depositAmount: this.formatDecimal(aggregate._sum.amount),
      uniqueMembers,
    };
  }

  private async computeTopMembers(range: DateRange): Promise<TellerSummaryTopMemberDto[]> {
    const where = this.baseWhere(range, {
      type: { in: DEPOSIT_TYPES },
      status: TransactionStatus.POSTED,
    });

    const topGroups = await this.prisma.transaction.groupBy({
      where,
      by: ['memberId'],
      _sum: { amount: true },
      _count: { _all: true },
      orderBy: {
        _sum: {
          amount: 'desc',
        },
      },
      take: 5,
    });

    if (topGroups.length === 0) {
      return [];
    }

    const memberIds = topGroups.map((group) => group.memberId);

    const [members, lastReceipts] = await Promise.all([
      this.prisma.member.findMany({
        where: { id: { in: memberIds } },
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      }),
      this.prisma.transaction.findMany({
        where: {
          ...where,
          memberId: { in: memberIds },
        },
        select: {
          memberId: true,
          receiptNumber: true,
          createdAt: true,
        },
        orderBy: [
          { memberId: 'asc' },
          { valueDate: 'desc' },
          { createdAt: 'desc' },
        ],
      }),
    ]);

    const memberLookup = new Map(members.map((member) => [member.id, member]));
    const latestReceiptLookup = new Map<string, { receiptNumber: string | null; createdAt: Date }>();
    for (const receipt of lastReceipts) {
      if (!latestReceiptLookup.has(receipt.memberId)) {
        latestReceiptLookup.set(receipt.memberId, {
          receiptNumber: receipt.receiptNumber,
          createdAt: receipt.createdAt,
        });
      }
    }

    return topGroups.map((group) => {
      const member = memberLookup.get(group.memberId);
      return {
        memberId: group.memberId,
        fullName: member ? `${member.firstName} ${member.lastName}`.trim() : 'Unknown Member',
        avatarUrl: undefined,
        receiptCount: group._count._all ?? 0,
        totalDeposits: this.formatDecimal(group._sum.amount),
        lastReceiptId: latestReceiptLookup.get(group.memberId)?.receiptNumber ?? 'N/A',
        lastReceiptTimestamp: latestReceiptLookup.get(group.memberId)?.createdAt?.toISOString() ?? '',
      };
    });
  }

  private async fetchRecentReceipts(range: DateRange, limit: number): Promise<TellerSummaryReceiptDto[]> {
    const where = this.baseWhere(range, {
      type: { in: DEPOSIT_TYPES },
    });

    const transactions = await this.prisma.transaction.findMany({
      where,
      orderBy: [{ valueDate: 'desc' }, { createdAt: 'desc' }],
      take: limit,
      select: {
        id: true,
        receiptNumber: true,
        amount: true,
        channel: true,
        status: true,
        createdAt: true,
        member: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        cashier: {
          select: {
            email: true,
          },
        },
      },
    });

    return transactions.map((tx) => ({
      id: tx.receiptNumber ?? tx.id,
      memberName: `${tx.member.firstName} ${tx.member.lastName}`.trim(),
      amount: this.formatDecimal(tx.amount),
      method: tx.channel,
      tellerName: tx.cashier?.email ?? 'System Generated',
      status: tx.status,
      timestamp: tx.createdAt.toISOString(),
    }));
  }

  private async computeCloseDayDryRun(range: DateRange): Promise<CloseDayDryRunDto> {
    const postedWhere = this.baseWhere(range, {
      status: TransactionStatus.POSTED,
    });

    const [depositSum, outflowSum, pendingCount, latestReceipt] = await Promise.all([
      this.prisma.transaction.aggregate({
        _sum: { amount: true },
        where: {
          ...postedWhere,
          type: { in: DEPOSIT_TYPES },
        },
      }),
      this.prisma.transaction.aggregate({
        _sum: { amount: true },
        where: {
          ...postedWhere,
          type: { in: OUTFLOW_TYPES },
        },
      }),
      this.prisma.transaction.count({
        where: this.baseWhere(range, {
          status: TransactionStatus.PENDING,
        }),
      }),
      this.prisma.transaction.findFirst({
        where: {
          ...postedWhere,
          type: { in: DEPOSIT_TYPES },
        },
        orderBy: [{ valueDate: 'desc' }, { createdAt: 'desc' }],
        select: {
          createdAt: true,
          receiptNumber: true,
        },
      }),
    ]);

    const depositDecimal = depositSum._sum.amount ?? new Prisma.Decimal(0);
    const outflowDecimal = outflowSum._sum.amount ?? new Prisma.Decimal(0);
    const projectedNetCash = depositDecimal.minus(outflowDecimal);

    const warnings: string[] = [];
    if (pendingCount > 0) {
      warnings.push(`${pendingCount} pending transaction${pendingCount > 1 ? 's' : ''} still need posting.`);
    }
    if (depositDecimal.equals(0)) {
      warnings.push('No posted deposits recorded for the selected date.');
    }

    return {
      eligible: warnings.length === 0,
      projectedNetCash: this.formatDecimal(projectedNetCash),
      warnings,
      lastReceiptTimestamp: latestReceipt?.createdAt?.toISOString() ?? '',
    };
  }

  private async countUniqueMembers(where: Prisma.TransactionWhereInput) {
    const result = await this.prisma.transaction.groupBy({
      where,
      by: ['memberId'],
    });
    return result.length;
  }

  private formatDecimal(value?: Prisma.Decimal | null): string {
    if (!value) {
      return '0.00';
    }
    return value.toFixed(2);
  }

  private baseWhere(
    range: DateRange,
    overrides: Prisma.TransactionWhereInput = {},
  ): Prisma.TransactionWhereInput {
    return {
      valueDate: {
        gte: range.start,
        lte: range.end,
      },
      ...overrides,
    };
  }

  private resolveRange(dateIso: string): DateRange {
    const start = fromZonedTime(`${dateIso}T00:00:00`, this.bankTimeZone);
    const end = fromZonedTime(`${dateIso}T23:59:59.999`, this.bankTimeZone);
    return { start, end };
  }

  private getTodayIso(): string {
    return formatInTimeZone(new Date(), this.bankTimeZone, 'yyyy-MM-dd');
  }
}
