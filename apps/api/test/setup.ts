/**
 * Jest Test Setup
 * 
 * This file runs before all tests to:
 * - Load environment variables
 * - Configure test timeouts
 * - Set up global test utilities
 */

import { config } from 'dotenv';
import { join } from 'path';

// Load test environment variables
const testEnvPath = join(__dirname, '..', '.env.test');
config({ path: testEnvPath });

// Fallback to regular .env if .env.test doesn't exist
if (!process.env.DATABASE_URL) {
  const regularEnvPath = join(__dirname, '..', '.env');
  config({ path: regularEnvPath });
}

// Verify required environment variables
const requiredEnvVars = [
  'DATABASE_URL',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'JWT_SECRET',
  'PII_ENCRYPTION_KEY',
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.warn('⚠️  Warning: Missing environment variables for tests:');
  console.warn('   ', missingVars.join(', '));
  console.warn('   Tests may fail without proper configuration.');
  console.warn('   Please create .env.test or ensure .env has these values.');
}

// Extend Jest matchers (optional)
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidUUID(): R;
    }
  }
}

// Custom matcher implementation
(global as any).expect?.extend?.({
  toBeValidUUID(received: string) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const pass = typeof received === 'string' && uuidRegex.test(received);

    return {
      pass,
      message: () =>
        pass
          ? `expected ${received} not to be a valid UUID`
          : `expected ${received} to be a valid UUID`,
    };
  },
});

// Mock console methods in tests
const mockFn = () => {
  let calls: any[] = [];
  const fn = (...args: any[]) => {
    calls.push(args);
  };
  fn.mock = { calls };
  return fn;
};

global.console = {
  ...console,
  // Suppress logs in tests unless explicitly needed
  log: mockFn(),
  debug: mockFn(),
  info: mockFn(),
  warn: console.warn, // Keep warnings
  error: console.error, // Keep errors
} as any;

console.info('✅ Test environment setup complete');
