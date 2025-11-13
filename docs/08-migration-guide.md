# Migration Guide

## 📋 Overview

This guide documents all database migrations for the Church SACCO Platform, including their purpose, implementation details, and how to apply them.

## 🗂️ Migration Structure

```
db/prisma/migrations/
├── 001_rls_init/
│   ├── migration.sql
│   ├── test-roles.sql
│   └── README.md
├── 002_pgcrypto_pii/
│   ├── migration.sql
│   ├── migration-minimal.sql
│   └── README.md
├── 003_audit_triggers/
│   ├── migration.sql
│   └── README.md
└── 004_receipt_sequences/
    ├── migration.sql
    └── README.md
```

## 📊 Migration Timeline

| Migration             | Version | Date       | Status     | Description                 |
| --------------------- | ------- | ---------- | ---------- | --------------------------- |
| 001_rls_init          | 1.0     | 2025-01-10 | ✅ Applied | Row-level security policies |
| 002_pgcrypto_pii      | 1.0     | 2025-01-11 | ✅ Applied | PII encryption system       |
| 003_audit_triggers    | 1.0     | 2025-01-12 | ✅ Applied | Comprehensive audit trail   |
| 004_receipt_sequences | 1.0     | 2025-01-12 | 🚧 Pending | Receipt numbering system    |

## 🔐 Migration 001: Row-Level Security (RLS)

### Purpose

Implement database-level access control using PostgreSQL Row-Level Security policies.

### What It Does

- Enables RLS on all core tables
- Creates policies for role-based access
- Ensures users can only access authorized data
- Provides foundation for multi-tenant security

### Key Components

**Tables with RLS:**

- User
- Member
- Saving
- Share
- Loan
- Repayment
- Contribution
- Beneficiary

**Policy Examples:**

```sql
-- Members view own data
CREATE POLICY member_view_own ON "Member"
  FOR SELECT
  USING (userId = auth.uid()::TEXT);

-- Admins view all
CREATE POLICY admin_view_all ON "Member"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "User" u
      WHERE u.id = auth.uid()::TEXT
      AND u.role = 'ADMIN'
    )
  );
```

### How to Apply

```bash
# Via psql
psql $DATABASE_URL -f db/prisma/migrations/001_rls_init/migration.sql

# Via Supabase SQL Editor
# Copy and paste migration.sql content
```

### Verification

```sql
-- Check RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND rowsecurity = true;

-- Check policies
SELECT schemaname, tablename, policyname, roles, cmd
FROM pg_policies
WHERE schemaname = 'public';
```

### Rollback

```sql
-- Disable RLS on tables
ALTER TABLE "Member" DISABLE ROW LEVEL SECURITY;
-- Repeat for all tables

-- Drop policies
DROP POLICY IF EXISTS member_view_own ON "Member";
-- Repeat for all policies
```

## 🔒 Migration 002: PII Encryption

### Purpose

Encrypt sensitive personally identifiable information (PII) using PostgreSQL pgcrypto extension.

### What It Does

- Installs pgcrypto extension
- Adds encrypted columns for PII
- Creates encryption/decryption functions
- Implements automatic encryption triggers
- Provides secure decryption view

### Encrypted Fields

- ID/Passport numbers → `idNumberEncrypted` (BYTEA)
- Phone numbers → `phoneEncrypted` (BYTEA)
- Alternative phone → `phoneAltEncrypted` (BYTEA)
- Next of kin phone → `nextOfKinPhoneEncrypted` (BYTEA)

### Key Functions

```sql
-- Encryption
CREATE FUNCTION enc(data TEXT, key TEXT) RETURNS BYTEA;

-- Decryption
CREATE FUNCTION dec(data BYTEA, key TEXT) RETURNS TEXT;

-- Extract last 4 digits
CREATE FUNCTION get_last4(data TEXT) RETURNS VARCHAR(4);

-- Mask with asterisks
CREATE FUNCTION mask_last4(last4 VARCHAR(4)) RETURNS VARCHAR(20);
```

### Automatic Encryption Trigger

```sql
CREATE TRIGGER member_encrypt_pii
  BEFORE INSERT OR UPDATE ON "Member"
  FOR EACH ROW
  EXECUTE FUNCTION encrypt_member_pii();
```

### Decryption View

