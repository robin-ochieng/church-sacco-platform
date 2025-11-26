# Supabase Database Migration Guide - Phase 2

## Overview
This guide helps you update your Supabase database with the new fields added in **Phase 2** (Loan Application & Approval Workflow).

## New Fields Added in Phase 2

### Loan Table Updates:

#### **Application Details** (P2.1):
- `monthlyIncome` - Member's monthly income for eligibility assessment
- `sourceOfIncome` - Source of income (e.g., Salary, Business)
- `processingFee` - Loan processing fee (3% of loan amount)
- `insuranceFee` - Loan insurance fee (2% of loan amount)
- `disbursementMode` - Disbursement mode: "NET" or "GROSS"

#### **Status Updates** (P2.2):
New `LoanStatus` enum values:
- `DRAFT` - Initial loan draft
- `SUBMITTED` - Application submitted for review
- `UNDER_REVIEW` - Under admin review
- `APPROVED` - Approved and ready for disbursement
- `DISBURSED` - Funds disbursed to member
- `ACTIVE` - Loan is active with repayments
- `CLOSED` - Loan fully repaid

#### **Field Modifications**:
- Guarantor fields (`guarantorName`, `guarantorPhone`, `guarantorNationalId`) are now **optional** (can be added during approval stage)
- `monthlyPayment` is now **nullable** (calculated at disbursement)
- `balance` defaults to `0` (updated after disbursement)

## Migration Options

### Option 1: Incremental Update (Recommended for Production)
**Use this if you already have data in your Supabase database.**

**File:** `supabase-phase2-loan-updates.sql`

**What it does:**
- Adds new columns to existing `Loan` table
- Updates `LoanStatus` enum with new values
- Makes guarantor fields optional
- Sets default values for existing records
- Creates helpful indexes for performance
- **Does NOT delete any existing data**

**How to use:**
1. Open your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Create a new query
4. Copy and paste the contents of `supabase-phase2-loan-updates.sql`
5. Click **Run** to execute

**Expected output:**
```
Phase 2 Loan table updates completed successfully!
New fields added: monthlyIncome, sourceOfIncome, processingFee, insuranceFee, disbursementMode
Guarantor fields are now optional (can be added during approval stage)
```

### Option 2: Fresh Installation
**Use this if you're setting up a brand new Supabase database.**

**File:** `supabase-complete-schema-v2.sql`

**What it does:**
- Creates all tables from scratch
- Includes all Phase 1 and Phase 2 fields
- Sets up all enums, indexes, and views
- **WARNING: Will delete existing data if uncommented**

**How to use:**
1. Open your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Create a new query
4. **IMPORTANT:** Review the DROP statements at the top (lines 13-35)
5. **Only uncomment them if you want to start fresh**
6. Copy and paste the contents of `supabase-complete-schema-v2.sql`
7. Click **Run** to execute

## Verification Steps

After running the migration, verify the changes:

### 1. Check New Columns
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'Loan'
AND column_name IN (
  'monthlyIncome', 
  'sourceOfIncome', 
  'processingFee', 
  'insuranceFee', 
  'disbursementMode'
);
```

Expected result: 5 rows showing the new columns.

### 2. Check LoanStatus Enum
```sql
SELECT enumlabel
FROM pg_enum
WHERE enumtypid = 'LoanStatus'::regtype
ORDER BY enumsortorder;
```

Expected values: DRAFT, SUBMITTED, UNDER_REVIEW, APPROVED, DISBURSED, ACTIVE, CLOSED, REJECTED, DEFAULTED

### 3. Check Guarantor Fields (should be nullable)
```sql
SELECT column_name, is_nullable
FROM information_schema.columns
WHERE table_name = 'Loan'
AND column_name IN ('guarantorName', 'guarantorPhone', 'guarantorNationalId');
```

Expected result: All three should show `is_nullable = YES`

### 4. Test Loan Creation
```sql
-- Test inserting a loan application (without guarantor)
INSERT INTO "Loan" (
  id, 
  "memberId", 
  "loanNumber", 
  amount, 
  "interestRate", 
  "durationMonths", 
  status, 
  purpose,
  "monthlyIncome",
  "sourceOfIncome",
  "processingFee",
  "insuranceFee",
  "disbursementMode"
) VALUES (
  gen_random_uuid()::text,
  '<MEMBER_ID_HERE>',
  'LN-TEST-001',
  50000,
  15.0,
  12,
  'DRAFT',
  'Business Expansion',
  30000,
  'Salary',
  1500,
  1000,
  'GROSS'
);

-- Verify insertion
SELECT * FROM "Loan" WHERE "loanNumber" = 'LN-TEST-001';

-- Clean up test data
DELETE FROM "Loan" WHERE "loanNumber" = 'LN-TEST-001';
```

## Rollback Plan

If something goes wrong with the incremental update:

```sql
-- Remove new columns (if needed)
ALTER TABLE "Loan" DROP COLUMN IF EXISTS "monthlyIncome";
ALTER TABLE "Loan" DROP COLUMN IF EXISTS "sourceOfIncome";
ALTER TABLE "Loan" DROP COLUMN IF EXISTS "processingFee";
ALTER TABLE "Loan" DROP COLUMN IF EXISTS "insuranceFee";
ALTER TABLE "Loan" DROP COLUMN IF EXISTS "disbursementMode";

-- Make guarantor fields required again (if needed)
ALTER TABLE "Loan" ALTER COLUMN "guarantorName" SET NOT NULL;
ALTER TABLE "Loan" ALTER COLUMN "guarantorPhone" SET NOT NULL;
ALTER TABLE "Loan" ALTER COLUMN "guarantorNationalId" SET NOT NULL;
```

**Note:** You cannot easily remove enum values once added. If you need to rollback enum changes, you'll need to recreate the enum type.

## Files in This Directory

| File | Purpose | Use Case |
|------|---------|----------|
| `supabase-phase2-loan-updates.sql` | Incremental update script | **Recommended** - Update existing database |
| `supabase-complete-schema-v2.sql` | Complete schema from scratch | Fresh Supabase setup or reference |
| `supabase-direct-migration.sql` | Original schema (Phase 0/1) | Historical reference only |

## Support

If you encounter any issues:
1. Check the Supabase logs in the Dashboard
2. Verify your PostgreSQL version (should be 14+)
3. Ensure you have proper permissions
4. Review the error messages carefully

## Next Steps

After successful migration:
1. ✅ Update your Prisma client: `cd db && pnpm prisma generate`
2. ✅ Restart your API server: `cd apps/api && pnpm dev`
3. ✅ Test loan creation via the frontend: `http://localhost:3000/loans/apply`
4. ✅ Test loan approval workflow: `http://localhost:3000/loans`

---

**Migration Date:** November 25, 2025  
**Phase:** Phase 2 - Loan Application & Approval Workflow  
**Version:** 2.0
