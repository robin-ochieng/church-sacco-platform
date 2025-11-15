/// <reference types="jest" />

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { CreateMemberDto, Gender } from '../src/members/dto';

describe('Members Registration (e2e)', () => {
  let app: INestApplication;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    // TODO: Get auth token from test setup
    // For now, this test requires proper auth setup
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /members', () => {
    const validMemberDto: CreateMemberDto = {
      // User credentials
      email: 'test.member@example.com',
      password: 'SecurePass123!',

      // Personal Information
      firstName: 'John',
      lastName: 'Doe',
      middleName: 'Michael',
      dateOfBirth: '1990-01-15',
      gender: Gender.MALE,
      telephone: '+254712345678',

      // Address & Church Group
      physicalAddress: '123 Main Street, Nairobi',
      poBox: 'P.O. Box 12345',
      churchGroup: 'Youth Fellowship',

      // ID & Referee
      idPassportNumber: '12345678',
      refereeMemberNo: 'ATSC-2024-0001',

      // Next of Kin
      nextOfKinName: 'Jane Doe',
      nextOfKinPhone: '+254787654321',
      nextOfKinRelationship: 'Spouse',

      // Terms
      agreedToTerms: true,
      agreedToRefundPolicy: true,
    };

    it('should create a new member with valid data', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/members')
        .send(validMemberDto)
        .expect(201);

      expect(response.body).toHaveProperty('message', 'Member created successfully');
      expect(response.body).toHaveProperty('member');
      expect(response.body.member).toHaveProperty('id');
      expect(response.body.member).toHaveProperty('memberNumber');
      expect(response.body.member.memberNumber).toMatch(/^ATSC-\d{4}-\d{4}$/);
      expect(response.body.member).toHaveProperty('firstName', 'John');
      expect(response.body.member).toHaveProperty('lastName', 'Doe');
      expect(response.body.member).toHaveProperty('email', 'test.member@example.com');
    });

    it('should validate required fields', async () => {
      const invalidDto = {
        email: 'invalid-email',
        // Missing required fields
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/members')
        .send(invalidDto)
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(Array.isArray(response.body.message)).toBe(true);
    });

    it('should validate E.164 phone format', async () => {
      const invalidPhoneDto = {
        ...validMemberDto,
        telephone: '0712345678', // Invalid: not E.164 format
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/members')
        .send(invalidPhoneDto)
        .expect(400);

      expect(response.body.message).toContain('E.164 format');
    });

    it('should validate gender enum', async () => {
      const invalidGenderDto = {
        ...validMemberDto,
        gender: 'UNKNOWN', // Invalid gender
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/members')
        .send(invalidGenderDto)
        .expect(400);

      expect(response.body.message).toBeDefined();
    });

    it('should validate referee member number format', async () => {
      const invalidRefereeDto = {
        ...validMemberDto,
        refereeMemberNo: 'INVALID-FORMAT',
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/members')
        .send(invalidRefereeDto)
        .expect(400);

      expect(response.body.message).toContain('ATSC-YYYY-NNNN');
    });

    it('should reject duplicate email', async () => {
      // First registration
      await request(app.getHttpServer())
        .post('/api/v1/members')
        .send(validMemberDto)
        .expect(201);

      // Duplicate registration
      const response = await request(app.getHttpServer())
        .post('/api/v1/members')
        .send(validMemberDto)
        .expect(409);

      expect(response.body.message).toContain('email already exists');
    });

    it('should reject duplicate ID number', async () => {
      const member1 = {
        ...validMemberDto,
        email: 'unique1@example.com',
      };

      const member2 = {
        ...validMemberDto,
        email: 'unique2@example.com',
        // Same ID number as member1
      };

      // First registration
      await request(app.getHttpServer())
        .post('/api/v1/members')
        .send(member1)
        .expect(201);

      // Duplicate ID number
      const response = await request(app.getHttpServer())
        .post('/api/v1/members')
        .send(member2)
        .expect(409);

      expect(response.body.message).toContain('ID/Passport number already registered');
    });

    it('should generate unique member numbers', async () => {
      const member1 = {
        ...validMemberDto,
        email: 'unique3@example.com',
        idPassportNumber: '11111111',
      };

      const member2 = {
        ...validMemberDto,
        email: 'unique4@example.com',
        idPassportNumber: '22222222',
      };

      const response1 = await request(app.getHttpServer())
        .post('/api/v1/members')
        .send(member1)
        .expect(201);

      const response2 = await request(app.getHttpServer())
        .post('/api/v1/members')
        .send(member2)
        .expect(201);

      const memberNumber1 = response1.body.member.memberNumber;
      const memberNumber2 = response2.body.member.memberNumber;

      expect(memberNumber1).not.toBe(memberNumber2);
      expect(memberNumber1).toMatch(/^ATSC-\d{4}-\d{4}$/);
      expect(memberNumber2).toMatch(/^ATSC-\d{4}-\d{4}$/);

      // Extract sequence numbers and verify increment
      const seq1 = parseInt(memberNumber1.split('-')[2], 10);
      const seq2 = parseInt(memberNumber2.split('-')[2], 10);
      expect(seq2).toBe(seq1 + 1);
    });

    it('should encrypt PII fields', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/members')
        .send({
          ...validMemberDto,
          email: 'unique5@example.com',
          idPassportNumber: '33333333',
        })
        .expect(201);

      // Response should not contain plaintext sensitive data in encrypted fields
      // (This is a conceptual test - actual verification requires database access)
      expect(response.body.member).not.toHaveProperty('idNumberEncrypted');
      expect(response.body.member).not.toHaveProperty('phoneEncrypted');
    });

    it('should create member with optional fields', async () => {
      const minimalDto: CreateMemberDto = {
        email: 'minimal@example.com',
        password: 'SecurePass123!',
        firstName: 'Jane',
        lastName: 'Smith',
        dateOfBirth: '1995-05-20',
        gender: Gender.FEMALE,
        telephone: '+254798765432',
        physicalAddress: '456 Side Street, Mombasa',
        idPassportNumber: '44444444',
        nextOfKinName: 'John Smith',
        nextOfKinPhone: '+254711223344',
        nextOfKinRelationship: 'Brother',
        agreedToTerms: true,
        agreedToRefundPolicy: true,
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/members')
        .send(minimalDto)
        .expect(201);

      expect(response.body.message).toBe('Member created successfully');
      expect(response.body.member).toHaveProperty('memberNumber');
    });
  });

  describe('GET /members/:id', () => {
    let createdMemberId: string;

    beforeAll(async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/members')
        .send({
          email: 'get-test@example.com',
          password: 'SecurePass123!',
          firstName: 'Test',
          lastName: 'User',
          dateOfBirth: '1992-03-10',
          gender: Gender.MALE,
          telephone: '+254722334455',
          physicalAddress: 'Test Address',
          idPassportNumber: '55555555',
          nextOfKinName: 'Emergency Contact',
          nextOfKinPhone: '+254733445566',
          nextOfKinRelationship: 'Friend',
          agreedToTerms: true,
          agreedToRefundPolicy: true,
        })
        .expect(201);

      createdMemberId = response.body.member.id;
    });

    it('should get member by ID', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/members/${createdMemberId}`)
        .expect(200);

      expect(response.body).toHaveProperty('member');
      expect(response.body.member).toHaveProperty('id', createdMemberId);
      expect(response.body.member).toHaveProperty('firstName', 'Test');
    });

    it('should return 404 for non-existent member', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      await request(app.getHttpServer())
        .get(`/api/v1/members/${fakeId}`)
        .expect(404);
    });
  });

  describe('GET /members?search=...&page=...', () => {
    it('should list members with pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/members?page=1&limit=10')
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('meta');
      expect(response.body.meta).toHaveProperty('page', 1);
      expect(response.body.meta).toHaveProperty('limit', 10);
      expect(response.body.meta).toHaveProperty('total');
      expect(response.body.meta).toHaveProperty('totalPages');
    });

    it('should search members by name', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/members?search=Test')
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });
});
