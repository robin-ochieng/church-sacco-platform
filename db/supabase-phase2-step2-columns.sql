-- ============================================================================
-- STEP 2 of 2: Add Loan Table Columns and Updates
-- 
-- PREREQUISITE: Run supabase-phase2-step1a-add-enum-values.sql FIRST
--               to add missing enum values like 'DRAFT', 'SUBMITTED', etc.
-- ============================================================================

-- --------------------------------------------------------------------------
-- STEP 2: Add new columns to Loan table (Application Details)
-- --------------------------------------------------------------------------

-- Add monthlyIncome (required for loan application)
ALTER TABLE "Loan" 
ADD COLUMN IF NOT EXISTS "monthlyIncome" DECIMAL(10,2);

-- Add sourceOfIncome (required for loan application)
ALTER TABLE "Loan" 
ADD COLUMN IF NOT EXISTS "sourceOfIncome" TEXT;

-- Add processingFee (calculated during application)
ALTER TABLE "Loan" 
ADD COLUMN IF NOT EXISTS "processingFee" DECIMAL(10,2);

-- Add insuranceFee (calculated during application)
ALTER TABLE "Loan" 
ADD COLUMN IF NOT EXISTS "insuranceFee" DECIMAL(10,2);

-- Add disbursementMode (NET or GROSS)
ALTER TABLE "Loan" 
ADD COLUMN IF NOT EXISTS "disbursementMode" TEXT;

-- Add branchId for multi-branch support
ALTER TABLE "Loan" 
ADD COLUMN IF NOT EXISTS "branchId" TEXT;

-- --------------------------------------------------------------------------
-- STEP 3: Modify existing columns to be nullable (Application stage)
-- --------------------------------------------------------------------------

-- Make guarantor fields optional (can be added later in approval stage)
DO $$
BEGIN
  ALTER TABLE "Loan" ALTER COLUMN "guarantorName" DROP NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "Loan" ALTER COLUMN "guarantorPhone" DROP NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "Loan" ALTER COLUMN "guarantorNationalId" DROP NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Make monthlyPayment nullable (calculated at disbursement)
DO $$
BEGIN
  ALTER TABLE "Loan" ALTER COLUMN "monthlyPayment" DROP NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Make balance nullable initially (set to 0 until disbursement)
DO $$
BEGIN
  ALTER TABLE "Loan" ALTER COLUMN "balance" DROP NOT NULL;
  ALTER TABLE "Loan" ALTER COLUMN "balance" SET DEFAULT 0;
EXCEPTION WHEN others THEN NULL;
END $$;

-- --------------------------------------------------------------------------
-- STEP 4: Update existing Loan records with default values
-- --------------------------------------------------------------------------

-- Set default values for existing records (if any exist)
UPDATE "Loan" 
SET 
  "monthlyIncome" = COALESCE("monthlyIncome", 0),
  "sourceOfIncome" = COALESCE("sourceOfIncome", 'Not Specified'),
  "processingFee" = COALESCE("processingFee", 0),
  "insuranceFee" = COALESCE("insuranceFee", 0),
  "disbursementMode" = COALESCE("disbursementMode", 'GROSS'),
  "balance" = COALESCE("balance", 0)
WHERE "monthlyIncome" IS NULL OR "sourceOfIncome" IS NULL;

-- --------------------------------------------------------------------------
-- STEP 5: Make required fields NOT NULL after setting defaults
-- --------------------------------------------------------------------------

DO $$
BEGIN
  ALTER TABLE "Loan" ALTER COLUMN "monthlyIncome" SET NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "Loan" ALTER COLUMN "sourceOfIncome" SET NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;

-- --------------------------------------------------------------------------
-- STEP 6: Update default status from PENDING to DRAFT
-- --------------------------------------------------------------------------

-- Change default status for new loan applications
ALTER TABLE "Loan" 
ALTER COLUMN "status" SET DEFAULT 'DRAFT';

-- --------------------------------------------------------------------------
-- STEP 7: Create indexes for better query performance
-- --------------------------------------------------------------------------

-- Index for filtering loans by status (used in loan list page)
CREATE INDEX IF NOT EXISTS "idx_loan_status" ON "Loan"("status");

-- Index for filtering loans by member
CREATE INDEX IF NOT EXISTS "idx_loan_memberId" ON "Loan"("memberId");

-- Index for filtering by branch (multi-branch support)
CREATE INDEX IF NOT EXISTS "idx_loan_branchId" ON "Loan"("branchId");

-- Index for date-based queries
CREATE INDEX IF NOT EXISTS "idx_loan_applicationDate" ON "Loan"("applicationDate");

-- --------------------------------------------------------------------------
-- STEP 8: Add comments for documentation
-- --------------------------------------------------------------------------

COMMENT ON COLUMN "Loan"."monthlyIncome" IS 'Member monthly income for loan eligibility assessment';
COMMENT ON COLUMN "Loan"."sourceOfIncome" IS 'Source of income (e.g., Salary, Business, etc.)';
COMMENT ON COLUMN "Loan"."processingFee" IS 'Loan processing fee (3% of loan amount)';
COMMENT ON COLUMN "Loan"."insuranceFee" IS 'Loan insurance fee (2% of loan amount)';
COMMENT ON COLUMN "Loan"."disbursementMode" IS 'Disbursement mode: NET (deduct fees) or GROSS (add fees to balance)';
COMMENT ON COLUMN "Loan"."guarantorName" IS 'Optional guarantor name (can be added during approval)';
COMMENT ON COLUMN "Loan"."guarantorPhone" IS 'Optional guarantor phone (can be added during approval)';
COMMENT ON COLUMN "Loan"."guarantorNationalId" IS 'Optional guarantor national ID (can be added during approval)';

-- --------------------------------------------------------------------------
-- STEP 9: Create a view for loan summaries (optional but useful)
-- --------------------------------------------------------------------------

CREATE OR REPLACE VIEW "loan_summary_view" AS
SELECT 
  l.id,
  l."loanNumber",
  l."memberId",
  m."memberNumber",
  m."firstName" || ' ' || m."lastName" AS "memberName",
  l.amount,
  l."interestRate",
  l."durationMonths",
  l.status,
  l.purpose,
  l."monthlyIncome",
  l."sourceOfIncome",
  l."processingFee",
  l."insuranceFee",
  l."disbursementMode",
  l.balance,
  l."monthlyPayment",
  l."applicationDate",
  l."approvalDate",
  l."disbursementDate",
  l."guarantorName",
  l."createdAt",
  l."updatedAt"
FROM "Loan" l
INNER JOIN "Member" m ON l."memberId" = m.id;

COMMENT ON VIEW "loan_summary_view" IS 'Comprehensive loan summary with member details for reporting and admin dashboard';

-- --------------------------------------------------------------------------
-- Success message
-- --------------------------------------------------------------------------
SELECT 'Phase 2 Loan table updates completed successfully!' AS message;
SELECT 'New fields added: monthlyIncome, sourceOfIncome, processingFee, insuranceFee, disbursementMode' AS details;
SELECT 'Guarantor fields are now optional (can be added during approval stage)' AS note;
