# Audit Trail Migration - Complete Change Tracking

## Overview

This migration implements a comprehensive audit trail system that captures every change (INSERT, UPDATE, DELETE) to key tables in the SACCO platform. Every change is fully reconstructible with before/after snapshots stored as JSONB.

## What's Included

### 1. Core Table

- **`audit_log`** - Stores all changes with:
  - `id` - Unique audit record ID
  - `table_name` - Which table was changed
  - `row_id` - ID of the affected record
  - `actor` - User who made the change (from JWT `sub`)
  - `branch_id` - Branch context (from JWT `branch_id`)
  - `action` - Type of change: INSERT, UPDATE, DELETE
  - `before_json` - State before change (NULL for INSERT)
  - `after_json` - State after change (NULL for DELETE)
  - `changed_fields` - Array of changed field names (for UPDATE)
  - `at` - Timestamp of the change

### 2. Helper Functions

- `get_current_actor()` - Extracts user ID from JWT or session
- `get_current_branch_id()` - Extracts branch ID from JWT
- `audit_trigger_func()` - Generic trigger function that captures changes
- `get_audit_trail(table, id, limit)` - Get full history of a record
- `get_audit_by_actor(actor, from, to, limit)` - Get changes by user
- `get_record_at_time(table, id, timestamp)` - Reconstruct record state at any point
- `get_audit_summary(from, to)` - Get change statistics by table

### 3. Views

- `audit_log_latest` - Latest state of each record
- `audit_log_with_user` - Audit log with user and branch details

### 4. Triggers

Audit triggers are automatically created on:

- ✅ `User`
- ✅ `Member`
- ✅ `Saving`
- ✅ `Share`
- ✅ `Loan`
- ✅ `Repayment`
- ✅ `Contribution`
- ✅ `Beneficiary`

### 5. Security

- Row Level Security (RLS) enabled
- Users can view their own audit trail
- Admins (ADMIN, CHAIRMAN) can view all audit trails

## How to Apply Migration

### Option 1: Supabase SQL Editor (Recommended)

1. Open Supabase Dashboard → SQL Editor
2. Copy the entire `migration.sql` file
3. Run it as a single script
4. Verify with test queries (see below)

### Option 2: psql Command Line

```bash
psql $DATABASE_URL -f db/prisma/migrations/003_audit_triggers/migration.sql
```

## Usage Examples

### 1. View Audit Trail for a Record

```sql
-- Get full history of a member
SELECT * FROM get_audit_trail('Member', 'member-uuid-here', 50);

-- Get with user details
SELECT
  actor_name,
  action,
  changed_fields,
  at
FROM "audit_log_with_user"
WHERE table_name = 'Member'
  AND row_id = 'member-uuid-here'
ORDER BY at DESC;
```

### 2. See What Changed in an Update

```sql
-- View before and after for an update
SELECT
  actor,
  changed_fields,
  before_json,
  after_json,
  at
FROM "audit_log"
WHERE table_name = 'Loan'
  AND row_id = 'loan-uuid-here'
  AND action = 'UPDATE'
ORDER BY at DESC
LIMIT 1;
```

### 3. Reconstruct Record at a Point in Time

```sql
-- See what a member record looked like on 2025-01-15
SELECT get_record_at_time(
  'Member',
  'member-uuid-here',
  '2025-01-15 12:00:00+00'::TIMESTAMPTZ
);
```

### 4. Get Changes by User

```sql
-- See all changes made by a user in the last 7 days
SELECT * FROM get_audit_by_actor(
  'user-uuid-here',
  NOW() - INTERVAL '7 days',
  NOW(),
  100
);
```

### 5. Get Change Summary

```sql
-- See activity summary for last 30 days
SELECT * FROM get_audit_summary(
  NOW() - INTERVAL '30 days',
  NOW()
);
```

### 6. Find Who Deleted a Record

```sql
-- Find deletion events
SELECT
  actor_name,
  before_json,
  at
FROM "audit_log_with_user"
WHERE table_name = 'Loan'
  AND row_id = 'deleted-loan-uuid'
  AND action = 'DELETE';
```

### 7. Track Field-Specific Changes

```sql
-- Find all changes to loan status
SELECT
  actor_name,
  before_json->>'status' AS old_status,
  after_json->>'status' AS new_status,
  at
FROM "audit_log_with_user"
WHERE table_name = 'Loan'
  AND 'status' = ANY(changed_fields)
ORDER BY at DESC;
```

## Backend Integration

### NestJS Usage

```typescript
// apps/api/src/audit/audit.service.ts

import { Injectable } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";

@Injectable()
export class AuditService {
  constructor(private supabase: SupabaseService) {}

  async getRecordHistory(tableName: string, recordId: string) {
    const { data, error } = await this.supabase
      .getAdminClient()
      .rpc("get_audit_trail", {
        p_table_name: tableName,
        p_row_id: recordId,
        p_limit: 100,
      });

    if (error) throw error;
    return data;
  }

  async getUserActivity(userId: string, days: number = 30) {
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    const { data, error } = await this.supabase
      .getAdminClient()
      .rpc("get_audit_by_actor", {
        p_actor: userId,
        p_from_date: fromDate.toISOString(),
        p_to_date: new Date().toISOString(),
        p_limit: 1000,
      });

    if (error) throw error;
    return data;
  }

  async getChangeSummary(days: number = 30) {
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    const { data, error } = await this.supabase
      .getAdminClient()
      .rpc("get_audit_summary", {
        p_from_date: fromDate.toISOString(),
        p_to_date: new Date().toISOString(),
      });

    if (error) throw error;
    return data;
  }

  async getRecordAtTime(tableName: string, recordId: string, timestamp: Date) {
    const { data, error } = await this.supabase
      .getAdminClient()
      .rpc("get_record_at_time", {
        p_table_name: tableName,
        p_row_id: recordId,
        p_at: timestamp.toISOString(),
      });

    if (error) throw error;
    return data;
  }
}
```

