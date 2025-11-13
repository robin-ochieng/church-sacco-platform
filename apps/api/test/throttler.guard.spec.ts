/// <reference types="jest" />
import { Controller, Get, INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import * as request from 'supertest';

// Test controller with a simple endpoint
@Controller('test-throttle')
class TestController {
  @Get()
  getTest() {
    return { message: 'success' };
  }
}

describe('Rate Limiting (Unit)', () => {
  let app: INestApplication;
  let server: any;

  beforeEach(async () => {
    // Create a fresh app instance for each test to avoid rate limit interference
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([{
          ttl: 2000, // 2 seconds for testing
          limit: 3,  // 3 requests max
        }]),
      ],
      controllers: [TestController],
      providers: [
        {
          provide: APP_GUARD,
          useClass: ThrottlerGuard,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    server = app.getHttpServer();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should allow requests under the rate limit', async () => {
    // First request should succeed
    const response1 = await request(server)
      .get('/test-throttle')
      .expect(200);

    expect(response1.body.message).toBe('success');

    // Second request should also succeed
    const response2 = await request(server)
      .get('/test-throttle')
      .expect(200);

    expect(response2.body.message).toBe('success');

    // Verify rate limit headers are present
    expect(response2.headers['x-ratelimit-limit']).toBeDefined();
    expect(response2.headers['x-ratelimit-remaining']).toBeDefined();
  });

  it('should return 429 when rate limit is exceeded', async () => {
    // Make requests up to the limit (3 requests)
    await request(server).get('/test-throttle').expect(200);
    await request(server).get('/test-throttle').expect(200);
    await request(server).get('/test-throttle').expect(200);

    // Fourth request should be rate limited
    const response = await request(server)
      .get('/test-throttle')
      .expect(429);

    // Verify it has the appropriate status and message
    expect(response.body.statusCode).toBe(429);
    expect(response.body.message).toBeDefined();
    
    // Retry-after header should be present
    expect(response.headers['retry-after']).toBeDefined();
  });

  it('should reset limit after TTL expires', async () => {
    // Exhaust the limit
    await request(server).get('/test-throttle');
    await request(server).get('/test-throttle');
    await request(server).get('/test-throttle');

    // Verify we're rate limited
    await request(server).get('/test-throttle').expect(429);

    // Wait for TTL to expire (2 seconds + buffer)
    await new Promise(resolve => setTimeout(resolve, 2500));

    // Should allow requests again
    const response = await request(server)
      .get('/test-throttle')
      .expect(200);

    expect(response.body.message).toBe('success');
  }, 10000); // Increase timeout for this test

  it('should include proper error message in 429 response', async () => {
    // Exhaust the limit
    await request(server).get('/test-throttle');
    await request(server).get('/test-throttle');
    await request(server).get('/test-throttle');

    // Fourth request should be rate limited with proper message
    const response = await request(server)
      .get('/test-throttle')
      .expect(429);

    expect(response.body.message).toBeDefined();
    expect(response.body.statusCode).toBe(429);
  });
});
