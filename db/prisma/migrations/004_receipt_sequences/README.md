# Receipt Sequences Migration - Immutable Receipt Numbers

## Overview

This migration implements a robust receipt numbering system with automatic generation, immutability guarantees, and concurrency safety. Receipt numbers follow the format `BR{branch}-YYYYMM-{NNNNN}` and are unique across the entire system.

## Features

✅ **Auto-generation** - Receipt numbers generated automatically on INSERT  
✅ **Immutable** - Once created, receipt numbers cannot be changed  
✅ **Branch-aware** - Sequences tracked per branch per month  
✅ **Concurrency-safe** - Row-level locking prevents duplicate numbers  
✅ **Format validation** - Built-in validation and parsing functions  
✅ **Audit trail** - Unified view of all receipts across tables

## Receipt Number Format

```
BR{branch}-YYYYMM-{NNNNN}
```

**Examples:**

- `BR001-202501-00001` - First receipt of January 2025, Branch 001
- `BR002-202501-00123` - 123rd receipt of January 2025, Branch 002
- `BR001-202502-00001` - First receipt of February 2025, Branch 001

**Components:**

- `BR{branch}` - Branch identifier (e.g., BR001, BR002)
- `YYYYMM` - Year and month (e.g., 202501 = January 2025)
- `NNNNN` - 5-digit sequence number (padded with zeros)

## What's Included

### 1. Core Table

**`receipt_sequences`** - Tracks sequence numbers per branch/month:

- `id` - Unique identifier
- `branch_id` - Branch identifier (e.g., 'BR001')
- `year_month` - Format YYYYMM (e.g., '202501')
- `last_sequence_number` - Current sequence number
- `created_at` - When sequence was first created
- `updated_at` - Last update timestamp
- **Unique constraint:** One sequence per branch per month

### 2. Auto-generation Triggers

Receipt numbers are automatically generated on INSERT for:

- ✅ **Repayment** table - Payment receipts for loan repayments
- ✅ **Contribution** table - Receipts for member contributions

**Behavior:**

- If `receiptNumber` is NULL or empty → Auto-generates
- If `receiptNumber` is provided → Uses provided value (manual override)
- Branch context extracted from related Member record

### 3. Immutability Triggers

BEFORE UPDATE triggers prevent any changes to receipt numbers:

- ✅ Blocks UPDATE operations that modify `receiptNumber`
- ✅ Raises clear error message with old/new values
- ✅ Applied to: Repayment, Contribution tables

### 4. Helper Functions

#### `generate_receipt_number(branch_id TEXT)`

Generates next receipt number for a branch.

```sql
-- Generate receipt for branch BR001
SELECT generate_receipt_number('BR001');
-- Returns: BR001-202501-00001

-- Generate with JWT branch context
SELECT generate_receipt_number(NULL); -- Uses JWT branch_id
```

#### `get_current_receipt_sequence(branch_id TEXT, year_month TEXT)`

Get current sequence number for a branch/month.

```sql
-- Current sequence for BR001 in January 2025
SELECT get_current_receipt_sequence('BR001', '202501');
-- Returns: 123 (if 123 receipts issued)

-- Current month's sequence
SELECT get_current_receipt_sequence('BR001');
```

#### `get_receipt_sequence_history(branch_id TEXT, limit INT)`

View sequence history across months/branches.

```sql
-- Last 12 months for BR001
SELECT * FROM get_receipt_sequence_history('BR001', 12);

-- All branches, last 12 months
SELECT * FROM get_receipt_sequence_history(NULL, 12);
```

#### `validate_receipt_number(receipt_number TEXT)`

Validate receipt number format.

```sql
SELECT validate_receipt_number('BR001-202501-00001'); -- true
SELECT validate_receipt_number('INVALID-RECEIPT');    -- false
```

#### `parse_receipt_number(receipt_number TEXT)`

Parse receipt number into components.

```sql
SELECT * FROM parse_receipt_number('BR001-202501-00001');
-- Returns: branch_id='BR001', year_month='202501', sequence_number=1, is_valid=true
```

### 5. Views

#### `receipt_audit_view`

Unified view of all receipts with member details.

**Columns:**

- `source_table` - Which table (Repayment/Contribution)
- `record_id` - Record ID
- `receipt_number` - Receipt number
- `amount` - Transaction amount
- `transaction_date` - Date of transaction
- `payment_method` - Payment method (CASH, etc.)
- `member_id` - Member ID
- `member_number` - Member number
- `member_name` - Member full name
- `created_at` - When receipt was created

