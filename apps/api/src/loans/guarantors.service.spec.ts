import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { GuarantorStatus, LoanStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GuarantorApprovalAction } from './dto/approve-guarantor.dto';
import { GuarantorsService } from './guarantors.service';

describe('GuarantorsService', () => {
  let service: GuarantorsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    loan: {
      findUnique: jest.fn(),
    },
    member: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    guarantor: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GuarantorsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<GuarantorsService>(GuarantorsService);
    prisma = module.get<PrismaService>(PrismaService);

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('addGuarantor', () => {
    const mockLoan = {
      id: 'loan-1',
      memberId: 'member-applicant',
      amount: 100000,
      status: LoanStatus.DRAFT,
      guarantors: [],
      member: { id: 'member-applicant', firstName: 'John' },
    };

    const createMockGuarantorMember = (
      joiningDate: Date,
      sharesValue: number,
      existingExposure: number = 0
    ) => ({
      id: 'member-guarantor',
      firstName: 'Jane',
      lastName: 'Doe',
      memberNumber: 'ATSC-2020-0001',
      joiningDate,
      membershipStatus: 'ACTIVE',
      shares: [{ totalValue: sharesValue }],
      guaranteesGiven: existingExposure > 0 ? [{ amountGuaranteed: existingExposure }] : [],
    });

    it('should successfully add a guarantor when all conditions are met', async () => {
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

      mockPrismaService.loan.findUnique.mockResolvedValue(mockLoan);
      mockPrismaService.member.findUnique.mockResolvedValue(
        createMockGuarantorMember(twoYearsAgo, 50000)
      );
      mockPrismaService.guarantor.create.mockResolvedValue({
        id: 'guarantor-1',
        loanId: 'loan-1',
        guarantorMemberId: 'member-guarantor',
        amountGuaranteed: 30000,
        status: GuarantorStatus.PENDING,
      });

      const result = await service.addGuarantor('loan-1', {
        guarantorMemberId: 'member-guarantor',
        amountGuaranteed: 30000,
      });

      expect(result.status).toBe(GuarantorStatus.PENDING);
      expect(mockPrismaService.guarantor.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            loanId: 'loan-1',
            guarantorMemberId: 'member-guarantor',
            amountGuaranteed: 30000,
            status: GuarantorStatus.PENDING,
          }),
        })
      );
    });

    it('should throw NotFoundException when loan not found', async () => {
      mockPrismaService.loan.findUnique.mockResolvedValue(null);

      await expect(
        service.addGuarantor('non-existent-loan', {
          guarantorMemberId: 'member-guarantor',
          amountGuaranteed: 30000,
        })
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when loan is already disbursed', async () => {
      mockPrismaService.loan.findUnique.mockResolvedValue({
        ...mockLoan,
        status: LoanStatus.DISBURSED,
      });

      await expect(
        service.addGuarantor('loan-1', {
          guarantorMemberId: 'member-guarantor',
          amountGuaranteed: 30000,
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when member tries to guarantee own loan', async () => {
      mockPrismaService.loan.findUnique.mockResolvedValue(mockLoan);

      await expect(
        service.addGuarantor('loan-1', {
          guarantorMemberId: 'member-applicant', // Same as loan.memberId
          amountGuaranteed: 30000,
        })
      ).rejects.toThrow(BadRequestException);
      expect(
        mockPrismaService.member.findUnique
      ).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when member is already a guarantor for this loan', async () => {
      mockPrismaService.loan.findUnique.mockResolvedValue({
        ...mockLoan,
        guarantors: [{ guarantorMemberId: 'member-guarantor' }],
      });

      await expect(
        service.addGuarantor('loan-1', {
          guarantorMemberId: 'member-guarantor',
          amountGuaranteed: 30000,
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when member has been a member for less than 12 months', async () => {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      mockPrismaService.loan.findUnique.mockResolvedValue(mockLoan);
      mockPrismaService.member.findUnique.mockResolvedValue(
        createMockGuarantorMember(sixMonthsAgo, 50000)
      );

      await expect(
        service.addGuarantor('loan-1', {
          guarantorMemberId: 'member-guarantor',
          amountGuaranteed: 30000,
        })
      ).rejects.toThrow('Guarantor must be a member for at least 12 months');
    });

    it('should throw BadRequestException when guarantor has insufficient share balance', async () => {
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

      mockPrismaService.loan.findUnique.mockResolvedValue(mockLoan);
      mockPrismaService.member.findUnique.mockResolvedValue(
        createMockGuarantorMember(twoYearsAgo, 20000) // Only 20000 shares
      );

      await expect(
        service.addGuarantor('loan-1', {
          guarantorMemberId: 'member-guarantor',
          amountGuaranteed: 30000, // Requesting 30000 guarantee
        })
      ).rejects.toThrow('Guarantor does not have sufficient share balance');
    });

    it('should throw BadRequestException when guarantor has existing exposure that limits capacity', async () => {
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

      mockPrismaService.loan.findUnique.mockResolvedValue(mockLoan);
      mockPrismaService.member.findUnique.mockResolvedValue(
        createMockGuarantorMember(twoYearsAgo, 50000, 40000) // 50k shares, 40k already guaranteed
      );

      await expect(
        service.addGuarantor('loan-1', {
          guarantorMemberId: 'member-guarantor',
          amountGuaranteed: 20000, // Only 10k available (50k - 40k)
        })
      ).rejects.toThrow('Guarantor does not have sufficient share balance');
    });

    it('should throw BadRequestException when total guaranteed exceeds loan amount', async () => {
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

      mockPrismaService.loan.findUnique.mockResolvedValue({
        ...mockLoan,
        amount: 50000,
        guarantors: [
          { guarantorMemberId: 'other-member', amountGuaranteed: 40000, status: GuarantorStatus.PENDING },
        ],
      });
      mockPrismaService.member.findUnique.mockResolvedValue(
        createMockGuarantorMember(twoYearsAgo, 50000)
      );

      await expect(
        service.addGuarantor('loan-1', {
          guarantorMemberId: 'member-guarantor',
          amountGuaranteed: 20000, // 40k + 20k = 60k > 50k loan amount
        })
      ).rejects.toThrow('Total guaranteed amount');
    });
  });

  describe('approveGuarantor', () => {
    const mockGuarantor = {
      id: 'guarantor-1',
      loanId: 'loan-1',
      guarantorMemberId: 'member-guarantor',
      amountGuaranteed: 30000,
      status: GuarantorStatus.PENDING,
      loan: { id: 'loan-1' },
      guarantorMember: { id: 'member-guarantor', firstName: 'Jane' },
    };

    it('should approve a guarantee with signature', async () => {
      mockPrismaService.guarantor.findUnique.mockResolvedValue(mockGuarantor);
      mockPrismaService.guarantor.update.mockResolvedValue({
        ...mockGuarantor,
        status: GuarantorStatus.APPROVED,
        signatureKey: 'signature-key-123',
        approvedAt: new Date(),
      });

      const result = await service.approveGuarantor('loan-1', 'guarantor-1', {
        action: GuarantorApprovalAction.APPROVE,
        signatureKey: 'signature-key-123',
      });

      expect(result.status).toBe(GuarantorStatus.APPROVED);
      expect(mockPrismaService.guarantor.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'guarantor-1' },
          data: expect.objectContaining({
            status: GuarantorStatus.APPROVED,
            signatureKey: 'signature-key-123',
          }),
        })
      );
    });

    it('should decline a guarantee with reason', async () => {
      mockPrismaService.guarantor.findUnique.mockResolvedValue(mockGuarantor);
      mockPrismaService.guarantor.update.mockResolvedValue({
        ...mockGuarantor,
        status: GuarantorStatus.DECLINED,
        declineReason: 'Cannot afford to guarantee at this time',
      });

      const result = await service.approveGuarantor('loan-1', 'guarantor-1', {
        action: GuarantorApprovalAction.DECLINE,
        declineReason: 'Cannot afford to guarantee at this time',
      });

      expect(result.status).toBe(GuarantorStatus.DECLINED);
    });

    it('should throw NotFoundException when guarantor not found', async () => {
      mockPrismaService.guarantor.findUnique.mockResolvedValue(null);

      await expect(
        service.approveGuarantor('loan-1', 'non-existent', {
          action: GuarantorApprovalAction.APPROVE,
          signatureKey: 'sig',
        })
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when guarantor does not belong to the loan', async () => {
      mockPrismaService.guarantor.findUnique.mockResolvedValue({
        ...mockGuarantor,
        loanId: 'different-loan',
      });

      await expect(
        service.approveGuarantor('loan-1', 'guarantor-1', {
          action: GuarantorApprovalAction.APPROVE,
          signatureKey: 'sig',
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when guarantee already processed', async () => {
      mockPrismaService.guarantor.findUnique.mockResolvedValue({
        ...mockGuarantor,
        status: GuarantorStatus.APPROVED,
      });

      await expect(
        service.approveGuarantor('loan-1', 'guarantor-1', {
          action: GuarantorApprovalAction.APPROVE,
          signatureKey: 'sig',
        })
      ).rejects.toThrow('already been');
    });

    it('should throw BadRequestException when approval without signature', async () => {
      mockPrismaService.guarantor.findUnique.mockResolvedValue(mockGuarantor);

      await expect(
        service.approveGuarantor('loan-1', 'guarantor-1', {
          action: GuarantorApprovalAction.APPROVE,
          // No signatureKey
        })
      ).rejects.toThrow('Signature is required');
    });

    it('should throw ForbiddenException when acting member is not the guarantor', async () => {
      mockPrismaService.guarantor.findUnique.mockResolvedValue(mockGuarantor);

      await expect(
        service.approveGuarantor('loan-1', 'guarantor-1', {
          action: GuarantorApprovalAction.APPROVE,
          signatureKey: 'sig',
        }, 'different-member') // Acting member ID is different from guarantor
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getEligibleGuarantors', () => {
    it('should return eligible members with available capacity', async () => {
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

      mockPrismaService.loan.findUnique.mockResolvedValue({
        id: 'loan-1',
        memberId: 'member-applicant',
      });

      mockPrismaService.member.findMany.mockResolvedValue([
        {
          id: 'member-1',
          firstName: 'Jane',
          lastName: 'Doe',
          memberNumber: 'ATSC-2020-0001',
          shares: [{ totalValue: 50000 }],
          guaranteesGiven: [{ amountGuaranteed: 10000 }],
        },
        {
          id: 'member-2',
          firstName: 'Bob',
          lastName: 'Smith',
          memberNumber: 'ATSC-2020-0002',
          shares: [{ totalValue: 30000 }],
          guaranteesGiven: [],
        },
      ]);

      const result = await service.getEligibleGuarantors('loan-1');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(expect.objectContaining({
        id: 'member-1',
        totalSharesValue: 50000,
        existingExposure: 10000,
        availableCapacity: 40000,
        isEligible: true,
      }));
      expect(result[1]).toEqual(expect.objectContaining({
        id: 'member-2',
        availableCapacity: 30000,
      }));
    });

    it('should filter members with search query', async () => {
      mockPrismaService.loan.findUnique.mockResolvedValue({
        id: 'loan-1',
        memberId: 'member-applicant',
      });
      mockPrismaService.member.findMany.mockResolvedValue([]);

      await service.getEligibleGuarantors('loan-1', 'Jane');

      expect(mockPrismaService.member.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { firstName: { contains: 'Jane', mode: 'insensitive' } },
            ]),
          }),
        })
      );
    });
  });

  describe('getGuarantorExposure', () => {
    it('should return exposure summary for a member', async () => {
      mockPrismaService.guarantor.findMany.mockResolvedValue([
        {
          id: 'g1',
          amountGuaranteed: 20000,
          status: GuarantorStatus.APPROVED,
          loan: {
            id: 'loan-1',
            loanNumber: 'LN-2024-001',
            amount: 50000,
            status: LoanStatus.ACTIVE,
            member: { firstName: 'John', lastName: 'Doe', memberNumber: 'M001' },
          },
        },
        {
          id: 'g2',
          amountGuaranteed: 15000,
          status: GuarantorStatus.PENDING,
          loan: {
            id: 'loan-2',
            loanNumber: 'LN-2024-002',
            amount: 30000,
            status: LoanStatus.SUBMITTED,
            member: { firstName: 'Jane', lastName: 'Smith', memberNumber: 'M002' },
          },
        },
      ]);

      const result = await service.getGuarantorExposure('member-guarantor');

      expect(result.totalExposure).toBe(35000);
      expect(result.activeGuarantees).toBe(2);
      expect(result.guarantees).toHaveLength(2);
    });
  });

  describe('removeGuarantor', () => {
    it('should remove a pending guarantor', async () => {
      mockPrismaService.guarantor.findUnique.mockResolvedValue({
        id: 'guarantor-1',
        loanId: 'loan-1',
        status: GuarantorStatus.PENDING,
      });
      mockPrismaService.guarantor.delete.mockResolvedValue({
        id: 'guarantor-1',
      });

      const result = await service.removeGuarantor('loan-1', 'guarantor-1');

      expect(result.id).toBe('guarantor-1');
    });

    it('should throw BadRequestException when trying to remove non-pending guarantor', async () => {
      mockPrismaService.guarantor.findUnique.mockResolvedValue({
        id: 'guarantor-1',
        loanId: 'loan-1',
        status: GuarantorStatus.APPROVED,
      });

      await expect(
        service.removeGuarantor('loan-1', 'guarantor-1')
      ).rejects.toThrow('Can only remove pending guarantors');
    });
  });
});
