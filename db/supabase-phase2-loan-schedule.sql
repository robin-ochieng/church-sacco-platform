-- =====================================================
-- P2.3 & P2.4: Loan Approval/Disbursement Enhancement & Repayment Schedule
-- =====================================================
-- This migration adds:
-- 1. New columns to Loan table for approval/disbursement tracking
-- 2. LoanSchedule table for amortization
-- 3. ScheduleStatus enum
-- 4. RLS policies for both tables

-- Step 0: Ensure MANAGER role exists in UserRole enum (if not already)
-- This must run outside a transaction, so we check first
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

-- Step 1: Add ScheduleStatus enum
DO $$ BEGIN
  CREATE TYPE "ScheduleStatus" AS ENUM ('PENDING', 'DUE', 'PARTIAL', 'PAID', 'OVERDUE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Step 2: Add new columns to Loan table for enhanced approval/disbursement
ALTER TABLE "Loan" 
  ADD COLUMN IF NOT EXISTS "approvedBy" TEXT,
  ADD COLUMN IF NOT EXISTS "disbursedBy" TEXT,
  ADD COLUMN IF NOT EXISTS "disbursementReceiptNo" TEXT,
  ADD COLUMN IF NOT EXISTS "netDisbursedAmount" DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS "arrearsDeducted" DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS "savingsDeducted" DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS "sharesDeducted" DECIMAL(10, 2);

-- Step 3: Create LoanSchedule table
CREATE TABLE IF NOT EXISTS "LoanSchedule" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "loanId" TEXT NOT NULL,
  "installmentNo" INTEGER NOT NULL,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "principalDue" DECIMAL(10,2) NOT NULL,
  "interestDue" DECIMAL(10,2) NOT NULL,
  "penaltyDue" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "principalPaid" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "interestPaid" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "penaltyPaid" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "totalDue" DECIMAL(10,2) NOT NULL,
  "totalPaid" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "balanceAfter" DECIMAL(10,2) NOT NULL,
  "status" "ScheduleStatus" NOT NULL DEFAULT 'PENDING'::"ScheduleStatus",
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LoanSchedule_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LoanSchedule_loanId_fkey" FOREIGN KEY ("loanId") 
    REFERENCES "Loan"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Step 4: Create indexes
CREATE UNIQUE INDEX IF NOT EXISTS "LoanSchedule_loanId_installmentNo_key" 
  ON "LoanSchedule"("loanId", "installmentNo");
CREATE INDEX IF NOT EXISTS "LoanSchedule_loanId_idx" ON "LoanSchedule"("loanId");
CREATE INDEX IF NOT EXISTS "LoanSchedule_dueDate_idx" ON "LoanSchedule"("dueDate");
CREATE INDEX IF NOT EXISTS "LoanSchedule_status_idx" ON "LoanSchedule"("status");

-- Step 5: Enable RLS on LoanSchedule
ALTER TABLE "LoanSchedule" ENABLE ROW LEVEL SECURITY;

-- Step 6: RLS Policies for LoanSchedule

-- Policy 1: Staff can view all loan schedules
DROP POLICY IF EXISTS "staff_view_all_schedules" ON "LoanSchedule";
CREATE POLICY "staff_view_all_schedules" ON "LoanSchedule"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "User" u
      WHERE u.id = auth.uid()::text
      AND u.role::text IN ('ADMIN', 'MANAGER', 'CLERK', 'TREASURER', 'SECRETARY', 'CHAIRMAN')
    )
  );

-- Policy 2: Members can view schedules for their own loans
DROP POLICY IF EXISTS "members_view_own_loan_schedules" ON "LoanSchedule";
CREATE POLICY "members_view_own_loan_schedules" ON "LoanSchedule"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "Loan" l
      JOIN "Member" m ON l."memberId" = m.id
      WHERE l.id = "LoanSchedule"."loanId"
      AND m."userId" = auth.uid()::text
    )
  );

-- Policy 3: Guarantors can view schedules for loans they guarantee
DROP POLICY IF EXISTS "guarantors_view_guaranteed_loan_schedules" ON "LoanSchedule";
CREATE POLICY "guarantors_view_guaranteed_loan_schedules" ON "LoanSchedule"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "Guarantor" g
      JOIN "Member" m ON g."guarantorMemberId" = m.id
      WHERE g."loanId" = "LoanSchedule"."loanId"
      AND m."userId" = auth.uid()::text
    )
  );

-- Policy 4: Staff can manage (insert/update) loan schedules
DROP POLICY IF EXISTS "staff_manage_schedules" ON "LoanSchedule";
CREATE POLICY "staff_manage_schedules" ON "LoanSchedule"
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM "User" u
      WHERE u.id = auth.uid()::text
      AND u.role::text IN ('ADMIN', 'MANAGER', 'TREASURER')
    )
  );

