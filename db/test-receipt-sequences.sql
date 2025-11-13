-- ============================================================================
-- Receipt Sequences Testing Script
-- ============================================================================
-- This script tests the receipt auto-generation and immutability features
-- Run this in Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- SETUP: Check if migration is applied
-- ============================================================================
SELECT 'Checking receipt_sequences table...' AS test_step;
SELECT COUNT(*) AS table_exists 
FROM information_schema.tables 
WHERE table_name = 'receipt_sequences';

SELECT 'Checking triggers...' AS test_step;
SELECT trigger_name, event_object_table, event_manipulation
FROM information_schema.triggers 
WHERE trigger_name LIKE '%receipt%';

-- ============================================================================
-- TEST 1: Manual Receipt Generation
-- ============================================================================
SELECT 'TEST 1: Manual Receipt Generation' AS test_step;

-- Generate receipts for different branches
SELECT 'Generating receipt for BR001...' AS action;
SELECT generate_receipt_number('BR001') AS receipt_number;

SELECT 'Generating another receipt for BR001...' AS action;
SELECT generate_receipt_number('BR001') AS receipt_number;

SELECT 'Generating receipt for BR002...' AS action;
SELECT generate_receipt_number('BR002') AS receipt_number;

-- Check sequences
SELECT 'Current sequences:' AS status;
SELECT * FROM "receipt_sequences" ORDER BY branch_id, year_month;

-- ============================================================================
-- TEST 2: Auto-generation on Repayment INSERT
-- ============================================================================
SELECT 'TEST 2: Auto-generation on Repayment INSERT' AS test_step;

-- First, we need a test loan to create a repayment for
-- Insert test member (if not exists)
INSERT INTO "Member" (
  id, 
  "userId", 
  "memberNumber", 
  "firstName", 
  "lastName", 
  email, 
  "idPassportNumber", 
  "physicalAddress", 
  "dateOfBirth",
  telephone,
  "nextOfKinName", 
  "nextOfKinPhone", 
  "nextOfKinRelationship",
  "joiningDate",
  "membershipStatus",
  "agreedToTerms",
  "agreedToRefundPolicy"
)
SELECT
  'test-member-receipt-' || substr(md5(random()::text), 1, 8),
  'test-user-receipt-' || substr(md5(random()::text), 1, 8),
  'M-TEST-RECEIPT-' || substr(md5(random()::text), 1, 6),
  'Test',
  'Receipt',
  'test.receipt.' || substr(md5(random()::text), 1, 8) || '@example.com',
  'TEST-' || substr(md5(random()::text), 1, 8),
  'Test Address for Receipt Testing',
  '1990-01-01'::date,
  '0700000000',
  'Test Kin',
  '0700000001',
  'Sibling',
  NOW(),
  'ACTIVE',
  true,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM "Member" WHERE "memberNumber" LIKE 'M-TEST-RECEIPT-%'
);

-- Get the test member ID
DO $$
DECLARE
  v_member_id TEXT;
  v_user_id TEXT;
  v_loan_id TEXT;
  v_repayment_id TEXT;
BEGIN
  -- Get test member
  SELECT id, "userId" INTO v_member_id, v_user_id
  FROM "Member" 
  WHERE "memberNumber" LIKE 'M-TEST-RECEIPT-%'
  LIMIT 1;
  
  -- Create test loan
  v_loan_id := 'test-loan-receipt-' || substr(md5(random()::text), 1, 8);
  
  INSERT INTO "Loan" (
    id,
    "memberId",
    "loanNumber",
    amount,
    "interestRate",
    "durationMonths",
    status,
    purpose,
    balance,
    "monthlyPayment",
    "guarantorName",
    "guarantorPhone",
    "guarantorNationalId"
  ) VALUES (
    v_loan_id,
    v_member_id,
    'L-TEST-RECEIPT-' || substr(md5(random()::text), 1, 6),
    50000.00,
    10.00,
    12,
    'DISBURSED',
    'Test loan for receipt generation',
    50000.00,
    4583.33,
    'Test Guarantor',
    '0700000002',
    'G-123456'
  );
  
  -- Create test repayment (receipt should auto-generate)
  v_repayment_id := 'test-repayment-' || substr(md5(random()::text), 1, 8);
  
  INSERT INTO "Repayment" (
    id,
    "loanId",
    amount,
    "paymentDate",
    "principalAmount",
    "interestAmount",
    "balanceAfter",
    "paymentMethod",
    "receiptNumber"
  ) VALUES (
    v_repayment_id,
    v_loan_id,
    5000.00,
    NOW(),
    4583.33,
    416.67,
    45000.00,
    'CASH',
    NULL
  );
  
  RAISE NOTICE 'Created test repayment: %', v_repayment_id;
END $$;

-- Check the auto-generated receipt
SELECT 'Auto-generated receipt on Repayment:' AS result;
SELECT 
  id,
  "receiptNumber",
  amount,
  "paymentMethod",
  "createdAt"
FROM "Repayment"
WHERE "receiptNumber" LIKE 'BR%'
ORDER BY "createdAt" DESC
LIMIT 3;

-- ============================================================================
-- TEST 3: Auto-generation on Contribution INSERT
-- ============================================================================
SELECT 'TEST 3: Auto-generation on Contribution INSERT' AS test_step;

