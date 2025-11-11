# Quick Fix: Running RLS Migration in Supabase

## Issue Fixed
✅ **Error:** `permission denied for schema auth`  
✅ **Solution:** Changed all functions from `auth` schema to `public` schema

## How to Run the Migration

### Step 1: Open Supabase SQL Editor
1. Go to your Supabase Dashboard
2. Click on "SQL Editor" in the left sidebar
3. Click "+ New query"

### Step 2: Copy the Migration SQL
1. Open `db/prisma/migrations/001_rls_init/migration.sql`
2. Copy ALL the content (Ctrl+A, Ctrl+C)

### Step 3: Execute the Migration
1. Paste the SQL into the Supabase SQL Editor
2. Click "Run" or press Ctrl+Enter
3. Wait for execution (should take 5-10 seconds)

### Step 4: Verify Success
You should see:
```
Success. No rows returned
```

### Step 5: Test the Setup
Run this test query:
```sql
-- Test the helper functions
SELECT public.jwt_role() as role;
SELECT public.jwt_branch_id() as branch_id;
SELECT public.jwt_user_id() as user_id;

-- Test setting JWT claims
SELECT set_test_jwt_claims('ADMIN', 'branch-001', 'test-user-123');
SELECT public.jwt_role();  -- Should return 'ADMIN'
SELECT clear_test_jwt_claims();
```

## What Changed from Original

### Before (❌ Causes Error):
```sql
CREATE OR REPLACE FUNCTION auth.jwt_role()
RETURNS TEXT AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::json->>'role',
    'MEMBER'
  )::TEXT;
$$ LANGUAGE SQL STABLE;
```

### After (✅ Works):
```sql
CREATE OR REPLACE FUNCTION public.jwt_role()
RETURNS TEXT AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::json->>'role',
    'MEMBER'
  )::TEXT;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;
```

## Key Changes:
1. ✅ Changed `auth.jwt_role()` → `public.jwt_role()`
2. ✅ Changed `auth.jwt_branch_id()` → `public.jwt_branch_id()`
3. ✅ Changed `auth.jwt_user_id()` → `public.jwt_user_id()`
4. ✅ Added `SECURITY DEFINER` to allow functions to access JWT claims
5. ✅ Updated all 60+ function calls in policies

## Why This Works
- Supabase restricts direct access to the `auth` schema
- The `public` schema is fully accessible
- `SECURITY DEFINER` allows the function to run with creator privileges
- Functions can still read JWT claims from `request.jwt.claims`

## Troubleshooting

### Error: "relation does not exist"
**Cause:** Tables not created yet  
**Solution:** Run the initial schema migration first:
```bash
# In your terminal
cd db
psql [YOUR_SUPABASE_CONNECTION_STRING] < supabase-direct-migration.sql
```

### Error: "policy already exists"
**Cause:** Migration was partially run  
**Solution:** Drop existing policies first:
```sql
-- Run this before re-running migration
DROP POLICY IF EXISTS "auditor_read_members" ON "Member";
DROP POLICY IF EXISTS "clerk_insert_members" ON "Member";
-- ... (drop all policies)
```

Or use this helper script:
```sql
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
    END LOOP;
END $$;
```

### Error: "column branchId does not exist"
**Cause:** Migration adds the column, but table structure may be different  
**Solution:** Check your table structure:
```sql
\d "Member"  -- In psql
-- Or in SQL Editor:
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'Member';
```

## Next Steps After Migration

1. ✅ Verify RLS is enabled:
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('Member', 'Loan', 'Saving', 'Share', 'Repayment', 'Contribution');
-- All should show rowsecurity = true
```

2. ✅ Check policies created:
```sql
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
-- Should show 30+ policies
```

3. ✅ Update your backend code to include `branch_id` in JWT:
```typescript
// auth.service.ts
private generateTokens(user: User, member?: Member) {
  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    branch_id: member?.branchId || 'branch-001',  // ← Add this
  };
  // ...
}
```

4. ✅ Test with actual data using test helper functions

## Support
If you encounter any other errors, check:
- Supabase Dashboard → Database → Logs
- SQL Editor error messages
- Migration README.md for detailed examples
