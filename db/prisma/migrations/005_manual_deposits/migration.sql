-- ============================================================================
-- Migration: 005_manual_deposits
-- Description: Introduce Transaction ledger for cashier deposits with
--              branch-aware receipt generation and audit view updates.
-- Date: 2025-11-16
-- ============================================================================

-- --------------------------------------------------------------------------
-- STEP 1: Create supporting enum types
-- --------------------------------------------------------------------------
DO $$
BEGIN
  CREATE TYPE "TransactionType" AS ENUM (
    'SAVINGS_DEPOSIT',
    'SHARES_DEPOSIT',
    'SPECIAL_CONTRIBUTION',
    'MAINTENANCE_FEE',
    'MONTHLY_CHARGE',
    'WITHDRAWAL',
    'ADJUSTMENT',
    'LOAN_DISBURSEMENT',
    'LOAN_REPAYMENT'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'POSTED', 'REVERSED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE "TransactionChannel" AS ENUM ('CASH', 'BANK_TRANSFER', 'MOBILE_MONEY', 'CHEQUE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- --------------------------------------------------------------------------
-- STEP 2: Create Transaction table
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Transaction" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "memberId" TEXT NOT NULL,
  "cashierId" TEXT,
  "branchId" TEXT,
  amount NUMERIC(12, 2) NOT NULL,
  type "TransactionType" NOT NULL,
  channel "TransactionChannel" NOT NULL,
  status "TransactionStatus" NOT NULL DEFAULT 'POSTED',
  reference TEXT,
  narration TEXT,
  "receiptNumber" TEXT UNIQUE,
  "valueDate" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "balanceAfter" NUMERIC(14, 2) NOT NULL DEFAULT 0,
  metadata JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT transaction_member_fk FOREIGN KEY ("memberId") REFERENCES "Member" (id) ON DELETE CASCADE,
  CONSTRAINT transaction_cashier_fk FOREIGN KEY ("cashierId") REFERENCES "User" (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_transaction_member ON "Transaction"("memberId");
CREATE INDEX IF NOT EXISTS idx_transaction_branch_date ON "Transaction"("branchId", "valueDate");

-- --------------------------------------------------------------------------
-- STEP 3: Receipt generation + immutability triggers
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION transaction_generate_receipt_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_branch_id TEXT;
BEGIN
  -- ensure branchId is hydrated from member when missing
  IF NEW."branchId" IS NULL THEN
    SELECT m."branchId" INTO v_branch_id FROM "Member" m WHERE m.id = NEW."memberId" LIMIT 1;
    NEW."branchId" := v_branch_id;
  ELSE
    v_branch_id := NEW."branchId";
  END IF;

  IF NEW."receiptNumber" IS NULL OR NEW."receiptNumber" = '' THEN
    NEW."receiptNumber" := generate_receipt_number(v_branch_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS transaction_receipt_trigger ON "Transaction";
CREATE TRIGGER transaction_receipt_trigger
  BEFORE INSERT ON "Transaction"
  FOR EACH ROW
  EXECUTE FUNCTION transaction_generate_receipt_trigger();

DROP TRIGGER IF EXISTS transaction_receipt_immutable ON "Transaction";
CREATE TRIGGER transaction_receipt_immutable
  BEFORE UPDATE OF "receiptNumber" ON "Transaction"
  FOR EACH ROW
  EXECUTE FUNCTION prevent_receipt_update_trigger();

-- --------------------------------------------------------------------------
-- STEP 4: Update receipt audit view to include cashier transactions
-- --------------------------------------------------------------------------
DROP VIEW IF EXISTS "receipt_audit_view";
CREATE OR REPLACE VIEW "receipt_audit_view" AS
SELECT 
  'CashierTransaction' AS source_table,
  t.id AS record_id,
  t."receiptNumber" AS receipt_number,
  t.amount,
  t."valueDate" AS transaction_date,
  t.channel::TEXT AS payment_method,
  t."memberId" AS member_id,
  m."memberNumber" AS member_number,
  CONCAT(m."firstName", ' ', m."lastName") AS member_name,
  t."createdAt" AS created_at
FROM "Transaction" t
JOIN "Member" m ON m.id = t."memberId"

UNION ALL

SELECT 
  'Repayment' AS source_table,
  r.id AS record_id,
  r."receiptNumber" AS receipt_number,
  r.amount,
  r."paymentDate" AS transaction_date,
  r."paymentMethod" AS payment_method,
  l."memberId" AS member_id,
  m."memberNumber" AS member_number,
  CONCAT(m."firstName", ' ', m."lastName") AS member_name,
  r."createdAt" AS created_at
FROM "Repayment" r
JOIN "Loan" l ON l.id = r."loanId"
JOIN "Member" m ON m.id = l."memberId"

UNION ALL

SELECT 
  'Contribution' AS source_table,
  c.id AS record_id,
  c."receiptNumber" AS receipt_number,
  c.amount,
  c."contributionDate" AS transaction_date,
  c."paymentMethod" AS payment_method,
  c."memberId" AS member_id,
  m."memberNumber" AS member_number,
  CONCAT(m."firstName", ' ', m."lastName") AS member_name,
  c."createdAt" AS created_at
FROM "Contribution" c
JOIN "Member" m ON m.id = c."memberId"

ORDER BY transaction_date DESC, created_at DESC;

-- --------------------------------------------------------------------------
-- STEP 5: RLS alignment (Transaction table uses same policies via JWT settings)
-- Note: Policies will be applied manually after migration if needed.
-- --------------------------------------------------------------------------

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