```sql
CREATE VIEW "MemberWithDecryptedPII" AS
SELECT
  m.*,
  dec(m.idNumberEncrypted, current_setting('pii.encryption_key')) AS idNumberDecrypted,
  dec(m.phoneEncrypted, current_setting('pii.encryption_key')) AS phoneDecrypted
FROM "Member" m;
```

### How to Apply

**Prerequisites:**

1. Set PII encryption key in environment:

   ```bash
   export PII_ENCRYPTION_KEY="your-secure-key-here"
   ```

2. Apply migration:
   ```bash
   psql $DATABASE_URL -f db/prisma/migrations/002_pgcrypto_pii/migration.sql
   ```

**For Existing Data:**

```sql
-- Set encryption key for session
SET pii.encryption_key = 'your-key-here';

-- Encrypt existing data
UPDATE "Member"
SET idPassportNumber = idPassportNumber  -- Trigger will encrypt
WHERE idNumberEncrypted IS NULL;
```

### Verification

```sql
-- Check pgcrypto extension
SELECT * FROM pg_extension WHERE extname = 'pgcrypto';

-- Check encrypted columns exist
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'Member'
AND column_name LIKE '%Encrypted%';

-- Test encryption/decryption
SET pii.encryption_key = 'your-key-here';

INSERT INTO "Member" (id, userId, memberNumber, firstName, lastName,
  email, idPassportNumber, physicalAddress, dateOfBirth,
  nextOfKinName, nextOfKinPhone, nextOfKinRelationship,
  joiningDate, membershipStatus, agreedToTerms, agreedToRefundPolicy)
VALUES ('test-id', 'user-id', 'M-TEST-001', 'Test', 'User',
  'test@example.com', '12345678', 'Test Address', '1990-01-01',
  'Kin Name', '0700000000', 'Sibling', NOW(), 'ACTIVE', true, true);

-- Verify encryption
SELECT idLast4, idNumberEncrypted IS NOT NULL AS is_encrypted
FROM "Member" WHERE id = 'test-id';

-- Verify decryption
SELECT * FROM "MemberWithDecryptedPII" WHERE id = 'test-id';

-- Cleanup
DELETE FROM "Member" WHERE id = 'test-id';
```

### Rollback

```sql
-- Drop view
DROP VIEW IF EXISTS "MemberWithDecryptedPII";

-- Drop triggers
DROP TRIGGER IF EXISTS member_encrypt_pii ON "Member";

-- Drop functions
DROP FUNCTION IF EXISTS encrypt_member_pii();
DROP FUNCTION IF EXISTS enc(TEXT, TEXT);
DROP FUNCTION IF EXISTS dec(BYTEA, TEXT);

-- Drop columns (⚠️ Data loss!)
ALTER TABLE "Member" DROP COLUMN IF EXISTS idNumberEncrypted;
ALTER TABLE "Member" DROP COLUMN IF EXISTS idLast4;
-- Repeat for other encrypted columns

-- Uninstall extension
DROP EXTENSION IF EXISTS pgcrypto;
```

## 📝 Migration 003: Audit Triggers

### Purpose

Implement comprehensive audit trail for all data changes with complete before/after snapshots.

### What It Does

- Creates `audit_log` table
- Implements generic audit trigger function
- Captures INSERT/UPDATE/DELETE operations
- Stores before/after state in JSONB
- Tracks actor and branch context
- Provides helper functions for querying audit data

### Audit Log Structure

```sql
CREATE TABLE "audit_log" (
  id             UUID PRIMARY KEY,
  table_name     TEXT NOT NULL,
  row_id         TEXT NOT NULL,
  actor          TEXT,              -- From JWT
  branch_id      TEXT,              -- From JWT
  action         TEXT NOT NULL,     -- INSERT/UPDATE/DELETE
  before_json    JSONB,             -- State before
  after_json     JSONB,             -- State after
  changed_fields TEXT[],            -- Changed columns
  at             TIMESTAMPTZ        -- When
);
```

### Tracked Tables

- User
- Member
- Saving
- Share
- Loan
- Repayment
- Contribution
- Beneficiary

### Helper Functions

