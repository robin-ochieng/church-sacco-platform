# 🚀 Quick Start: Running RLS Integration Tests

## ⚡ Fast Track (5 minutes)

### 1. Install Dependencies
```bash
cd apps/api
pnpm install
```

### 2. Configure Test Environment
```bash
# Copy example file
cp .env.test .env.test.local

# Edit with your test database credentials
# Use a SEPARATE test database, never production!
```

### 3. Apply RLS Migration to Test Database
```sql
-- In Supabase SQL Editor (connected to test database)
-- Run: db/prisma/migrations/001_rls_init/migration.sql
```

### 4. Run Tests
```bash
# Run all tests
pnpm test

# Or just RLS tests
pnpm test rls.spec.ts

# Watch mode (for development)
pnpm test:watch
```

## ✅ Expected Output

```
PASS  test/rls.spec.ts
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
```

## 🔧 Troubleshooting

### Error: "RLS functions not found"
**Solution**: Run the RLS migration on your test database first

### Error: "Missing environment variables"
**Solution**: Create and configure `.env.test` file

### Error: "Permission denied"
**Solution**: Check you're using test database, not production

### Error: "Cannot find module 'dotenv'"
**Solution**: Run `pnpm install` in apps/api directory

## 📋 What Gets Tested

✅ **Branch Isolation** - Users can only access their branch data
✅ **Role Permissions** - Each role has correct access levels
✅ **AUDITOR** - Read-only across all branches
✅ **Data Protection** - Unauthorized access is blocked

## 🎯 Test Data

The tests automatically create and clean up:
- 2 Branches (A and B)
- 5 Test Users (clerk A, clerk B, auditor, admin, member)
- 5 Test Members across both branches
- All data is prefixed with `test-` for easy identification

## 📚 More Info

- Full documentation: [test/README.md](./README.md)
- RLS migration guide: [../../db/prisma/migrations/001_rls_init/README.md](../../db/prisma/migrations/001_rls_init/README.md)
- Visual guide: [../../db/prisma/migrations/001_rls_init/VISUAL-GUIDE.md](../../db/prisma/migrations/001_rls_init/VISUAL-GUIDE.md)

## 🎉 Success!

If all 17 tests pass, your RLS implementation is working correctly and production-ready! 🔒
