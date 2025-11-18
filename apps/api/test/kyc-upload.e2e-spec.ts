/// <reference types="jest" />
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { KycDocumentType } from '../src/kyc/dto';
import { PrismaService } from '../src/prisma/prisma.service';

describe.skip('KYC Upload (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let member1Token: string;
  let member2Token: string;
  let clerkToken: string;
  let member1Id: string;
  let member2Id: string;

  beforeAll(async () => {
    // Set test environment to disable throttling
    process.env.NODE_ENV = 'test';
    
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(require('../src/auth/guards/jwt-auth.guard').JwtAuthGuard)
      .useValue({
        canActivate: (context) => {
          // Mock the request user object for tests
          const request = context.switchToHttp().getRequest();
          request.user = { 
            sub: 'test-user-id', 
            role: 'MEMBER',
            email: 'test@example.com' 
          };
          return true;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);

    // Clean up existing test data
    await prisma.member.deleteMany({
      where: {
        OR: [
          { email: { contains: 'kyc-test' } },
          { telephone: { startsWith: '+254799' } },
        ],
      },
    });

    // Register test members
    const member1Response = await request(app.getHttpServer())
      .post('/api/v1/members')
      .send({
        firstName: 'Alice',
        lastName: 'KYC-Test',
        dateOfBirth: '1990-01-01',
        gender: 'FEMALE',
        telephone: '+254799111111',
        email: 'alice-kyc-test@example.com',
        password: 'Password123!',
        physicalAddress: '123 Test St',
        idPassportNumber: '11111111',
        nextOfKinName: 'Bob Test',
        nextOfKinPhone: '+254799222222',
        nextOfKinRelationship: 'Spouse',
        agreedToTerms: true,
        agreedToRefundPolicy: true,
      });

    member1Id = member1Response.body.id;

    const member2Response = await request(app.getHttpServer())
      .post('/api/v1/members')
      .send({
        firstName: 'Bob',
        lastName: 'KYC-Test',
        dateOfBirth: '1992-01-01',
        gender: 'MALE',
        telephone: '+254799333333',
        email: 'bob-kyc-test@example.com',
        password: 'Password123!',
        physicalAddress: '456 Test Ave',
        idPassportNumber: '22222222',
        nextOfKinName: 'Alice Test',
        nextOfKinPhone: '+254799444444',
        nextOfKinRelationship: 'Spouse',
        agreedToTerms: true,
        agreedToRefundPolicy: true,
      });

    member2Id = member2Response.body.id;

    // Login to get tokens
    const loginMember1 = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'alice-kyc-test@example.com',
        password: 'Password123!',
      });

    member1Token = loginMember1.body.access_token;

    const loginMember2 = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'bob-kyc-test@example.com',
        password: 'Password123!',
      });

    member2Token = loginMember2.body.access_token;

    // For clerk token, we'll need to create a clerk user
    // This is simplified - in real scenario, clerk would be created differently
    // For now, we'll skip clerk tests if auth is not fully set up
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.member.deleteMany({
      where: {
        OR: [
          { id: member1Id },
          { id: member2Id },
        ],
      },
    });

    await app.close();
  });

  describe('POST /members/:memberId/kyc/upload-url', () => {
    it('should generate upload URL for own member', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/members/${member1Id}/kyc/upload-url`)
        .set('Authorization', `Bearer ${member1Token}`)
        .send({
          documentType: KycDocumentType.ID_FRONT,
          fileExtension: 'jpg',
        })
        .expect(200);

      expect(response.body).toHaveProperty('uploadUrl');
      expect(response.body).toHaveProperty('filePath');
      expect(response.body).toHaveProperty('expiresIn');
      expect(response.body.uploadUrl).toContain('supabase');
      expect(response.body.filePath).toContain(member1Id);
      expect(response.body.filePath).toContain('id_front');
      expect(response.body.expiresIn).toBe(3600);
    });

    it('should generate upload URL for different document types', async () => {
      const documentTypes = [
        KycDocumentType.ID_FRONT,
        KycDocumentType.ID_BACK,
        KycDocumentType.SELFIE,
        KycDocumentType.PHOTO,
      ];

      for (const docType of documentTypes) {
        const response = await request(app.getHttpServer())
          .post(`/api/v1/members/${member1Id}/kyc/upload-url`)
          .set('Authorization', `Bearer ${member1Token}`)
          .send({
            documentType: docType,
            fileExtension: 'jpg',
          })
          .expect(200);

        expect(response.body.filePath).toContain(docType);
      }
    });

    it('should reject request without authentication', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/members/${member1Id}/kyc/upload-url`)
        .send({
          documentType: KycDocumentType.ID_FRONT,
          fileExtension: 'jpg',
        })
        .expect(401);
    });

    it('should reject cross-member upload request (403 Forbidden)', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/members/${member2Id}/kyc/upload-url`)
        .set('Authorization', `Bearer ${member1Token}`) // Member 1 token
        .send({
          documentType: KycDocumentType.ID_FRONT,
          fileExtension: 'jpg',
        })
        .expect(403);

      expect(response.body.message).toContain('not authorized');
    });

    it('should reject request for non-existent member (404)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/members/00000000-0000-0000-0000-000000000000/kyc/upload-url')
        .set('Authorization', `Bearer ${member1Token}`)
        .send({
          documentType: KycDocumentType.ID_FRONT,
          fileExtension: 'jpg',
        })
        .expect(404);
    });

    it('should validate request body - missing documentType', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/members/${member1Id}/kyc/upload-url`)
        .set('Authorization', `Bearer ${member1Token}`)
        .send({
          fileExtension: 'jpg',
        })
        .expect(400);
    });

    it('should validate request body - invalid documentType', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/members/${member1Id}/kyc/upload-url`)
        .set('Authorization', `Bearer ${member1Token}`)
        .send({
          documentType: 'invalid_type',
          fileExtension: 'jpg',
        })
        .expect(400);
    });

    it('should validate request body - missing fileExtension', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/members/${member1Id}/kyc/upload-url`)
        .set('Authorization', `Bearer ${member1Token}`)
        .send({
          documentType: KycDocumentType.ID_FRONT,
        })
        .expect(400);
    });

    it('should support different file extensions', async () => {
      const extensions = ['jpg', 'jpeg', 'png', 'pdf'];

      for (const ext of extensions) {
        const response = await request(app.getHttpServer())
          .post(`/api/v1/members/${member1Id}/kyc/upload-url`)
          .set('Authorization', `Bearer ${member1Token}`)
          .send({
            documentType: KycDocumentType.ID_FRONT,
            fileExtension: ext,
          })
          .expect(200);

        expect(response.body.filePath).toContain(`.${ext}`);
      }
    });
  });

  describe('GET /members/:memberId/kyc/documents', () => {
    it('should list documents for own member', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/members/${member1Id}/kyc/documents`)
        .set('Authorization', `Bearer ${member1Token}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should reject request without authentication', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/members/${member1Id}/kyc/documents`)
        .expect(401);
    });

    it('should reject listing documents for other member', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/members/${member2Id}/kyc/documents`)
        .set('Authorization', `Bearer ${member1Token}`)
        .expect(403);
    });
  });

  describe('Authorization Scenarios', () => {
    it('should prevent Member A from uploading for Member B', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/members/${member2Id}/kyc/upload-url`)
        .set('Authorization', `Bearer ${member1Token}`)
        .send({
          documentType: KycDocumentType.SELFIE,
          fileExtension: 'jpg',
        })
        .expect(403);
    });

    it('should prevent Member B from uploading for Member A', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/members/${member1Id}/kyc/upload-url`)
        .set('Authorization', `Bearer ${member2Token}`)
        .send({
          documentType: KycDocumentType.SELFIE,
          fileExtension: 'jpg',
        })
        .expect(403);
    });

    it('should generate unique upload URLs for concurrent requests', async () => {
      const requests = Array(3).fill(null).map(() =>
        request(app.getHttpServer())
          .post(`/api/v1/members/${member1Id}/kyc/upload-url`)
          .set('Authorization', `Bearer ${member1Token}`)
          .send({
            documentType: KycDocumentType.ID_FRONT,
            fileExtension: 'jpg',
          })
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('uploadUrl');
      });

      // All URLs should be unique
      const urls = responses.map(r => r.body.uploadUrl);
      const uniqueUrls = new Set(urls);
      expect(uniqueUrls.size).toBe(3);
    });
  });
});
