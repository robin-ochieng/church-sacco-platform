# Database Testing Strategies Guide

## Overview
This guide provides three approaches to test your NestJS + Prisma application without requiring a live Supabase connection.

---

## ✅ Option 1: In-Memory SQLite (Recommended for CI/CD)

### Benefits
- ⚡ Fast (runs in memory)
- 🎯 No external dependencies
- 💰 Free
- 🔄 Fresh database for each test
- 📦 Works offline

### Setup

#### 1. Add SQLite Provider to Prisma Schema

Create `db/prisma/schema.test.prisma`:

```prisma
// Copy from your main schema.prisma but change:
datasource db {
  provider = "sqlite"
  url      = env("TEST_DATABASE_URL")
}

// Keep all your models the same
```

#### 2. Install SQLite Dependencies

```bash
cd apps/api
pnpm add -D @databases/sqlite @databases/sqlite-sync
```

#### 3. Update .env.test

```bash
# apps/api/.env.test
TEST_DATABASE_URL="file:./test.db"
DATABASE_URL="file:./test.db"
SUPABASE_URL="http://localhost:54321"
SUPABASE_ANON_KEY="test-key"
SUPABASE_SERVICE_ROLE_KEY="test-service-key"
JWT_SECRET="test-jwt-secret-key-for-testing-only"
PII_ENCRYPTION_KEY="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
```

#### 4. Create Test Database Helper

```typescript
// apps/api/test/test-db.helper.ts
import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import { join } from 'path';
import * as fs from 'fs';

export class TestDatabaseHelper {
  private static prisma: PrismaClient;
  private static dbPath = join(__dirname, '..', 'test.db');

  static async setupDatabase(): Promise<PrismaClient> {
    // Remove old test database
    if (fs.existsSync(this.dbPath)) {
      fs.unlinkSync(this.dbPath);
    }

    // Generate Prisma Client with test schema
    console.log('Generating Prisma Client for tests...');
    execSync('npx prisma generate', { stdio: 'inherit' });

    // Run migrations to create schema
    console.log('Creating test database schema...');
    execSync('npx prisma db push --skip-generate', { 
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: `file:${this.dbPath}` }
    });

    this.prisma = new PrismaClient({
      datasources: {
        db: {
          url: `file:${this.dbPath}`
        }
      }
    });

    await this.prisma.$connect();
    return this.prisma;
  }

  static async cleanDatabase() {
    if (this.prisma) {
      // Delete all records in reverse order (respecting foreign keys)
      const tables = [
        'Transaction',
        'KYCDocument', 
        'Member',
        'User',
        'Branch'
      ];

      for (const table of tables) {
        await this.prisma.$executeRawUnsafe(`DELETE FROM ${table}`);
      }
    }
  }

  static async teardownDatabase() {
    if (this.prisma) {
      await this.prisma.$disconnect();
    }
    
    // Remove test database file
    if (fs.existsSync(this.dbPath)) {
      fs.unlinkSync(this.dbPath);
    }
  }

  static getPrisma(): PrismaClient {
    return this.prisma;
  }
}
```

#### 5. Update Test Setup

```typescript
// apps/api/test/setup.ts
import { TestDatabaseHelper } from './test-db.helper';

// Setup database once before all tests
beforeAll(async () => {
  await TestDatabaseHelper.setupDatabase();
}, 60000); // 1 minute timeout for setup

// Clean between tests
beforeEach(async () => {
  await TestDatabaseHelper.cleanDatabase();
});

// Teardown after all tests
afterAll(async () => {
  await TestDatabaseHelper.teardownDatabase();
});
```

---

## 🐳 Option 2: Docker PostgreSQL (Best for E2E Tests)

### Benefits
- 💯 Exact production environment (PostgreSQL)
- 🔒 Isolated from development database
- 🧪 Test real Supabase features (RLS, pgcrypto)
- 🔄 Reproducible across machines

### Setup

#### 1. Create docker-compose.test.yml

```yaml
# apps/api/docker-compose.test.yml
version: '3.8'

services:
  postgres-test:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
      POSTGRES_DB: sacco_test
    ports:
      - "5433:5432"
    volumes:
      - test-db-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U test"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  test-db-data:
```

#### 2. Update .env.test

```bash
DATABASE_URL="postgresql://test:test@localhost:5433/sacco_test?schema=public"
SUPABASE_URL="http://localhost:54321"
SUPABASE_ANON_KEY="test-key"
SUPABASE_SERVICE_ROLE_KEY="test-service-key"
JWT_SECRET="test-jwt-secret"
PII_ENCRYPTION_KEY="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
```

#### 3. Add Test Scripts

```json
// apps/api/package.json
{
  "scripts": {
    "test:docker:up": "docker-compose -f docker-compose.test.yml up -d",
    "test:docker:down": "docker-compose -f docker-compose.test.yml down -v",
    "test:db:reset": "dotenv -e .env.test -- npx prisma migrate reset --force --skip-seed",
    "test:db:migrate": "dotenv -e .env.test -- npx prisma migrate deploy",
    "test:e2e:full": "pnpm test:docker:up && pnpm test:db:migrate && pnpm test && pnpm test:docker:down"
  }
}
```

