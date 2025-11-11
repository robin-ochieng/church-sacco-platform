-- Migration: 001_rls_init
-- Description: Enable Row Level Security (RLS) with branch-based access control
-- Date: 2025-11-11
-- 
-- This migration:
-- 1. Enables RLS on all transactional tables
-- 2. Creates branch-based policies for different roles
-- 3. Adds helper functions for JWT claim extraction
-- 4. Sets up test utilities for JWT claims

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to extract role from JWT
CREATE OR REPLACE FUNCTION public.jwt_role()
RETURNS TEXT AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::json->>'role',
    'MEMBER'
  )::TEXT;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Function to extract branch_id from JWT
CREATE OR REPLACE FUNCTION public.jwt_branch_id()
RETURNS TEXT AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::json->>'branch_id',
    NULL
  )::TEXT;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Function to extract user_id from JWT
CREATE OR REPLACE FUNCTION public.jwt_user_id()
RETURNS TEXT AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::json->>'sub',
    NULL
  )::TEXT;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on Member table
ALTER TABLE "Member" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Member" FORCE ROW LEVEL SECURITY;

-- Enable RLS on Loan table
ALTER TABLE "Loan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Loan" FORCE ROW LEVEL SECURITY;

-- Enable RLS on Saving table (transactions)
ALTER TABLE "Saving" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Saving" FORCE ROW LEVEL SECURITY;

-- Enable RLS on Share table
ALTER TABLE "Share" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Share" FORCE ROW LEVEL SECURITY;

-- Enable RLS on Repayment table
ALTER TABLE "Repayment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Repayment" FORCE ROW LEVEL SECURITY;

-- Enable RLS on Contribution table
ALTER TABLE "Contribution" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Contribution" FORCE ROW LEVEL SECURITY;

-- ============================================================================
-- ADD BRANCH_ID COLUMN TO TABLES (if not exists)
-- ============================================================================

-- Add branch_id to Member table
ALTER TABLE "Member" 
ADD COLUMN IF NOT EXISTS "branchId" VARCHAR(255);

-- Add branch_id to Loan table
ALTER TABLE "Loan" 
ADD COLUMN IF NOT EXISTS "branchId" VARCHAR(255);

-- Add branch_id to Saving table
ALTER TABLE "Saving" 
ADD COLUMN IF NOT EXISTS "branchId" VARCHAR(255);

-- Add branch_id to Share table
ALTER TABLE "Share" 
ADD COLUMN IF NOT EXISTS "branchId" VARCHAR(255);

-- Add branch_id to Repayment table
ALTER TABLE "Repayment" 
ADD COLUMN IF NOT EXISTS "branchId" VARCHAR(255);

-- Add branch_id to Contribution table
ALTER TABLE "Contribution" 
ADD COLUMN IF NOT EXISTS "branchId" VARCHAR(255);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS "idx_member_branch" ON "Member"("branchId");
CREATE INDEX IF NOT EXISTS "idx_loan_branch" ON "Loan"("branchId");
CREATE INDEX IF NOT EXISTS "idx_saving_branch" ON "Saving"("branchId");
CREATE INDEX IF NOT EXISTS "idx_share_branch" ON "Share"("branchId");
CREATE INDEX IF NOT EXISTS "idx_repayment_branch" ON "Repayment"("branchId");
CREATE INDEX IF NOT EXISTS "idx_contribution_branch" ON "Contribution"("branchId");

-- ============================================================================
-- RLS POLICIES - MEMBER TABLE
-- ============================================================================

-- AUDITOR: Read-only across all branches
CREATE POLICY "auditor_read_members" ON "Member"
  FOR SELECT
  TO authenticated
  USING (public.jwt_role() = 'AUDITOR');

-- CLERK: Insert/Select restricted to their branch
CREATE POLICY "clerk_insert_members" ON "Member"
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.jwt_role() IN ('CLERK', 'SECRETARY') 
    AND "branchId" = public.jwt_branch_id()
  );

CREATE POLICY "clerk_select_members" ON "Member"
  FOR SELECT
  TO authenticated
  USING (
    public.jwt_role() IN ('CLERK', 'SECRETARY')
    AND "branchId" = public.jwt_branch_id()
  );

-- MANAGER/TREASURER: Read/Write within their branch
CREATE POLICY "manager_all_members" ON "Member"
  FOR ALL
  TO authenticated
  USING (
    public.jwt_role() IN ('MANAGER', 'TREASURER', 'CHAIRMAN')
    AND "branchId" = public.jwt_branch_id()
  )
  WITH CHECK (
    public.jwt_role() IN ('MANAGER', 'TREASURER', 'CHAIRMAN')
    AND "branchId" = public.jwt_branch_id()
  );