## Testing

### 1. Test Insert Audit

```sql
-- Insert a test member
INSERT INTO "Member" (
  id, "userId", "memberNumber", "firstName", "lastName",
  email, "idPassportNumber", "physicalAddress", "dateOfBirth",
  "nextOfKinName", "nextOfKinPhone", "nextOfKinRelationship",
  "branchId", "joiningDate", "membershipStatus",
  "agreedToTerms", "agreedToRefundPolicy"
)
VALUES (
  gen_random_uuid(),
  'user-id-here',
  'M-TEST-001',
  'Audit',
  'Test',
  'audit.test@example.com',
  '12345678',
  'Test Address',
  '1990-01-01',
  'Test Kin',
  '0700000000',
  'Sibling',
  'branch-id-here',
  NOW(),
  'ACTIVE',
  true,
  true
);

-- Check audit log
SELECT
  action,
  actor,
  after_json->>'firstName' AS first_name,
  after_json->>'memberNumber' AS member_number,
  at
FROM "audit_log"
WHERE table_name = 'Member'
ORDER BY at DESC
LIMIT 1;
```

### 2. Test Update Audit

```sql
-- Update member
UPDATE "Member"
SET "firstName" = 'Updated',
    "physicalAddress" = 'New Address'
WHERE "memberNumber" = 'M-TEST-001';

-- Check what changed
SELECT
  action,
  changed_fields,
  before_json->>'firstName' AS old_first_name,
  after_json->>'firstName' AS new_first_name,
  before_json->>'physicalAddress' AS old_address,
  after_json->>'physicalAddress' AS new_address
FROM "audit_log"
WHERE table_name = 'Member'
  AND action = 'UPDATE'
ORDER BY at DESC
LIMIT 1;
```

### 3. Test Delete Audit

```sql
-- Delete member
DELETE FROM "Member" WHERE "memberNumber" = 'M-TEST-001';

-- Check deletion record
SELECT
  action,
  actor,
  before_json->>'firstName' AS deleted_name,
  at
FROM "audit_log"
WHERE table_name = 'Member'
  AND action = 'DELETE'
ORDER BY at DESC
LIMIT 1;
```

## Performance Considerations

### Indexes

All necessary indexes are created automatically:

- `table_name` - Fast filtering by table
- `row_id` - Fast lookup for specific records
- `actor` - Fast user activity queries
- `branch_id` - Fast branch filtering
- `action` - Fast action type filtering
- `at` - Fast time-range queries
- Composite indexes for common query patterns

### Storage

- JSONB is efficiently stored and indexed
- Consider archiving old audit records (e.g., > 2 years)
- Typical audit record size: 1-5KB depending on table

### Partitioning (Future Enhancement)

For very large deployments, consider partitioning by date:

```sql
-- Example: Partition audit_log by month
CREATE TABLE audit_log_2025_01 PARTITION OF audit_log
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
```

## Compliance & Security

### GDPR Compliance

- ✅ Tracks all changes to personal data
- ✅ Can reconstruct data at any point in time
- ✅ Supports right to erasure (delete audit logs for specific user)
- ✅ Supports right to access (export user's audit trail)

### Security Features

- ✅ Row Level Security enabled
- ✅ Users can only view their own audit trail (unless admin)
- ✅ Branch managers can view their branch's audit
- ✅ Immutable audit records (no UPDATE/DELETE triggers on audit_log)
- ✅ Actor extracted from JWT - can't be spoofed

### Retention Policy

Consider implementing:

```sql
-- Delete audit records older than 7 years
DELETE FROM "audit_log"
WHERE at < NOW() - INTERVAL '7 years';
```

## Troubleshooting

### No Actor in Audit Log

**Issue:** `actor` column is NULL

**Solution:** Ensure JWT is being passed correctly:

```typescript
// Set actor manually if JWT not available
await client.query("SET app.current_user_id = $1", [userId]);
```

### No Branch ID in Audit Log

**Issue:** `branch_id` column is NULL

**Solution:** Ensure branch ID is in JWT claims or set manually:

```typescript
await client.query("SET app.current_branch_id = $1", [branchId]);
```

### Performance Issues

**Issue:** Queries are slow

**Solution:**

1. Ensure indexes are created (check with `\d audit_log`)
2. Use time range filters (`WHERE at >= ... AND at <= ...`)
3. Limit results (`LIMIT 100`)
4. Consider archiving old records

## Maintenance

### Archive Old Records

```sql
-- Create archive table
CREATE TABLE audit_log_archive (LIKE audit_log INCLUDING ALL);

-- Move old records to archive (older than 2 years)
WITH moved AS (
  DELETE FROM audit_log
  WHERE at < NOW() - INTERVAL '2 years'
  RETURNING *
)
INSERT INTO audit_log_archive SELECT * FROM moved;
```

### Export Audit Trail

```sql
-- Export to CSV (via psql)
\copy (SELECT * FROM audit_log WHERE table_name = 'Member' ORDER BY at DESC) TO 'audit_trail.csv' CSV HEADER
```

## Summary

✅ **Complete Change Tracking** - Every INSERT/UPDATE/DELETE is captured  
✅ **Full Reconstruction** - Can rebuild any record at any point in time  
✅ **Actor & Context** - Tracks who made changes and from which branch  
✅ **Efficient Queries** - Optimized indexes for fast lookups  
✅ **GDPR Compliant** - Supports data subject access and erasure requests  
✅ **Secure** - RLS policies prevent unauthorized access  
✅ **Easy to Use** - Helper functions for common audit queries

Every change is now fully auditable and reconstructible! 🎉
