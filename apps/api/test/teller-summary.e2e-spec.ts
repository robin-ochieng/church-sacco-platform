/// <reference types="jest" />
// @ts-nocheck
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma, TransactionChannel, TransactionStatus, TransactionType, UserRole } from '@prisma/client';
import { formatInTimeZone } from 'date-fns-tz';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { PrismaService } from '../src/prisma/prisma.service';

const HASHED_PASSWORD = '$2b$10$testsaltHashForTellerSummary';
const TELLER_USER_ID = 'test-teller-user';
const MEMBER_USER_A = 'test-member-user-a';
const MEMBER_USER_B = 'test-member-user-b';
const MEMBER_A_ID = 'test-member-a';
const MEMBER_B_ID = 'test-member-b';
const TEST_BRANCH = 'test-branch-01';
const BANK_TIMEZONE = process.env.BANK_TIMEZONE ?? 'Africa/Nairobi';

describe('Teller Summary (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(JwtAuthGuard)
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
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  afterEach(async () => {
    await cleanup();
  });

  it('returns aggregated data for an explicit date', async () => {
    const targetDate = '2024-05-15';
    await seedTransactions(targetDate, { includePending: true });

    const response = await request(app.getHttpServer())
      .get(`/api/v1/teller/summary?date=${targetDate}&limit=3`)
      .expect(200);

    expect(response.body.date).toBe(targetDate);
    expect(response.body.totals.depositCount).toBe(4);
    expect(response.body.totals.depositAmount).toBe('6500.00');
    expect(response.body.totals.uniqueMembers).toBe(2);

    expect(response.body.topMembers[0]).toMatchObject({
      memberId: MEMBER_A_ID,
      receiptCount: 3,
      totalDeposits: '5000.00',
    });

    expect(response.body.recentReceipts).toHaveLength(3);
    expect(response.body.recentReceipts[0].id).toBe('RCP-TELLER-004');
    expect(new Date(response.body.recentReceipts[0].timestamp).getTime()).toBeGreaterThan(
      new Date(response.body.recentReceipts[1].timestamp).getTime(),
    );

    expect(response.body.closeDayDryRun.eligible).toBe(false);
    expect(response.body.closeDayDryRun.warnings.some((w: string) => w.includes('pending transaction'))).toBe(true);
    expect(response.body.closeDayDryRun.projectedNetCash).toBe('6300.00');
  });

  it('defaults to today when no date is provided', async () => {
    const todayIso = formatInTimeZone(new Date(), BANK_TIMEZONE, 'yyyy-MM-dd');
    await seedTransactions(todayIso, { includePending: false });

    const response = await request(app.getHttpServer()).get('/api/v1/teller/summary').expect(200);

    expect(response.body.date).toBe(todayIso);
    expect(response.body.totals.depositCount).toBe(4);
    expect(response.body.closeDayDryRun.eligible).toBe(true);
    expect(response.body.closeDayDryRun.warnings).toHaveLength(0);
  });

  async function seedTransactions(dateIso: string, options: { includePending: boolean }) {
    await ensureUsers();
    await ensureMembers();

    const baseDate = `${dateIso}T08:00:00Z`;
    const postedDeposits = [
      {
        id: 'txn-teller-001',
        memberId: MEMBER_A_ID,
        amount: new Prisma.Decimal(2000),
        receiptNumber: 'RCP-TELLER-001',
        createdAt: new Date(baseDate),
      },
      {
        id: 'txn-teller-002',
        memberId: MEMBER_B_ID,
        amount: new Prisma.Decimal(1000),
        receiptNumber: 'RCP-TELLER-002',
        createdAt: new Date(`${dateIso}T09:00:00Z`),
      },
      {
        id: 'txn-teller-003',
        memberId: MEMBER_A_ID,
        amount: new Prisma.Decimal(1500),
        receiptNumber: 'RCP-TELLER-003',
        createdAt: new Date(`${dateIso}T10:00:00Z`),
      },
      {
        id: 'txn-teller-004',
        memberId: MEMBER_A_ID,
        amount: new Prisma.Decimal(1500),
        receiptNumber: 'RCP-TELLER-004',
        createdAt: new Date(`${dateIso}T11:00:00Z`),
      },
    ];

    for (const deposit of postedDeposits) {
      await prisma.transaction.create({
        data: {
          id: deposit.id,
          memberId: deposit.memberId,
          cashierId: TELLER_USER_ID,
          branchId: TEST_BRANCH,
          amount: deposit.amount,
          type: TransactionType.SAVINGS_DEPOSIT,
          channel: TransactionChannel.CASH,
          status: TransactionStatus.POSTED,
          reference: 'TEST-REF',
          narration: 'Manual deposit',
          receiptNumber: deposit.receiptNumber,
          valueDate: deposit.createdAt,
          createdAt: deposit.createdAt,
          balanceAfter: deposit.amount,
        },
      });
    }

    await prisma.transaction.create({
      data: {
        id: 'txn-teller-outflow',
        memberId: MEMBER_B_ID,
        cashierId: TELLER_USER_ID,
        branchId: TEST_BRANCH,
        amount: new Prisma.Decimal(200),
        type: TransactionType.WITHDRAWAL,
        channel: TransactionChannel.CASH,
        status: TransactionStatus.POSTED,
        reference: 'WITHDRAW_TEST',
        receiptNumber: 'RCP-TELLER-OUT',
        valueDate: new Date(`${dateIso}T12:00:00Z`),
        createdAt: new Date(`${dateIso}T12:00:00Z`),
        balanceAfter: new Prisma.Decimal(0),
      },
    });

    if (options.includePending) {
      await prisma.transaction.create({
        data: {
          id: 'txn-teller-pending',
          memberId: MEMBER_B_ID,
          cashierId: TELLER_USER_ID,
          branchId: TEST_BRANCH,
          amount: new Prisma.Decimal(500),
          type: TransactionType.SAVINGS_DEPOSIT,
          channel: TransactionChannel.MOBILE_MONEY,
          status: TransactionStatus.PENDING,
          reference: 'PENDING_REF',
          receiptNumber: null,
          valueDate: new Date(`${dateIso}T13:00:00Z`),
          createdAt: new Date(`${dateIso}T13:00:00Z`),
          balanceAfter: new Prisma.Decimal(0),
        },
      });
    }
  }

  async function ensureUsers() {
    await prisma.user.upsert({
      where: { id: TELLER_USER_ID },
      update: {},
      create: {
        id: TELLER_USER_ID,
        email: 'teller@test.com',
        password: HASHED_PASSWORD,
        role: UserRole.CLERK,
        isActive: true,
      },
    });

    await prisma.user.upsert({
      where: { id: MEMBER_USER_A },
      update: {},
      create: {
        id: MEMBER_USER_A,
        email: 'member.a@test.com',
        password: HASHED_PASSWORD,
        role: UserRole.MEMBER,
        isActive: true,
      },
    });

    await prisma.user.upsert({
      where: { id: MEMBER_USER_B },
      update: {},
      create: {
        id: MEMBER_USER_B,
        email: 'member.b@test.com',
        password: HASHED_PASSWORD,
        role: UserRole.MEMBER,
        isActive: true,
      },
    });
  }

  async function ensureMembers() {
    await prisma.member.upsert({
      where: { id: MEMBER_A_ID },
      update: {},
      create: {
        id: MEMBER_A_ID,
        userId: MEMBER_USER_A,
        memberNumber: 'TM-TELLER-001',
        firstName: 'Alice',
        lastName: 'Wambui',
        email: 'member.a@test.com',
        idPassportNumber: 'ID-TELLER-001',
        physicalAddress: 'Test Address 1',
        telephone: '+254700000001',
        dateOfBirth: new Date('1990-01-01T00:00:00Z'),
        nextOfKinName: 'Kin A',
        nextOfKinPhone: '+254711111111',
        nextOfKinRelationship: 'Sibling',
        branchId: TEST_BRANCH,
      },
    });

    await prisma.member.upsert({
      where: { id: MEMBER_B_ID },
      update: {},
      create: {
        id: MEMBER_B_ID,
        userId: MEMBER_USER_B,
        memberNumber: 'TM-TELLER-002',
        firstName: 'Brian',
        lastName: 'Otieno',
        email: 'member.b@test.com',
        idPassportNumber: 'ID-TELLER-002',
        physicalAddress: 'Test Address 2',
        telephone: '+254700000002',
        dateOfBirth: new Date('1992-02-02T00:00:00Z'),
        nextOfKinName: 'Kin B',
        nextOfKinPhone: '+254722222222',
        nextOfKinRelationship: 'Parent',
        branchId: TEST_BRANCH,
      },
    });
  }

  async function cleanup() {
    await prisma.transaction.deleteMany({
      where: {
        OR: [
          { memberId: MEMBER_A_ID },
          { memberId: MEMBER_B_ID },
        ],
      },
    });
    await prisma.member.deleteMany({ where: { id: { in: [MEMBER_A_ID, MEMBER_B_ID] } } });
    await prisma.user.deleteMany({ where: { id: { in: [TELLER_USER_ID, MEMBER_USER_A, MEMBER_USER_B] } } });
  }
});
