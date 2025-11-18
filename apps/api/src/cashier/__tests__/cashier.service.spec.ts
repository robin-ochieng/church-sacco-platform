import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma, TransactionChannel, TransactionStatus, TransactionType, UserRole } from '@prisma/client';
import { AuthenticatedUser } from '../../auth/types';
import { PrismaService } from '../../prisma/prisma.service';
import { CashierService } from '../cashier.service';

describe('CashierService', () => {
  let service: CashierService;
  let prisma: jest.Mocked<PrismaService>;

  const mockUser: AuthenticatedUser = {
    sub: 'cashier-user-id',
    email: 'cashier@test.com',
    role: UserRole.CLERK,
    branchId: 'branch-001',
  };

  const mockMember = {
    id: 'member-123',
    memberNumber: 'MEM-001',
    firstName: 'John',
    lastName: 'Doe',
    branchId: 'branch-001',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CashierService,
        {
          provide: PrismaService,
          useValue: {
            member: {
              findUnique: jest.fn(),
            },
            transaction: {
              create: jest.fn(),
              findFirst: jest.fn(),
              findUnique: jest.fn(),
              findMany: jest.fn(),
            },
            $transaction: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<CashierService>(CashierService);
    prisma = module.get(PrismaService) as jest.Mocked<PrismaService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createDeposit', () => {
    it('should successfully create a deposit with member ID', async () => {
      const dto = {
        memberId: 'member-123',
        amount: 1000.50,
        transactionType: TransactionType.SAVINGS_DEPOSIT,
        channel: TransactionChannel.CASH,
        narration: 'Monthly savings deposit',
      };

      const mockTransaction = {
        id: 'txn-001',
        memberId: mockMember.id,
        cashierId: mockUser.sub,
        branchId: 'branch-001',
        amount: new Prisma.Decimal(1000.50),
        type: TransactionType.SAVINGS_DEPOSIT,
        channel: TransactionChannel.CASH,
        status: TransactionStatus.POSTED,
        reference: null,
        narration: 'Monthly savings deposit',
        receiptNumber: 'RCP-B001-20251116-00001',
        valueDate: new Date('2025-11-16'),
        balanceAfter: new Prisma.Decimal(1000.50),
        metadata: null,
        createdAt: new Date('2025-11-16T10:00:00Z'),
        updatedAt: new Date('2025-11-16T10:00:00Z'),
        member: mockMember,
      };

      prisma.member.findUnique.mockResolvedValue(mockMember as any);
      prisma.$transaction.mockImplementation(async (callback) => {
        return callback({
          transaction: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue(mockTransaction),
          },
        } as any);
      });

      const result = await service.createDeposit(dto, mockUser);

      expect(result).toEqual({
        id: 'txn-001',
        member: {
          id: mockMember.id,
          memberNumber: mockMember.memberNumber,
          name: 'John Doe',
          branchId: mockMember.branchId,
        },
        amount: mockTransaction.amount,
        type: TransactionType.SAVINGS_DEPOSIT,
        channel: TransactionChannel.CASH,
        status: TransactionStatus.POSTED,
        reference: null,
        narration: 'Monthly savings deposit',
        receiptNumber: 'RCP-B001-20251116-00001',
        valueDate: mockTransaction.valueDate,
        balanceAfter: mockTransaction.balanceAfter,
        branchId: 'branch-001',
        createdAt: mockTransaction.createdAt,
        cashierId: mockUser.sub,
      });

      expect(prisma.member.findUnique).toHaveBeenCalledWith({
        where: { id: 'member-123' },
        select: {
          id: true,
          memberNumber: true,
          branchId: true,
          firstName: true,
          lastName: true,
        },
      });
    });

    it('should successfully create a deposit with member number', async () => {
      const dto = {
        memberNumber: 'MEM-001',
        amount: 500.00,
        transactionType: TransactionType.SHARES_DEPOSIT,
        channel: TransactionChannel.MOBILE_MONEY,
        reference: 'MPESA-XYZ123',
      };

      const mockTransaction = {
        id: 'txn-002',
        memberId: mockMember.id,
        cashierId: mockUser.sub,
        branchId: 'branch-001',
        amount: new Prisma.Decimal(500.00),
        type: TransactionType.SHARES_DEPOSIT,
        channel: TransactionChannel.MOBILE_MONEY,
        status: TransactionStatus.POSTED,
        reference: 'MPESA-XYZ123',
        narration: null,
        receiptNumber: 'RCP-B001-20251116-00002',
        valueDate: new Date('2025-11-16'),
        balanceAfter: new Prisma.Decimal(500.00),
        metadata: null,
        createdAt: new Date('2025-11-16T11:00:00Z'),
        updatedAt: new Date('2025-11-16T11:00:00Z'),
        member: mockMember,
      };

      prisma.member.findUnique.mockResolvedValue(mockMember as any);
      prisma.$transaction.mockImplementation(async (callback) => {
        return callback({
          transaction: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue(mockTransaction),
          },
        } as any);
      });

      const result = await service.createDeposit(dto, mockUser);

      expect(result.reference).toBe('MPESA-XYZ123');
      expect(result.channel).toBe(TransactionChannel.MOBILE_MONEY);
      expect(prisma.member.findUnique).toHaveBeenCalledWith({
        where: { memberNumber: 'MEM-001' },
        select: {
          id: true,
          memberNumber: true,
          branchId: true,
          firstName: true,
          lastName: true,
        },
      });
    });

    it('should correctly calculate balance after with previous balance', async () => {
      const dto = {
        memberId: 'member-123',
        amount: 250.75,
        transactionType: TransactionType.SAVINGS_DEPOSIT,
        channel: TransactionChannel.CASH,
      };

      const previousTransaction = {
        id: 'prev-txn',
        balanceAfter: new Prisma.Decimal(1000.00),
        valueDate: new Date('2025-11-15'),
        createdAt: new Date('2025-11-15T10:00:00Z'),
      };

      prisma.member.findUnique.mockResolvedValue(mockMember as any);
      prisma.$transaction.mockImplementation(async (callback) => {
        return callback({
          transaction: {
            findFirst: jest.fn().mockResolvedValue(previousTransaction),
            create: jest.fn().mockImplementation((data) => {
              return Promise.resolve({
                ...data.data,
                id: 'txn-003',
                receiptNumber: 'RCP-B001-20251116-00003',
                createdAt: new Date(),
                updatedAt: new Date(),
                member: mockMember,
              });
            }),
          },
        } as any);
      });

      const result = await service.createDeposit(dto, mockUser);

      expect(result.balanceAfter).toEqual(new Prisma.Decimal(1250.75));
    });

    it('should throw BadRequestException when neither memberId nor memberNumber provided', async () => {
      const dto = {
        amount: 100,
        transactionType: TransactionType.SAVINGS_DEPOSIT,
        channel: TransactionChannel.CASH,
      } as any;

      await expect(service.createDeposit(dto, mockUser)).rejects.toThrow(
        new BadRequestException('Provide either memberId or memberNumber'),
      );
    });

    it('should throw BadRequestException for non-deposit transaction types', async () => {
      const dto = {
        memberId: 'member-123',
        amount: 100,
        transactionType: TransactionType.WITHDRAWAL,
        channel: TransactionChannel.CASH,
      };

      await expect(service.createDeposit(dto, mockUser)).rejects.toThrow(
        new BadRequestException('Only deposit transaction types are supported in this endpoint'),
      );
    });

    it('should throw NotFoundException when member not found', async () => {
      const dto = {
        memberId: 'non-existent',
        amount: 100,
        transactionType: TransactionType.SAVINGS_DEPOSIT,
        channel: TransactionChannel.CASH,
      };

      prisma.member.findUnique.mockResolvedValue(null);

      await expect(service.createDeposit(dto, mockUser)).rejects.toThrow(
        new NotFoundException('Member not found'),
      );
    });

    it('should throw ForbiddenException when clerk tries to access different branch', async () => {
      const dto = {
        memberId: 'member-123',
        amount: 100,
        transactionType: TransactionType.SAVINGS_DEPOSIT,
        channel: TransactionChannel.CASH,
      };

      const differentBranchMember = {
        ...mockMember,
        branchId: 'branch-002',
      };

      prisma.member.findUnique.mockResolvedValue(differentBranchMember as any);

      await expect(service.createDeposit(dto, mockUser)).rejects.toThrow(
        new ForbiddenException('You are not authorized to access this branch'),
      );
    });

    it('should allow admin to create deposit for any branch', async () => {
      const adminUser: AuthenticatedUser = {
        sub: 'admin-user-id',
        email: 'admin@test.com',
        role: UserRole.ADMIN,
        branchId: 'branch-001',
      };

      const dto = {
        memberId: 'member-123',
        amount: 100,
        transactionType: TransactionType.SAVINGS_DEPOSIT,
        channel: TransactionChannel.CASH,
      };

      const differentBranchMember = {
        ...mockMember,
        branchId: 'branch-002',
      };

      const mockTransaction = {
        id: 'txn-004',
        memberId: differentBranchMember.id,
        cashierId: adminUser.sub,
        branchId: 'branch-002',
        amount: new Prisma.Decimal(100),
        type: TransactionType.SAVINGS_DEPOSIT,
        channel: TransactionChannel.CASH,
        status: TransactionStatus.POSTED,
        reference: null,
        narration: null,
        receiptNumber: 'RCP-B002-20251116-00001',
        valueDate: new Date(),
        balanceAfter: new Prisma.Decimal(100),
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        member: differentBranchMember,
      };

      prisma.member.findUnique.mockResolvedValue(differentBranchMember as any);
      prisma.$transaction.mockImplementation(async (callback) => {
        return callback({
          transaction: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue(mockTransaction),
          },
        } as any);
      });

      const result = await service.createDeposit(dto, adminUser);

      expect(result.branchId).toBe('branch-002');
      expect(result).toBeDefined();
    });

    it('should handle amount with 2 decimal places correctly', async () => {
      const dto = {
        memberId: 'member-123',
        amount: 99.99,
        transactionType: TransactionType.SPECIAL_CONTRIBUTION,
        channel: TransactionChannel.CASH,
      };

      prisma.member.findUnique.mockResolvedValue(mockMember as any);
      prisma.$transaction.mockImplementation(async (callback) => {
        return callback({
          transaction: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockImplementation((data) => {
              return Promise.resolve({
                ...data.data,
                id: 'txn-005',
                receiptNumber: 'RCP-B001-20251116-00005',
                createdAt: new Date(),
                updatedAt: new Date(),
                member: mockMember,
              });
            }),
          },
        } as any);
      });

      const result = await service.createDeposit(dto, mockUser);

      expect(result.amount).toEqual(new Prisma.Decimal(99.99));
    });

    it('should use custom valueDate when provided', async () => {
      const customDate = '2025-11-10';
      const dto = {
        memberId: 'member-123',
        amount: 100,
        transactionType: TransactionType.SAVINGS_DEPOSIT,
        channel: TransactionChannel.CASH,
        valueDate: customDate,
      };

      prisma.member.findUnique.mockResolvedValue(mockMember as any);
      prisma.$transaction.mockImplementation(async (callback) => {
        return callback({
          transaction: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockImplementation((data) => {
              return Promise.resolve({
                ...data.data,
                id: 'txn-006',
                receiptNumber: 'RCP-B001-20251116-00006',
                createdAt: new Date(),
                updatedAt: new Date(),
                member: mockMember,
              });
            }),
          },
        } as any);
      });

      const result = await service.createDeposit(dto, mockUser);

      expect(result.valueDate).toEqual(new Date(customDate));
    });
  });

  describe('getDeposit', () => {
    it('should retrieve a deposit by ID', async () => {
      const mockTransaction = {
        id: 'txn-001',
        memberId: mockMember.id,
        cashierId: mockUser.sub,
        branchId: 'branch-001',
        amount: new Prisma.Decimal(500),
        type: TransactionType.SAVINGS_DEPOSIT,
        channel: TransactionChannel.CASH,
        status: TransactionStatus.POSTED,
        reference: null,
        narration: null,
        receiptNumber: 'RCP-B001-20251116-00001',
        valueDate: new Date(),
        balanceAfter: new Prisma.Decimal(500),
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        member: mockMember,
      };

      prisma.transaction.findUnique.mockResolvedValue(mockTransaction as any);

      const result = await service.getDeposit('txn-001', mockUser);

      expect(result).toBeDefined();
      expect(result.id).toBe('txn-001');
      expect(result.receiptNumber).toBe('RCP-B001-20251116-00001');
    });

    it('should throw NotFoundException when transaction not found', async () => {
      prisma.transaction.findUnique.mockResolvedValue(null);

      await expect(service.getDeposit('non-existent', mockUser)).rejects.toThrow(
        new NotFoundException('Transaction not found'),
      );
    });

    it('should throw ForbiddenException when accessing transaction from different branch', async () => {
      const mockTransaction = {
        id: 'txn-001',
        branchId: 'branch-002',
        member: mockMember,
      };

      prisma.transaction.findUnique.mockResolvedValue(mockTransaction as any);

      await expect(service.getDeposit('txn-001', mockUser)).rejects.toThrow(
        new ForbiddenException('You are not authorized to access this branch'),
      );
    });
  });

  describe('listDeposits', () => {
    it('should list deposits with default pagination', async () => {
      const mockTransactions = [
        {
          id: 'txn-001',
          memberId: mockMember.id,
          cashierId: mockUser.sub,
          branchId: 'branch-001',
          amount: new Prisma.Decimal(500),
          type: TransactionType.SAVINGS_DEPOSIT,
          channel: TransactionChannel.CASH,
          status: TransactionStatus.POSTED,
          reference: null,
          narration: null,
          receiptNumber: 'RCP-B001-20251116-00001',
          valueDate: new Date(),
          balanceAfter: new Prisma.Decimal(500),
          metadata: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          member: mockMember,
        },
      ];

      prisma.transaction.findMany.mockResolvedValue(mockTransactions as any);

      const result = await service.listDeposits({}, mockUser);

      expect(result.data).toHaveLength(1);
      expect(result.meta.count).toBe(1);
      expect(result.meta.limit).toBe(20);
    });

    it('should filter deposits by transaction type', async () => {
      const filters = {
        transactionType: TransactionType.SHARES_DEPOSIT,
      };

      prisma.transaction.findMany.mockResolvedValue([]);

      await service.listDeposits(filters, mockUser);

      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: TransactionType.SHARES_DEPOSIT,
          }),
        }),
      );
    });

    it('should filter deposits by date range', async () => {
      const filters = {
        fromDate: '2025-11-01',
        toDate: '2025-11-16',
      };

      prisma.transaction.findMany.mockResolvedValue([]);

      await service.listDeposits(filters, mockUser);

      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            valueDate: {
              gte: new Date('2025-11-01'),
              lte: new Date('2025-11-16'),
            },
          }),
        }),
      );
    });

    it('should respect custom limit', async () => {
      const filters = {
        limit: 50,
      };

      prisma.transaction.findMany.mockResolvedValue([]);

      const result = await service.listDeposits(filters, mockUser);

      expect(result.meta.limit).toBe(50);
      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
        }),
      );
    });

    it('should filter by member ID', async () => {
      const filters = {
        memberId: 'member-123',
      };

      prisma.member.findUnique.mockResolvedValue(mockMember as any);
      prisma.transaction.findMany.mockResolvedValue([]);

      await service.listDeposits(filters, mockUser);

      expect(prisma.member.findUnique).toHaveBeenCalled();
      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            memberId: 'member-123',
          }),
        }),
      );
    });
  });
});
