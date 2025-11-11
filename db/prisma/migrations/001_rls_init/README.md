# RLS (Row Level Security) Migration - 001_rls_init

## Overview

This migration implements comprehensive Row Level Security (RLS) with branch-based access control for the ACK Thiboro SACCO platform.

## What This Migration Does

### 1. **Enables RLS on Tables**
- Member
- Loan
- Saving (transactions)
- Share
- Repayment
- Contribution

### 2. **Adds Branch Support**
- Adds `branchId` column to all tables
- Creates indexes for performance
- Enables branch-based data isolation

### 3. **Creates Helper Functions**
- `auth.jwt_role()` - Extracts role from JWT
- `auth.jwt_branch_id()` - Extracts branch ID from JWT
- `auth.jwt_user_id()` - Extracts user ID from JWT
- `set_test_jwt_claims()` - Sets test JWT claims for testing
- `clear_test_jwt_claims()` - Clears test JWT claims

### 4. **Implements Role-Based Policies**

#### **AUDITOR Role**
- ✅ Read-only access across ALL branches
- ❌ No write/update/delete permissions
- Use case: External auditors, compliance officers

#### **CLERK/SECRETARY Role**
- ✅ INSERT records in their branch only
- ✅ SELECT records in their branch only
- ❌ Cannot update or delete
- ❌ Cannot access other branches
- Use case: Data entry staff, front desk

#### **MANAGER/TREASURER/CHAIRMAN Role**
- ✅ Full READ access in their branch
- ✅ UPDATE records in their branch
- ✅ DELETE Member records in their branch
- ❌ Cannot DELETE transactional records (Loan, Saving, Share, Repayment, Contribution)
- ❌ Cannot access other branches
- Use case: Branch managers, treasurers, SACCO officials

#### **ADMIN Role**
- ✅ Full access across ALL branches
- ✅ Can DELETE any record including transactions
- ✅ Bypass all RLS restrictions
- Use case: System administrators, IT staff

#### **MEMBER Role**
- ✅ Can view their own records only
- ❌ Cannot view other members' data
- ❌ No write access
- Use case: Regular SACCO members

## Installation

### Option 1: Run via Supabase SQL Editor
1. Log into your Supabase dashboard
2. Go to SQL Editor
3. Copy the contents of `migration.sql`
4. Execute the SQL

### Option 2: Run via psql
```bash
psql postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres < migration.sql
```

### Option 3: Run via Node.js script
```javascript
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const sql = fs.readFileSync('./migration.sql', 'utf8');

// Execute migration
// Note: Supabase SDK doesn't support multi-statement SQL directly
// Use Supabase SQL Editor or pg library
```

## Testing

### Test JWT Claims Setup

The migration includes helper functions for testing. Here's how to use them:

#### 1. Test as AUDITOR
```sql
-- Set JWT claims
SELECT set_test_jwt_claims('AUDITOR', NULL, 'user-auditor-123');

-- Test read access across all branches
SELECT * FROM "Member";  -- ✅ Should see all members
SELECT * FROM "Loan";    -- ✅ Should see all loans

-- Test write access (should fail)
INSERT INTO "Member" (...) VALUES (...);  -- ❌ Should fail

-- Clear claims
SELECT clear_test_jwt_claims();
```

#### 2. Test as CLERK in Branch 001
```sql
-- Set JWT claims for clerk in branch-001
SELECT set_test_jwt_claims('CLERK', 'branch-001', 'user-clerk-456');

-- Test read access (only branch-001)
SELECT * FROM "Member";  -- ✅ Should see only branch-001 members
SELECT * FROM "Member" WHERE "branchId" = 'branch-002';  -- ❌ Should return empty

-- Test insert in own branch (should succeed)
INSERT INTO "Member" (
  id, userId, memberNumber, firstName, lastName, 
  email, telephone, idPassportNumber, physicalAddress,
  dateOfBirth, nextOfKinName, nextOfKinPhone, nextOfKinRelationship,
  membershipStatus, branchId
) VALUES (
  'member-test-001', 'user-123', 'ACK-TEST-001', 'Test', 'User',
  'test@example.com', '+254712345678', 'ID12345', 'Nyeri',
  '1990-01-01', 'Next Kin', '+254722222222', 'Sibling',
  'ACTIVE', 'branch-001'
);  -- ✅ Should succeed

-- Test insert in different branch (should fail)
INSERT INTO "Member" (..., branchId) VALUES (..., 'branch-002');  -- ❌ Should fail

-- Clear claims
SELECT clear_test_jwt_claims();
```

#### 3. Test as MANAGER in Branch 002
```sql
-- Set JWT claims for manager in branch-002
SELECT set_test_jwt_claims('MANAGER', 'branch-002', 'user-manager-789');

-- Test read access (only branch-002)
SELECT * FROM "Member" WHERE "branchId" = 'branch-002';  -- ✅ Should succeed

-- Test update in own branch (should succeed)
UPDATE "Member" 
SET "firstName" = 'Updated Name' 
WHERE id = 'some-id' AND "branchId" = 'branch-002';  -- ✅ Should succeed

-- Test delete Member (should succeed)
DELETE FROM "Member" WHERE id = 'some-id' AND "branchId" = 'branch-002';  -- ✅ Should succeed

-- Test delete Loan (should FAIL - transactional table)
DELETE FROM "Loan" WHERE "branchId" = 'branch-002';  -- ❌ Should fail (only admins)

-- Clear claims
SELECT clear_test_jwt_claims();
```