-- ADMIN: Full access across all branches
CREATE POLICY "admin_all_members" ON "Member"
  FOR ALL
  TO authenticated
  USING (public.jwt_role() = 'ADMIN')
  WITH CHECK (public.jwt_role() = 'ADMIN');

-- MEMBER: Can view their own record
CREATE POLICY "member_own_record" ON "Member"
  FOR SELECT
  TO authenticated
  USING (
    public.jwt_role() = 'MEMBER'
    AND "userId" = public.jwt_user_id()
  );

-- ============================================================================
-- RLS POLICIES - LOAN TABLE
-- ============================================================================

-- AUDITOR: Read-only across all branches
CREATE POLICY "auditor_read_loans" ON "Loan"
  FOR SELECT
  TO authenticated
  USING (public.jwt_role() = 'AUDITOR');

-- CLERK: Insert/Select restricted to their branch
CREATE POLICY "clerk_insert_loans" ON "Loan"
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.jwt_role() IN ('CLERK', 'SECRETARY')
    AND "branchId" = public.jwt_branch_id()
  );

CREATE POLICY "clerk_select_loans" ON "Loan"
  FOR SELECT
  TO authenticated
  USING (
    public.jwt_role() IN ('CLERK', 'SECRETARY')
    AND "branchId" = public.jwt_branch_id()
  );

-- MANAGER/TREASURER: Read/Update within their branch (NO DELETE)
CREATE POLICY "manager_read_update_loans" ON "Loan"
  FOR UPDATE
  TO authenticated
  USING (
    public.jwt_role() IN ('MANAGER', 'TREASURER', 'CHAIRMAN')
    AND "branchId" = public.jwt_branch_id()
  )
  WITH CHECK (
    public.jwt_role() IN ('MANAGER', 'TREASURER', 'CHAIRMAN')
    AND "branchId" = public.jwt_branch_id()
  );

CREATE POLICY "manager_select_loans" ON "Loan"
  FOR SELECT
  TO authenticated
  USING (
    public.jwt_role() IN ('MANAGER', 'TREASURER', 'CHAIRMAN')
    AND "branchId" = public.jwt_branch_id()
  );

-- ADMIN: Full access (including delete)
CREATE POLICY "admin_all_loans" ON "Loan"
  FOR ALL
  TO authenticated
  USING (public.jwt_role() = 'ADMIN')
  WITH CHECK (public.jwt_role() = 'ADMIN');

-- MEMBER: Can view their own loans
CREATE POLICY "member_own_loans" ON "Loan"
  FOR SELECT
  TO authenticated
  USING (
    public.jwt_role() = 'MEMBER'
    AND EXISTS (
      SELECT 1 FROM "Member" m 
      WHERE m.id = "Loan"."memberId" 
      AND m."userId" = public.jwt_user_id()
    )
  );

-- DENY DELETE for non-admins
CREATE POLICY "deny_delete_loans" ON "Loan"
  FOR DELETE
  TO authenticated
  USING (public.jwt_role() = 'ADMIN');

-- ============================================================================
-- RLS POLICIES - SAVING TABLE (Transactions)
-- ============================================================================

-- AUDITOR: Read-only across all branches
CREATE POLICY "auditor_read_savings" ON "Saving"
  FOR SELECT
  TO authenticated
  USING (public.jwt_role() = 'AUDITOR');

-- CLERK: Insert/Select restricted to their branch
CREATE POLICY "clerk_insert_savings" ON "Saving"
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.jwt_role() IN ('CLERK', 'SECRETARY', 'TREASURER')
    AND "branchId" = public.jwt_branch_id()
  );

CREATE POLICY "clerk_select_savings" ON "Saving"
  FOR SELECT
  TO authenticated
  USING (
    public.jwt_role() IN ('CLERK', 'SECRETARY')
    AND "branchId" = public.jwt_branch_id()
  );

-- MANAGER/TREASURER: Read/Update within their branch (NO DELETE)
CREATE POLICY "manager_read_update_savings" ON "Saving"
  FOR UPDATE
  TO authenticated
  USING (
    public.jwt_role() IN ('MANAGER', 'TREASURER', 'CHAIRMAN')
    AND "branchId" = public.jwt_branch_id()
  )
  WITH CHECK (
    public.jwt_role() IN ('MANAGER', 'TREASURER', 'CHAIRMAN')
    AND "branchId" = public.jwt_branch_id()
  );

