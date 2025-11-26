-- ===========================================
-- Supabase Migration: P2.2 Guarantor Table
-- ACK Thiboro SACCO Platform
-- ===========================================

-- 0. Ensure MANAGER role exists in UserRole enum (if not already)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'MANAGER' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'UserRole')
  ) THEN
    ALTER TYPE "UserRole" ADD VALUE 'MANAGER';
  END IF;
EXCEPTION
  WHEN others THEN 
    RAISE NOTICE 'Could not add MANAGER to UserRole enum: %', SQLERRM;
END $$;

-- 1. Create GuarantorStatus enum if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'GuarantorStatus') THEN
    CREATE TYPE "GuarantorStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED');
  END IF;
END$$;

-- 2. Create Guarantor table
CREATE TABLE IF NOT EXISTS "Guarantor" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "loanId" TEXT NOT NULL REFERENCES "Loan"("id") ON DELETE CASCADE,
  "guarantorMemberId" TEXT NOT NULL REFERENCES "Member"("id") ON DELETE CASCADE,
  "amountGuaranteed" DECIMAL(10, 2) NOT NULL,
  "status" "GuarantorStatus" NOT NULL DEFAULT 'PENDING',
  "signatureKey" TEXT,  -- Supabase Storage key for signature image
  "approvedAt" TIMESTAMP,
  "declinedAt" TIMESTAMP,
  "declineReason" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- A member can only guarantee a loan once
  CONSTRAINT "Guarantor_loan_member_unique" UNIQUE ("loanId", "guarantorMemberId")
);

-- 3. Create indexes
CREATE INDEX IF NOT EXISTS "Guarantor_loanId_idx" ON "Guarantor"("loanId");
CREATE INDEX IF NOT EXISTS "Guarantor_guarantorMemberId_idx" ON "Guarantor"("guarantorMemberId");
CREATE INDEX IF NOT EXISTS "Guarantor_status_idx" ON "Guarantor"("status");

-- 4. Create updated_at trigger for Guarantor
CREATE OR REPLACE FUNCTION update_guarantor_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_guarantor_timestamp ON "Guarantor";
CREATE TRIGGER update_guarantor_timestamp
  BEFORE UPDATE ON "Guarantor"
  FOR EACH ROW
  EXECUTE FUNCTION update_guarantor_updated_at();

-- ===========================================
-- Row Level Security (RLS) Policies
-- ===========================================

-- Enable RLS on Guarantor table
ALTER TABLE "Guarantor" ENABLE ROW LEVEL SECURITY;

-- Policy: Admins, Treasurers, Clerks can view all guarantors
CREATE POLICY "Staff can view all guarantors" ON "Guarantor"
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "User"
      WHERE "User"."id" = auth.uid()::text
      AND "User"."role"::text IN ('ADMIN', 'TREASURER', 'CLERK', 'MANAGER')
    )
  );

-- Policy: Members can view guarantors for their own loans
CREATE POLICY "Members can view own loan guarantors" ON "Guarantor"
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "Loan"
      JOIN "Member" ON "Loan"."memberId" = "Member"."id"
      WHERE "Loan"."id" = "Guarantor"."loanId"
      AND "Member"."userId" = auth.uid()::text
    )
  );

-- Policy: Members can view guarantees they have given
CREATE POLICY "Members can view own guarantees" ON "Guarantor"
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "Member"
      WHERE "Member"."id" = "Guarantor"."guarantorMemberId"
      AND "Member"."userId" = auth.uid()::text
    )
  );

-- Policy: Staff can insert guarantors
CREATE POLICY "Staff can insert guarantors" ON "Guarantor"
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "User"
      WHERE "User"."id" = auth.uid()::text
      AND "User"."role"::text IN ('ADMIN', 'TREASURER', 'CLERK', 'MANAGER')
    )
  );

-- Policy: Members can add guarantors to their own loans (for self-service)
CREATE POLICY "Members can add guarantors to own loans" ON "Guarantor"
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "Loan"
      JOIN "Member" ON "Loan"."memberId" = "Member"."id"
      WHERE "Loan"."id" = "Guarantor"."loanId"
      AND "Member"."userId" = auth.uid()::text
      AND "Loan"."status"::text IN ('DRAFT', 'SUBMITTED')
    )
  );

-- Policy: Staff can update any guarantor
CREATE POLICY "Staff can update guarantors" ON "Guarantor"
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "User"
      WHERE "User"."id" = auth.uid()::text
      AND "User"."role"::text IN ('ADMIN', 'TREASURER', 'CLERK', 'MANAGER')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "User"
      WHERE "User"."id" = auth.uid()::text
      AND "User"."role"::text IN ('ADMIN', 'TREASURER', 'CLERK', 'MANAGER')
    )
  );

-- Policy: Guarantors can approve/decline their own guarantee requests
CREATE POLICY "Guarantors can approve own guarantees" ON "Guarantor"
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "Member"
      WHERE "Member"."id" = "Guarantor"."guarantorMemberId"
      AND "Member"."userId" = auth.uid()::text
    )
    AND "Guarantor"."status"::text = 'PENDING'
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "Member"
      WHERE "Member"."id" = "Guarantor"."guarantorMemberId"
      AND "Member"."userId" = auth.uid()::text
    )
    -- Can only change status to APPROVED or DECLINED
    AND "Guarantor"."status"::text IN ('APPROVED', 'DECLINED')
  );