```sql
-- Get audit trail for a record
SELECT * FROM get_audit_trail('Member', 'member-id', 100);

-- Get changes by user
SELECT * FROM get_audit_by_actor('user-id', NOW() - INTERVAL '30 days', NOW());

-- Reconstruct record at point in time
SELECT get_record_at_time('Member', 'member-id', '2025-01-01 00:00:00+00');

-- Get change summary
SELECT * FROM get_audit_summary(NOW() - INTERVAL '30 days', NOW());
```

### How to Apply

```bash
# Apply migration
psql $DATABASE_URL -f db/prisma/migrations/003_audit_triggers/migration.sql
```

### Verification

```sql
-- Check audit_log table exists
SELECT COUNT(*) FROM information_schema.tables
WHERE table_name = 'audit_log';

-- Check triggers exist
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'audit_trigger';

-- Test audit trail
INSERT INTO "Member" (...) VALUES (...);
SELECT * FROM "audit_log"
WHERE table_name = 'Member'
ORDER BY at DESC LIMIT 1;

-- Test update tracking
UPDATE "Member" SET firstName = 'Updated' WHERE id = 'test-id';
SELECT action, changed_fields, before_json->>'firstName', after_json->>'firstName'
FROM "audit_log"
WHERE table_name = 'Member' AND row_id = 'test-id' AND action = 'UPDATE';

-- Test deletion tracking
DELETE FROM "Member" WHERE id = 'test-id';
SELECT action, before_json
FROM "audit_log"
WHERE table_name = 'Member' AND row_id = 'test-id' AND action = 'DELETE';
```

### Rollback

```sql
-- Drop views
DROP VIEW IF EXISTS "audit_log_latest";
DROP VIEW IF EXISTS "audit_log_with_user";

-- Drop helper functions
DROP FUNCTION IF EXISTS get_audit_trail(TEXT, TEXT, INTEGER);
DROP FUNCTION IF EXISTS get_audit_by_actor(TEXT, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER);
DROP FUNCTION IF EXISTS get_record_at_time(TEXT, TEXT, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS get_audit_summary(TIMESTAMPTZ, TIMESTAMPTZ);

-- Drop triggers
DROP TRIGGER IF EXISTS audit_trigger ON "Member";
-- Repeat for all tables

-- Drop trigger function
DROP FUNCTION IF EXISTS audit_trigger_func();
DROP FUNCTION IF EXISTS get_current_actor();
DROP FUNCTION IF EXISTS get_current_branch_id();

-- Drop table
DROP TABLE IF EXISTS "audit_log";
```

## 🧾 Migration 004: Receipt Sequences

### Purpose

Implement immutable, auto-generated receipt numbers with branch-specific sequences.

### What It Does

- Creates `receipt_sequences` table
- Implements receipt number generation function
- Auto-generates receipts on transaction INSERT
- Enforces immutability (prevents updates)
- Provides concurrency-safe sequence increments

### Receipt Format

```
BR{branch}-YYYYMM-{NNNNN}
```

**Examples:**

- `BR001-202501-00001`
- `BR002-202501-00123`

### Key Components

**1. Sequences Table:**

```sql
CREATE TABLE "receipt_sequences" (
  id                   UUID PRIMARY KEY,
  branch_id            TEXT NOT NULL,
  year_month           TEXT NOT NULL,
  last_sequence_number INTEGER DEFAULT 0,
  UNIQUE(branch_id, year_month)
);
```

**2. Generation Function:**

```sql
SELECT generate_receipt_number('BR001');
-- Returns: BR001-202501-00001
```

**3. Auto-generation Triggers:**

- `repayment_receipt_trigger` - For Repayment table
- `contribution_receipt_trigger` - For Contribution table

**4. Immutability Triggers:**

- Prevents any updates to `receiptNumber` fields
- Raises error with clear message

### How to Apply

```bash
# Apply migration
psql $DATABASE_URL -f db/prisma/migrations/004_receipt_sequences/migration.sql
```

### Verification