#### 4. Usage

```bash
# Start test database
pnpm test:docker:up

# Run migrations
pnpm test:db:migrate

# Run tests
pnpm test

# Stop test database
pnpm test:docker:down

# Or run everything at once
pnpm test:e2e:full
```

---

## 🎭 Option 3: Mock PrismaService (Unit Tests Only)

### Benefits
- ⚡ Blazing fast
- 🎯 Tests business logic only
- 📦 No database needed

### Setup

```typescript
// apps/api/test/mocks/prisma.mock.ts
export const mockPrismaService = {
  member: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  transaction: {
    findMany: jest.fn(),
    create: jest.fn(),
    aggregate: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  $connect: jest.fn(),
  $disconnect: jest.fn(),
  $transaction: jest.fn((callback) => callback(mockPrismaService)),
};
```

### Usage in Tests

```typescript
// apps/api/test/member-statement.e2e-spec.ts (modified for unit test)
import { Test, TestingModule } from '@nestjs/testing';
import { MembersService } from '../src/members/members.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { mockPrismaService } from './mocks/prisma.mock';

describe('MembersService', () => {
  let service: MembersService;
  let prisma: typeof mockPrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MembersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<MembersService>(MembersService);
    prisma = module.get(PrismaService);
    
    // Reset mocks
    jest.clearAllMocks();
  });

  describe('getStatement', () => {
    it('should return statement with running balance', async () => {
      // Arrange
      const memberId = 'test-member-id';
      const mockMember = {
        id: memberId,
        firstName: 'John',
        lastName: 'Doe',
        memberNumber: 'MEM001',
      };
      
      const mockTransactions = [
        {
          id: 'txn-1',
          amount: 5000,
          type: 'DEPOSIT',
          channel: 'CASH',
          status: 'POSTED',
          valueDate: new Date('2024-01-15'),
          receiptNumber: 'RCP-001',
          createdAt: new Date(),
        },
      ];

      prisma.member.findUnique.mockResolvedValue(mockMember);
      prisma.transaction.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
      prisma.transaction.findMany.mockResolvedValue(mockTransactions);

      // Act
      const result = await service.getStatement(memberId, {});

      // Assert
      expect(result.member.id).toBe(memberId);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].balance).toBe(5000);
      expect(prisma.member.findUnique).toHaveBeenCalledWith({
        where: { id: memberId },
      });
    });
  });
});
```

---

## 📊 Comparison Table

| Feature | SQLite In-Memory | Docker PostgreSQL | Mock Prisma |
|---------|------------------|-------------------|-------------|
| **Speed** | ⚡⚡⚡ Very Fast | ⚡⚡ Moderate | ⚡⚡⚡⚡ Fastest |
| **Setup Complexity** | 🟢 Easy | 🟡 Moderate | 🟢 Easy |
| **Production Accuracy** | 🟡 Good | 🟢 Exact | 🔴 None |
| **Offline Support** | ✅ Yes | ✅ Yes (after image pull) | ✅ Yes |
| **CI/CD Friendly** | ✅ Excellent | 🟡 Good | ✅ Excellent |
| **Tests RLS/Triggers** | ❌ No | ✅ Yes | ❌ No |
| **Best For** | Unit + Integration | E2E Tests | Pure Unit Tests |

---

## 🎯 Recommended Approach: Hybrid

Use a combination based on test type:

```typescript
// apps/api/jest.config.js
module.exports = {
  projects: [
    {
      // Unit tests with mocks
      displayName: 'unit',
      testMatch: ['**/*.spec.ts'],
      setupFilesAfterEnv: ['<rootDir>/test/setup.unit.ts'],
    },
    {
      // Integration tests with SQLite
      displayName: 'integration',
      testMatch: ['**/*.integration.ts'],
      setupFilesAfterEnv: ['<rootDir>/test/setup.integration.ts'],
    },
    {
      // E2E tests with Docker PostgreSQL
      displayName: 'e2e',
      testMatch: ['**/*.e2e-spec.ts'],
      setupFilesAfterEnv: ['<rootDir>/test/setup.e2e.ts'],
    },
  ],
};
```

---

## 🚀 Quick Start: SQLite Setup (5 Minutes)

```bash
# 1. Install dependencies
cd apps/api
pnpm add -D better-sqlite3

# 2. Create .env.test
echo 'DATABASE_URL="file:./test.db"' > .env.test
echo 'PII_ENCRYPTION_KEY="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"' >> .env.test

# 3. Update setup.ts with database helper (see Option 1)

# 4. Run tests
pnpm test
```

---

## ✅ Next Steps

1. **Choose your approach** based on your needs
2. **Implement the setup** following the guide above
3. **Update your tests** to use the test database
4. **Add CI/CD integration** to run tests automatically

The SQLite approach is recommended for most cases as it provides a good balance of speed, simplicity, and reliability.
