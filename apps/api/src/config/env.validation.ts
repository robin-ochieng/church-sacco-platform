import * as Joi from 'joi';

/**
 * Environment variable validation schema.
 * Application will fail to boot if any required variable is missing or invalid.
 */
export const envValidationSchema = Joi.object({
  // Server Configuration
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number()
    .port()
    .default(3001)
    .description('API server port'),

  // Database Configuration
  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgres', 'postgresql'] })
    .required()
    .description('PostgreSQL connection string'),

  // JWT Configuration
  JWT_SECRET: Joi.string()
    .min(32)
    .required()
    .description('JWT signing secret (min 32 characters)'),
  JWT_REFRESH_SECRET: Joi.string()
    .min(32)
    .required()
    .description('JWT refresh token secret (min 32 characters)'),
  JWT_EXPIRATION: Joi.string()
    .default('1h')
    .description('JWT token expiration time'),

  // Supabase Configuration
  SUPABASE_URL: Joi.string()
    .uri()
    .required()
    .description('Supabase project URL'),
  SUPABASE_ANON_KEY: Joi.string()
    .required()
    .description('Supabase anonymous/public key'),
  SUPABASE_SERVICE_ROLE_KEY: Joi.string()
    .required()
    .description('Supabase service role key'),

  // Security Configuration
  WEB_ORIGIN: Joi.string()
    .uri()
    .required()
    .description('Frontend origin for CORS'),
  FRONTEND_URL: Joi.string()
    .uri()
    .optional()
    .description('Frontend URL (legacy, use WEB_ORIGIN)'),

  // PII Encryption
  PII_ENCRYPTION_KEY: Joi.string()
    .base64()
    .required()
    .description('Base64-encoded encryption key for PII data'),

  // Rate Limiting
  THROTTLE_TTL: Joi.number()
    .integer()
    .positive()
    .default(60)
    .description('Rate limit time window in seconds'),
  THROTTLE_LIMIT: Joi.number()
    .integer()
    .positive()
    .default(10)
    .description('Max requests per time window'),
  BANK_TIMEZONE: Joi.string()
    .default('Africa/Nairobi')
    .description('IANA timezone identifier for teller reporting windows'),
});

/**
 * Type-safe environment variable interface.
 * Generated from Joi schema validation.
 */
export interface EnvironmentVariables {
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_REFRESH_SECRET: string;
  JWT_EXPIRATION: string;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  WEB_ORIGIN: string;
  FRONTEND_URL?: string;
  PII_ENCRYPTION_KEY: string;
  THROTTLE_TTL: number;
  THROTTLE_LIMIT: number;
  BANK_TIMEZONE: string;
}