-- Policy: Staff can delete pending guarantors
CREATE POLICY "Staff can delete pending guarantors" ON "Guarantor"
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "User"
      WHERE "User"."id" = auth.uid()::text
      AND "User"."role"::text IN ('ADMIN', 'TREASURER', 'CLERK', 'MANAGER')
    )
    AND "Guarantor"."status"::text = 'PENDING'
  );

-- Policy: Loan applicants can remove pending guarantors from their loans
CREATE POLICY "Members can remove pending guarantors from own loans" ON "Guarantor"
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "Loan"
      JOIN "Member" ON "Loan"."memberId" = "Member"."id"
      WHERE "Loan"."id" = "Guarantor"."loanId"
      AND "Member"."userId" = auth.uid()::text
      AND "Loan"."status"::text IN ('DRAFT', 'SUBMITTED')
    )
    AND "Guarantor"."status"::text = 'PENDING'
  );

-- ===========================================
-- Helper Functions
-- ===========================================

-- Function to get a member's total guarantee exposure
CREATE OR REPLACE FUNCTION get_member_guarantee_exposure(p_member_id TEXT)
RETURNS TABLE (
  total_exposure DECIMAL,
  active_guarantees INT,
  pending_guarantees INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(g."amountGuaranteed"), 0)::DECIMAL AS total_exposure,
    COUNT(CASE WHEN g."status" = 'APPROVED' THEN 1 END)::INT AS active_guarantees,
    COUNT(CASE WHEN g."status" = 'PENDING' THEN 1 END)::INT AS pending_guarantees
  FROM "Guarantor" g
  JOIN "Loan" l ON g."loanId" = l."id"
  WHERE g."guarantorMemberId" = p_member_id
    AND g."status" IN ('PENDING', 'APPROVED')
    AND l."status" NOT IN ('CLOSED', 'REJECTED');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if a member is eligible to guarantee
CREATE OR REPLACE FUNCTION is_member_eligible_guarantor(
  p_member_id TEXT,
  p_amount DECIMAL
)
RETURNS TABLE (
  is_eligible BOOLEAN,
  reason TEXT,
  available_capacity DECIMAL
) AS $$
DECLARE
  v_joining_date TIMESTAMP;
  v_total_shares DECIMAL;
  v_existing_exposure DECIMAL;
  v_available_capacity DECIMAL;
  v_twelve_months_ago TIMESTAMP;
BEGIN
  v_twelve_months_ago := NOW() - INTERVAL '12 months';
  
  -- Get member details
  SELECT "joiningDate" INTO v_joining_date
  FROM "Member"
  WHERE "id" = p_member_id;
  
  IF v_joining_date IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Member not found'::TEXT, 0::DECIMAL;
    RETURN;
  END IF;
  
  -- Check membership duration
  IF v_joining_date > v_twelve_months_ago THEN
    RETURN QUERY SELECT FALSE, 'Member must be a member for at least 12 months'::TEXT, 0::DECIMAL;
    RETURN;
  END IF;
  
  -- Get total shares value
  SELECT COALESCE(SUM("totalValue"), 0) INTO v_total_shares
  FROM "Share"
  WHERE "memberId" = p_member_id;
  
  -- Get existing exposure
  SELECT COALESCE(SUM(g."amountGuaranteed"), 0) INTO v_existing_exposure
  FROM "Guarantor" g
  JOIN "Loan" l ON g."loanId" = l."id"
  WHERE g."guarantorMemberId" = p_member_id
    AND g."status" IN ('PENDING', 'APPROVED')
    AND l."status" NOT IN ('CLOSED', 'REJECTED');
  
  v_available_capacity := v_total_shares - v_existing_exposure;
  
  IF v_available_capacity < p_amount THEN
    RETURN QUERY SELECT 
      FALSE, 
      'Insufficient share balance. Available: ' || v_available_capacity::TEXT, 
      v_available_capacity;
    RETURN;
  END IF;
  
  RETURN QUERY SELECT TRUE, 'Eligible'::TEXT, v_available_capacity;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_member_guarantee_exposure(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION is_member_eligible_guarantor(TEXT, DECIMAL) TO authenticated;

-- ===========================================
-- COMMENTS
-- ===========================================
COMMENT ON TABLE "Guarantor" IS 'Loan guarantors - members who guarantee loan repayment';
COMMENT ON COLUMN "Guarantor"."amountGuaranteed" IS 'Amount this guarantor is responsible for';
COMMENT ON COLUMN "Guarantor"."signatureKey" IS 'Supabase Storage key for digital signature';
COMMENT ON COLUMN "Guarantor"."status" IS 'PENDING=awaiting approval, APPROVED=guarantor accepted, DECLINED=guarantor rejected';
COMMENT ON FUNCTION get_member_guarantee_exposure(TEXT) IS 'Get total guarantee exposure for a member';
COMMENT ON FUNCTION is_member_eligible_guarantor(TEXT, DECIMAL) IS 'Check if member can guarantee a given amount';