CREATE POLICY "manager_select_savings" ON "Saving"
  FOR SELECT
  TO authenticated
  USING (
    public.jwt_role() IN ('MANAGER', 'TREASURER', 'CHAIRMAN')
    AND "branchId" = public.jwt_branch_id()
  );

-- ADMIN: Full access
CREATE POLICY "admin_all_savings" ON "Saving"
  FOR ALL
  TO authenticated
  USING (public.jwt_role() = 'ADMIN')
  WITH CHECK (public.jwt_role() = 'ADMIN');

-- MEMBER: Can view their own savings
CREATE POLICY "member_own_savings" ON "Saving"
  FOR SELECT
  TO authenticated
  USING (
    public.jwt_role() = 'MEMBER'
    AND EXISTS (
      SELECT 1 FROM "Member" m 
      WHERE m.id = "Saving"."memberId" 
      AND m."userId" = public.jwt_user_id()
    )
  );

-- DENY DELETE for non-admins
CREATE POLICY "deny_delete_savings" ON "Saving"
  FOR DELETE
  TO authenticated
  USING (public.jwt_role() = 'ADMIN');

-- ============================================================================
-- RLS POLICIES - SHARE TABLE
-- ============================================================================

-- AUDITOR: Read-only across all branches
CREATE POLICY "auditor_read_shares" ON "Share"
  FOR SELECT
  TO authenticated
  USING (public.jwt_role() = 'AUDITOR');

-- CLERK: Insert/Select restricted to their branch
CREATE POLICY "clerk_insert_shares" ON "Share"
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.jwt_role() IN ('CLERK', 'SECRETARY', 'TREASURER')
    AND "branchId" = public.jwt_branch_id()
  );

CREATE POLICY "clerk_select_shares" ON "Share"
  FOR SELECT
  TO authenticated
  USING (
    public.jwt_role() IN ('CLERK', 'SECRETARY')
    AND "branchId" = public.jwt_branch_id()
  );

-- MANAGER/TREASURER: Read/Update within their branch (NO DELETE)
CREATE POLICY "manager_read_update_shares" ON "Share"
  FOR UPDATE
  TO authenticated
  USING (
    public.jwt_role() IN ('MANAGER', 'TREASURER', 'CHAIRMAN')
    AND "branchId" = public.jwt_branch_id()
  )
  WITH CHECK (
    public.jwt_role() IN ('MANAGER', 'TREASURER', 'CHAIRMAN')
    AND "branchId" = public.jwt_branch_id()
  );

CREATE POLICY "manager_select_shares" ON "Share"
  FOR SELECT
  TO authenticated
  USING (
    public.jwt_role() IN ('MANAGER', 'TREASURER', 'CHAIRMAN')
    AND "branchId" = public.jwt_branch_id()
  );

-- ADMIN: Full access
CREATE POLICY "admin_all_shares" ON "Share"
  FOR ALL
  TO authenticated
  USING (public.jwt_role() = 'ADMIN')
  WITH CHECK (public.jwt_role() = 'ADMIN');

-- MEMBER: Can view their own shares
CREATE POLICY "member_own_shares" ON "Share"
  FOR SELECT
  TO authenticated
  USING (
    public.jwt_role() = 'MEMBER'
    AND EXISTS (
      SELECT 1 FROM "Member" m 
      WHERE m.id = "Share"."memberId" 
      AND m."userId" = public.jwt_user_id()
    )
  );

-- DENY DELETE for non-admins
CREATE POLICY "deny_delete_shares" ON "Share"
  FOR DELETE
  TO authenticated
  USING (public.jwt_role() = 'ADMIN');

-- ============================================================================
-- RLS POLICIES - REPAYMENT TABLE
-- ============================================================================

-- AUDITOR: Read-only across all branches
CREATE POLICY "auditor_read_repayments" ON "Repayment"
  FOR SELECT
  TO authenticated
  USING (public.jwt_role() = 'AUDITOR');

-- CLERK: Insert/Select restricted to their branch
CREATE POLICY "clerk_insert_repayments" ON "Repayment"
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.jwt_role() IN ('CLERK', 'SECRETARY', 'TREASURER')
    AND "branchId" = public.jwt_branch_id()
  );