### 6. Security

- **RLS enabled** on `receipt_sequences`
- Authenticated users can view sequences (SELECT only)
- Only system (via triggers) can modify sequences
- Receipt audit view accessible to authenticated users

## How to Apply Migration

### Option 1: Supabase SQL Editor

1. Open Supabase Dashboard → SQL Editor
2. Copy entire `migration.sql` file
3. Run as single script
4. Verify with test queries (see below)

### Option 2: psql Command Line

```bash
psql $DATABASE_URL -f db/prisma/migrations/004_receipt_sequences/migration.sql
```

## Usage Examples

### 1. Automatic Receipt Generation

```typescript
// NestJS example - receipt auto-generated
await prisma.repayment.create({
  data: {
    id: uuid(),
    loanId: "loan-uuid",
    amount: 1000,
    principalAmount: 900,
    interestAmount: 100,
    balanceAfter: 5000,
    paymentMethod: "CASH",
    // receiptNumber: NOT PROVIDED - will be auto-generated!
  },
});

// Check generated receipt
const repayment = await prisma.repayment.findUnique({
  where: { id: repaymentId },
});
console.log(repayment.receiptNumber); // BR001-202501-00001
```

### 2. Manual Receipt Generation

```sql
-- Generate receipt number for specific branch
SELECT generate_receipt_number('BR001');
-- Returns: BR001-202501-00042

-- Use in INSERT
INSERT INTO "Repayment" (
  id, "loanId", amount, "paymentDate",
  "principalAmount", "interestAmount", "balanceAfter",
  "receiptNumber"
)
VALUES (
  gen_random_uuid(),
  'loan-id',
  1000,
  NOW(),
  900,
  100,
  5000,
  generate_receipt_number('BR001')
);
```

### 3. View Receipt History

```sql
-- All receipts, recent first
SELECT * FROM "receipt_audit_view"
ORDER BY transaction_date DESC
LIMIT 50;

-- Receipts for specific member
SELECT * FROM "receipt_audit_view"
WHERE member_number = 'M-001234'
ORDER BY transaction_date DESC;

-- Receipts by branch (parsed from receipt_number)
SELECT
  (parse_receipt_number(receipt_number)).branch_id AS branch,
  COUNT(*) AS total_receipts,
  SUM(amount) AS total_amount
FROM "receipt_audit_view"
WHERE transaction_date >= '2025-01-01'
GROUP BY (parse_receipt_number(receipt_number)).branch_id;
```

### 4. Check Sequence Status

```sql
-- Current sequences for all branches
SELECT * FROM get_receipt_sequence_history(NULL, 12);

-- Specific branch sequence
SELECT
  branch_id,
  year_month,
  last_sequence_number,
  TO_CHAR(updated_at, 'YYYY-MM-DD HH24:MI:SS') AS last_updated
FROM "receipt_sequences"
WHERE branch_id = 'BR001'
ORDER BY year_month DESC;
```

### 5. Validate Receipt Numbers

```sql
-- Validate format
SELECT
  receipt_number,
  validate_receipt_number(receipt_number) AS is_valid
FROM "receipt_audit_view"
WHERE validate_receipt_number(receipt_number) = false;

-- Parse receipt components
SELECT
  receipt_number,
  (parse_receipt_number(receipt_number)).*
FROM "receipt_audit_view"
LIMIT 10;
```

### 6. Test Immutability

```sql
-- This INSERT will work (receipt auto-generated)
INSERT INTO "Contribution" (
  id, "memberId", type, amount, "contributionDate", "paymentMethod"
)
VALUES (
  gen_random_uuid(),
  'member-id',
  'MONTHLY',
  5000,
  NOW(),
  'CASH'
);

-- This UPDATE will FAIL with error
UPDATE "Contribution"
SET "receiptNumber" = 'BR999-999999-99999'
WHERE id = 'contribution-id';
-- ERROR: Receipt numbers are immutable and cannot be updated
```

## Backend Integration

### NestJS Service Example

