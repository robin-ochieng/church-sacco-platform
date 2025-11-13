-- ============================================================================
-- Receipt Sequences Migration - Immutable Receipt Numbers
-- ============================================================================
-- This migration creates:
-- 1. receipt_sequences table to track sequences per branch+date
-- 2. Helper function to generate receipt numbers: BR{branch}-YYYYMM-{NNNNN}
-- 3. BEFORE INSERT triggers on Repayment & Contribution to auto-generate receipts
-- 4. Immutability constraint - disallow updates to receipt_no fields
-- ============================================================================

-- ============================================================================
-- STEP 1: Create receipt_sequences tracking table
-- ============================================================================
CREATE TABLE IF NOT EXISTS "receipt_sequences" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id TEXT NOT NULL,           -- Branch identifier (e.g., 'BR001', 'BR002')
  year_month TEXT NOT NULL,          -- Format: YYYYMM (e.g., '202501')
  last_sequence_number INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure one sequence per branch per month
  UNIQUE(branch_id, year_month)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_receipt_sequences_branch_month 
  ON "receipt_sequences"(branch_id, year_month);

-- ============================================================================
-- STEP 2: Create function to generate receipt numbers
-- ============================================================================
-- Format: BR{branch}-YYYYMM-{NNNNN}
-- Example: BR001-202501-00001, BR002-202501-00123
CREATE OR REPLACE FUNCTION generate_receipt_number(
  p_branch_id TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_branch_id TEXT;
  v_year_month TEXT;
  v_sequence_number INT;
  v_receipt_number TEXT;
  v_jwt_claims JSONB;
BEGIN
  -- Get branch ID from parameter, JWT, or custom setting
  v_branch_id := p_branch_id;
  
  IF v_branch_id IS NULL OR v_branch_id = '' THEN
    -- Try to get from JWT claims
    BEGIN
      v_jwt_claims := current_setting('request.jwt.claims', true)::JSONB;
      v_branch_id := v_jwt_claims->>'branch_id';
    EXCEPTION WHEN OTHERS THEN
      v_branch_id := NULL;
    END;
  END IF;
  
  IF v_branch_id IS NULL OR v_branch_id = '' THEN
    -- Try to get from custom setting
    BEGIN
      v_branch_id := current_setting('app.current_branch_id', true);
    EXCEPTION WHEN OTHERS THEN
      v_branch_id := NULL;
    END;
  END IF;
  
  -- Default to BR001 if no branch context available
  IF v_branch_id IS NULL OR v_branch_id = '' THEN
    v_branch_id := 'BR001';
  END IF;
  
  -- Get current year-month (format: YYYYMM)
  v_year_month := TO_CHAR(NOW(), 'YYYYMM');
  
  -- Get next sequence number (using row-level locking for concurrency safety)
  INSERT INTO "receipt_sequences" (branch_id, year_month, last_sequence_number)
  VALUES (v_branch_id, v_year_month, 1)
  ON CONFLICT (branch_id, year_month) 
  DO UPDATE SET 
    last_sequence_number = "receipt_sequences".last_sequence_number + 1,
    updated_at = NOW()
  RETURNING last_sequence_number INTO v_sequence_number;
  
  -- Format receipt number: BR{branch}-YYYYMM-{NNNNN}
  v_receipt_number := v_branch_id || '-' || v_year_month || '-' || LPAD(v_sequence_number::TEXT, 5, '0');
  
  RETURN v_receipt_number;
END;
$$;

-- ============================================================================
-- STEP 3: Add receipt_no column to existing tables (if not exists)
-- ============================================================================
-- Note: Repayment and Contribution already have receiptNumber
-- We'll add triggers to auto-populate them if NULL

-- ============================================================================
-- STEP 4: Create BEFORE INSERT triggers for auto-generation
-- ============================================================================

-- Trigger function for Repayment table
CREATE OR REPLACE FUNCTION repayment_generate_receipt_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_branch_id TEXT;
BEGIN
  -- Only generate if receipt number is NULL or empty
  IF NEW."receiptNumber" IS NULL OR NEW."receiptNumber" = '' THEN
    -- Try to get branch from related loan/member
    SELECT m."branchId" INTO v_branch_id
    FROM "Loan" l
    JOIN "Member" m ON m.id = l."memberId"
    WHERE l.id = NEW."loanId"
    LIMIT 1;
    
    -- Generate receipt number
    NEW."receiptNumber" := generate_receipt_number(v_branch_id);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger function for Contribution table
CREATE OR REPLACE FUNCTION contribution_generate_receipt_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_branch_id TEXT;
BEGIN
  -- Only generate if receipt number is NULL or empty
  IF NEW."receiptNumber" IS NULL OR NEW."receiptNumber" = '' THEN
    -- Try to get branch from member
    SELECT m."branchId" INTO v_branch_id
    FROM "Member" m
    WHERE m.id = NEW."memberId"
    LIMIT 1;
    
    -- Generate receipt number
    NEW."receiptNumber" := generate_receipt_number(v_branch_id);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS repayment_receipt_trigger ON "Repayment";
DROP TRIGGER IF EXISTS contribution_receipt_trigger ON "Contribution";

-- Create triggers
CREATE TRIGGER repayment_receipt_trigger
  BEFORE INSERT ON "Repayment"
  FOR EACH ROW
  EXECUTE FUNCTION repayment_generate_receipt_trigger();

CREATE TRIGGER contribution_receipt_trigger
  BEFORE INSERT ON "Contribution"
  FOR EACH ROW
  EXECUTE FUNCTION contribution_generate_receipt_trigger();

-- ============================================================================
-- STEP 5: Create triggers to prevent receipt number updates (immutability)
-- ============================================================================

-- Generic function to prevent receipt number updates
CREATE OR REPLACE FUNCTION prevent_receipt_update_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Prevent updates to receiptNumber field
  IF OLD."receiptNumber" IS DISTINCT FROM NEW."receiptNumber" THEN
    RAISE EXCEPTION 'Receipt numbers are immutable and cannot be updated. Old: %, New: %', 
      OLD."receiptNumber", NEW."receiptNumber";
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop existing immutability triggers if they exist
DROP TRIGGER IF EXISTS repayment_receipt_immutable ON "Repayment";
DROP TRIGGER IF EXISTS contribution_receipt_immutable ON "Contribution";

-- Create immutability triggers
CREATE TRIGGER repayment_receipt_immutable
  BEFORE UPDATE ON "Repayment"
  FOR EACH ROW
  EXECUTE FUNCTION prevent_receipt_update_trigger();

CREATE TRIGGER contribution_receipt_immutable
  BEFORE UPDATE ON "Contribution"
  FOR EACH ROW
  EXECUTE FUNCTION prevent_receipt_update_trigger();

-- ============================================================================
-- STEP 6: Create helper functions for receipt management
-- ============================================================================

-- Function to get current sequence number for a branch+month
CREATE OR REPLACE FUNCTION get_current_receipt_sequence(
  p_branch_id TEXT,
  p_year_month TEXT DEFAULT NULL
)
RETURNS INT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_year_month TEXT;
  v_sequence INT;
BEGIN
  v_year_month := COALESCE(p_year_month, TO_CHAR(NOW(), 'YYYYMM'));
  
  SELECT last_sequence_number INTO v_sequence
  FROM "receipt_sequences"
  WHERE branch_id = p_branch_id
    AND year_month = v_year_month;
  
  RETURN COALESCE(v_sequence, 0);
END;
$$;

-- Function to get receipt sequence history
CREATE OR REPLACE FUNCTION get_receipt_sequence_history(
  p_branch_id TEXT DEFAULT NULL,
  p_limit INT DEFAULT 12
)
RETURNS TABLE (
  branch_id TEXT,
  year_month TEXT,
  last_sequence_number INT,
  total_receipts INT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    rs.branch_id,
    rs.year_month,
    rs.last_sequence_number,
    rs.last_sequence_number AS total_receipts,
    rs.created_at,
    rs.updated_at
  FROM "receipt_sequences" rs
  WHERE p_branch_id IS NULL OR rs.branch_id = p_branch_id
  ORDER BY rs.year_month DESC, rs.branch_id
  LIMIT p_limit;
END;
$$;

-- Function to validate receipt number format
CREATE OR REPLACE FUNCTION validate_receipt_number(
  p_receipt_number TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  -- Check format: BR{branch}-YYYYMM-{NNNNN}
  -- Example: BR001-202501-00001
  RETURN p_receipt_number ~ '^BR[A-Z0-9]+-[0-9]{6}-[0-9]{5}$';
END;
$$;

-- Function to parse receipt number components
CREATE OR REPLACE FUNCTION parse_receipt_number(
  p_receipt_number TEXT
)
RETURNS TABLE (
  branch_id TEXT,
  year_month TEXT,
  sequence_number INT,
  is_valid BOOLEAN
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_parts TEXT[];
BEGIN
  -- Validate format first
  is_valid := validate_receipt_number(p_receipt_number);
  
  IF NOT is_valid THEN
    branch_id := NULL;
    year_month := NULL;
    sequence_number := NULL;
    RETURN NEXT;
    RETURN;
  END IF;
  
  -- Split by '-'
  v_parts := string_to_array(p_receipt_number, '-');
  
  branch_id := v_parts[1];
  year_month := v_parts[2];
  sequence_number := v_parts[3]::INT;
  
  RETURN NEXT;
END;
$$;

-- ============================================================================
-- STEP 7: Create view for receipt audit trail
-- ============================================================================
CREATE OR REPLACE VIEW "receipt_audit_view" AS
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

-- ============================================================================
-- STEP 8: Grant permissions
-- ============================================================================
GRANT SELECT ON "receipt_sequences" TO authenticated;
GRANT SELECT ON "receipt_audit_view" TO authenticated;

GRANT EXECUTE ON FUNCTION generate_receipt_number(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_current_receipt_sequence(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_receipt_sequence_history(TEXT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_receipt_number(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION parse_receipt_number(TEXT) TO authenticated;

-- ============================================================================
-- STEP 9: Enable RLS on receipt_sequences
-- ============================================================================
ALTER TABLE "receipt_sequences" ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated users can view receipt sequences
CREATE POLICY receipt_sequences_view_all ON "receipt_sequences"
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Policy: Only system can insert/update (via triggers)
CREATE POLICY receipt_sequences_system_only ON "receipt_sequences"
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these after migration to verify setup:

-- 1. Check receipt_sequences table
-- SELECT * FROM "receipt_sequences";

-- 2. Test receipt generation
-- SELECT generate_receipt_number('BR001');
-- SELECT generate_receipt_number('BR002');

-- 3. Test immutability - this should fail
-- INSERT INTO "Repayment" (id, "loanId", amount, "paymentDate", "principalAmount", "interestAmount", "balanceAfter", "receiptNumber") 
-- VALUES (gen_random_uuid(), 'some-loan-id', 1000, NOW(), 900, 100, 5000, 'TEST-001');
-- UPDATE "Repayment" SET "receiptNumber" = 'NEW-001' WHERE id = 'test-id'; -- Should raise error

-- 4. View receipt audit trail
-- SELECT * FROM "receipt_audit_view" LIMIT 10;

-- 5. Check sequence history
-- SELECT * FROM get_receipt_sequence_history();

-- 6. Validate receipt format
-- SELECT validate_receipt_number('BR001-202501-00001'); -- true
-- SELECT validate_receipt_number('INVALID'); -- false

-- 7. Parse receipt number
-- SELECT * FROM parse_receipt_number('BR001-202501-00001');

-- ============================================================================
-- DONE!
-- ============================================================================
-- Receipt number system is now active:
-- ✅ Auto-generates unique receipt numbers on INSERT
-- ✅ Format: BR{branch}-YYYYMM-{NNNNN}
-- ✅ Sequences tracked per branch per month
-- ✅ Receipt numbers are immutable (cannot be updated)
-- ✅ Concurrency-safe with row-level locking
-- ✅ Applied to: Repayment, Contribution tables
-- 
-- Usage:
-- - INSERT records normally - receipt numbers auto-generated
-- - Manual generation: SELECT generate_receipt_number('BR001');
-- - Check sequences: SELECT * FROM get_receipt_sequence_history();
-- - Audit trail: SELECT * FROM receipt_audit_view;
-- ============================================================================
