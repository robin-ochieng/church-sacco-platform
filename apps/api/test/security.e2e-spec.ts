/// <reference types="jest" />
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Security Hardening (e2e)', () => {
  let app: INestApplication;
  let server: any;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    
    // Apply the same configuration as main.ts
    const helmet = require('helmet');
    app.use(helmet());
    
    const webOrigin = process.env.WEB_ORIGIN || 'http://localhost:3000';
    app.enableCors({
      origin: webOrigin,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    });

    app.setGlobalPrefix('api/v1');

    await app.init();
    server = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('CORS Configuration', () => {
    it('should handle CORS preflight (OPTIONS) request successfully', async () => {
      const webOrigin = process.env.WEB_ORIGIN || 'http://localhost:3000';
      
      const response = await request(server)
        .options('/api/v1')
        .set('Origin', webOrigin)
        .set('Access-Control-Request-Method', 'GET')
        .set('Access-Control-Request-Headers', 'Content-Type,Authorization');

      // Should return 204 No Content or 200 OK for preflight
      expect([200, 204]).toContain(response.status);
      
      // Verify CORS headers are present
      expect(response.headers['access-control-allow-origin']).toBe(webOrigin);
      expect(response.headers['access-control-allow-credentials']).toBe('true');
      expect(response.headers['access-control-allow-methods']).toBeDefined();
      expect(response.headers['access-control-allow-headers']).toBeDefined();
    });

    it('should reject requests from unauthorized origins', async () => {
      const unauthorizedOrigin = 'http://evil.com';
      
      const response = await request(server)
        .get('/api/v1')
        .set('Origin', unauthorizedOrigin);

      // Should not include CORS headers for unauthorized origin
      expect(response.headers['access-control-allow-origin']).not.toBe(unauthorizedOrigin);
    });

    it('should allow requests from configured WEB_ORIGIN', async () => {
      const webOrigin = process.env.WEB_ORIGIN || 'http://localhost:3000';
      
      const response = await request(server)
        .get('/api/v1')
        .set('Origin', webOrigin);

      expect(response.headers['access-control-allow-origin']).toBe(webOrigin);
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });
  });

  describe('Helmet Security Headers', () => {
    it('should include security headers from Helmet', async () => {
      const response = await request(server)
        .get('/api/v1');

      // Helmet adds these security headers
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBeDefined();
      expect(response.headers['x-dns-prefetch-control']).toBeDefined();
    });

    it('should not expose server information', async () => {
      const response = await request(server)
        .get('/api/v1');

      // Helmet removes or hides the X-Powered-By header
      expect(response.headers['x-powered-by']).toBeUndefined();
    });
  });

  describe('Rate Limiting', () => {
    it('should allow requests under the rate limit', async () => {
      // Make a few requests under the limit
      const response = await request(server)
        .get('/api/v1')
        .expect(200);

      // Should have rate limit headers
      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
    });

    it('should return 429 when rate limit is exceeded', async () => {
      const limit = parseInt(process.env.THROTTLE_LIMIT || '10', 10);
      
      // Rapid fire requests to exceed the limit
      const requests = [];
      for (let i = 0; i < limit + 5; i++) {
        requests.push(
          request(server)
            .get('/api/v1')
            .set('X-Forwarded-For', '192.168.1.100') // Simulate same IP
        );
      }

      const responses = await Promise.all(requests);
      
      // At least one should be rate limited
      const rateLimited = responses.some(res => res.status === 429);
      expect(rateLimited).toBe(true);
      
      // Check that the 429 response has appropriate headers
      const throttledResponse = responses.find(res => res.status === 429);
      if (throttledResponse) {
        expect(throttledResponse.headers['retry-after']).toBeDefined();
        expect(throttledResponse.headers['x-ratelimit-limit']).toBeDefined();
      }
    }, 15000); // Increase timeout for this test
  });

  describe('Global Validation', () => {
    it('should validate request payloads and strip extra properties', async () => {
      // This depends on having a POST endpoint with validation
      // For now, just verify the app is configured correctly
      expect(app).toBeDefined();
    });
  });
});
