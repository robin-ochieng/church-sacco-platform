import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TransactionStatus, TransactionType, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/types';
import { CreateDepositDto } from './dto/create-deposit.dto';
import { FilterDepositsDto } from './dto/filter-deposits.dto';

const CREDIT_TRANSACTION_TYPES = new Set<TransactionType>([
  TransactionType.SAVINGS_DEPOSIT,
  TransactionType.SHARES_DEPOSIT,
  TransactionType.SPECIAL_CONTRIBUTION,
]);

const ADMIN_ROLES: UserRole[] = [UserRole.ADMIN, UserRole.CHAIRMAN];

const memberSummarySelection = {
  id: true,
  memberNumber: true,
  firstName: true,
  lastName: true,
  branchId: true,
} as const;

type TransactionWithMember = Prisma.TransactionGetPayload<{
  include: {
    member: {
      select: typeof memberSummarySelection;
    };
  };
}>;

@Injectable()
export class CashierService {
  constructor(private readonly prisma: PrismaService) {}

  async createDeposit(dto: CreateDepositDto, user: AuthenticatedUser) {
    if (!dto.memberId && !dto.memberNumber) {
      throw new BadRequestException('Provide either memberId or memberNumber');
    }

    if (!CREDIT_TRANSACTION_TYPES.has(dto.transactionType)) {
      throw new BadRequestException('Only deposit transaction types are supported in this endpoint');
    }

    const member = await this.lookupMember(dto.memberId, dto.memberNumber);
    if (!member) {
      throw new NotFoundException('Member not found');
    }

    this.assertBranchAccess(user, member.branchId);

    const valueDate = dto.valueDate ? new Date(dto.valueDate) : new Date();
    const metadata = dto.metadata as Prisma.JsonObject | undefined;

    const transaction = await this.prisma.$transaction(async (tx) => {
      const latest = await tx.transaction.findFirst({
        where: { memberId: member.id },
        orderBy: [{ valueDate: 'desc' }, { createdAt: 'desc' }],
      });

      const previousBalance = latest?.balanceAfter ?? new Prisma.Decimal(0);
      const amountDecimal = new Prisma.Decimal(dto.amount);
      const balanceAfter = previousBalance.plus(amountDecimal);

      return tx.transaction.create({
        data: {
          memberId: member.id,
          cashierId: user.sub,
          branchId: dto.branchId ?? member.branchId ?? user.branchId ?? null,
          amount: amountDecimal,
          type: dto.transactionType,
          channel: dto.channel,
          status: TransactionStatus.POSTED,
          reference: dto.reference,
          narration: dto.narration,
          valueDate,
          balanceAfter,
          metadata,
        },
        include: {
          member: {
            select: memberSummarySelection,
          },
        },
      });
    });

    return this.mapTransaction(transaction);
  }

  async getDeposit(id: string, user: AuthenticatedUser) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id },
      include: {
        member: {
          select: memberSummarySelection,
        },
      },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    this.assertBranchAccess(user, transaction.branchId);
    return this.mapTransaction(transaction);
  }

  async listDeposits(filters: FilterDepositsDto, user: AuthenticatedUser) {
    const where: Prisma.TransactionWhereInput = {};

    if (filters.transactionType) {
      where.type = filters.transactionType;
    }

    if (filters.channel) {
      where.channel = filters.channel;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.fromDate || filters.toDate) {
      where.valueDate = {};
      if (filters.fromDate) {
        where.valueDate.gte = new Date(filters.fromDate);
      }
      if (filters.toDate) {
        where.valueDate.lte = new Date(filters.toDate);
      }
    }

    if (filters.memberId || filters.memberNumber) {
      const member = await this.lookupMember(filters.memberId, filters.memberNumber);
      if (!member) {
        throw new NotFoundException('Member not found');
      }
      this.assertBranchAccess(user, member.branchId);
      where.memberId = member.id;
    }

    if (filters.branchId) {
      this.assertBranchAccess(user, filters.branchId);
      where.branchId = filters.branchId;
    } else if (!this.isAdmin(user)) {
      this.assertBranchAccess(user, user.branchId);
      where.branchId = user.branchId ?? undefined;
    }

    const limit = filters.limit ?? 20;

    const transactions = await this.prisma.transaction.findMany({
      where,
      orderBy: [{ valueDate: 'desc' }, { createdAt: 'desc' }],
      take: limit,
      include: {
        member: {
          select: memberSummarySelection,
        },
      },
    });

    return {
      data: transactions.map((tx) => this.mapTransaction(tx)),
      meta: {
        count: transactions.length,
        limit,
      },
    };
  }

  private async lookupMember(memberId?: string, memberNumber?: string) {
    if (memberId) {
      return this.prisma.member.findUnique({
        where: { id: memberId },
        select: { id: true, memberNumber: true, branchId: true, firstName: true, lastName: true },
      });
    }

    if (memberNumber) {
      return this.prisma.member.findUnique({
        where: { memberNumber: memberNumber },
        select: { id: true, memberNumber: true, branchId: true, firstName: true, lastName: true },
      });
    }

    return null;
  }

  private assertBranchAccess(user: AuthenticatedUser, branchId?: string | null) {
    if (this.isAdmin(user)) {
      return;
    }

    if (!branchId || !user.branchId || branchId !== user.branchId) {
      throw new ForbiddenException('You are not authorized to access this branch');
    }
  }

  private isAdmin(user: AuthenticatedUser) {
    return ADMIN_ROLES.includes(user.role);
  }

  private mapTransaction(transaction: TransactionWithMember) {
    return {
      id: transaction.id,
      member: {
        id: transaction.member.id,
        memberNumber: transaction.member.memberNumber,
        name: `${transaction.member.firstName} ${transaction.member.lastName}`.trim(),
        branchId: transaction.member.branchId,
      },
      amount: transaction.amount,
      type: transaction.type,
      channel: transaction.channel,
      status: transaction.status,
      reference: transaction.reference,
      narration: transaction.narration,
      receiptNumber: transaction.receiptNumber,
      valueDate: transaction.valueDate,
      balanceAfter: transaction.balanceAfter,
      branchId: transaction.branchId,
      createdAt: transaction.createdAt,
      cashierId: transaction.cashierId,
    };
  }
}