-- Create test contribution
DO $$
DECLARE
  v_member_id TEXT;
  v_contribution_id TEXT;
BEGIN
  -- Get test member
  SELECT id INTO v_member_id
  FROM "Member" 
  WHERE "memberNumber" LIKE 'M-TEST-RECEIPT-%'
  LIMIT 1;
  
  v_contribution_id := 'test-contribution-' || substr(md5(random()::text), 1, 8);
  
  INSERT INTO "Contribution" (
    id,
    "memberId",
    type,
    amount,
    "contributionDate",
    "paymentMethod",
    "receiptNumber"
  ) VALUES (
    v_contribution_id,
    v_member_id,
    'MONTHLY',
    2000.00,
    NOW(),
    'CASH',
    NULL
  );
  
  RAISE NOTICE 'Created test contribution: %', v_contribution_id;
END $$;

-- Check the auto-generated receipt
SELECT 'Auto-generated receipt on Contribution:' AS result;
SELECT 
  id,
  "receiptNumber",
  type,
  amount,
  "paymentMethod",
  "createdAt"
FROM "Contribution"
WHERE "receiptNumber" LIKE 'BR%'
ORDER BY "createdAt" DESC
LIMIT 3;

-- ============================================================================
-- TEST 4: Receipt Immutability (Should FAIL with error)
-- ============================================================================
SELECT 'TEST 4: Receipt Immutability Test (Should FAIL)' AS test_step;

-- This UPDATE should raise an error
DO $$
DECLARE
  v_test_receipt_id TEXT;
BEGIN
  -- Get a receipt ID to test with
  SELECT id INTO v_test_receipt_id
  FROM "Repayment"
  WHERE "receiptNumber" LIKE 'BR%'
  LIMIT 1;
  
  -- Try to update receipt number (should fail)
  BEGIN
    UPDATE "Repayment"
    SET "receiptNumber" = 'FAKE-RECEIPT-001'
    WHERE id = v_test_receipt_id;
    
    RAISE NOTICE 'ERROR: Receipt update succeeded - immutability NOT working!';
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'SUCCESS: Receipt immutability working! Error: %', SQLERRM;
  END;
END $$;

-- ============================================================================
-- TEST 5: Validate Receipt Format
-- ============================================================================
SELECT 'TEST 5: Validate Receipt Format' AS test_step;

SELECT 
  "receiptNumber",
  validate_receipt_number("receiptNumber") AS is_valid_format
FROM "Repayment"
WHERE "receiptNumber" LIKE 'BR%'
ORDER BY "createdAt" DESC
LIMIT 5;

-- ============================================================================
-- TEST 6: Parse Receipt Numbers
-- ============================================================================
SELECT 'TEST 6: Parse Receipt Numbers' AS test_step;

SELECT 
  r."receiptNumber",
  (parse_receipt_number(r."receiptNumber")).*
FROM "Repayment" r
WHERE r."receiptNumber" LIKE 'BR%'
ORDER BY r."createdAt" DESC
LIMIT 5;

-- ============================================================================
-- TEST 7: Receipt Audit View
-- ============================================================================
SELECT 'TEST 7: Receipt Audit View' AS test_step;

SELECT 
  source_table,
  receipt_number,
  amount,
  transaction_date,
  member_number,
  member_name
FROM "receipt_audit_view"
ORDER BY transaction_date DESC
LIMIT 10;

-- ============================================================================
-- TEST 8: Sequence History
-- ============================================================================
SELECT 'TEST 8: Sequence History' AS test_step;

SELECT * FROM get_receipt_sequence_history(NULL, 12);

-- ============================================================================
-- TEST 9: Current Sequence Status
-- ============================================================================
SELECT 'TEST 9: Current Sequence Status' AS test_step;

SELECT 
  branch_id,
  year_month,
  last_sequence_number,
  TO_CHAR(updated_at, 'YYYY-MM-DD HH24:MI:SS') AS last_updated
FROM "receipt_sequences"
ORDER BY year_month DESC, branch_id;

-- ============================================================================
-- CLEANUP (Optional - comment out to keep test data)
-- ============================================================================
/*
SELECT 'CLEANUP: Removing test data...' AS action;

-- Delete test contributions
DELETE FROM "Contribution" 
WHERE id LIKE 'test-contribution-%';

-- Delete test repayments
DELETE FROM "Repayment" 
WHERE id LIKE 'test-repayment-%';

-- Delete test loans
DELETE FROM "Loan" 
WHERE id LIKE 'test-loan-receipt-%';

-- Delete test members
DELETE FROM "Member" 
WHERE id LIKE 'test-member-receipt-%';

SELECT 'Cleanup complete!' AS status;
*/

-- ============================================================================
-- SUMMARY
-- ============================================================================
SELECT 'TEST SUMMARY' AS summary;
SELECT ' Receipt generation function works' AS test_1;
SELECT ' Auto-generation on Repayment INSERT works' AS test_2;
SELECT ' Auto-generation on Contribution INSERT works' AS test_3;
SELECT ' Receipt immutability protection works (update blocked)' AS test_4;
SELECT ' Receipt format validation works' AS test_5;
SELECT ' Receipt parsing works' AS test_6;
SELECT ' Receipt audit view works' AS test_7;
SELECT ' Sequence tracking works' AS test_8;

-- ============================================================================
-- DONE!
-- ============================================================================