#### 4. Test as ADMIN
```sql
-- Set JWT claims for admin
SELECT set_test_jwt_claims('ADMIN', NULL, 'user-admin-001');

-- Test full access
SELECT * FROM "Member";  -- ✅ Should see all members across all branches
UPDATE "Member" SET firstName = 'Admin Update' WHERE id = 'any-id';  -- ✅ Should succeed
DELETE FROM "Loan" WHERE id = 'any-loan-id';  -- ✅ Should succeed (only admins can delete transactions)

-- Clear claims
SELECT clear_test_jwt_claims();
```

#### 5. Test as MEMBER
```sql
-- Set JWT claims for regular member
SELECT set_test_jwt_claims('MEMBER', NULL, 'user-member-specific-id');

-- Test view own records
SELECT * FROM "Member" WHERE "userId" = 'user-member-specific-id';  -- ✅ Should see only their record

-- Test view own loans
SELECT l.* FROM "Loan" l
JOIN "Member" m ON m.id = l."memberId"
WHERE m."userId" = 'user-member-specific-id';  -- ✅ Should see only their loans

-- Test view other member's data (should fail)
SELECT * FROM "Member" WHERE "userId" != 'user-member-specific-id';  -- ❌ Should return empty

-- Clear claims
SELECT clear_test_jwt_claims();
```

## Updating Your Application Code

### Backend (NestJS)

Update your JWT payload to include `branch_id`:

```typescript
// auth.service.ts
private generateTokens(user: User, member?: Member) {
  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    branch_id: member?.branchId || null,  // ← Add this
  };

  return {
    accessToken: this.jwtService.sign(payload, {
      expiresIn: '1h',
    }),
    refreshToken: this.jwtService.sign(payload, {
      expiresIn: '7d',
    }),
  };
}
```

### Supabase Service

Make sure JWT claims are passed in requests:

```typescript
// supabase.service.ts
getClientWithAuth(accessToken: string) {
  const supabase = createClient(this.supabaseUrl, this.supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
  return supabase;
}
```

### Assigning Branch IDs

When creating records, always include `branchId`:

```typescript
// members.service.ts
async create(createMemberDto: CreateMemberDto) {
  // Get user's branch from JWT or assign default
  const branchId = this.getBranchIdFromContext() || 'branch-001';

  const { data: member, error } = await this.supabase
    .from('Member')
    .insert({
      ...memberData,
      branchId,  // ← Always include branch ID
    })
    .select()
    .single();
}
```

## Rollback

To rollback this migration:

```sql
-- Disable RLS on all tables
ALTER TABLE "Member" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Loan" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Saving" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Share" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Repayment" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Contribution" DISABLE ROW LEVEL SECURITY;

-- Drop all policies
DROP POLICY IF EXISTS "auditor_read_members" ON "Member";
DROP POLICY IF EXISTS "clerk_insert_members" ON "Member";
DROP POLICY IF EXISTS "clerk_select_members" ON "Member";
-- ... (drop all other policies)

-- Drop helper functions
DROP FUNCTION IF EXISTS auth.jwt_role();
DROP FUNCTION IF EXISTS auth.jwt_branch_id();
DROP FUNCTION IF EXISTS auth.jwt_user_id();
DROP FUNCTION IF EXISTS set_test_jwt_claims(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS clear_test_jwt_claims();

-- Optionally remove branchId columns
ALTER TABLE "Member" DROP COLUMN IF EXISTS "branchId";
ALTER TABLE "Loan" DROP COLUMN IF EXISTS "branchId";
-- ... (drop from other tables)
```

## Security Notes

1. **JWT Secret**: Ensure your JWT_SECRET is strong and kept secure
2. **Service Role Key**: Use service role key only in backend, never expose to frontend
3. **Branch Assignment**: Always validate branch assignments server-side
4. **Audit Logging**: Consider adding audit logs for sensitive operations
5. **Testing**: Thoroughly test RLS policies before deploying to production

## Troubleshooting

### Issue: "Permission denied" errors
**Solution**: Ensure JWT token includes `role` and `branch_id` claims

### Issue: Can't see any data
**Solution**: Check that JWT claims are being set correctly. Use test helper functions.

### Issue: Clerk can access other branches
**Solution**: Verify `branchId` is set on all records and matches JWT `branch_id`

### Issue: Manager can't delete transactions
**Solution**: This is intentional. Only ADMIN can delete transactional records.

## Next Steps

1. ✅ Run this migration in Supabase
2. ✅ Update JWT token generation to include `branch_id`
3. ✅ Update all `INSERT` operations to include `branchId`
4. ✅ Test each role's permissions thoroughly
5. ✅ Update existing records with appropriate `branchId` values
6. ✅ Create a branch management UI for admins
7. ✅ Add audit logging for sensitive operations

## Support

For issues or questions, refer to:
- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL RLS Documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- Project: `robin-ochieng/church-sacco-platform`
