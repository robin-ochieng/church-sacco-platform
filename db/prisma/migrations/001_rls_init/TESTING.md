# RLS Role Testing Guide

## Overview
This guide walks you through testing all role-based access control policies in your Supabase database.

## Prerequisites
1. ✅ Migration file updated (auth → public schema)
2. ✅ JWT generation updated to include branch_id
3. ⏳ Ready to test in Supabase SQL Editor

## Testing Steps

### Step 1: Run the Migration

1. Open **Supabase Dashboard** → Go to **SQL Editor**
2. Copy entire content of `db/prisma/migrations/001_rls_init/migration.sql`
3. Paste into SQL Editor
4. Click **RUN** button
5. Wait for success message (should take 2-5 seconds)

**Expected Result:**
```
Success. No rows returned
```

### Step 2: Run the Test Script

1. In **Supabase SQL Editor**, click **New query**
2. Copy entire content of `db/prisma/migrations/001_rls_init/test-roles.sql`
3. Paste into SQL Editor
4. Click **RUN** button
5. Review results section by section

**What the Tests Do:**

The script tests 6 scenarios automatically:

1. **AUDITOR Role Test** (Lines 1-100)
   - ✅ Can view all members from all branches
   - ✅ Can view all loans and savings
   - ❌ Cannot insert, update, or delete

2. **CLERK Role Test** (Lines 101-200)
   - ✅ Can view members only in their assigned branch (branch-001)
   - ✅ Can insert members only in their assigned branch
   - ❌ Cannot view or insert in other branches
   - ❌ Cannot update or delete

3. **MANAGER Role Test** (Lines 201-300)
   - ✅ Can view members only in their assigned branch (branch-002)
   - ✅ Can insert and update members in their branch
   - ✅ Can delete members (non-transactional)
   - ❌ Cannot delete loans, savings, or other transactions

4. **ADMIN Role Test** (Lines 301-400)
   - ✅ Can view all members from all branches
   - ✅ Can insert, update, delete anywhere
   - ✅ Can delete transactional records (loans, savings)

5. **MEMBER Role Test** (Lines 401-500)
   - ✅ Can view only their own member record
   - ✅ Can view only their own loans and savings
   - ❌ Cannot view other members
   - ❌ Cannot insert, update, or delete anything

6. **DELETE Restrictions Test** (Lines 501-600)
   - ❌ MANAGER cannot delete loans or savings
   - ✅ ADMIN can delete loans and savings

### Step 3: Manual Testing (Optional)

You can also test manually by running individual queries:

**Example: Test CLERK access**
```sql
-- Set JWT claims for CLERK in branch-001
SELECT set_test_jwt_claims('CLERK', 'branch-001', 'clerk-user-001');

-- This should work (own branch)
SELECT * FROM "Member" WHERE "branchId" = 'branch-001';

-- This should return empty (other branch blocked by RLS)
SELECT * FROM "Member" WHERE "branchId" = 'branch-002';

-- Clear claims when done
SELECT clear_test_jwt_claims();
```

**Example: Test AUDITOR access**
```sql
-- Set JWT claims for AUDITOR
SELECT set_test_jwt_claims('AUDITOR', NULL, NULL);

-- Should see all members
SELECT COUNT(*) FROM "Member";

-- Should see all loans
SELECT COUNT(*) FROM "Loan";

-- Try to insert (should fail)
INSERT INTO "Member" (...) VALUES (...);  -- Will fail!

-- Clear claims
SELECT clear_test_jwt_claims();
```

## Reading Test Results

### ✅ Successful Tests
Look for messages like:
- `✅ Insert succeeded`
- `✅ Update succeeded`
- `✅ Delete succeeded`
- `Expected: X | Actual: X` (numbers match)

### ❌ Expected Failures
Some tests are SUPPOSED to fail (showing RLS is working):
- `Uncomment DELETE above to test - should FAIL`
- `Expected: 0 (RLS blocks access)`

When you uncomment these queries, they should produce errors like:
```
ERROR: new row violates row-level security policy for table "Member"
```

## Troubleshooting

### Error: "function public.jwt_role() does not exist"
**Solution:** Run the migration file first (Step 1 above)

### Error: "column branchId does not exist"
**Solution:** Run the migration file which adds branchId columns

### All tests show 0 results
**Solution:** Create test data first (included in test-roles.sql)

### Error: "permission denied for schema auth"
**Solution:** You're using old migration file. Use the updated one with `public.` schema

## After Testing

Once all tests pass:

1. **Assign branchId to existing members:**
   ```sql
   UPDATE "Member" SET "branchId" = 'branch-001' WHERE id IN (...);
   ```

2. **Update your API** to include branchId when creating members:
   ```typescript
   await supabase.from('Member').insert({
     ...memberData,
     branchId: user.branchId || 'branch-001'
   });
   ```

3. **Test with real JWT tokens** from your API (already configured!)

4. **Create branch management UI** for admins to:
   - Create new branches
   - Assign staff to branches
   - View branch-specific reports

## Summary

| Role | Read Own Branch | Read All Branches | Insert Own Branch | Update Own Branch | Delete Transactions |
|------|----------------|-------------------|-------------------|-------------------|---------------------|
| **AUDITOR** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **CLERK** | ✅ | ❌ | ✅ | ❌ | ❌ |
| **MANAGER** | ✅ | ❌ | ✅ | ✅ | ❌ |
| **ADMIN** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **MEMBER** | Own records only | ❌ | ❌ | ❌ | ❌ |

## Questions?

- Check `db/prisma/migrations/001_rls_init/README.md` for detailed documentation
- Review `db/prisma/migrations/001_rls_init/QUICKSTART.md` for quick fixes
- Check migration.sql comments for policy details
