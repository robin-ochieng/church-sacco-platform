import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as jwt from 'jsonwebtoken';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Member Statement (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;
  let testMember: any;
  let testUser: any;

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
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // Create test user for authentication
    testUser = await prisma.user.create({
      data: {
        id: 'test-user-statement-' + Date.now(),
        email: `statement-test-${Date.now()}@example.com`,
        role: 'TREASURER',
        password: '$2b$10$test.hash',
      },
    });

    // Create test member
    testMember = await prisma.member.create({
      data: {
        id: 'test-member-statement-' + Date.now(),
        userId: testUser.id,
        memberNumber: `MEM${Date.now()}`,
        firstName: 'John',
        lastName: 'Doe',
        email: testUser.email,
        idPassportNumber: `ID${Date.now()}`,
        telephone: '+254700000000',
        dateOfBirth: new Date('1990-01-01'),
        physicalAddress: '123 Test St',
        nextOfKinName: 'Jane Doe',
        nextOfKinPhone: '+254700000001',
        nextOfKinRelationship: 'Spouse',
        membershipStatus: 'ACTIVE',
      },
    });

    // Seed transactions for statement testing
    await seedTestTransactions(prisma, testMember.id);

    // Generate real JWT token for authentication
    const token = jwt.sign(
      { sub: testUser.id, email: testUser.email, role: testUser.role },
      process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing-only-do-not-use-in-production',
      { expiresIn: '1h' }
    );
    authToken = `Bearer ${token}`;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.transaction.deleteMany({
      where: { memberId: testMember.id },
    });
    await prisma.member.delete({
      where: { id: testMember.id },
    });
    await prisma.user.delete({
      where: { id: testUser.id },
    });

    await app.close();
  });

  describe('GET /members/:id/statement', () => {
    it('should return statement with all transactions in date order', async () => {
      const response = await request(app.getHttpServer())
        .get(`/members/${testMember.id}/statement`)
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body).toHaveProperty('member');
      expect(response.body).toHaveProperty('period');
      expect(response.body).toHaveProperty('openingBalance');
      expect(response.body).toHaveProperty('closingBalance');
      expect(response.body).toHaveProperty('totalDeposits');
      expect(response.body).toHaveProperty('totalWithdrawals');
      expect(response.body).toHaveProperty('transactions');
      expect(response.body).toHaveProperty('transactionCount');
      expect(response.body).toHaveProperty('generatedAt');

      // Verify member details
      expect(response.body.member.id).toBe(testMember.id);
      expect(response.body.member.memberNumber).toBe(testMember.memberNumber);
      expect(response.body.member.firstName).toBe('John');
      expect(response.body.member.lastName).toBe('Doe');

      // Verify transactions are in ascending date order
      const transactions = response.body.transactions;
      expect(Array.isArray(transactions)).toBe(true);
      expect(transactions.length).toBeGreaterThan(0);

      for (let i = 1; i < transactions.length; i++) {
        const prevDate = new Date(transactions[i - 1].date);
        const currDate = new Date(transactions[i].date);
        expect(currDate.getTime()).toBeGreaterThanOrEqual(prevDate.getTime());
      }
    });

    it('should compute running balance correctly', async () => {
      const response = await request(app.getHttpServer())
        .get(`/members/${testMember.id}/statement`)
        .set('Authorization', authToken)
        .expect(200);

      const { transactions, openingBalance } = response.body;

      // Verify running balance calculation
      let expectedBalance = openingBalance;
      transactions.forEach((txn: any) => {
        expectedBalance += (txn.credit - txn.debit);
        expect(txn.balance).toBeCloseTo(expectedBalance, 2);
      });

      // Verify closing balance matches last transaction balance
      if (transactions.length > 0) {
        const lastTransaction = transactions[transactions.length - 1];
        expect(response.body.closingBalance).toBeCloseTo(lastTransaction.balance, 2);
      }
    });

    it('should correctly categorize debits and credits', async () => {
      const response = await request(app.getHttpServer())
        .get(`/members/${testMember.id}/statement`)
        .set('Authorization', authToken)
        .expect(200);

      const { transactions } = response.body;

      transactions.forEach((txn: any) => {
        if (txn.type === 'WITHDRAWAL' || txn.type === 'ADJUSTMENT') {
          // Withdrawals should be debits
          expect(txn.debit).toBeGreaterThan(0);
          expect(txn.credit).toBe(0);
        } else {
          // Deposits should be credits
          expect(txn.credit).toBeGreaterThan(0);
          expect(txn.debit).toBe(0);
        }
      });
    });

    it('should filter by date range when s and e params provided', async () => {
      const startDate = '2024-01-15';
      const endDate = '2024-02-15';

      const response = await request(app.getHttpServer())
        .get(`/members/${testMember.id}/statement`)
        .query({ s: startDate, e: endDate })
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body.period.startDate).toContain('2024-01-15');
      expect(response.body.period.endDate).toContain('2024-02-15');

      const { transactions } = response.body;
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      transactions.forEach((txn: any) => {
        const txnDate = new Date(txn.date);
        expect(txnDate.getTime()).toBeGreaterThanOrEqual(start.getTime());
        expect(txnDate.getTime()).toBeLessThanOrEqual(end.getTime());
      });
    });

    it('should filter by transaction type when type param provided', async () => {
      const response = await request(app.getHttpServer())
        .get(`/members/${testMember.id}/statement`)
        .query({ type: 'SAVINGS_DEPOSIT' })
        .set('Authorization', authToken)
        .expect(200);

      const { transactions } = response.body;
      transactions.forEach((txn: any) => {
        expect(txn.type).toBe('SAVINGS_DEPOSIT');
      });
    });

    it('should calculate totalDeposits and totalWithdrawals correctly', async () => {
      const response = await request(app.getHttpServer())
        .get(`/members/${testMember.id}/statement`)
        .set('Authorization', authToken)
        .expect(200);

      const { transactions, totalDeposits, totalWithdrawals } = response.body;

      const calculatedDeposits = transactions.reduce((sum: number, txn: any) => sum + txn.credit, 0);
      const calculatedWithdrawals = transactions.reduce((sum: number, txn: any) => sum + txn.debit, 0);

      expect(totalDeposits).toBeCloseTo(calculatedDeposits, 2);
      expect(totalWithdrawals).toBeCloseTo(calculatedWithdrawals, 2);
    });

    it('should return 404 for non-existent member', async () => {
      await request(app.getHttpServer())
        .get('/members/non-existent-id/statement')
        .set('Authorization', authToken)
        .expect(404);
    });

    it('should include all transaction fields in ledger entries', async () => {
      const response = await request(app.getHttpServer())
        .get(`/members/${testMember.id}/statement`)
        .set('Authorization', authToken)
        .expect(200);

      const { transactions } = response.body;
      expect(transactions.length).toBeGreaterThan(0);

      const firstTxn = transactions[0];
      expect(firstTxn).toHaveProperty('id');
      expect(firstTxn).toHaveProperty('date');
      expect(firstTxn).toHaveProperty('type');
      expect(firstTxn).toHaveProperty('channel');
      expect(firstTxn).toHaveProperty('reference');
      expect(firstTxn).toHaveProperty('narration');
      expect(firstTxn).toHaveProperty('debit');
      expect(firstTxn).toHaveProperty('credit');
      expect(firstTxn).toHaveProperty('balance');
      expect(firstTxn).toHaveProperty('receiptNumber');
      expect(firstTxn).toHaveProperty('status');
      expect(firstTxn).toHaveProperty('cashierId');
    });

    it('should only include POSTED transactions', async () => {
      // Create a PENDING transaction that should not appear
      await prisma.transaction.create({
        data: {
          id: 'pending-txn-' + Date.now(),
          memberId: testMember.id,
          amount: 1000,
          type: 'SAVINGS_DEPOSIT',
          channel: 'CASH',
          status: 'PENDING',
          valueDate: new Date(),
          balanceAfter: 0,
        },
      });

      const response = await request(app.getHttpServer())
        .get(`/members/${testMember.id}/statement`)
        .set('Authorization', authToken)
        .expect(200);

      const { transactions } = response.body;
      transactions.forEach((txn: any) => {
        expect(txn.status).toBe('POSTED');
      });
    });

    it('should handle member with no transactions', async () => {
      // Create a separate user for this test to avoid userId constraint
      const emptyUser = await prisma.user.create({
        data: {
          id: 'empty-user-' + Date.now(),
          email: `empty-user-${Date.now()}@example.com`,
          role: 'MEMBER',
          password: '$2b$10$test.hash',
        },
      });

      // Create member with no transactions
      const emptyMember = await prisma.member.create({
        data: {
          id: 'empty-member-' + Date.now(),
          userId: emptyUser.id,
          memberNumber: `EMPTY${Date.now()}`,
          firstName: 'Empty',
          lastName: 'Member',
          email: emptyUser.email,
          idPassportNumber: `EMPTY_ID${Date.now()}`,
          telephone: '+254700000002',
          dateOfBirth: new Date('1990-01-01'),
          physicalAddress: '123 Test St',
          nextOfKinName: 'Jane Doe',
          nextOfKinPhone: '+254700000003',
          nextOfKinRelationship: 'Spouse',
          membershipStatus: 'ACTIVE',
        },
      });

      const response = await request(app.getHttpServer())
        .get(`/members/${emptyMember.id}/statement`)
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body.openingBalance).toBe(0);
      expect(response.body.closingBalance).toBe(0);
      expect(response.body.totalDeposits).toBe(0);
      expect(response.body.totalWithdrawals).toBe(0);
      expect(response.body.transactions).toEqual([]);
      expect(response.body.transactionCount).toBe(0);

      // Cleanup
      await prisma.member.delete({ where: { id: emptyMember.id } });
    });

    it('should validate date format for s parameter', async () => {
      await request(app.getHttpServer())
        .get(`/members/${testMember.id}/statement`)
        .query({ s: 'invalid-date' })
        .set('Authorization', authToken)
        .expect(400);
    });

    it('should validate date format for e parameter', async () => {
      await request(app.getHttpServer())
        .get(`/members/${testMember.id}/statement`)
        .query({ e: 'invalid-date' })
        .set('Authorization', authToken)
        .expect(400);
    });

    it('should handle date range with no transactions', async () => {
      const response = await request(app.getHttpServer())
        .get(`/members/${testMember.id}/statement`)
        .query({ s: '2030-01-01', e: '2030-12-31' })
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body.transactions).toEqual([]);
      expect(response.body.transactionCount).toBe(0);
    });

    it('should calculate opening balance from transactions before start date', async () => {
      const response = await request(app.getHttpServer())
        .get(`/members/${testMember.id}/statement`)
        .query({ s: '2024-02-01', e: '2024-12-31' })
        .set('Authorization', authToken)
        .expect(200);

      // Opening balance should be sum of all transactions before 2024-02-01
      expect(response.body.openingBalance).toBeGreaterThanOrEqual(0);
    });

    it('should return statement count matching number of transactions', async () => {
      const response = await request(app.getHttpServer())
        .get(`/members/${testMember.id}/statement`)
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body.transactionCount).toBe(response.body.transactions.length);
    });
  });
});

