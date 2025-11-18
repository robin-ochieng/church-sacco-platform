import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { MonthlyChargesController } from '../monthly-charges.controller';
import { MonthlyChargesService } from '../monthly-charges.service';

describe('MonthlyChargesController (Integration)', () => {
  let app: INestApplication;
  let monthlyChargesService: MonthlyChargesService;

  const mockMonthlyChargesService = {
    scheduleMonthlyCharges: jest.fn(),
    getJobStatus: jest.fn(),
    calculateCurrentMonthRange: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule],
      controllers: [MonthlyChargesController],
      providers: [
        {
          provide: MonthlyChargesService,
          useValue: mockMonthlyChargesService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    monthlyChargesService = moduleFixture.get<MonthlyChargesService>(MonthlyChargesService);
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /admin/monthly-charges/run', () => {
    it('should schedule monthly charges with provided date range', async () => {
      const mockResponse = {
        jobId: 'job-123',
        status: 'scheduled',
        data: {
          from: '2024-01-01',
          to: '2024-01-31',
          triggeredBy: 'admin',
          manual: true,
        },
      };

      mockMonthlyChargesService.scheduleMonthlyCharges.mockResolvedValue(mockResponse);

      const response = await request(app.getHttpServer())
        .post('/admin/monthly-charges/run?from=2024-01-01&to=2024-01-31')
        .expect(202);

      expect(response.body).toMatchObject({
        message: 'Monthly charges job scheduled successfully',
        jobId: 'job-123',
        status: 'scheduled',
      });

      expect(mockMonthlyChargesService.scheduleMonthlyCharges).toHaveBeenCalledWith(
        expect.objectContaining({
          from: '2024-01-01',
          to: '2024-01-31',
          manual: true,
        }),
      );
    });

    it('should use current month range when dates not provided', async () => {
      const mockDateRange = {
        from: '2024-01-01',
        to: '2024-01-31',
      };

      const mockResponse = {
        jobId: 'job-456',
        status: 'scheduled',
        data: {
          ...mockDateRange,
          triggeredBy: 'admin',
          manual: true,
        },
      };

      mockMonthlyChargesService.calculateCurrentMonthRange.mockReturnValue(mockDateRange);
      mockMonthlyChargesService.scheduleMonthlyCharges.mockResolvedValue(mockResponse);

      const response = await request(app.getHttpServer())
        .post('/admin/monthly-charges/run')
        .expect(202);

      expect(response.body).toMatchObject({
        message: 'Monthly charges job scheduled successfully',
        jobId: 'job-456',
      });

      expect(mockMonthlyChargesService.calculateCurrentMonthRange).toHaveBeenCalled();
    });
  });

  describe('GET /admin/monthly-charges/status/:jobId', () => {
    it('should return job status', async () => {
      const mockJobStatus = {
        id: 'job-123',
        status: 'completed',
        progress: 100,
        result: {
          totalMembers: 50,
          successCount: 50,
          failureCount: 0,
          totalAmount: 5000,
          errors: [],
        },
        createdAt: new Date('2024-01-01T02:00:00Z'),
        processedAt: new Date('2024-01-01T02:01:00Z'),
        finishedAt: new Date('2024-01-01T02:02:00Z'),
      };

      mockMonthlyChargesService.getJobStatus.mockResolvedValue(mockJobStatus);

      const response = await request(app.getHttpServer())
        .get('/admin/monthly-charges/status/job-123')
        .expect(200);

      expect(response.body).toMatchObject({
        id: 'job-123',
        status: 'completed',
        progress: 100,
      });

      expect(mockMonthlyChargesService.getJobStatus).toHaveBeenCalledWith('job-123');
    });

    it('should return not_found for non-existent job', async () => {
      mockMonthlyChargesService.getJobStatus.mockResolvedValue({ status: 'not_found' });

      const response = await request(app.getHttpServer())
        .get('/admin/monthly-charges/status/non-existent')
        .expect(200);

      expect(response.body).toEqual({ status: 'not_found' });
    });
  });
});
