# Migration 005 - Manual Deposits & Transactions Ledger

## Overview

This migration unlocks the P1.3 "Manual Deposit" feature by introducing a dedicated `Transaction` ledger that captures every cashier-posted credit/debit with immutable receipt numbers. It keeps the existing receipt sequence pipeline intact and extends the receipt audit view so that PDF generation and reporting can read from a single source.

## What's Inside

1. **New Enum Types**
   - `TransactionType` – differentiates savings, shares, special contribution, fees, withdrawals, adjustments.
   - `TransactionStatus` – basic lifecycle (`PENDING`, `POSTED`, `REVERSED`).
   - `TransactionChannel` – how money reached the SACCO (`CASH`, `BANK_TRANSFER`, `MOBILE_MONEY`, `CHEQUE`).

2. **`Transaction` Table**
   - Links to both `Member` and the processing `User` (cashier).
   - Stores branch context, reference metadata, running balance, and the immutable receipt number.
   - Indexed for member lookups and branch/date reporting.

3. **Receipt Automation**
   - Trigger copies member branch when absent and calls `generate_receipt_number`.
   - Reuses the existing immutability trigger to block edits on `receiptNumber`.

4. **Audit View Update**
   - `receipt_audit_view` now unions cashier transactions with repayments and contributions, preserving downstream consumers.

## Post-Migration Checklist

1. **Apply SQL script** (Supabase SQL Editor or psql) in the `db/prisma/migrations/005_manual_deposits` folder.
2. **Re-run Prisma generate** so the application layer sees the new model/enums:  
   ```bash
   pnpm --filter @ack-thiboro-sacco/db db:generate
   ```
3. **Grant/Update Policies** if running outside dev: reuse existing RLS helpers to scope the `Transaction` table once seeded.

## Testing Tips

- Insert a manual transaction without a receipt to confirm trigger-based generation:  
  ```sql
  INSERT INTO "Transaction" ("memberId", amount, type, channel)
  VALUES ('member-id', 2500, 'SAVINGS_DEPOSIT', 'CASH')
  RETURNING "receiptNumber";
  ```
- Query `receipt_audit_view` to ensure the new source shows up.
- Verify balance rollover by inserting multiple deposits for the same member.