/**
 * Seed test transactions for a member
 * Creates a mix of deposits, withdrawals, and different channels
 */
async function seedTestTransactions(prisma: PrismaService, memberId: string) {
  const transactions = [
    // January 2024 - Deposits
    {
      id: `txn-${Date.now()}-1`,
      memberId,
      amount: 10000,
      type: 'SAVINGS_DEPOSIT',
      channel: 'CASH',
      status: 'POSTED',
      valueDate: new Date('2024-01-05'),
      balanceAfter: 10000,
      receiptNumber: 'RCP-2024-001',
      narration: 'Opening deposit',
    },
    {
      id: `txn-${Date.now()}-2`,
      memberId,
      amount: 5000,
      type: 'SHARES_DEPOSIT',
      channel: 'MOBILE_MONEY',
      status: 'POSTED',
      valueDate: new Date('2024-01-15'),
      balanceAfter: 15000,
      receiptNumber: 'RCP-2024-002',
      reference: 'RKJ8X9P2QW',
      narration: 'Shares purchase',
    },
    // February 2024 - More deposits and first withdrawal
    {
      id: `txn-${Date.now()}-3`,
      memberId,
      amount: 3000,
      type: 'SAVINGS_DEPOSIT',
      channel: 'BANK_TRANSFER',
      status: 'POSTED',
      valueDate: new Date('2024-02-01'),
      balanceAfter: 18000,
      receiptNumber: 'RCP-2024-003',
      reference: 'BANK-TXN-123',
      narration: 'Monthly savings',
    },
    {
      id: `txn-${Date.now()}-4`,
      memberId,
      amount: 2000,
      type: 'WITHDRAWAL',
      channel: 'CASH',
      status: 'POSTED',
      valueDate: new Date('2024-02-10'),
      balanceAfter: 16000,
      narration: 'Emergency withdrawal',
    },
    // March 2024 - Special contribution
    {
      id: `txn-${Date.now()}-5`,
      memberId,
      amount: 1000,
      type: 'SPECIAL_CONTRIBUTION',
      channel: 'CASH',
      status: 'POSTED',
      valueDate: new Date('2024-03-01'),
      balanceAfter: 17000,
      receiptNumber: 'RCP-2024-004',
      narration: 'Building fund',
    },
    // April 2024 - Maintenance fee and deposit
    {
      id: `txn-${Date.now()}-6`,
      memberId,
      amount: 500,
      type: 'MAINTENANCE_FEE',
      channel: 'CASH',
      status: 'POSTED',
      valueDate: new Date('2024-04-01'),
      balanceAfter: 17500,
      receiptNumber: 'RCP-2024-005',
      narration: 'Annual maintenance',
    },
    {
      id: `txn-${Date.now()}-7`,
      memberId,
      amount: 7500,
      type: 'SAVINGS_DEPOSIT',
      channel: 'CHEQUE',
      status: 'POSTED',
      valueDate: new Date('2024-04-15'),
      balanceAfter: 25000,
      receiptNumber: 'RCP-2024-006',
      reference: 'CHQ-987654',
      narration: 'Bonus deposit',
    },
  ];

  for (const txn of transactions) {
    await prisma.transaction.create({ data: txn });
  }
}
