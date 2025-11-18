// @ts-nocheck
import { ExecutionContext, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma, TransactionChannel, TransactionType, UserRole } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Receipts Module (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let member: { id: string; memberNumber: string };
  let tellerUserId: string;
  let memberUserId: string;
  let receiptNumber: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.RECEIPTS_RENDERER_MODE = 'stub';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(require('../src/auth/guards/jwt-auth.guard').JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest();
          req.user = { sub: 'admin-user', email: 'admin@test.com', role: UserRole.ADMIN };
          return true;
        },
      })
      .overrideGuard(require('../src/auth/guards/roles.guard').RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    await seedData();
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  describe('GET /receipts/transaction/:receiptNumber.pdf', () => {
    it('returns a PDF stream when receipt exists', async () => {
      const res = await request(app.getHttpServer())
        .get(`/receipts/transaction/${receiptNumber}.pdf`)
        .expect(200);

      expect(res.headers['content-type']).toContain('application/pdf');
      expect(res.headers['content-disposition']).toContain(`${receiptNumber}.pdf`);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('returns 404 for unknown receipt number', async () => {
      await request(app.getHttpServer())
        .get('/receipts/transaction/RCP-UNKNOWN.pdf')
        .expect(404);
    });
  });

  describe('GET /receipts/statement/:memberId.pdf', () => {
    it('streams a member statement PDF', async () => {
      const res = await request(app.getHttpServer())
        .get(`/receipts/statement/${member.id}.pdf`)
        .expect(200);

      expect(res.headers['content-type']).toContain('application/pdf');
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('returns 404 for non-existent member', async () => {
      await request(app.getHttpServer())
        .get('/receipts/statement/member-not-found.pdf')
        .expect(404);
    });
  });

  describe('GET /verify/receipt/:receiptNumber', () => {
    it('returns verification metadata for valid receipt', async () => {
      const res = await request(app.getHttpServer())
        .get(`/verify/receipt/${receiptNumber}`)
        .expect(200);

      expect(res.body.receiptNumber).toBe(receiptNumber);
      expect(res.body.memberName).toContain('Test');
      expect(res.body.amount).toBe(1500);
      expect(res.body.verifiedAt).toBeDefined();
    });

    it('returns 404 for invalid receipt', async () => {
      await request(app.getHttpServer())
        .get('/verify/receipt/RCP-NOT-THERE')
        .expect(404);
    });
  });

  async function seedData() {
    const passwordHash = '$2b$10$receiptstesthashreceiptstestha';
    tellerUserId = `receipt-teller-${Date.now()}`;
    memberUserId = `receipt-member-${Date.now()}`;

    await prisma.user.createMany({
      data: [
        { id: tellerUserId, email: 'teller.receipts@test.com', password: passwordHash, role: UserRole.CLERK },
        { id: memberUserId, email: 'member.receipts@test.com', password: passwordHash, role: UserRole.MEMBER },
      ],
      skipDuplicates: true,
    });

    member = await prisma.member.create({
      data: {
        id: `receipt-member-${Date.now()}`,
        userId: memberUserId,
        memberNumber: `RCP-MEM-${Math.floor(Math.random() * 10000)}`,
        firstName: 'Test',
        lastName: 'Member',
        email: 'member.receipts@test.com',
        idPassportNumber: `ID-${Date.now()}`,
        telephone: '+254711111111',
        physicalAddress: 'Test Lane 123',
        dateOfBirth: new Date('1990-01-01'),
        nextOfKinName: 'Kin Test',
        nextOfKinPhone: '+254722222222',
        nextOfKinRelationship: 'Sibling',
        membershipStatus: 'ACTIVE',
      },
    });

    receiptNumber = `RCP-TEST-${Date.now()}`;

    await prisma.transaction.create({
      data: {
        id: `txn-receipt-${Date.now()}`,
        memberId: member.id,
        cashierId: tellerUserId,
        branchId: null,
        amount: new Prisma.Decimal(1500),
        type: TransactionType.SAVINGS_DEPOSIT,
        channel: TransactionChannel.CASH,
        status: 'POSTED',
        reference: 'RCPT-REF',
        narration: 'Manual teller deposit',
        valueDate: new Date('2024-02-01T10:00:00Z'),
        balanceAfter: new Prisma.Decimal(1500),
        receiptNumber,
      },
    });

    await prisma.transaction.create({
      data: {
        id: `txn-receipt-${Date.now()}-2`,
        memberId: member.id,
        cashierId: tellerUserId,
        branchId: null,
        amount: new Prisma.Decimal(1000),
        type: TransactionType.SHARES_DEPOSIT,
        channel: TransactionChannel.MOBILE_MONEY,
        status: 'POSTED',
        reference: 'RCPT-REF-2',
        narration: 'Share top-up',
        valueDate: new Date('2024-03-01T09:00:00Z'),
        balanceAfter: new Prisma.Decimal(2500),
        receiptNumber: `RCP-TEST-${Date.now()}-ALT`,
      },
    });
  }

  async function cleanup() {
    await prisma.transaction.deleteMany({ where: { memberId: member?.id } });
    if (member) {
      await prisma.member.delete({ where: { id: member.id } });
    }
    const userIds: string[] = [];
    if (tellerUserId) {
      userIds.push(tellerUserId);
    }
    if (memberUserId) {
      userIds.push(memberUserId);
    }
    if (userIds.length) {
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
  }
});