-- Step 7: Helper function to get loan schedule summary
CREATE OR REPLACE FUNCTION get_loan_schedule_summary(p_loan_id TEXT)
RETURNS TABLE (
  total_principal_due DECIMAL,
  total_interest_due DECIMAL,
  total_penalty_due DECIMAL,
  total_paid DECIMAL,
  total_outstanding DECIMAL,
  paid_installments INTEGER,
  overdue_installments INTEGER,
  remaining_installments INTEGER,
  next_due_date TIMESTAMP,
  next_amount_due DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(ls."principalDue"), 0) AS total_principal_due,
    COALESCE(SUM(ls."interestDue"), 0) AS total_interest_due,
    COALESCE(SUM(ls."penaltyDue"), 0) AS total_penalty_due,
    COALESCE(SUM(ls."totalPaid"), 0) AS total_paid,
    COALESCE(SUM(ls."totalDue") - SUM(ls."totalPaid"), 0) AS total_outstanding,
    COUNT(*) FILTER (WHERE ls.status = 'PAID')::INTEGER AS paid_installments,
    COUNT(*) FILTER (WHERE ls.status = 'OVERDUE')::INTEGER AS overdue_installments,
    COUNT(*) FILTER (WHERE ls.status != 'PAID')::INTEGER AS remaining_installments,
    MIN(ls."dueDate") FILTER (WHERE ls.status != 'PAID') AS next_due_date,
    COALESCE(
      (SELECT ls2."totalDue" - ls2."totalPaid" 
       FROM "LoanSchedule" ls2 
       WHERE ls2."loanId" = p_loan_id 
       AND ls2.status != 'PAID' 
       ORDER BY ls2."installmentNo" 
       LIMIT 1),
      0
    ) AS next_amount_due
  FROM "LoanSchedule" ls
  WHERE ls."loanId" = p_loan_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 8: Function to calculate amortization schedule
-- This is a helper for generating schedules in SQL (optional, can also use application logic)
CREATE OR REPLACE FUNCTION calculate_monthly_payment(
  p_principal DECIMAL,
  p_monthly_rate DECIMAL,
  p_months INTEGER
) RETURNS DECIMAL AS $$
DECLARE
  v_factor DECIMAL;
  v_payment DECIMAL;
BEGIN
  IF p_monthly_rate = 0 THEN
    RETURN p_principal / p_months;
  END IF;
  
  v_factor := POWER(1 + p_monthly_rate, p_months);
  v_payment := p_principal * (p_monthly_rate * v_factor) / (v_factor - 1);
  
  RETURN ROUND(v_payment, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Step 9: Trigger to update schedule status based on due date
CREATE OR REPLACE FUNCTION update_schedule_status()
RETURNS TRIGGER AS $$
BEGIN
  -- If past due date and not fully paid, mark as OVERDUE
  IF NEW."dueDate" < CURRENT_DATE AND NEW."totalPaid" < NEW."totalDue" THEN
    IF NEW."totalPaid" > 0 THEN
      NEW.status := 'PARTIAL';
    ELSE
      NEW.status := 'OVERDUE';
    END IF;
  -- If fully paid, mark as PAID
  ELSIF NEW."totalPaid" >= NEW."totalDue" THEN
    NEW.status := 'PAID';
    NEW."paidAt" := COALESCE(NEW."paidAt", CURRENT_TIMESTAMP);
  -- If due date is today or past and has partial payment
  ELSIF NEW."dueDate" <= CURRENT_DATE AND NEW."totalPaid" > 0 THEN
    NEW.status := 'PARTIAL';
  -- If due date is today or past
  ELSIF NEW."dueDate" <= CURRENT_DATE THEN
    NEW.status := 'DUE';
  END IF;
  
  NEW."updatedAt" := CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_schedule_status ON "LoanSchedule";
CREATE TRIGGER trigger_update_schedule_status
  BEFORE UPDATE ON "LoanSchedule"
  FOR EACH ROW
  EXECUTE FUNCTION update_schedule_status();

-- Step 10: Add audit logging for loan status changes
CREATE OR REPLACE FUNCTION log_loan_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO "audit_log" (
      id,
      table_name,
      record_id,
      action,
      old_data,
      new_data,
      changed_by,
      changed_at
    ) VALUES (
      gen_random_uuid()::text,
      'Loan',
      NEW.id,
      'STATUS_CHANGE',
      jsonb_build_object(
        'status', OLD.status,
        'balance', OLD.balance,
        'approvedBy', OLD."approvedBy",
        'disbursedBy', OLD."disbursedBy"
      ),
      jsonb_build_object(
        'status', NEW.status,
        'balance', NEW.balance,
        'approvedBy', NEW."approvedBy",
        'disbursedBy', NEW."disbursedBy",
        'netDisbursedAmount', NEW."netDisbursedAmount"
      ),
      COALESCE(auth.uid()::text, 'system'),
      CURRENT_TIMESTAMP
    );
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN undefined_table THEN
    -- audit_log table doesn't exist, skip logging
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_log_loan_status_change ON "Loan";
CREATE TRIGGER trigger_log_loan_status_change
  AFTER UPDATE ON "Loan"
  FOR EACH ROW
  EXECUTE FUNCTION log_loan_status_change();

-- Step 11: Grant necessary permissions
GRANT SELECT ON "LoanSchedule" TO authenticated;
GRANT SELECT ON "LoanSchedule" TO anon;

-- Step 12: Comment documentation
COMMENT ON TABLE "LoanSchedule" IS 'Loan repayment schedule (amortization table) with reducing balance method';
COMMENT ON COLUMN "LoanSchedule"."installmentNo" IS 'Sequential installment number starting from 1';
COMMENT ON COLUMN "LoanSchedule"."balanceAfter" IS 'Remaining loan principal balance after this installment is paid';
COMMENT ON COLUMN "LoanSchedule"."status" IS 'PENDING: Not yet due, DUE: Due for payment, PARTIAL: Partially paid, PAID: Fully paid, OVERDUE: Past due';
COMMENT ON COLUMN "Loan"."approvedBy" IS 'User ID of chairman/secretary/treasurer who approved the loan';
COMMENT ON COLUMN "Loan"."disbursedBy" IS 'User ID of staff who processed the disbursement';
COMMENT ON COLUMN "Loan"."netDisbursedAmount" IS 'Amount actually disbursed after deducting fees, arrears, etc.';
