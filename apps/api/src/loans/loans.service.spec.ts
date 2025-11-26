import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLoanDto, DisbursementMode } from './dto/create-loan.dto';
import { LoansService } from './loans.service';

describe('LoansService', () => {
  let service: LoansService;
  let prisma: PrismaService;

  const mockPrismaService = {
    member: {
      findUnique: jest.fn(),
    },
    loan: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    transaction: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  mockPrismaService.$transaction.mockImplementation((cb) => cb(mockPrismaService));

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoansService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<LoansService>(LoansService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const validDto: CreateLoanDto = {
      memberId: 'member-1',
      loanAmount: 50000,
      purpose: 'Business',
      repaymentMonths: 12,
      monthlyIncome: 20000,
      sourceIncome: 'Salary',
      disbursementMode: DisbursementMode.GROSS,
    };

    const mockMember = {
      id: 'member-1',
      savings: [
        { id: 's1', balance: 30000, startDate: new Date('2020-01-01') }, // > 6 months
      ],
      loans: [],
    };

    it('should create a loan if eligible', async () => {
      mockPrismaService.member.findUnique.mockResolvedValue(mockMember);
      mockPrismaService.loan.create.mockResolvedValue({ id: 'loan-1', ...validDto });

      const result = await service.create(validDto);

      expect(result).toBeDefined();
      expect(prisma.loan.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          amount: 50000,
          processingFee: 300,
          insuranceFee: 500, // 1% of 50000
        })
      }));
    });

    it('should reject if savings < 6 months', async () => {
      const recentMember = {
        ...mockMember,
        savings: [{ id: 's1', balance: 30000, startDate: new Date() }], // Today
      };
      mockPrismaService.member.findUnique.mockResolvedValue(recentMember);

      await expect(service.create(validDto)).rejects.toThrow(BadRequestException);
    });

    it('should reject if loan > 3x savings (existing loans)', async () => {
      const memberWithLoans = {
        ...mockMember,
        loans: [{ id: 'l1', status: 'ACTIVE' }],
        savings: [{ id: 's1', balance: 10000, startDate: new Date('2020-01-01') }],
      };
      // Max loan = 10000 * 3 = 30000. Requested 50000.
      mockPrismaService.member.findUnique.mockResolvedValue(memberWithLoans);

      await expect(service.create(validDto)).rejects.toThrow(BadRequestException);
    });

    it('should reject if loan > 2x savings (first loan)', async () => {
      const memberNoLoans = {
        ...mockMember,
        loans: [],
        savings: [{ id: 's1', balance: 10000, startDate: new Date('2020-01-01') }],
      };
      // Max loan = 10000 * 2 = 20000. Requested 50000.
      mockPrismaService.member.findUnique.mockResolvedValue(memberNoLoans);

      await expect(service.create(validDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should return all loans', async () => {
      const loans = [{ id: 'loan-1' }, { id: 'loan-2' }];
      mockPrismaService.loan.findMany.mockResolvedValue(loans);

      const result = await service.findAll();
      expect(result).toEqual(loans);
    });

    it('should filter by status', async () => {
      const loans = [{ id: 'loan-1', status: 'APPROVED' }];
      mockPrismaService.loan.findMany.mockResolvedValue(loans);

      const result = await service.findAll('APPROVED' as any);
      expect(result).toEqual(loans);
      expect(prisma.loan.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ status: 'APPROVED' })
      }));
    });
  });

  describe('updateStatus', () => {
    const mockLoan = {
      id: 'loan-1',
      status: 'SUBMITTED',
      amount: 50000,
      memberId: 'member-1',
      branchId: 'branch-1',
      loanNumber: 'LN-123',
      disbursementMode: 'GROSS',
      member: { savings: [] },
    };

    it('should approve loan', async () => {
      mockPrismaService.loan.findUnique.mockResolvedValue(mockLoan);
      mockPrismaService.loan.update.mockResolvedValue({ ...mockLoan, status: 'APPROVED' });

      const result = await service.updateStatus('loan-1', { status: 'APPROVED' as any });
      expect(result.status).toBe('APPROVED');
      expect(prisma.loan.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ status: 'APPROVED', approvalDate: expect.any(Date) })
      }));
    });

    it('should disburse loan and create transaction', async () => {
      const approvedLoan = { ...mockLoan, status: 'APPROVED' };
      mockPrismaService.loan.findUnique.mockResolvedValue(approvedLoan);
      mockPrismaService.$transaction.mockImplementation(async (cb) => cb(prisma));
      mockPrismaService.loan.update.mockResolvedValue({ ...approvedLoan, status: 'DISBURSED' });
      mockPrismaService.transaction.create.mockResolvedValue({});

      await service.updateStatus('loan-1', { status: 'DISBURSED' as any });

      expect(prisma.transaction.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          type: 'LOAN_DISBURSEMENT',
          amount: 50000,
        })
      }));
    });

    it('should fail to disburse if not approved', async () => {
      mockPrismaService.loan.findUnique.mockResolvedValue(mockLoan); // SUBMITTED

      await expect(service.updateStatus('loan-1', { status: 'DISBURSED' as any }))
        .rejects.toThrow(BadRequestException);
    });
  });
});
