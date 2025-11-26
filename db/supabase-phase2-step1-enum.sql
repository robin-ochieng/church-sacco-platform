-- ============================================================================
-- STEP 1 of 2: Create LoanStatus Enum
-- Run this FIRST, then run supabase-phase2-step2-columns.sql
-- 
-- NOTE: If you get "type LoanStatus already exists" error, SKIP this file
--       and run supabase-phase2-step2-columns.sql directly!
-- ============================================================================

-- Create LoanStatus enum with all Phase 2 values (IF NOT EXISTS)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LoanStatus') THEN
    CREATE TYPE "LoanStatus" AS ENUM (
      'DRAFT',
      'SUBMITTED',
      'UNDER_REVIEW',
      'APPROVED',
      'DISBURSED',
      'ACTIVE',
      'CLOSED',
      'REJECTED',
      'DEFAULTED'
    );
    RAISE NOTICE 'LoanStatus enum created successfully!';
  ELSE
    RAISE NOTICE 'LoanStatus enum already exists - skipping creation.';
  END IF;
END
$$;

SELECT 'Step 1 complete! Now run supabase-phase2-step2-columns.sql' AS next_step;