```typescript
// apps/api/src/receipts/receipts.service.ts

import { Injectable } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";

@Injectable()
export class ReceiptsService {
  constructor(private supabase: SupabaseService) {}

  /**
   * Generate next receipt number for branch
   */
  async generateReceiptNumber(branchId: string): Promise<string> {
    const { data, error } = await this.supabase
      .getAdminClient()
      .rpc("generate_receipt_number", { p_branch_id: branchId });

    if (error) throw error;
    return data;
  }

  /**
   * Get current sequence for branch
   */
  async getCurrentSequence(branchId: string): Promise<number> {
    const { data, error } = await this.supabase
      .getAdminClient()
      .rpc("get_current_receipt_sequence", {
        p_branch_id: branchId,
        p_year_month: null, // Current month
      });

    if (error) throw error;
    return data || 0;
  }

  /**
   * Get receipt history
   */
  async getReceiptHistory(branchId?: string, limit = 12) {
    const { data, error } = await this.supabase
      .getAdminClient()
      .rpc("get_receipt_sequence_history", {
        p_branch_id: branchId,
        p_limit: limit,
      });

    if (error) throw error;
    return data;
  }

  /**
   * Validate receipt number format
   */
  async validateReceiptNumber(receiptNumber: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .getAdminClient()
      .rpc("validate_receipt_number", {
        p_receipt_number: receiptNumber,
      });

    if (error) throw error;
    return data;
  }

  /**
   * Get all receipts with audit trail
   */
  async getReceiptAuditTrail(filters?: {
    memberNumber?: string;
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
  }) {
    let query = this.supabase
      .getAdminClient()
      .from("receipt_audit_view")
      .select("*")
      .order("transaction_date", { ascending: false });

    if (filters?.memberNumber) {
      query = query.eq("member_number", filters.memberNumber);
    }

    if (filters?.fromDate) {
      query = query.gte("transaction_date", filters.fromDate.toISOString());
    }

    if (filters?.toDate) {
      query = query.lte("transaction_date", filters.toDate.toISOString());
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  /**
   * Parse receipt number into components
   */
  async parseReceiptNumber(receiptNumber: string) {
    const { data, error } = await this.supabase
      .getAdminClient()
      .rpc("parse_receipt_number", {
        p_receipt_number: receiptNumber,
      });

    if (error) throw error;
    return data?.[0]; // Returns single row
  }
}
```

### Controller Example

```typescript
// apps/api/src/receipts/receipts.controller.ts

import { Controller, Get, Query, Param } from "@nestjs/common";
import { ReceiptsService } from "./receipts.service";

@Controller("receipts")
export class ReceiptsController {
  constructor(private receiptsService: ReceiptsService) {}

  @Get("generate/:branchId")
  async generateReceipt(@Param("branchId") branchId: string) {
    const receiptNumber =
      await this.receiptsService.generateReceiptNumber(branchId);
    return { receiptNumber };
  }

  @Get("audit")
  async getAuditTrail(
    @Query("memberNumber") memberNumber?: string,
    @Query("fromDate") fromDate?: string,
    @Query("toDate") toDate?: string,
  ) {
    return this.receiptsService.getReceiptAuditTrail({
      memberNumber,
      fromDate: fromDate ? new Date(fromDate) : undefined,
      toDate: toDate ? new Date(toDate) : undefined,
      limit: 100,
    });
  }

  @Get("validate/:receiptNumber")
  async validateReceipt(@Param("receiptNumber") receiptNumber: string) {
    const isValid =
      await this.receiptsService.validateReceiptNumber(receiptNumber);
    return { receiptNumber, isValid };
  }

  @Get("parse/:receiptNumber")
  async parseReceipt(@Param("receiptNumber") receiptNumber: string) {
    return this.receiptsService.parseReceiptNumber(receiptNumber);
  }

  @Get("sequences/:branchId")
  async getSequenceHistory(@Param("branchId") branchId: string) {
    return this.receiptsService.getReceiptHistory(branchId, 12);
  }
}
```

## Testing

### 1. Test Auto-generation

```sql
-- Insert repayment without receipt number
INSERT INTO "Repayment" (
  id, "loanId", amount, "paymentDate",
  "principalAmount", "interestAmount", "balanceAfter"
)
SELECT
  gen_random_uuid(),
  l.id,
  1000,
  NOW(),
  900,
  100,
  5000
FROM "Loan" l
LIMIT 1;

-- Check generated receipt
SELECT
  "receiptNumber",
  amount,
  "paymentDate"
FROM "Repayment"
ORDER BY "createdAt" DESC
LIMIT 1;
```

### 2. Test Immutability

```sql
-- Try to update receipt number (should fail)
UPDATE "Repayment"
SET "receiptNumber" = 'FAKE-RECEIPT'
WHERE id = (SELECT id FROM "Repayment" LIMIT 1);

-- Expected error:
-- ERROR: Receipt numbers are immutable and cannot be updated
```

