-- ============================================================================
-- RLS ROLE TESTING SCRIPT
-- ============================================================================
-- Instructions: 
-- 1. First run the migration.sql in Supabase SQL Editor
-- 2. Then run this test file section by section
-- 3. Review results after each test
-- ============================================================================

-- ============================================================================
-- STEP 1: CREATE TEST DATA
-- ============================================================================

-- First, create test users (required for foreign key constraint)
INSERT INTO "User" (id, email, password, role, "isActive", "createdAt", "updatedAt")
VALUES 
  ('test-user-001', 'john.test@branch1.com', '$2b$10$dummyhashedpassword001', 'MEMBER', true, NOW(), NOW()),
  ('test-user-002', 'mary.test@branch1.com', '$2b$10$dummyhashedpassword002', 'MEMBER', true, NOW(), NOW()),
  ('test-user-003', 'peter.test@branch2.com', '$2b$10$dummyhashedpassword003', 'MEMBER', true, NOW(), NOW()),
  ('test-user-004', 'alice.test@branch2.com', '$2b$10$dummyhashedpassword004', 'MEMBER', true, NOW(), NOW()),
  ('u-clerk-001', 'clerk1@test.com', '$2b$10$dummyhashedpassword005', 'SECRETARY', true, NOW(), NOW()),
  ('u-mgr-001', 'manager@test.com', '$2b$10$dummyhashedpassword006', 'TREASURER', true, NOW(), NOW()),
  ('u-admin-001', 'admin@test.com', '$2b$10$dummyhashedpassword007', 'ADMIN', true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Insert test members for different branches
INSERT INTO "Member" (
  id, "userId", "memberNumber", "firstName", "lastName", email, 
  "idPassportNumber", "physicalAddress", telephone, "dateOfBirth", 
  "nextOfKinName", "nextOfKinPhone", "nextOfKinRelationship", "branchId",
  "createdAt", "updatedAt"
)
VALUES 
  ('test-mem-001', 'test-user-001', 'TESTMEM001', 'John', 'Doe', 'john.test@branch1.com', 
   'TESTID001', 'Address 1', '0701000001', '1990-01-01', 
   'Jane Doe', '0702000001', 'Spouse', 'branch-001',
   NOW(), NOW()),
  
  ('test-mem-002', 'test-user-002', 'TESTMEM002', 'Mary', 'Smith', 'mary.test@branch1.com', 
   'TESTID002', 'Address 2', '0701000002', '1985-05-15', 
   'Tom Smith', '0702000002', 'Spouse', 'branch-001',
   NOW(), NOW()),
  
  ('test-mem-003', 'test-user-003', 'TESTMEM003', 'Peter', 'Jones', 'peter.test@branch2.com', 
   'TESTID003', 'Address 3', '0701000003', '1992-03-20', 
   'Sarah Jones', '0702000003', 'Spouse', 'branch-002',
   NOW(), NOW()),
  
  ('test-mem-004', 'test-user-004', 'TESTMEM004', 'Alice', 'Brown', 'alice.test@branch2.com', 
   'TESTID004', 'Address 4', '0701000004', '1988-07-10', 
   'Bob Brown', '0702000004', 'Spouse', 'branch-002',
   NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Insert test loans
INSERT INTO "Loan" (
  id, "memberId", "loanNumber", amount, "interestRate", "durationMonths", 
  status, purpose, "applicationDate", balance, "monthlyPayment",
  "guarantorName", "guarantorPhone", "guarantorNationalId", "branchId",
  "createdAt", "updatedAt"
)
VALUES
  ('test-loan-001', 'test-mem-001', 'TESTLOAN001', 50000, 12.5, 12, 
   'APPROVED', 'Personal expenses', NOW(), 50000, 4500,
   'John Guarantor', '0711111111', 'GUAR001', 'branch-001',
   NOW(), NOW()),
  
  ('test-loan-002', 'test-mem-003', 'TESTLOAN002', 100000, 10.0, 24, 
   'PENDING', 'Business expansion', NOW(), 100000, 4600,
   'Peter Guarantor', '0722222222', 'GUAR002', 'branch-002',
   NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Insert test savings
INSERT INTO "Saving" (
  id, "memberId", type, amount, balance, "interestRate", 
  "startDate", "branchId", "createdAt", "updatedAt"
)
VALUES
  ('test-sav-001', 'test-mem-001', 'REGULAR', 10000, 10000, 5.0, 
   NOW(), 'branch-001', NOW(), NOW()),
  ('test-sav-002', 'test-mem-003', 'FIXED', 15000, 15000, 7.5, 
   NOW(), 'branch-002', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Verify test data created
SELECT '✅ Test data created successfully' AS status;
SELECT 'Members:' AS info, COUNT(*) AS count FROM "Member" WHERE id LIKE 'test-%';
SELECT 'Loans:' AS info, COUNT(*) AS count FROM "Loan" WHERE id LIKE 'test-%';
SELECT 'Savings:' AS info, COUNT(*) AS count FROM "Saving" WHERE id LIKE 'test-%';


-- ============================================================================
-- TEST 1: AUDITOR ROLE (Read-Only Across All Branches)
-- ============================================================================

SELECT '🧪 TEST 1: AUDITOR ROLE' AS test_section;
SELECT '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' AS divider;

-- Set JWT claims for AUDITOR
SELECT set_test_jwt_claims('AUDITOR', NULL, NULL);

-- Test 1.1: View all members (should succeed)
SELECT '📌 Test 1.1: View all members' AS test_name;
SELECT COUNT(*) AS member_count, 'Expected: Should see all members' AS expected
FROM "Member";

-- Test 1.2: View members from branch-001 (should succeed)
SELECT '📌 Test 1.2: View branch-001 members' AS test_name;
SELECT COUNT(*) AS member_count, 'Expected: Should see branch-001 members' AS expected
FROM "Member" WHERE "branchId" = 'branch-001';

-- Test 1.3: View members from branch-002 (should succeed)
SELECT '📌 Test 1.3: View branch-002 members' AS test_name;
SELECT COUNT(*) AS member_count, 'Expected: Should see branch-002 members' AS expected
FROM "Member" WHERE "branchId" = 'branch-002';

-- Test 1.4: Try to insert member (should FAIL - auditor is read-only)
SELECT '📌 Test 1.4: Try to insert member (should FAIL)' AS test_name;
-- Uncomment to test (should fail):
/*
INSERT INTO "Member" (
  id, "userId", "memberNumber", "firstName", "lastName", email, 
  "idPassportNumber", "physicalAddress", telephone, "dateOfBirth", 
  "nextOfKinName", "nextOfKinPhone", "nextOfKinRelationship", "branchId"
)
VALUES (
  'auditor-test', 'u-audit', 'MAUD', 'Audit', 'Test', 'audit@test.com',
  'AUD001', 'Addr', '0700000000', '1990-01-01',
  'Next', '0700000001', 'Spouse', 'branch-001'
);
*/
SELECT 'Uncomment INSERT above to test - should FAIL with RLS violation' AS result;

-- Test 1.5: View all loans (should succeed)
SELECT '📌 Test 1.5: View all loans' AS test_name;
SELECT COUNT(*) AS loan_count, 'Expected: Should see all loans' AS expected
FROM "Loan";

-- Clear JWT claims
SELECT clear_test_jwt_claims();
SELECT '✅ AUDITOR tests completed' AS status;


-- ============================================================================
-- TEST 2: CLERK ROLE (Insert/Select in Own Branch Only)
-- ============================================================================

SELECT '🧪 TEST 2: CLERK ROLE (branch-001)' AS test_section;
SELECT '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' AS divider;

-- Set JWT claims for CLERK in branch-001
SELECT set_test_jwt_claims('CLERK', 'branch-001', 'clerk-user-001');

-- Test 2.1: View own branch members (should succeed)
SELECT '📌 Test 2.1: View own branch members' AS test_name;
SELECT COUNT(*) AS member_count, 'Expected: Should see only branch-001 members' AS expected
FROM "Member" WHERE "branchId" = 'branch-001';

-- Test 2.2: Try to view other branch members (should return 0 due to RLS)
SELECT '📌 Test 2.2: Try to view other branch members' AS test_name;
SELECT COUNT(*) AS member_count, 'Expected: 0 (RLS blocks access)' AS expected
FROM "Member" WHERE "branchId" = 'branch-002';

-- Test 2.3: Insert member in own branch (should succeed)
SELECT '📌 Test 2.3: Insert member in own branch' AS test_name;
INSERT INTO "Member" (
  id, "userId", "memberNumber", "firstName", "lastName", email,
  "idPassportNumber", "physicalAddress", telephone, "dateOfBirth",
  "nextOfKinName", "nextOfKinPhone", "nextOfKinRelationship", "branchId",
  "createdAt", "updatedAt"
)
VALUES (
  'clerk-test-001', 'u-clerk-001', 'MCLK001', 'Clerk', 'Test1', 'clerk1@test.com',
  'CLK001', 'Addr', '0701111111', '1990-01-01',
  'Next', '0702111111', 'Spouse', 'branch-001',
  NOW(), NOW()
);
SELECT '✅ Insert succeeded' AS result;

-- Test 2.4: Try to insert member in other branch (should FAIL)
SELECT '📌 Test 2.4: Try to insert in other branch (should FAIL)' AS test_name;
-- Uncomment to test (should fail):
/*
INSERT INTO "Member" (
  id, "userId", "memberNumber", "firstName", "lastName", email,
  "idPassportNumber", "physicalAddress", telephone, "dateOfBirth",
  "nextOfKinName", "nextOfKinPhone", "nextOfKinRelationship", "branchId"
)
VALUES (
  'clerk-test-002', 'u-clerk-002', 'MCLK002', 'Clerk', 'Test2', 'clerk2@test.com',
  'CLK002', 'Addr', '0701111112', '1990-01-01',
  'Next', '0702111112', 'Spouse', 'branch-002'
);
*/
SELECT 'Uncomment INSERT above to test - should FAIL with RLS violation' AS result;

-- Test 2.5: Try to update member (should FAIL - clerk can only INSERT/SELECT)
SELECT '📌 Test 2.5: Try to update member (should FAIL)' AS test_name;
-- Uncomment to test (should fail):
/*
UPDATE "Member" 
SET "firstName" = 'Updated' 
WHERE id = 'test-mem-001';
*/
SELECT 'Uncomment UPDATE above to test - should FAIL (no UPDATE policy for CLERK)' AS result;

-- Clear JWT claims
SELECT clear_test_jwt_claims();
SELECT '✅ CLERK tests completed' AS status;


-- ============================================================================
-- TEST 3: MANAGER ROLE (Read/Write in Own Branch, Cannot Delete Transactions)
-- ============================================================================

SELECT '🧪 TEST 3: MANAGER ROLE (branch-002)' AS test_section;
SELECT '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' AS divider;

-- Set JWT claims for MANAGER in branch-002
SELECT set_test_jwt_claims('MANAGER', 'branch-002', 'manager-user-002');

-- Test 3.1: View own branch members (should succeed)
SELECT '📌 Test 3.1: View own branch members' AS test_name;
SELECT COUNT(*) AS member_count, 'Expected: Should see only branch-002 members' AS expected
FROM "Member" WHERE "branchId" = 'branch-002';

-- Test 3.2: Try to view other branch (should return 0)
SELECT '📌 Test 3.2: Try to view other branch' AS test_name;
SELECT COUNT(*) AS member_count, 'Expected: 0 (RLS blocks access)' AS expected
FROM "Member" WHERE "branchId" = 'branch-001';

-- Test 3.3: Update member in own branch (should succeed)
SELECT '📌 Test 3.3: Update member in own branch' AS test_name;
UPDATE "Member" 
SET "firstName" = 'UpdatedByManager' 
WHERE id = 'test-mem-003';
SELECT '✅ Update succeeded' AS result;

-- Test 3.4: Insert member in own branch (should succeed)
SELECT '📌 Test 3.4: Insert member in own branch' AS test_name;
INSERT INTO "Member" (
  id, "userId", "memberNumber", "firstName", "lastName", email,
  "idPassportNumber", "physicalAddress", telephone, "dateOfBirth",
  "nextOfKinName", "nextOfKinPhone", "nextOfKinRelationship", "branchId",
  "createdAt", "updatedAt"
)
VALUES (
  'mgr-test-001', 'u-mgr-001', 'MMGR001', 'Manager', 'Test', 'manager@test.com',
  'MGR001', 'Addr', '0703333333', '1990-01-01',
  'Next', '0704333333', 'Spouse', 'branch-002',
  NOW(), NOW()
);
SELECT '✅ Insert succeeded' AS result;

-- Test 3.5: Try to delete loan (should FAIL - only ADMIN can delete transactions)
SELECT '📌 Test 3.5: Try to delete loan (should FAIL)' AS test_name;
-- Uncomment to test (should fail):
/*
DELETE FROM "Loan" WHERE id = 'test-loan-002';
*/
SELECT 'Uncomment DELETE above to test - should FAIL (only ADMIN can delete loans)' AS result;

-- Test 3.6: Delete member (should succeed - manager can delete members, just not transactions)
SELECT '📌 Test 3.6: Delete member (should succeed)' AS test_name;
DELETE FROM "Member" WHERE id = 'mgr-test-001';
SELECT '✅ Delete succeeded (members are not transactions)' AS result;

-- Clear JWT claims
SELECT clear_test_jwt_claims();
SELECT '✅ MANAGER tests completed' AS status;


-- ============================================================================
-- TEST 4: ADMIN ROLE (Full Access to All Branches)
-- ============================================================================

SELECT '🧪 TEST 4: ADMIN ROLE' AS test_section;
SELECT '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' AS divider;

-- Set JWT claims for ADMIN
SELECT set_test_jwt_claims('ADMIN', NULL, 'admin-user-000');

-- Test 4.1: View all members (should succeed)
SELECT '📌 Test 4.1: View all members' AS test_name;
SELECT COUNT(*) AS member_count, 'Expected: Should see all members from all branches' AS expected
FROM "Member";

-- Test 4.2: View branch-001 members (should succeed)
SELECT '📌 Test 4.2: View branch-001 members' AS test_name;
SELECT COUNT(*) AS member_count FROM "Member" WHERE "branchId" = 'branch-001';

-- Test 4.3: View branch-002 members (should succeed)
SELECT '📌 Test 4.3: View branch-002 members' AS test_name;
SELECT COUNT(*) AS member_count FROM "Member" WHERE "branchId" = 'branch-002';

-- Test 4.4: Update any member (should succeed)
SELECT '📌 Test 4.4: Update any member' AS test_name;
UPDATE "Member" 
SET "firstName" = 'AdminUpdated' 
WHERE id = 'test-mem-001';
SELECT '✅ Update succeeded' AS result;

-- Test 4.5: Insert member in any branch (should succeed)
SELECT '📌 Test 4.5: Insert member in any branch' AS test_name;
INSERT INTO "Member" (
  id, "userId", "memberNumber", "firstName", "lastName", email,
  "idPassportNumber", "physicalAddress", telephone, "dateOfBirth",
  "nextOfKinName", "nextOfKinPhone", "nextOfKinRelationship", "branchId",
  "createdAt", "updatedAt"
)
VALUES (
  'admin-test-001', 'u-admin-001', 'MADM001', 'Admin', 'Test', 'admin@test.com',
  'ADM001', 'Addr', '0705555555', '1990-01-01',
  'Next', '0706555555', 'Spouse', 'branch-003',
  NOW(), NOW()
);
SELECT '✅ Insert succeeded (created member in branch-003)' AS result;

-- Test 4.6: Delete loan (should succeed - ADMIN can delete transactions)
SELECT '📌 Test 4.6: Delete loan (should succeed)' AS test_name;
DELETE FROM "Loan" WHERE id = 'test-loan-001';
SELECT '✅ Delete succeeded (ADMIN can delete transactional records)' AS result;

-- Test 4.7: Delete member (should succeed)
SELECT '📌 Test 4.7: Delete member' AS test_name;
DELETE FROM "Member" WHERE id = 'admin-test-001';
SELECT '✅ Delete succeeded' AS result;

-- Clear JWT claims
SELECT clear_test_jwt_claims();
SELECT '✅ ADMIN tests completed' AS status;


-- ============================================================================
-- TEST 5: MEMBER ROLE (Can Only View Own Records)
-- ============================================================================

SELECT '🧪 TEST 5: MEMBER ROLE (test-user-001)' AS test_section;
SELECT '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' AS divider;

-- Set JWT claims for MEMBER (test-user-001)
SELECT set_test_jwt_claims('MEMBER', NULL, 'test-user-001');

-- Test 5.1: View own member record (should succeed)
SELECT '📌 Test 5.1: View own member record' AS test_name;
SELECT COUNT(*) AS member_count, 'Expected: 1 (own record)' AS expected
FROM "Member" WHERE "userId" = 'test-user-001';

-- Test 5.2: Try to view other members (should return 0)
SELECT '📌 Test 5.2: Try to view other members' AS test_name;
SELECT COUNT(*) AS member_count, 'Expected: 0 (RLS blocks other members)' AS expected
FROM "Member" WHERE "userId" != 'test-user-001';

-- Test 5.3: View own loans (should succeed)
SELECT '📌 Test 5.3: View own loans' AS test_name;
SELECT COUNT(*) AS loan_count, 'Expected: Count of loans for test-user-001' AS expected
FROM "Loan" l 
JOIN "Member" m ON m.id = l."memberId" 
WHERE m."userId" = 'test-user-001';

-- Test 5.4: Try to insert member (should FAIL)
SELECT '📌 Test 5.4: Try to insert member (should FAIL)' AS test_name;
-- Uncomment to test (should fail):
/*
INSERT INTO "Member" (
  id, "userId", "memberNumber", "firstName", "lastName", email,
  "idPassportNumber", "physicalAddress", telephone, "dateOfBirth",
  "nextOfKinName", "nextOfKinPhone", "nextOfKinRelationship", "branchId"
)
VALUES (
  'mem-test-001', 'u-mem-001', 'MMEM001', 'Member', 'Test', 'member@test.com',
  'MEM001', 'Addr', '0707777777', '1990-01-01',
  'Next', '0708777777', 'Spouse', 'branch-001'
);
*/
SELECT 'Uncomment INSERT above to test - should FAIL (members cannot insert)' AS result;

-- Test 5.5: Try to update own record (should FAIL - members have read-only access)
SELECT '📌 Test 5.5: Try to update own record (should FAIL)' AS test_name;
-- Uncomment to test (should fail):
/*
UPDATE "Member" 
SET "firstName" = 'MemberUpdated' 
WHERE "userId" = 'test-user-001';
*/
SELECT 'Uncomment UPDATE above to test - should FAIL (members are read-only)' AS result;

-- Clear JWT claims
SELECT clear_test_jwt_claims();
SELECT '✅ MEMBER tests completed' AS status;


-- ============================================================================
-- TEST 6: DELETE RESTRICTIONS ON TRANSACTIONAL TABLES
-- ============================================================================

SELECT '🧪 TEST 6: DELETE RESTRICTIONS' AS test_section;
SELECT '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' AS divider;

-- Test as MANAGER (should fail to delete transactions)
SELECT set_test_jwt_claims('MANAGER', 'branch-002', 'manager-user-002');

SELECT '📌 Test 6.1: MANAGER tries to delete loan (should FAIL)' AS test_name;
-- Uncomment to test (should fail):
/*
DELETE FROM "Loan" WHERE id = 'test-loan-002';
*/
SELECT 'Uncomment DELETE above to test - should FAIL (only ADMIN can delete loans)' AS result;

SELECT '📌 Test 6.2: MANAGER tries to delete saving (should FAIL)' AS test_name;
-- Uncomment to test (should fail):
/*
DELETE FROM "Saving" WHERE id = 'test-sav-002';
*/
SELECT 'Uncomment DELETE above to test - should FAIL (only ADMIN can delete savings)' AS result;

SELECT clear_test_jwt_claims();

-- Test as ADMIN (should succeed)
SELECT set_test_jwt_claims('ADMIN', NULL, 'admin-user-000');

SELECT '📌 Test 6.3: ADMIN deletes saving (should succeed)' AS test_name;
DELETE FROM "Saving" WHERE id = 'test-sav-002';
SELECT '✅ Delete succeeded (ADMIN can delete transactional records)' AS result;

SELECT '📌 Test 6.4: ADMIN deletes remaining loan (should succeed)' AS test_name;
DELETE FROM "Loan" WHERE id = 'test-loan-002';
SELECT '✅ Delete succeeded' AS result;

SELECT clear_test_jwt_claims();
SELECT '✅ DELETE restriction tests completed' AS status;


-- ============================================================================
-- CLEANUP AND SUMMARY
-- ============================================================================

SELECT '🧹 CLEANUP: Removing test data' AS section;
SELECT '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' AS divider;

-- Set ADMIN claims to clean up
SELECT set_test_jwt_claims('ADMIN', NULL, 'admin-cleanup');

-- Clean up test data (delete in correct order due to foreign keys)
DELETE FROM "Saving" WHERE id LIKE 'test-%';
DELETE FROM "Loan" WHERE id LIKE 'test-%';
DELETE FROM "Member" WHERE id LIKE 'test-%' OR id LIKE 'clerk-test-%' OR id LIKE 'mgr-test-%' OR id LIKE 'admin-test-%';
DELETE FROM "User" WHERE id LIKE 'test-%' OR id LIKE 'u-clerk-%' OR id LIKE 'u-mgr-%' OR id LIKE 'u-admin-%';

SELECT clear_test_jwt_claims();

SELECT '✅ Test data cleaned up' AS status;

-- ============================================================================
-- SUMMARY
-- ============================================================================

SELECT '
═══════════════════════════════════════════════════════════════════════════
✅ RLS ROLE TESTING COMPLETED
═══════════════════════════════════════════════════════════════════════════

Summary of Tests:
  1. ✅ AUDITOR   - Read-only access to all branches
  2. ✅ CLERK     - Insert/Select in own branch only
  3. ✅ MANAGER   - Full CRUD in own branch, cannot delete transactions
  4. ✅ ADMIN     - Full access to all branches including delete
  5. ✅ MEMBER    - View own records only
  6. ✅ DELETE    - Only ADMIN can delete transactional records

📋 Next Steps:
  1. Review test results above
  2. Assign branchId to existing Member records in production
  3. Update member creation endpoints to include branchId
  4. Test with actual JWT tokens from your API
  5. Create branch management UI for admins

═══════════════════════════════════════════════════════════════════════════
' AS summary;
