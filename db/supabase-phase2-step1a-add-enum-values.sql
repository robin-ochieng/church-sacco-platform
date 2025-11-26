-- ============================================================================
-- STEP 1A: Add missing enum values to existing LoanStatus
-- Run this FIRST if LoanStatus enum already exists but is missing values
-- ============================================================================

-- Add all Phase 2 enum values (IF NOT EXISTS prevents errors if they exist)
ALTER TYPE "LoanStatus" ADD VALUE IF NOT EXISTS 'DRAFT';
ALTER TYPE "LoanStatus" ADD VALUE IF NOT EXISTS 'SUBMITTED';
ALTER TYPE "LoanStatus" ADD VALUE IF NOT EXISTS 'UNDER_REVIEW';
ALTER TYPE "LoanStatus" ADD VALUE IF NOT EXISTS 'APPROVED';
ALTER TYPE "LoanStatus" ADD VALUE IF NOT EXISTS 'DISBURSED';
ALTER TYPE "LoanStatus" ADD VALUE IF NOT EXISTS 'ACTIVE';
ALTER TYPE "LoanStatus" ADD VALUE IF NOT EXISTS 'CLOSED';
ALTER TYPE "LoanStatus" ADD VALUE IF NOT EXISTS 'REJECTED';
ALTER TYPE "LoanStatus" ADD VALUE IF NOT EXISTS 'DEFAULTED';

SELECT 'LoanStatus enum values added! Now run supabase-phase2-step2-columns.sql' AS next_step;