### 3. Test Sequence Tracking

```sql
-- Check current sequences
SELECT * FROM "receipt_sequences"
ORDER BY year_month DESC, branch_id;

-- Generate multiple receipts for same branch
SELECT generate_receipt_number('BR001');
SELECT generate_receipt_number('BR001');
SELECT generate_receipt_number('BR001');

-- Verify sequence incremented
SELECT * FROM get_current_receipt_sequence('BR001');
```

### 4. Test Concurrency

```sql
-- Simulate concurrent inserts (run in multiple sessions)
-- Session 1:
INSERT INTO "Contribution" (
  id, "memberId", type, amount, "contributionDate", "paymentMethod"
) SELECT gen_random_uuid(), m.id, 'MONTHLY', 5000, NOW(), 'CASH'
  FROM "Member" m LIMIT 1;

-- Session 2 (at same time):
INSERT INTO "Contribution" (
  id, "memberId", type, amount, "contributionDate", "paymentMethod"
) SELECT gen_random_uuid(), m.id, 'MONTHLY', 5000, NOW(), 'CASH'
  FROM "Member" m LIMIT 1;

-- Check: Both should have unique sequential receipts
SELECT "receiptNumber" FROM "Contribution"
ORDER BY "createdAt" DESC LIMIT 2;
```

## Troubleshooting

### Issue: Receipt number is NULL

**Cause:** Auto-generation trigger not working

**Solution:**

```sql
-- Check if triggers exist
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE trigger_name LIKE '%receipt%';

-- Re-create trigger if missing
DROP TRIGGER IF EXISTS repayment_receipt_trigger ON "Repayment";
CREATE TRIGGER repayment_receipt_trigger
  BEFORE INSERT ON "Repayment"
  FOR EACH ROW
  EXECUTE FUNCTION repayment_generate_receipt_trigger();
```

### Issue: Cannot update other fields

**Cause:** Immutability trigger blocking all updates

**Solution:** Immutability trigger only blocks changes to `receiptNumber`. Other fields can be updated normally. If blocked, check trigger implementation.

### Issue: Duplicate receipt numbers

**Cause:** Concurrent inserts without proper locking

**Solution:** The migration uses `ON CONFLICT ... DO UPDATE` with row-level locking. Ensure PostgreSQL version >= 9.5. Check for manual inserts bypassing triggers.

### Issue: Wrong branch in receipt number

**Cause:** Branch context not available during INSERT

**Solution:**

```typescript
// Set branch in JWT or custom setting before insert
await client.query('SET app.current_branch_id = $1', ['BR001']);

// Or manually specify in trigger by updating member record
UPDATE "Member" SET "branchId" = 'BR001' WHERE id = 'member-id';
```

## Maintenance

### Reset Sequences (Caution!)

```sql
-- Reset sequences for specific branch/month
-- ⚠️ Only do this if you're sure!
DELETE FROM "receipt_sequences"
WHERE branch_id = 'BR001' AND year_month = '202501';

-- Reset all sequences (⚠️ DANGER!)
TRUNCATE "receipt_sequences";
```

### Archive Old Sequences

```sql
-- Create archive table
CREATE TABLE receipt_sequences_archive (LIKE "receipt_sequences");

-- Move old sequences (> 2 years old)
WITH moved AS (
  DELETE FROM "receipt_sequences"
  WHERE year_month < TO_CHAR(NOW() - INTERVAL '2 years', 'YYYYMM')
  RETURNING *
)
INSERT INTO receipt_sequences_archive SELECT * FROM moved;
```

### Export Receipt Report

```sql
-- Monthly report for branch
\copy (
  SELECT * FROM "receipt_audit_view"
  WHERE receipt_number LIKE 'BR001-202501-%'
  ORDER BY transaction_date
) TO 'receipts_br001_202501.csv' CSV HEADER
```

## Summary

✅ **Automatic** - Receipt numbers auto-generated on INSERT  
✅ **Immutable** - Cannot be changed once created  
✅ **Unique** - Guaranteed unique per branch per month  
✅ **Concurrency-safe** - Row-level locking prevents duplicates  
✅ **Auditable** - Full trail of all receipts with member details  
✅ **Validated** - Format validation and parsing built-in  
✅ **Extensible** - Easy to add to new transaction tables

Receipt numbering is now production-ready! 🎉
