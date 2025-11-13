/// <reference types="jest" />
import request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';

describe('Health Check (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    
    // Apply same validation pipe as main.ts
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      })
    );
    
    // Apply global prefix
    app.setGlobalPrefix('api/v1');
    
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/health', () => {
    it('should return health status with ok', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('service', 'ACK Thiboro SACCO API');
    });

    it('should return valid ISO 8601 timestamp', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);

      const timestamp = response.body.timestamp;
      expect(timestamp).toBeDefined();
      
      // Verify it's a valid ISO 8601 date
      const date = new Date(timestamp);
      expect(date.toISOString()).toBe(timestamp);
    });

    it('should return current timestamp (within last 5 seconds)', async () => {
      const before = new Date();
      
      const response = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);

      const after = new Date();
      const timestamp = new Date(response.body.timestamp);

      // Timestamp should be between before and after
      expect(timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should have correct response headers', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });

    it('should be accessible without authentication', async () => {
      // No Authorization header - should still work
      await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);
    });

    it('should return consistent structure on multiple calls', async () => {
      const response1 = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);

      const response2 = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);

      // Both should have same structure
      expect(Object.keys(response1.body).sort()).toEqual(
        Object.keys(response2.body).sort()
      );
      
      // Status and service should be identical
      expect(response1.body.status).toBe(response2.body.status);
      expect(response1.body.service).toBe(response2.body.service);
      
      // Timestamps should be different (but close)
      expect(response1.body.timestamp).not.toBe(response2.body.timestamp);
    });
  });

  describe('GET /api/v1 (root)', () => {
    it('should return welcome message', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1')
        .expect(200);

      expect(typeof response.text).toBe('string');
      expect(response.text.length).toBeGreaterThan(0);
    });
  });
});