CREATE POLICY "clerk_select_repayments" ON "Repayment"
  FOR SELECT
  TO authenticated
  USING (
    public.jwt_role() IN ('CLERK', 'SECRETARY')
    AND "branchId" = public.jwt_branch_id()
  );

-- MANAGER/TREASURER: Read/Update within their branch (NO DELETE)
CREATE POLICY "manager_read_update_repayments" ON "Repayment"
  FOR UPDATE
  TO authenticated
  USING (
    public.jwt_role() IN ('MANAGER', 'TREASURER', 'CHAIRMAN')
    AND "branchId" = public.jwt_branch_id()
  )
  WITH CHECK (
    public.jwt_role() IN ('MANAGER', 'TREASURER', 'CHAIRMAN')
    AND "branchId" = public.jwt_branch_id()
  );

CREATE POLICY "manager_select_repayments" ON "Repayment"
  FOR SELECT
  TO authenticated
  USING (
    public.jwt_role() IN ('MANAGER', 'TREASURER', 'CHAIRMAN')
    AND "branchId" = public.jwt_branch_id()
  );

-- ADMIN: Full access
CREATE POLICY "admin_all_repayments" ON "Repayment"
  FOR ALL
  TO authenticated
  USING (public.jwt_role() = 'ADMIN')
  WITH CHECK (public.jwt_role() = 'ADMIN');

-- MEMBER: Can view their own repayments
CREATE POLICY "member_own_repayments" ON "Repayment"
  FOR SELECT
  TO authenticated
  USING (
    public.jwt_role() = 'MEMBER'
    AND EXISTS (
      SELECT 1 FROM "Loan" l
      JOIN "Member" m ON m.id = l."memberId"
      WHERE l.id = "Repayment"."loanId"
      AND m."userId" = public.jwt_user_id()
    )
  );

-- DENY DELETE for non-admins
CREATE POLICY "deny_delete_repayments" ON "Repayment"
  FOR DELETE
  TO authenticated
  USING (public.jwt_role() = 'ADMIN');

-- ============================================================================
-- RLS POLICIES - CONTRIBUTION TABLE
-- ============================================================================

-- AUDITOR: Read-only across all branches
CREATE POLICY "auditor_read_contributions" ON "Contribution"
  FOR SELECT
  TO authenticated
  USING (public.jwt_role() = 'AUDITOR');

-- CLERK: Insert/Select restricted to their branch
CREATE POLICY "clerk_insert_contributions" ON "Contribution"
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.jwt_role() IN ('CLERK', 'SECRETARY', 'TREASURER')
    AND "branchId" = public.jwt_branch_id()
  );

CREATE POLICY "clerk_select_contributions" ON "Contribution"
  FOR SELECT
  TO authenticated
  USING (
    public.jwt_role() IN ('CLERK', 'SECRETARY')
    AND "branchId" = public.jwt_branch_id()
  );

-- MANAGER/TREASURER: Read/Update within their branch (NO DELETE)
CREATE POLICY "manager_read_update_contributions" ON "Contribution"
  FOR UPDATE
  TO authenticated
  USING (
    public.jwt_role() IN ('MANAGER', 'TREASURER', 'CHAIRMAN')
    AND "branchId" = public.jwt_branch_id()
  )
  WITH CHECK (
    public.jwt_role() IN ('MANAGER', 'TREASURER', 'CHAIRMAN')
    AND "branchId" = public.jwt_branch_id()
  );

CREATE POLICY "manager_select_contributions" ON "Contribution"
  FOR SELECT
  TO authenticated
  USING (
    public.jwt_role() IN ('MANAGER', 'TREASURER', 'CHAIRMAN')
    AND "branchId" = public.jwt_branch_id()
  );

-- ADMIN: Full access
CREATE POLICY "admin_all_contributions" ON "Contribution"
  FOR ALL
  TO authenticated
  USING (public.jwt_role() = 'ADMIN')
  WITH CHECK (public.jwt_role() = 'ADMIN');

-- MEMBER: Can view their own contributions
CREATE POLICY "member_own_contributions" ON "Contribution"
  FOR SELECT
  TO authenticated
  USING (
    public.jwt_role() = 'MEMBER'
    AND EXISTS (
      SELECT 1 FROM "Member" m 
      WHERE m.id = "Contribution"."memberId" 
      AND m."userId" = public.jwt_user_id()
    )
  );

-- DENY DELETE for non-admins
CREATE POLICY "deny_delete_contributions" ON "Contribution"
  FOR DELETE
  TO authenticated
  USING (public.jwt_role() = 'ADMIN');

