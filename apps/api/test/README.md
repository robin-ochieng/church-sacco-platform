# RLS Integration Test Suite

Comprehensive backend integration tests for Row Level Security (RLS) policies in the ACK Thiboro SACCO platform.

## 📋 Overview

This test suite validates:
- **Branch-based access control** - Users can only access data from their assigned branch
- **Role-based permissions** - Different roles have appropriate access levels
- **AUDITOR role** - Read-only access across all branches
- **Data isolation** - Prevents unauthorized cross-branch data access

## 🎯 Test Coverage

### 1. Branch Isolation Tests
- ✅ Clerk(A) can read only Branch A members
- ✅ Clerk(B) can read only Branch B members
- ✅ Clerk(A) cannot insert into Branch B
- ✅ Clerk(A) can insert into Branch A

### 2. Auditor Role Tests
- ✅ Auditor can read all branches
- ✅ Auditor cannot insert (read-only)
- ✅ Auditor cannot update (read-only)
- ✅ Auditor cannot delete (read-only)

### 3. Admin Role Tests
- ✅ Admin can read all branches
- ✅ Admin can write to any branch
- ✅ Admin can delete from any branch

### 4. Member Role Tests
- ✅ Member can read only their own records
- ✅ Member cannot read other members' records

## 🚀 Setup Instructions

### Prerequisites

1. **RLS Migration Applied**
   ```bash
   # Apply the RLS migration to your test database
   cd db/prisma/migrations/001_rls_init
   # Run migration.sql in your test database
   ```

2. **Test Database**
   - Use a **separate test database** (never production!)
   - Options:
     - Create a separate Supabase test project
     - Use a different schema in your database
     - Use local Supabase with Docker

3. **Environment Variables**
   ```bash
   # Copy and configure .env.test
   cp apps/api/.env.test.example apps/api/.env.test
   # Edit .env.test with your test database credentials
   ```

### Install Dependencies

```bash
cd apps/api
pnpm install
```

## 🧪 Running Tests

### Run All Tests
```bash
pnpm test
```

### Run RLS Tests Only
```bash
pnpm test rls.spec.ts
```

### Run with Coverage
```bash
pnpm test:cov
```

### Watch Mode (during development)
```bash
pnpm test:watch
```

## 📊 Test Structure

```
apps/api/test/
├── rls.spec.ts          # Main RLS integration tests
├── setup.ts             # Test environment setup
└── README.md            # This file

apps/api/
├── jest.config.js       # Jest configuration
└── .env.test            # Test environment variables
```

## 🔍 Test Data Seeding

The test suite automatically:

1. **Creates 2 branches**:
   - Branch A (test-branch-a-001)
   - Branch B (test-branch-b-001)

2. **Creates 5 test users**:
   - clerk.a@test.com (SECRETARY role, Branch A)
   - clerk.b@test.com (SECRETARY role, Branch B)
   - auditor@test.com (ADMIN role, used as AUDITOR via JWT)
   - admin@test.com (ADMIN role)
   - member.a@test.com (MEMBER role, Branch A)

3. **Creates test members**:
   - 3 members in Branch A
   - 2 members in Branch B

4. **Cleans up** all test data after tests complete

## 🔐 Security Testing

### JWT Token Generation

The tests use two methods for JWT tokens:

1. **Normal Authentication** (for CLERK, ADMIN, MEMBER):
   ```typescript
   const { accessToken } = await loginAsUser('clerk.a@test.com');
   ```

2. **Special AUDITOR Token** (for AUDITOR role):
   ```typescript
   const auditorToken = await createAuditorToken(userId);
   // Creates JWT with role: 'AUDITOR' (not in User table enum)
   ```

### RLS Policy Verification

Each test verifies RLS policies by:
- Attempting allowed operations (should succeed)
- Attempting forbidden operations (should fail with RLS block)
- Checking returned data is properly filtered by RLS

## 📝 Example Test Output

```
RLS Integration Tests
  Test Setup & Data Seeding
    ✓ should verify RLS policies are enabled (120ms)
    ✓ should seed two branches (A and B) (89ms)
    ✓ should create test users with roles (234ms)
    ✓ should create test members in branches (345ms)

  Branch Isolation Tests
    ✓ should allow Clerk(A) to read only Branch A members (156ms)
    ✓ should allow Clerk(B) to read only Branch B members (142ms)
    ✓ should prevent Clerk(A) from inserting into Branch B (98ms)
    ✓ should allow Clerk(A) to insert into Branch A (187ms)

  Auditor Role Tests
    ✓ should allow Auditor to read all branches (134ms)
    ✓ should prevent Auditor from writing (insert) (76ms)
    ✓ should prevent Auditor from updating (82ms)
    ✓ should prevent Auditor from deleting (79ms)

  Admin Role Tests
    ✓ should allow Admin to read all branches (145ms)
    ✓ should allow Admin to write to any branch (198ms)
    ✓ should allow Admin to delete from any branch (176ms)

  Member Role Tests
    ✓ should allow Member to read only their own records (123ms)
    ✓ should prevent Member from reading other members (91ms)

Test Suites: 1 passed, 1 total
Tests:       17 passed, 17 total
Time:        3.456s
```

## 🐛 Troubleshooting

### "RLS functions not found" Error
**Problem**: Migration not applied to test database

**Solution**:
```sql
-- Run in your test database SQL editor
-- File: db/prisma/migrations/001_rls_init/migration.sql
```

### "Missing environment variables" Warning
**Problem**: .env.test not configured

**Solution**:
```bash
# Create and configure .env.test
cp apps/api/.env.test.example apps/api/.env.test
# Add your test database credentials
```

### Tests Failing with "Permission Denied"
**Problem**: Using production database or wrong credentials

**Solution**:
1. Verify you're using a test database
2. Check Supabase service role key is correct
3. Ensure database URL points to test instance

### "Cannot find module 'dotenv'" Error
**Problem**: Missing dependencies

**Solution**:
```bash
cd apps/api
pnpm install
```

## 🔄 CI/CD Integration

### GitHub Actions Example

```yaml
name: RLS Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: supabase/postgres:latest
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install pnpm
        run: npm install -g pnpm
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Run migrations
        run: |
          cd db/prisma/migrations/001_rls_init
          psql $DATABASE_URL -f migration.sql
      
      - name: Run RLS tests
        run: cd apps/api && pnpm test rls.spec.ts
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test
          SUPABASE_URL: ${{ secrets.TEST_SUPABASE_URL }}
          SUPABASE_ANON_KEY: ${{ secrets.TEST_SUPABASE_ANON_KEY }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.TEST_SUPABASE_SERVICE_KEY }}
          JWT_SECRET: test-secret
```

## 📚 Additional Resources

- [RLS Migration Documentation](../../db/prisma/migrations/001_rls_init/README.md)
- [RLS Visual Guide](../../db/prisma/migrations/001_rls_init/VISUAL-GUIDE.md)
- [RLS Testing Guide](../../db/prisma/migrations/001_rls_init/TESTING.md)
- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)

## 🤝 Contributing

When adding new RLS policies:

1. Update `migration.sql` with new policies
2. Add corresponding tests to `rls.spec.ts`
3. Document expected behavior
4. Run full test suite
5. Update this README if needed

## 📄 License

Part of the ACK Thiboro SACCO Platform