```sql
-- Check sequences table exists
SELECT * FROM "receipt_sequences";

-- Test receipt generation
SELECT generate_receipt_number('BR001');
SELECT generate_receipt_number('BR001');  -- Should increment
SELECT generate_receipt_number('BR002');  -- Different branch

-- Test auto-generation on insert
INSERT INTO "Repayment" (
  id, loanId, amount, paymentDate, principalAmount,
  interestAmount, balanceAfter
) VALUES (
  gen_random_uuid(), 'loan-id', 1000, NOW(), 900, 100, 5000
);

SELECT receiptNumber FROM "Repayment"
ORDER BY createdAt DESC LIMIT 1;
-- Should have auto-generated receipt

-- Test immutability (should fail)
UPDATE "Repayment"
SET receiptNumber = 'FAKE-001'
WHERE id = (SELECT id FROM "Repayment" LIMIT 1);
-- ERROR: Receipt numbers are immutable

-- Check sequence tracking
SELECT * FROM "receipt_sequences"
ORDER BY year_month DESC, branch_id;

-- View all receipts
SELECT * FROM "receipt_audit_view" LIMIT 10;
```

### Rollback

```sql
-- Drop views
DROP VIEW IF EXISTS "receipt_audit_view";

-- Drop helper functions
DROP FUNCTION IF EXISTS generate_receipt_number(TEXT);
DROP FUNCTION IF EXISTS get_current_receipt_sequence(TEXT, TEXT);
DROP FUNCTION IF EXISTS get_receipt_sequence_history(TEXT, INT);
DROP FUNCTION IF EXISTS validate_receipt_number(TEXT);
DROP FUNCTION IF EXISTS parse_receipt_number(TEXT);

-- Drop triggers
DROP TRIGGER IF EXISTS repayment_receipt_trigger ON "Repayment";
DROP TRIGGER IF EXISTS contribution_receipt_trigger ON "Contribution";
DROP TRIGGER IF EXISTS repayment_receipt_immutable ON "Repayment";
DROP TRIGGER IF EXISTS contribution_receipt_immutable ON "Contribution";

-- Drop trigger functions
DROP FUNCTION IF EXISTS repayment_generate_receipt_trigger();
DROP FUNCTION IF EXISTS contribution_generate_receipt_trigger();
DROP FUNCTION IF EXISTS prevent_receipt_update_trigger();

-- Drop table
DROP TABLE IF EXISTS "receipt_sequences";
```

## 🔄 Migration Best Practices

### Before Applying Migration

1. **Backup Database:**

   ```bash
   # Create backup
   pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
   ```

2. **Test in Development:**
   - Apply to local database first
   - Test all verification queries
   - Check for errors or warnings

3. **Review Migration:**
   - Read migration SQL carefully
   - Understand what will change
   - Check for data loss risks

### During Migration

1. **Use Transactions:**

   ```sql
   BEGIN;
   -- Run migration
   \i migration.sql
   -- Verify
   SELECT * FROM verification_query;
   COMMIT;  -- Or ROLLBACK if issues
   ```

2. **Monitor Performance:**
   - Watch for long-running queries
   - Check table locks
   - Monitor database load

3. **Document:**
   - Record start time
   - Note any warnings
   - Save migration output

### After Migration

1. **Verify:**
   - Run all verification queries
   - Test affected features
   - Check application logs

2. **Monitor:**
   - Watch for errors
   - Check performance metrics
   - Review audit logs

3. **Update Documentation:**
   - Mark migration as applied
   - Note any issues encountered
   - Update this guide if needed

## 🚨 Troubleshooting

### Common Issues

**1. Permission Denied:**

```sql
-- Error: permission denied for table
-- Solution: Ensure proper database role
GRANT ALL ON ALL TABLES IN SCHEMA public TO your_role;
```

**2. Extension Not Found:**

```sql
-- Error: extension "pgcrypto" does not exist
-- Solution: Install extension first
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

**3. Trigger Function Not Found:**

```sql
-- Error: function does not exist
-- Solution: Ensure functions created before triggers
-- Re-run function creation section
```

**4. RLS Policy Conflicts:**

```sql
-- Error: policy already exists
-- Solution: Drop existing policy first
DROP POLICY IF EXISTS policy_name ON table_name;
```

## 📊 Migration Status Tracking

### Check Applied Migrations

```sql
-- List all applied migrations (if using migration tracking)
SELECT * FROM _prisma_migrations ORDER BY finished_at DESC;

-- Check specific features
SELECT EXISTS (
  SELECT 1 FROM pg_tables WHERE tablename = 'audit_log'
) AS has_audit_trail;

SELECT EXISTS (
  SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto'
) AS has_encryption;
```

---

_Document Version: 1.0_  
_Last Updated: January 12, 2025_  
_Status: ✅ Active_
