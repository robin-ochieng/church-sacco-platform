-- ============================================================================
-- PII Encryption Test Script for Supabase SQL Editor
-- ============================================================================
-- Instructions:
-- 1. Open Supabase Dashboard → SQL Editor
-- 2. Copy and paste this entire script
-- 3. Run it to test pgcrypto encryption/decryption
-- ============================================================================

-- Step 1: Set your PII encryption key for this session
SET LOCAL app.pii_key = 'M0nGbcOL1/DedVPMtynXUS+ozy/ei4H3Dw5RQgnAWA0=';

-- Step 2: Create a test user (required for Member foreign key)
DO $$
DECLARE
  test_user_id uuid := gen_random_uuid();
  test_member_id uuid := gen_random_uuid();
  test_email text := 'test-' || substring(test_member_id::text, 1, 8) || '@example.com';
BEGIN
  -- Insert test user
  INSERT INTO "User" (
    id, 
    email, 
    password, 
    role, 
    "isActive", 
    "createdAt", 
    "updatedAt"
  )
  VALUES (
    test_user_id,
    test_email,
    'test-hash',
    'MEMBER',
    true,
    NOW(),
    NOW()
  );

  -- Generate unique test data
  DECLARE
    test_id_suffix text := substring(test_member_id::text, 1, 6);
    test_id_number text := 'TEST-' || test_id_suffix || '89';
    test_phone text := '071' || test_id_suffix || '78';
    test_phone_alt text := '079' || test_id_suffix || '32';
    test_kin_phone text := '070' || test_id_suffix || '22';
  BEGIN
    -- Insert test member with PII data
    INSERT INTO "Member" (
      id,
      "userId",
      "memberNumber",
      "firstName",
      "lastName",
      email,
      "idPassportNumber",
      "physicalAddress",
      telephone,
      "telephoneAlt",
      "nextOfKinName",
      "nextOfKinPhone",
      "nextOfKinRelationship",
      "dateOfBirth",
      "registrationFee",
      "joiningDate",
      "membershipStatus",
      "agreedToTerms",
      "agreedToRefundPolicy",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      test_member_id,
      test_user_id,
      'M-TEST-' || substring(test_member_id::text, 1, 8),
      'John',
      'Doe',
      test_email,
      test_id_number,           -- ID number (will be encrypted) - unique per run
      '123 Test Street',
      test_phone,               -- Phone (will be encrypted) - unique per run
      test_phone_alt,           -- Alt phone (will be encrypted) - unique per run
      'Jane Doe',
      test_kin_phone,           -- Kin phone (will be encrypted) - unique per run
      'Sister',
      '1990-01-15',             -- Date of Birth
      2000,
      NOW(),
      'ACTIVE',
      true,
      true,
      NOW(),
      NOW()
    );
  END;

  RAISE NOTICE 'Test member created with ID: %', test_member_id;
  RAISE NOTICE 'Test user created with ID: %', test_user_id;
  
  -- Store IDs for cleanup
  PERFORM set_config('test.member_id', test_member_id::text, true);
  PERFORM set_config('test.user_id', test_user_id::text, true);
END $$;

-- ============================================================================
-- TEST 1: Verify encrypted columns are populated (not NULL)
-- ============================================================================
SELECT 
  '✓ TEST 1: Encrypted columns populated' AS test_name,
  CASE 
    WHEN "idNumberEncrypted" IS NOT NULL 
     AND "phoneEncrypted" IS NOT NULL
     AND "phoneAltEncrypted" IS NOT NULL
     AND "nextOfKinPhoneEncrypted" IS NOT NULL
    THEN '✅ PASS'
    ELSE '❌ FAIL - Some encrypted columns are NULL'
  END AS result,
  "idNumberEncrypted" IS NOT NULL AS id_encrypted,
  "phoneEncrypted" IS NOT NULL AS phone_encrypted,
  "phoneAltEncrypted" IS NOT NULL AS phone_alt_encrypted,
  "nextOfKinPhoneEncrypted" IS NOT NULL AS kin_phone_encrypted
FROM "Member"
WHERE id::text = current_setting('test.member_id');

-- ============================================================================
-- TEST 2: Verify last4 columns are populated correctly
-- ============================================================================
SELECT 
  '✓ TEST 2: Last4 columns extracted' AS test_name,
  CASE 
    WHEN "idLast4" IS NOT NULL
     AND length("idLast4") = 4
     AND "phoneLast4" IS NOT NULL
     AND length("phoneLast4") = 4
     AND "phoneAltLast4" IS NOT NULL
     AND length("phoneAltLast4") = 4
     AND "nextOfKinPhoneLast4" IS NOT NULL
     AND length("nextOfKinPhoneLast4") = 4
    THEN '✅ PASS'
    ELSE '❌ FAIL - Last4 values incorrect'
  END AS result,
  "idLast4" AS id_last4_extracted,
  "phoneLast4" AS phone_last4_extracted,
  "phoneAltLast4" AS phone_alt_last4_extracted,
  "nextOfKinPhoneLast4" AS next_of_kin_phone_last4_extracted
FROM "Member"
WHERE id::text = current_setting('test.member_id');

-- ============================================================================
-- TEST 3: Verify decryption works through the view (WITH key set)
-- ============================================================================
SELECT 
  '✓ TEST 3: Decryption with key' AS test_name,
  CASE 
    WHEN "idPassportNumber" IS NOT NULL
     AND "idPassportNumber" LIKE 'TEST-%'
     AND telephone IS NOT NULL
     AND telephone LIKE '071%'
     AND "telephoneAlt" IS NOT NULL
     AND "nextOfKinPhone" IS NOT NULL
    THEN '✅ PASS'
    ELSE '❌ FAIL - Decrypted values are NULL or incorrect'
  END AS result,
  "idPassportNumber" AS id_decrypted,
  telephone AS phone_decrypted,
  "telephoneAlt" AS phone_alt_decrypted,
  "nextOfKinPhone" AS kin_phone_decrypted
FROM "MemberWithDecryptedPII"
WHERE id::text = current_setting('test.member_id');

-- ============================================================================
-- TEST 4: Verify decryption returns NULL without key
-- ============================================================================
-- Reset the key to test behavior without it
RESET app.pii_key;

SELECT 
  '✓ TEST 4: Decryption without key' AS test_name,
  CASE 
    WHEN "idPassportNumber" IS NULL
     AND telephone IS NULL
     AND "telephoneAlt" IS NULL
     AND "nextOfKinPhone" IS NULL
    THEN '✅ PASS'
    ELSE '❌ FAIL - Should return NULL without key'
  END AS result,
  "idPassportNumber" AS id_should_be_null,
  telephone AS phone_should_be_null,
  "telephoneAlt" AS phone_alt_should_be_null,
  "nextOfKinPhone" AS kin_phone_should_be_null
FROM "MemberWithDecryptedPII"
WHERE id::text = current_setting('test.member_id');

-- ============================================================================
-- CLEANUP: Remove test data
-- ============================================================================
DELETE FROM "Member" WHERE id::text = current_setting('test.member_id');
DELETE FROM "User" WHERE id::text = current_setting('test.user_id');

SELECT '🧹 Test data cleaned up' AS cleanup_status;

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- If all tests show ✅ PASS, your pgcrypto implementation is working correctly!
-- 
-- What this tested:
-- 1. Encryption triggers populate encrypted columns on INSERT
-- 2. Last4 extraction works correctly
-- 3. MemberWithDecryptedPII view decrypts with correct key
-- 4. MemberWithDecryptedPII view returns NULL without key
-- ============================================================================
