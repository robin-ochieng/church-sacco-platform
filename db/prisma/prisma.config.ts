import path from 'node:path';
import { defineConfig } from 'prisma/config';

/**
 * Prisma 7 Configuration File
 * 
 * This file configures Prisma CLI for database connections.
 * The DATABASE_URL is loaded from environment variables.
 * 
 * @see https://pris.ly/d/config-datasource
 */

// Path to the .env file (relative to monorepo root)
const envPath = path.resolve(__dirname, '../../.env');

export default defineConfig({
  earlyAccess: true,
  schema: path.resolve(__dirname, 'schema.prisma'),

  migrate: {
    async schema() {
      // Dynamically load dotenv to read DATABASE_URL
      const dotenv = await import('dotenv');
      dotenv.config({ path: envPath });

      if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL environment variable is not set');
      }

      return {
        url: process.env.DATABASE_URL,
      };
    },
  },
});
