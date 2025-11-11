# 🧪 RLS Test Commands Reference

## Quick Commands

```bash
# Navigate to API directory
cd apps/api

# Install dependencies (first time only)
pnpm install

# Run all tests
pnpm test

# Run only RLS integration tests
pnpm test rls.spec.ts

# Run tests in watch mode (auto-rerun on changes)
pnpm test:watch

# Run tests with coverage report
pnpm test:cov

# View coverage report (after running test:cov)
# Open: apps/api/coverage/index.html
```

## Setup Commands

```bash
# Copy test environment template
cp .env.test .env.test.local

# Edit environment variables
notepad .env.test  # or use your preferred editor

# Install missing dependencies
pnpm install dotenv jsonwebtoken @types/jsonwebtoken
```

## Database Commands

```powershell
# Connect to Supabase SQL Editor and run migration
# File: db/prisma/migrations/001_rls_init/migration.sql
```

## Debugging Commands

```bash
# Run single test
pnpm test rls.spec.ts -t "should allow Clerk(A) to read only Branch A members"

# Verbose output
pnpm test rls.spec.ts --verbose

# Show console logs
pnpm test rls.spec.ts --silent=false

# Run with specific timeout
pnpm test rls.spec.ts --testTimeout=60000
```

## Verification Commands

```bash
# Check if Jest is configured
cat jest.config.js

# Check if test files exist
ls test/

# Verify package.json has test scripts
cat package.json | grep "test"

# Check environment variables
cat .env.test
```

## Expected Output

```
✅ All 17 tests should pass
⏱️  Should complete in ~3-5 seconds
📊 Coverage report generated in coverage/
🧹 Test data automatically cleaned up
```

## Troubleshooting Commands

```bash
# Clear node modules and reinstall
rm -rf node_modules
pnpm install

# Check for TypeScript errors
pnpm typecheck

# Lint test files
pnpm lint test/

# Rebuild project
pnpm build
```

## CI/CD Commands

```bash
# Run tests in CI mode
CI=true pnpm test rls.spec.ts

# Generate coverage for CI
pnpm test:cov --ci --coverage --maxWorkers=2

# Run with JSON reporter for CI
pnpm test --json --outputFile=test-results.json
```

## Test Data Cleanup (Manual)

```sql
-- If tests fail and don't cleanup, run this in Supabase SQL Editor:
DELETE FROM "Member" WHERE id LIKE 'test-%';
DELETE FROM "User" WHERE id LIKE 'test-%';
DELETE FROM "Branch" WHERE id LIKE 'test-branch-%';
```

## Environment Variables Needed

```env
# Required in .env.test:
SUPABASE_URL=your-test-supabase-url
SUPABASE_ANON_KEY=your-test-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-test-service-role-key
DATABASE_URL=postgresql://...
JWT_SECRET=test-secret-key
```

## Test File Locations

```
apps/api/test/rls.spec.ts              # Main test file
apps/api/test/setup.ts                 # Setup configuration
apps/api/jest.config.js                # Jest configuration
apps/api/.env.test                     # Environment template
```

## Quick Verification

```bash
# One-liner to verify setup
cd apps/api && pnpm install && pnpm test rls.spec.ts
```

## Success Indicators

✅ `Test Suites: 1 passed, 1 total`
✅ `Tests: 17 passed, 17 total`
✅ No error messages or warnings
✅ Test data cleaned up automatically
