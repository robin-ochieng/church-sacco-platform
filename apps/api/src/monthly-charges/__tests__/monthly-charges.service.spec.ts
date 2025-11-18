import { getQueueToken } from '@nestjs/bull';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { TransactionType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MonthlyChargesService } from '../monthly-charges.service';

describe('MonthlyChargesService', () => {
  let service: MonthlyChargesService;
  let prismaService: PrismaService;

  const mockQueue = {
    add: jest.fn(),
    getJob: jest.fn(),
  };

  const mockPrismaService = {
    member: {
      findMany: jest.fn(),
    },
    transaction: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule],
      providers: [
        MonthlyChargesService,
        {
          provide: getQueueToken('monthly-charges'),
          useValue: mockQueue,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<MonthlyChargesService>(MonthlyChargesService);
    prismaService = module.get<PrismaService>(PrismaService);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calculateCurrentMonthRange', () => {
    it('should return correct date range for current month', () => {
      const result = service.calculateCurrentMonthRange();

      expect(result).toHaveProperty('from');
      expect(result).toHaveProperty('to');
      expect(result.from).toMatch(/^\d{4}-\d{2}-01$/); // First day of month
      expect(result.to).toMatch(/^\d{4}-\d{2}-\d{2}$/); // Last day of month
    });

    it('should return dates in YYYY-MM-DD format', () => {
      const result = service.calculateCurrentMonthRange();
      const datePattern = /^\d{4}-\d{2}-\d{2}$/;

      expect(datePattern.test(result.from)).toBe(true);
      expect(datePattern.test(result.to)).toBe(true);
    });
  });

  describe('scheduleMonthlyCharges', () => {
    it('should schedule a job in the queue', async () => {
      const jobData = {
        from: '2024-01-01',
        to: '2024-01-31',
        triggeredBy: 'test-user',
        manual: true,
      };

      mockQueue.add.mockResolvedValue({ id: 'job-123' });

      const result = await service.scheduleMonthlyCharges(jobData);

      expect(mockQueue.add).toHaveBeenCalledWith(
        'process-monthly-charges',
        jobData,
        expect.objectContaining({
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
        }),
      );

      expect(result).toEqual({
        jobId: 'job-123',
        status: 'scheduled',
        data: jobData,
      });
    });
  });

  describe('processMonthlyCharges', () => {
    it('should process charges for all active members', async () => {
      const mockMembers = [
        {
          id: 'member-1',
          memberNumber: 'M001',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
        },
        {
          id: 'member-2',
          memberNumber: 'M002',
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@example.com',
        },
      ];

      mockPrismaService.member.findMany.mockResolvedValue(mockMembers);
      mockPrismaService.transaction.findFirst
        .mockResolvedValueOnce(null) // No existing charge for member-1
        .mockResolvedValueOnce(null) // No existing charge for member-2
        .mockResolvedValueOnce({ balanceAfter: 1000 }) // Balance for member-1
        .mockResolvedValueOnce({ balanceAfter: 2000 }); // Balance for member-2

      mockPrismaService.transaction.create.mockResolvedValue({});

      const result = await service.processMonthlyCharges({
        from: '2024-01-01',
        to: '2024-01-31',
        triggeredBy: 'test',
        manual: false,
      });

      expect(result.totalMembers).toBe(2);
      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(0);
      expect(result.totalAmount).toBe(200); // 100 * 2 members
      expect(result.errors).toHaveLength(0);
    });

    it('should handle failures gracefully', async () => {
      const mockMembers = [
        {
          id: 'member-1',
          memberNumber: 'M001',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
        },
      ];

      mockPrismaService.member.findMany.mockResolvedValue(mockMembers);
      mockPrismaService.transaction.findFirst.mockResolvedValue(null);
      mockPrismaService.transaction.create.mockRejectedValue(new Error('Database error'));

      const result = await service.processMonthlyCharges({
        from: '2024-01-01',
        to: '2024-01-31',
        triggeredBy: 'test',
        manual: false,
      });

      expect(result.totalMembers).toBe(1);
      expect(result.successCount).toBe(0);
      expect(result.failureCount).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].memberId).toBe('member-1');
    });

    it('should skip members who already have charges for the period', async () => {
      const mockMembers = [
        {
          id: 'member-1',
          memberNumber: 'M001',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
        },
      ];

      const existingCharge = {
        id: 'transaction-1',
        memberId: 'member-1',
        type: TransactionType.MONTHLY_CHARGE,
        amount: 100,
      };

      mockPrismaService.member.findMany.mockResolvedValue(mockMembers);
      mockPrismaService.transaction.findFirst.mockResolvedValue(existingCharge);

      const result = await service.processMonthlyCharges({
        from: '2024-01-01',
        to: '2024-01-31',
        triggeredBy: 'test',
        manual: false,
      });

      expect(result.totalMembers).toBe(1);
      expect(result.successCount).toBe(1);
      expect(result.failureCount).toBe(0);
      expect(mockPrismaService.transaction.create).not.toHaveBeenCalled();
    });
  });

  describe('getJobStatus', () => {
    it('should return job status when job exists', async () => {
      const mockJob = {
        id: 'job-123',
        timestamp: Date.now(),
        processedOn: Date.now(),
        finishedOn: Date.now(),
        getState: jest.fn().mockResolvedValue('completed'),
        progress: jest.fn().mockReturnValue(100),
        returnvalue: { successCount: 10, failureCount: 0 },
      };

      mockQueue.getJob.mockResolvedValue(mockJob);

      const result = await service.getJobStatus('job-123');

      expect(result.id).toBe('job-123');
      expect(result.status).toBe('completed');
      expect(result.progress).toBe(100);
      expect(result.result).toEqual({ successCount: 10, failureCount: 0 });
    });

    it('should return not_found when job does not exist', async () => {
      mockQueue.getJob.mockResolvedValue(null);

      const result = await service.getJobStatus('non-existent-job');

      expect(result).toEqual({ status: 'not_found' });
    });
  });
});