-- ============================================================================
-- HELPER SQL FOR TESTING JWT CLAIMS
-- ============================================================================

-- Function to set test JWT claims for a session
CREATE OR REPLACE FUNCTION set_test_jwt_claims(
  p_role TEXT,
  p_branch_id TEXT DEFAULT NULL,
  p_user_id TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'role', p_role,
      'branch_id', p_branch_id,
      'sub', p_user_id
    )::text,
    true  -- is_local = true (applies only to current transaction)
  );
END;
$$ LANGUAGE plpgsql;

-- Function to clear test JWT claims
CREATE OR REPLACE FUNCTION clear_test_jwt_claims()
RETURNS VOID AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', NULL, true);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- EXAMPLE USAGE FOR TESTING
-- ============================================================================

/*
-- Test as AUDITOR (read-only across all branches)
SELECT set_test_jwt_claims('AUDITOR', NULL, 'user-123');
SELECT * FROM "Member";  -- Should see all members
SELECT clear_test_jwt_claims();

-- Test as CLERK in branch-001
SELECT set_test_jwt_claims('CLERK', 'branch-001', 'user-456');
SELECT * FROM "Member" WHERE "branchId" = 'branch-001';  -- Should see only branch-001 members
INSERT INTO "Member" (..., "branchId") VALUES (..., 'branch-001');  -- Should succeed
INSERT INTO "Member" (..., "branchId") VALUES (..., 'branch-002');  -- Should fail
SELECT clear_test_jwt_claims();

-- Test as MANAGER in branch-002
SELECT set_test_jwt_claims('MANAGER', 'branch-002', 'user-789');
SELECT * FROM "Member" WHERE "branchId" = 'branch-002';  -- Should see only branch-002 members
UPDATE "Member" SET "firstName" = 'Updated' WHERE "branchId" = 'branch-002';  -- Should succeed
DELETE FROM "Member" WHERE "branchId" = 'branch-002';  -- Should succeed (managers can delete members)
SELECT clear_test_jwt_claims();

-- Test DELETE restrictions on transactional tables
SELECT set_test_jwt_claims('MANAGER', 'branch-001', 'user-456');
DELETE FROM "Loan" WHERE "branchId" = 'branch-001';  -- Should FAIL (only admins can delete)
SELECT clear_test_jwt_claims();

-- Test as ADMIN (full access everywhere)
SELECT set_test_jwt_claims('ADMIN', NULL, 'admin-001');
SELECT * FROM "Member";  -- Should see all members
DELETE FROM "Loan" WHERE id = 'some-loan-id';  -- Should succeed
SELECT clear_test_jwt_claims();

-- Test as MEMBER (can only see their own records)
SELECT set_test_jwt_claims('MEMBER', NULL, 'user-member-123');
SELECT * FROM "Member" WHERE "userId" = 'user-member-123';  -- Should see only their record
SELECT * FROM "Loan" l 
  JOIN "Member" m ON m.id = l."memberId" 
  WHERE m."userId" = 'user-member-123';  -- Should see only their loans
SELECT clear_test_jwt_claims();
*/

-- ============================================================================
-- COMMENTS AND DOCUMENTATION
-- ============================================================================

COMMENT ON FUNCTION public.jwt_role() IS 'Extracts the role claim from the JWT token';
COMMENT ON FUNCTION public.jwt_branch_id() IS 'Extracts the branch_id claim from the JWT token';
COMMENT ON FUNCTION public.jwt_user_id() IS 'Extracts the sub (user ID) claim from the JWT token';
COMMENT ON FUNCTION set_test_jwt_claims(TEXT, TEXT, TEXT) IS 'Helper function to set test JWT claims for the current session';
COMMENT ON FUNCTION clear_test_jwt_claims() IS 'Helper function to clear test JWT claims';

-- Add comments to columns
COMMENT ON COLUMN "Member"."branchId" IS 'Branch identifier for RLS branch-based access control';
COMMENT ON COLUMN "Loan"."branchId" IS 'Branch identifier for RLS branch-based access control';
COMMENT ON COLUMN "Saving"."branchId" IS 'Branch identifier for RLS branch-based access control';
COMMENT ON COLUMN "Share"."branchId" IS 'Branch identifier for RLS branch-based access control';
COMMENT ON COLUMN "Repayment"."branchId" IS 'Branch identifier for RLS branch-based access control';
COMMENT ON COLUMN "Contribution"."branchId" IS 'Branch identifier for RLS branch-based access control';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
