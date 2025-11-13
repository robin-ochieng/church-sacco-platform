/// <reference types="jest" />
import { envValidationSchema } from '../src/config/env.validation';

describe('Environment Variable Validation', () => {
  describe('Required Variables', () => {
    it('should fail if DATABASE_URL is missing', () => {
      const result = envValidationSchema.validate({
        JWT_SECRET: 'a'.repeat(32),
        JWT_REFRESH_SECRET: 'b'.repeat(32),
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_ANON_KEY: 'test-anon',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service',
        WEB_ORIGIN: 'http://localhost:3000',
        PII_ENCRYPTION_KEY: Buffer.from('test').toString('base64'),
      });

      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('DATABASE_URL');
    });

    it('should fail if JWT_SECRET is missing', () => {
      const result = envValidationSchema.validate({
        DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
        JWT_REFRESH_SECRET: 'b'.repeat(32),
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_ANON_KEY: 'test-anon',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service',
        WEB_ORIGIN: 'http://localhost:3000',
        PII_ENCRYPTION_KEY: Buffer.from('test').toString('base64'),
      });

      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('JWT_SECRET');
    });

    it('should fail if JWT_REFRESH_SECRET is missing', () => {
      const result = envValidationSchema.validate({
        DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
        JWT_SECRET: 'a'.repeat(32),
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_ANON_KEY: 'test-anon',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service',
        WEB_ORIGIN: 'http://localhost:3000',
        PII_ENCRYPTION_KEY: Buffer.from('test').toString('base64'),
      });

      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('JWT_REFRESH_SECRET');
    });

    it('should fail if SUPABASE_URL is missing', () => {
      const result = envValidationSchema.validate({
        DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
        JWT_SECRET: 'a'.repeat(32),
        JWT_REFRESH_SECRET: 'b'.repeat(32),
        SUPABASE_ANON_KEY: 'test-anon',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service',
        WEB_ORIGIN: 'http://localhost:3000',
        PII_ENCRYPTION_KEY: Buffer.from('test').toString('base64'),
      });

      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('SUPABASE_URL');
    });

    it('should fail if WEB_ORIGIN is missing', () => {
      const result = envValidationSchema.validate({
        DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
        JWT_SECRET: 'a'.repeat(32),
        JWT_REFRESH_SECRET: 'b'.repeat(32),
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_ANON_KEY: 'test-anon',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service',
        PII_ENCRYPTION_KEY: Buffer.from('test').toString('base64'),
      });

      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('WEB_ORIGIN');
    });

    it('should fail if PII_ENCRYPTION_KEY is missing', () => {
      const result = envValidationSchema.validate({
        DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
        JWT_SECRET: 'a'.repeat(32),
        JWT_REFRESH_SECRET: 'b'.repeat(32),
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_ANON_KEY: 'test-anon',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service',
        WEB_ORIGIN: 'http://localhost:3000',
      });

      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('PII_ENCRYPTION_KEY');
    });
  });

  describe('Format Validation', () => {
    it('should fail if DATABASE_URL is not a valid PostgreSQL URI', () => {
      const result = envValidationSchema.validate({
        DATABASE_URL: 'not-a-valid-uri',
        JWT_SECRET: 'a'.repeat(32),
        JWT_REFRESH_SECRET: 'b'.repeat(32),
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_ANON_KEY: 'test-anon',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service',
        WEB_ORIGIN: 'http://localhost:3000',
        PII_ENCRYPTION_KEY: Buffer.from('test').toString('base64'),
      });

      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('DATABASE_URL');
    });

    it('should fail if JWT_SECRET is too short', () => {
      const result = envValidationSchema.validate({
        DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
        JWT_SECRET: 'too-short',
        JWT_REFRESH_SECRET: 'b'.repeat(32),
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_ANON_KEY: 'test-anon',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service',
        WEB_ORIGIN: 'http://localhost:3000',
        PII_ENCRYPTION_KEY: Buffer.from('test').toString('base64'),
      });

      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('JWT_SECRET');
      expect(result.error?.message).toContain('32');
    });

    it('should fail if SUPABASE_URL is not a valid URI', () => {
      const result = envValidationSchema.validate({
        DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
        JWT_SECRET: 'a'.repeat(32),
        JWT_REFRESH_SECRET: 'b'.repeat(32),
        SUPABASE_URL: 'not-a-url',
        SUPABASE_ANON_KEY: 'test-anon',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service',
        WEB_ORIGIN: 'http://localhost:3000',
        PII_ENCRYPTION_KEY: Buffer.from('test').toString('base64'),
      });

      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('SUPABASE_URL');
    });

    it('should fail if WEB_ORIGIN is not a valid URI', () => {
      const result = envValidationSchema.validate({
        DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
        JWT_SECRET: 'a'.repeat(32),
        JWT_REFRESH_SECRET: 'b'.repeat(32),
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_ANON_KEY: 'test-anon',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service',
        WEB_ORIGIN: 'not-a-url',
        PII_ENCRYPTION_KEY: Buffer.from('test').toString('base64'),
      });

      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('WEB_ORIGIN');
    });

    it('should fail if PII_ENCRYPTION_KEY is not valid base64', () => {
      const result = envValidationSchema.validate({
        DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
        JWT_SECRET: 'a'.repeat(32),
        JWT_REFRESH_SECRET: 'b'.repeat(32),
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_ANON_KEY: 'test-anon',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service',
        WEB_ORIGIN: 'http://localhost:3000',
        PII_ENCRYPTION_KEY: 'not-valid-base64!!!',
      });

      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('PII_ENCRYPTION_KEY');
    });

    it('should fail if PORT is not a valid port number', () => {
      const result = envValidationSchema.validate({
        PORT: 99999, // Invalid port
        DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
        JWT_SECRET: 'a'.repeat(32),
        JWT_REFRESH_SECRET: 'b'.repeat(32),
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_ANON_KEY: 'test-anon',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service',
        WEB_ORIGIN: 'http://localhost:3000',
        PII_ENCRYPTION_KEY: Buffer.from('test').toString('base64'),
      });

      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('PORT');
    });
  });

  describe('Default Values', () => {
    it('should use default NODE_ENV if not provided', () => {
      const result = envValidationSchema.validate({
        DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
        JWT_SECRET: 'a'.repeat(32),
        JWT_REFRESH_SECRET: 'b'.repeat(32),
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_ANON_KEY: 'test-anon',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service',
        WEB_ORIGIN: 'http://localhost:3000',
        PII_ENCRYPTION_KEY: Buffer.from('test').toString('base64'),
      });

      expect(result.error).toBeUndefined();
      expect(result.value.NODE_ENV).toBe('development');
    });

    it('should use default PORT if not provided', () => {
      const result = envValidationSchema.validate({
        DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
        JWT_SECRET: 'a'.repeat(32),
        JWT_REFRESH_SECRET: 'b'.repeat(32),
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_ANON_KEY: 'test-anon',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service',
        WEB_ORIGIN: 'http://localhost:3000',
        PII_ENCRYPTION_KEY: Buffer.from('test').toString('base64'),
      });

      expect(result.error).toBeUndefined();
      expect(result.value.PORT).toBe(3001);
    });

    it('should use default THROTTLE_TTL if not provided', () => {
      const result = envValidationSchema.validate({
        DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
        JWT_SECRET: 'a'.repeat(32),
        JWT_REFRESH_SECRET: 'b'.repeat(32),
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_ANON_KEY: 'test-anon',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service',
        WEB_ORIGIN: 'http://localhost:3000',
        PII_ENCRYPTION_KEY: Buffer.from('test').toString('base64'),
      });

      expect(result.error).toBeUndefined();
      expect(result.value.THROTTLE_TTL).toBe(60);
    });

    it('should use default THROTTLE_LIMIT if not provided', () => {
      const result = envValidationSchema.validate({
        DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
        JWT_SECRET: 'a'.repeat(32),
        JWT_REFRESH_SECRET: 'b'.repeat(32),
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_ANON_KEY: 'test-anon',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service',
        WEB_ORIGIN: 'http://localhost:3000',
        PII_ENCRYPTION_KEY: Buffer.from('test').toString('base64'),
      });

      expect(result.error).toBeUndefined();
      expect(result.value.THROTTLE_LIMIT).toBe(10);
    });

    it('should use default JWT_EXPIRATION if not provided', () => {
      const result = envValidationSchema.validate({
        DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
        JWT_SECRET: 'a'.repeat(32),
        JWT_REFRESH_SECRET: 'b'.repeat(32),
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_ANON_KEY: 'test-anon',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service',
        WEB_ORIGIN: 'http://localhost:3000',
        PII_ENCRYPTION_KEY: Buffer.from('test').toString('base64'),
      });

      expect(result.error).toBeUndefined();
      expect(result.value.JWT_EXPIRATION).toBe('1h');
    });
  });

  describe('Valid Configuration', () => {
    it('should pass with all required variables and valid formats', () => {
      const validConfig = {
        NODE_ENV: 'production',
        PORT: 4000,
        DATABASE_URL: 'postgresql://postgres:password@db.test.supabase.co:5432/postgres',
        JWT_SECRET: 'a'.repeat(32),
        JWT_REFRESH_SECRET: 'b'.repeat(32),
        JWT_EXPIRATION: '7d',
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_ANON_KEY: 'test-anon-key',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
        WEB_ORIGIN: 'https://app.example.com',
        PII_ENCRYPTION_KEY: Buffer.from('test-key-32-bytes-long-enough').toString('base64'),
        THROTTLE_TTL: 120,
        THROTTLE_LIMIT: 20,
      };

      const result = envValidationSchema.validate(validConfig);

      expect(result.error).toBeUndefined();
      expect(result.value).toMatchObject(validConfig);
    });

    it('should accept postgres:// and postgresql:// URI schemes', () => {
      const postgresUri = envValidationSchema.validate({
        DATABASE_URL: 'postgres://test:test@localhost:5432/test',
        JWT_SECRET: 'a'.repeat(32),
        JWT_REFRESH_SECRET: 'b'.repeat(32),
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_ANON_KEY: 'test-anon',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service',
        WEB_ORIGIN: 'http://localhost:3000',
        PII_ENCRYPTION_KEY: Buffer.from('test').toString('base64'),
      });

      const postgresqlUri = envValidationSchema.validate({
        DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
        JWT_SECRET: 'a'.repeat(32),
        JWT_REFRESH_SECRET: 'b'.repeat(32),
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_ANON_KEY: 'test-anon',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service',
        WEB_ORIGIN: 'http://localhost:3000',
        PII_ENCRYPTION_KEY: Buffer.from('test').toString('base64'),
      });

      expect(postgresUri.error).toBeUndefined();
      expect(postgresqlUri.error).toBeUndefined();
    });
  });

  describe('Multiple Errors', () => {
    it('should report all validation errors at once', () => {
      const result = envValidationSchema.validate(
        {
          DATABASE_URL: 'invalid-uri',
          JWT_SECRET: 'too-short',
          SUPABASE_URL: 'not-a-url',
          WEB_ORIGIN: 'also-not-a-url',
          PII_ENCRYPTION_KEY: 'bad-base64!!!',
        },
        { abortEarly: false }
      );

      expect(result.error).toBeDefined();
      const errorMessage = result.error?.message || '';
      
      // With abortEarly: false, should contain multiple errors
      expect(errorMessage).toContain('DATABASE_URL');
      expect(errorMessage).toContain('JWT_SECRET');
      expect(errorMessage).toContain('JWT_REFRESH_SECRET');
      expect(errorMessage).toContain('SUPABASE_URL');
      expect(errorMessage).toContain('WEB_ORIGIN');
      expect(errorMessage).toContain('PII_ENCRYPTION_KEY');
    });
  });
});
