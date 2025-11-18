import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TransactionChannel, TransactionType } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe.skip('Cashier Deposits (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;
  let testMemberId: string;
  let testBranchId: string | null;

  beforeAll(async () => {
    // Set test environment to disable throttling
    process.env.NODE_ENV = 'test';
    
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(require('../src/auth/guards/jwt-auth.guard').JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // Setup test data
    await setupTestData();
  });

  afterAll(async () => {
    // Cleanup
    await cleanupTestData();
    await app.close();
  });

  async function setupTestData() {
    // Skip Branch creation - Branch table doesn't exist in current schema
    // const branch = await prisma.$executeRawUnsafe(`
    //   INSERT INTO "Branch" (id, name, code, location, "createdAt", "updatedAt")
    //   VALUES ('test-branch-cashier', 'Test Cashier Branch', 'TCB', 'Test Location', NOW(), NOW())
    //   ON CONFLICT (id) DO NOTHING
    //   RETURNING id
    // `);

    testBranchId = null; // Branch functionality not yet implemented

    // Create test cashier user
    const hashedPassword = '$2b$10$test.hash'; // Mock bcrypt hash
    await prisma.$executeRawUnsafe(`
      INSERT INTO "User" (id, email, password, role, "isActive", "createdAt", "updatedAt")
      VALUES ('test-cashier-user', 'cashier@test.com', '${hashedPassword}', 'CLERK', true, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email
    `);

    // Create test member
    await prisma.$executeRawUnsafe(`
      INSERT INTO "User" (id, email, password, role, "isActive", "createdAt", "updatedAt")
      VALUES ('test-member-user', 'member@test.com', '${hashedPassword}', 'MEMBER', true, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email
    `);

    await prisma.$executeRawUnsafe(`
      INSERT INTO "Member" (
        id, "userId", "memberNumber", "firstName", "lastName", 
        email, "idPassportNumber", "phoneNumber", "dateOfBirth", "branchId",
        "kycStatus", "createdAt", "updatedAt"
      )
      VALUES (
        'test-member-deposit', 'test-member-user', 'TM-CASHIER-001', 'John', 'Doe',
        'johndoe@test.com', 'ID-123456', '+254712345678', '1990-01-01', '${testBranchId}',
        'APPROVED', NOW(), NOW()
      )
      ON CONFLICT (id) DO UPDATE SET "memberNumber" = EXCLUDED."memberNumber"
    `);

    testMemberId = 'test-member-deposit';

    // Mock authentication - in a real test, you'd use proper JWT
    // For simplicity, we'll assume the auth system is bypassed or mocked
    authToken = 'mock-jwt-token';
  }

  async function cleanupTestData() {
    try {
      await prisma.$executeRawUnsafe(`DELETE FROM "Transaction" WHERE "memberId" = '${testMemberId}'`);
      await prisma.$executeRawUnsafe(`DELETE FROM "Member" WHERE id = '${testMemberId}'`);
      await prisma.$executeRawUnsafe(`DELETE FROM "User" WHERE id IN ('test-cashier-user', 'test-member-user')`);
      // Skip Branch cleanup - Branch table doesn't exist
      // await prisma.$executeRawUnsafe(`DELETE FROM "Branch" WHERE id = '${testBranchId}'`);
    } catch (error) {
      console.warn('Cleanup warning:', error);
    }
  }

  describe('POST /cashier/deposits', () => {
    it('should create a cash deposit successfully', async () => {
      const depositDto = {
        memberId: testMemberId,
        amount: 1000.00,
        transactionType: TransactionType.SAVINGS_DEPOSIT,
        channel: TransactionChannel.CASH,
        narration: 'Monthly savings deposit',
      };

      const response = await request(app.getHttpServer())
        .post('/cashier/deposits')
        .set('Authorization', `Bearer ${authToken}`)
        .send(depositDto)
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        amount: expect.any(Number),
        type: TransactionType.SAVINGS_DEPOSIT,
        channel: TransactionChannel.CASH,
        status: 'POSTED',
        receiptNumber: expect.stringMatching(/^RCP-/),
        narration: 'Monthly savings deposit',
      });

      expect(response.body.member).toMatchObject({
        id: testMemberId,
        memberNumber: 'TM-CASHIER-001',
        name: 'John Doe',
      });

      expect(response.body.receiptNumber).toBeTruthy();
      expect(response.body.balanceAfter).toBeGreaterThanOrEqual(1000);
    });

    it('should create a mobile money deposit with reference', async () => {
      const depositDto = {
        memberNumber: 'TM-CASHIER-001',
        amount: 500.50,
        transactionType: TransactionType.SHARES_DEPOSIT,
        channel: TransactionChannel.MOBILE_MONEY,
        reference: 'MPESA-ABC123XYZ',
        narration: 'Share purchase via M-Pesa',
      };

      const response = await request(app.getHttpServer())
        .post('/cashier/deposits')
        .set('Authorization', `Bearer ${authToken}`)
        .send(depositDto)
        .expect(201);

      expect(response.body).toMatchObject({
        type: TransactionType.SHARES_DEPOSIT,
        channel: TransactionChannel.MOBILE_MONEY,
        reference: 'MPESA-ABC123XYZ',
        amount: expect.any(Number),
      });

      expect(response.body.receiptNumber).toMatch(/^RCP-/);
    });

    it('should create a bank transfer deposit', async () => {
      const depositDto = {
        memberId: testMemberId,
        amount: 2500.00,
        transactionType: TransactionType.SPECIAL_CONTRIBUTION,
        channel: TransactionChannel.BANK_TRANSFER,
        reference: 'BANK-REF-456',
        narration: 'Special project contribution',
      };

      const response = await request(app.getHttpServer())
        .post('/cashier/deposits')
        .set('Authorization', `Bearer ${authToken}`)
        .send(depositDto)
        .expect(201);

      expect(response.body.channel).toBe(TransactionChannel.BANK_TRANSFER);
      expect(response.body.reference).toBe('BANK-REF-456');
      expect(response.body.amount).toBeCloseTo(2500.00, 2);
    });

    it('should reject deposit without member identifier', async () => {
      const depositDto = {
        amount: 100,
        transactionType: TransactionType.SAVINGS_DEPOSIT,
        channel: TransactionChannel.CASH,
      };

      const response = await request(app.getHttpServer())
        .post('/cashier/deposits')
        .set('Authorization', `Bearer ${authToken}`)
        .send(depositDto)
        .expect(400);

      expect(response.body.message).toContain('memberId or memberNumber');
    });

    it('should reject deposit with invalid amount', async () => {
      const depositDto = {
        memberId: testMemberId,
        amount: -50,
        transactionType: TransactionType.SAVINGS_DEPOSIT,
        channel: TransactionChannel.CASH,
      };

      await request(app.getHttpServer())
        .post('/cashier/deposits')
        .set('Authorization', `Bearer ${authToken}`)
        .send(depositDto)
        .expect(400);
    });

    it('should reject deposit with zero amount', async () => {
      const depositDto = {
        memberId: testMemberId,
        amount: 0,
        transactionType: TransactionType.SAVINGS_DEPOSIT,
        channel: TransactionChannel.CASH,
      };

      await request(app.getHttpServer())
        .post('/cashier/deposits')
        .set('Authorization', `Bearer ${authToken}`)
        .send(depositDto)
        .expect(400);
    });

    it('should reject deposit for non-existent member', async () => {
      const depositDto = {
        memberId: 'non-existent-member',
        amount: 100,
        transactionType: TransactionType.SAVINGS_DEPOSIT,
        channel: TransactionChannel.CASH,
      };

      await request(app.getHttpServer())
        .post('/cashier/deposits')
        .set('Authorization', `Bearer ${authToken}`)
        .send(depositDto)
        .expect(404);
    });

    it('should reject withdrawal transaction type', async () => {
      const depositDto = {
        memberId: testMemberId,
        amount: 100,
        transactionType: TransactionType.WITHDRAWAL,
        channel: TransactionChannel.CASH,
      };

      const response = await request(app.getHttpServer())
        .post('/cashier/deposits')
        .set('Authorization', `Bearer ${authToken}`)
        .send(depositDto)
        .expect(400);

      expect(response.body.message).toContain('Only deposit transaction types');
    });

    it('should handle amount with exactly 2 decimal places', async () => {
      const depositDto = {
        memberId: testMemberId,
        amount: 99.99,
        transactionType: TransactionType.SAVINGS_DEPOSIT,
        channel: TransactionChannel.CASH,
      };

      const response = await request(app.getHttpServer())
        .post('/cashier/deposits')
        .set('Authorization', `Bearer ${authToken}`)
        .send(depositDto)
        .expect(201);

      expect(response.body.amount).toBeCloseTo(99.99, 2);
    });

    it('should reject amount with more than 2 decimal places', async () => {
      const depositDto = {
        memberId: testMemberId,
        amount: 100.555,
        transactionType: TransactionType.SAVINGS_DEPOSIT,
        channel: TransactionChannel.CASH,
      };

      await request(app.getHttpServer())
        .post('/cashier/deposits')
        .set('Authorization', `Bearer ${authToken}`)
        .send(depositDto)
        .expect(400);
    });

    it('should accept custom valueDate', async () => {
      const customDate = '2025-11-10T10:00:00Z';
      const depositDto = {
        memberId: testMemberId,
        amount: 750.00,
        transactionType: TransactionType.SAVINGS_DEPOSIT,
        channel: TransactionChannel.CASH,
        valueDate: customDate,
      };

      const response = await request(app.getHttpServer())
        .post('/cashier/deposits')
        .set('Authorization', `Bearer ${authToken}`)
        .send(depositDto)
        .expect(201);

      expect(new Date(response.body.valueDate).toISOString()).toContain('2025-11-10');
    });
  });

  describe('GET /cashier/deposits/:id', () => {
    let createdDepositId: string;

    beforeEach(async () => {
      // Create a deposit to fetch
      const depositDto = {
        memberId: testMemberId,
        amount: 300.00,
        transactionType: TransactionType.SAVINGS_DEPOSIT,
        channel: TransactionChannel.CASH,
      };

      const response = await request(app.getHttpServer())
        .post('/cashier/deposits')
        .set('Authorization', `Bearer ${authToken}`)
        .send(depositDto);

      createdDepositId = response.body.id;
    });

    it('should retrieve deposit by ID', async () => {
      const response = await request(app.getHttpServer())
        .get(`/cashier/deposits/${createdDepositId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: createdDepositId,
        amount: expect.any(Number),
        receiptNumber: expect.stringMatching(/^RCP-/),
      });
    });

    it('should return 404 for non-existent deposit', async () => {
      await request(app.getHttpServer())
        .get('/cashier/deposits/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('GET /cashier/deposits', () => {
    beforeEach(async () => {
      // Create multiple deposits for listing
      const deposits = [
        {
          memberId: testMemberId,
          amount: 100,
          transactionType: TransactionType.SAVINGS_DEPOSIT,
          channel: TransactionChannel.CASH,
        },
        {
          memberId: testMemberId,
          amount: 200,
          transactionType: TransactionType.SHARES_DEPOSIT,
          channel: TransactionChannel.MOBILE_MONEY,
        },
      ];

      for (const deposit of deposits) {
        await request(app.getHttpServer())
          .post('/cashier/deposits')
          .set('Authorization', `Bearer ${authToken}`)
          .send(deposit);
      }
    });

    it('should list deposits with default pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/cashier/deposits')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('meta');
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.meta).toMatchObject({
        count: expect.any(Number),
        limit: expect.any(Number),
      });
    });

    it('should filter deposits by transaction type', async () => {
      const response = await request(app.getHttpServer())
        .get('/cashier/deposits')
        .query({ transactionType: TransactionType.SHARES_DEPOSIT })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.every((d: any) => d.type === TransactionType.SHARES_DEPOSIT)).toBe(true);
    });

    it('should filter deposits by channel', async () => {
      const response = await request(app.getHttpServer())
        .get('/cashier/deposits')
        .query({ channel: TransactionChannel.CASH })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.every((d: any) => d.channel === TransactionChannel.CASH)).toBe(true);
    });

    it('should respect custom limit', async () => {
      const response = await request(app.getHttpServer())
        .get('/cashier/deposits')
        .query({ limit: 5 })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.meta.limit).toBe(5);
      expect(response.body.data.length).toBeLessThanOrEqual(5);
    });

    it('should filter by date range', async () => {
      const fromDate = '2025-11-01';
      const toDate = '2025-11-30';

      const response = await request(app.getHttpServer())
        .get('/cashier/deposits')
        .query({ fromDate, toDate })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data).toBeInstanceOf(Array);
    });

    it('should filter by member ID', async () => {
      const response = await request(app.getHttpServer())
        .get('/cashier/deposits')
        .query({ memberId: testMemberId })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.every((d: any) => d.member.id === testMemberId)).toBe(true);
    });
  });

  describe('Authorization', () => {
    it('should reject request without auth token', async () => {
      const depositDto = {
        memberId: testMemberId,
        amount: 100,
        transactionType: TransactionType.SAVINGS_DEPOSIT,
        channel: TransactionChannel.CASH,
      };

      await request(app.getHttpServer())
        .post('/cashier/deposits')
        .send(depositDto)
        .expect(401);
    });
  });
});
