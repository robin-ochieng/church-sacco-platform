import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { MpesaMessageStatus } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('M-Pesa Integration (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = app.get<PrismaService>(PrismaService);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // Clean up before each test
  beforeEach(async () => {
    await prisma.mpesaMessage.deleteMany();
    await prisma.transaction.deleteMany({
      where: { channel: 'MOBILE_MONEY' },
    });
    // Clean up test member if exists
    await prisma.member.deleteMany({
      where: { id: 'test-member-mpesa-1' },
    });
    await prisma.user.deleteMany({
      where: { id: 'user-mpesa-1' },
    });
  });

  const mockWebhookPayload = {
    TransID: 'SAF12345XYZ',
    MSISDN: '254712345678',
    TransAmount: 1000,
    BusinessShortCode: '600000',
    BillRefNumber: 'TEST-REF',
    TransactionType: 'Paybill',
    TransTime: '20251120123045',
    FirstName: 'John',
    LastName: 'Doe',
  };

  describe('POST /mpesa/c2b/webhook', () => {
    it('should handle exact match (Member found)', async () => {
      // 1. Create a test member with matching phone
      const member = await prisma.member.create({
        data: {
          id: 'test-member-mpesa-1',
          memberNumber: 'MEM-MPESA-001',
          firstName: 'Mpesa',
          lastName: 'Tester',
          email: 'mpesa.tester@example.com',
          idPassportNumber: 'ID-MPESA-001',
          physicalAddress: 'Test Address',
          telephone: '0712345678', // Matches 254712345678
          phoneLast4: '5678',
          dateOfBirth: new Date(),
          nextOfKinName: 'Next Kin',
          nextOfKinPhone: '0700000000',
          nextOfKinRelationship: 'Sibling',
          user: {
            create: {
              id: 'user-mpesa-1',
              email: 'mpesa.tester@example.com',
              password: 'hashedpassword',
            },
          },
        },
      });

      // 2. Send webhook
      const response = await request(app.getHttpServer())
        .post('/mpesa/c2b/webhook')
        .send(mockWebhookPayload)
        .expect(200);

      expect(response.body).toEqual({
        ResultCode: 0,
        ResultDesc: 'Success',
      });

      // 3. Verify MpesaMessage created with MATCHED status
      const message = await prisma.mpesaMessage.findUnique({
        where: { mpesaRef: mockWebhookPayload.TransID },
      });
      expect(message).toBeDefined();
      if (!message) throw new Error('Message is null');
      expect(message.status).toBe(MpesaMessageStatus.MATCHED);
      expect(message.matchedTxnId).toBeDefined();

      // 4. Verify Transaction created
      const transaction = await prisma.transaction.findFirst({
        where: { id: message.matchedTxnId! },
      });
      expect(transaction).toBeDefined();
      if (!transaction) throw new Error('Transaction is null');
      expect(transaction.amount.toNumber()).toBe(1000);
      expect(transaction.memberId).toBe(member.id);
    });

    it('should handle suspense (No member found)', async () => {
      // 1. Send webhook with unknown phone
      const unknownPayload = {
        ...mockWebhookPayload,
        TransID: 'SAF-UNKNOWN-001',
        MSISDN: '254799999999', // Unknown number
      };

      await request(app.getHttpServer())
        .post('/mpesa/c2b/webhook')
        .send(unknownPayload)
        .expect(200);

      // 2. Verify MpesaMessage created with SUSPENSE status
      const message = await prisma.mpesaMessage.findUnique({
        where: { mpesaRef: unknownPayload.TransID },
      });
      expect(message).toBeDefined();
      if (!message) throw new Error('Message is null');
      expect(message.status).toBe(MpesaMessageStatus.SUSPENSE);
      expect(message.matchedTxnId).toBeNull();
    });

    it('should handle duplicate reference (Idempotency)', async () => {
      // 1. Send first request
      await request(app.getHttpServer())
        .post('/mpesa/c2b/webhook')
        .send(mockWebhookPayload)
        .expect(200);

      // 2. Send duplicate request
      await request(app.getHttpServer())
        .post('/mpesa/c2b/webhook')
        .send(mockWebhookPayload)
        .expect(200);

      // 3. Verify only one record exists
      const messages = await prisma.mpesaMessage.findMany({
        where: { mpesaRef: mockWebhookPayload.TransID },
      });
      expect(messages.length).toBe(1);
    });
  });
});
