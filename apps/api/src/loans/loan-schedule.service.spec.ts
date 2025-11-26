import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { LoanScheduleService } from './loan-schedule.service';

describe('LoanScheduleService', () => {
  let service: LoanScheduleService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    loan: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    loanSchedule: {
      findMany: jest.fn(),
      createMany: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  const mockLoan = {
    id: 'loan-1',
    memberId: 'member-1',
    loanNumber: 'LN-20241126-0001',
    amount: 100000,
    interestRate: 1.0, // 1% per month
    durationMonths: 12,
    status: 'APPROVED',
    purpose: 'Business',
    applicationDate: new Date('2024-11-01'),
    approvalDate: new Date('2024-11-15'),
    disbursementDate: null,
    balance: 0,
    monthlyIncome: 50000,
    sourceOfIncome: 'Employment',
    processingFee: 300,
    insuranceFee: 1000,
    disbursementMode: 'GROSS',
    branchId: null,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoanScheduleService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<LoanScheduleService>(LoanScheduleService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateSchedule', () => {
    it('should throw NotFoundException if loan not found', async () => {
      mockPrismaService.loan.findUnique.mockResolvedValue(null);

      await expect(service.generateSchedule('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if loan is not approved', async () => {
      mockPrismaService.loan.findUnique.mockResolvedValue({
        ...mockLoan,
        status: 'SUBMITTED',
      });

      await expect(service.generateSchedule('loan-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should return existing schedule if already generated', async () => {
      const existingSchedule = [
        {
          id: 'schedule-1',
          loanId: 'loan-1',
          installmentNo: 1,
          dueDate: new Date(),
          principalDue: 8000,
          interestDue: 1000,
          penaltyDue: 0,
          principalPaid: 0,
          interestPaid: 0,
          penaltyPaid: 0,
          totalDue: 9000,
          totalPaid: 0,
          balanceAfter: 92000,
          status: 'PENDING',
        },
      ];

      mockPrismaService.loan.findUnique.mockResolvedValue(mockLoan);
      mockPrismaService.loanSchedule.findMany.mockResolvedValue(existingSchedule);

      const result = await service.generateSchedule('loan-1');

      expect(result).toHaveLength(1);
      expect(mockPrismaService.loanSchedule.createMany).not.toHaveBeenCalled();
    });

    it('should generate correct schedule for 12-month loan at 1% monthly', async () => {
      mockPrismaService.loan.findUnique.mockResolvedValue(mockLoan);
      mockPrismaService.loanSchedule.findMany
        .mockResolvedValueOnce([]) // First call: no existing schedule
        .mockResolvedValueOnce([]); // Second call: return created schedule

      // Mock createMany to capture the schedule entries
      let capturedSchedule: any[] = [];
      mockPrismaService.loanSchedule.createMany.mockImplementation(({ data }) => {
        capturedSchedule = data;
        return Promise.resolve({ count: data.length });
      });

      // Return the captured schedule on second findMany call
      mockPrismaService.loanSchedule.findMany.mockImplementation(() => {
        if (capturedSchedule.length > 0) {
          return Promise.resolve(
            capturedSchedule.map((s, i) => ({ ...s, id: `schedule-${i + 1}` })),
          );
        }
        return Promise.resolve([]);
      });

      await service.generateSchedule('loan-1');

      // Verify schedule was created with correct number of entries
      expect(mockPrismaService.loanSchedule.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            loanId: 'loan-1',
            installmentNo: 1,
          }),
        ]),
      });

      // Verify 12 installments were created
      expect(capturedSchedule).toHaveLength(12);

      // Verify first installment has correct interest (1% of 100000 = 1000)
      expect(capturedSchedule[0].interestDue).toBeCloseTo(1000, 0);

      // Verify last installment balance is 0
      expect(capturedSchedule[11].balanceAfter).toBe(0);
    });

    it('should calculate correct monthly payment using PMT formula', async () => {
      mockPrismaService.loan.findUnique.mockResolvedValue(mockLoan);
      mockPrismaService.loanSchedule.findMany.mockResolvedValue([]);

      let capturedSchedule: any[] = [];
      mockPrismaService.loanSchedule.createMany.mockImplementation(({ data }) => {
        capturedSchedule = data;
        return Promise.resolve({ count: data.length });
      });

      mockPrismaService.loanSchedule.findMany.mockImplementation(() => {
        if (capturedSchedule.length > 0) {
          return Promise.resolve(
            capturedSchedule.map((s, i) => ({ ...s, id: `schedule-${i + 1}` })),
          );
        }
        return Promise.resolve([]);
      });

      await service.generateSchedule('loan-1');

      // For 100,000 at 1% monthly over 12 months:
      // PMT = 100000 * [0.01(1.01)^12] / [(1.01)^12 - 1]
      // PMT ≈ 8884.88
      const totalMonthlyPayments = capturedSchedule.reduce(
        (sum, s) => sum + s.principalDue + s.interestDue,
        0,
      );
      const avgMonthlyPayment = totalMonthlyPayments / 12;
      
      // Monthly payment should be approximately 8885
      expect(avgMonthlyPayment).toBeGreaterThan(8800);
      expect(avgMonthlyPayment).toBeLessThan(9000);
    });

    it('should update loan with monthly payment', async () => {
      mockPrismaService.loan.findUnique.mockResolvedValue(mockLoan);
      mockPrismaService.loanSchedule.findMany.mockResolvedValue([]);
      mockPrismaService.loanSchedule.createMany.mockResolvedValue({ count: 12 });

      await service.generateSchedule('loan-1');

      expect(mockPrismaService.loan.update).toHaveBeenCalledWith({
        where: { id: 'loan-1' },
        data: {
          monthlyPayment: expect.any(Number),
        },
      });
    });

    it('should set first payment due 30 days after approval', async () => {
      const approvalDate = new Date('2024-11-15');
      mockPrismaService.loan.findUnique.mockResolvedValue({
        ...mockLoan,
        approvalDate,
      });
      mockPrismaService.loanSchedule.findMany.mockResolvedValue([]);

      let capturedSchedule: any[] = [];
      mockPrismaService.loanSchedule.createMany.mockImplementation(({ data }) => {
        capturedSchedule = data;
        return Promise.resolve({ count: data.length });
      });

      mockPrismaService.loanSchedule.findMany.mockImplementation(() => {
        if (capturedSchedule.length > 0) {
          return Promise.resolve(
            capturedSchedule.map((s, i) => ({ ...s, id: `schedule-${i + 1}` })),
          );
        }
        return Promise.resolve([]);
      });

      await service.generateSchedule('loan-1');

      const expectedFirstDueDate = new Date(approvalDate);
      expectedFirstDueDate.setDate(expectedFirstDueDate.getDate() + 30);

      expect(capturedSchedule[0].dueDate.toDateString()).toBe(
        expectedFirstDueDate.toDateString(),
      );
    });
  });

  describe('getScheduleWithDetails', () => {
    it('should throw NotFoundException if loan not found', async () => {
      mockPrismaService.loan.findUnique.mockResolvedValue(null);

      await expect(service.getScheduleWithDetails('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return schedule with loan details', async () => {
      const loanWithSchedule = {
        ...mockLoan,
        monthlyPayment: 8885,
        schedules: [
          {
            id: 'schedule-1',
            installmentNo: 1,
            dueDate: new Date(),
            principalDue: 7885,
            interestDue: 1000,
            penaltyDue: 0,
            principalPaid: 0,
            interestPaid: 0,
            penaltyPaid: 0,
            totalDue: 8885,
            totalPaid: 0,
            balanceAfter: 92115,
            status: 'PENDING',
          },
        ],
      };

      mockPrismaService.loan.findUnique.mockResolvedValue(loanWithSchedule);

      const result = await service.getScheduleWithDetails('loan-1');

      expect(result.loanId).toBe('loan-1');
      expect(result.loanNumber).toBe('LN-20241126-0001');
      expect(result.loanAmount).toBe(100000);
      expect(result.schedule).toHaveLength(1);
    });
  });

  describe('getScheduleSummary', () => {
    it('should return correct summary', async () => {
      const loanWithSchedule = {
        ...mockLoan,
        schedules: [
          {
            id: 'schedule-1',
            installmentNo: 1,
            dueDate: new Date('2024-12-15'),
            principalDue: 7885,
            interestDue: 1000,
            penaltyDue: 0,
            principalPaid: 8885,
            interestPaid: 1000,
            penaltyPaid: 0,
            totalDue: 8885,
            totalPaid: 8885,
            balanceAfter: 92115,
            status: 'PAID',
            paidAt: new Date(),
          },
          {
            id: 'schedule-2',
            installmentNo: 2,
            dueDate: new Date('2025-01-15'),
            principalDue: 7964,
            interestDue: 921,
            penaltyDue: 0,
            principalPaid: 0,
            interestPaid: 0,
            penaltyPaid: 0,
            totalDue: 8885,
            totalPaid: 0,
            balanceAfter: 84151,
            status: 'PENDING',
          },
        ],
      };

      mockPrismaService.loan.findUnique.mockResolvedValue(loanWithSchedule);

      const result = await service.getScheduleSummary('loan-1');

      expect(result.paidInstallments).toBe(1);
      expect(result.remainingInstallments).toBe(1);
      expect(result.totalPaid).toBe(8885);
      expect(result.nextInstallment?.installmentNo).toBe(2);
    });
  });

  describe('updateScheduleStatuses', () => {
    it('should update pending schedules to due', async () => {
      mockPrismaService.loanSchedule.updateMany
        .mockResolvedValueOnce({ count: 5 })
        .mockResolvedValueOnce({ count: 2 });

      const result = await service.updateScheduleStatuses();

      expect(result).toBe(7);
      expect(mockPrismaService.loanSchedule.updateMany).toHaveBeenCalledTimes(2);
    });
  });
});
