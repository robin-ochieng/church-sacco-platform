# 🧪 RLS Role Testing - Visual Flow

## 📋 Testing Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                    START HERE                                │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 1: Open Supabase SQL Editor                           │
│  https://supabase.com/dashboard/project/YOUR_PROJECT/sql    │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 2: Run Migration                                      │
│  • Copy: db/prisma/migrations/001_rls_init/migration.sql   │
│  • Paste into SQL Editor                                    │
│  • Click RUN button                                         │
│  • Wait for: "Success. No rows returned"                    │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 3: Run Test Suite                                     │
│  • New Query in SQL Editor                                  │
│  • Copy: db/prisma/migrations/001_rls_init/test-roles.sql  │
│  • Paste into SQL Editor                                    │
│  • Click RUN button                                         │
│  • Review results (scroll through output)                   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 4: Verify All Tests Passed                           │
│  Look for these indicators:                                 │
│  ✅ JWT claims set for [ROLE]                              │
│  ✅ PASS - Query executed successfully                     │
│  ✅ [ROLE] tests completed                                 │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   ALL TESTS PASSED! ✅                      │
│            Your RLS is working correctly!                   │
└─────────────────────────────────────────────────────────────┘
```

## 🎭 Role Testing Matrix

### 1️⃣ AUDITOR Role
```
┌──────────────────────────────────────────────────┐
│ AUDITOR: Read-Only Across All Branches          │
├──────────────────────────────────────────────────┤
│ ✅ Can READ   │ All branches                     │
│ ❌ Cannot     │ INSERT, UPDATE, DELETE           │
│ Use Case      │ Financial auditing, compliance   │
└──────────────────────────────────────────────────┘

Test Commands:
  SELECT set_test_jwt_claims('AUDITOR', NULL, NULL);
  SELECT COUNT(*) FROM "Member"; -- ✅ See all
  INSERT INTO "Member" (...); -- ❌ Blocked
```

### 2️⃣ CLERK Role
```
┌──────────────────────────────────────────────────┐
│ CLERK: Limited to Own Branch                     │
├──────────────────────────────────────────────────┤
│ ✅ Can READ   │ Own branch only                  │
│ ✅ Can INSERT │ Own branch only                  │
│ ❌ Cannot     │ UPDATE, DELETE, other branches   │
│ Use Case      │ Data entry, member registration  │
└──────────────────────────────────────────────────┘

Test Commands:
  SELECT set_test_jwt_claims('CLERK', 'branch-001', 'clerk-id');
  SELECT * FROM "Member" WHERE "branchId" = 'branch-001'; -- ✅
  SELECT * FROM "Member" WHERE "branchId" = 'branch-002'; -- ❌ Empty
  INSERT INTO "Member" (..., "branchId" = 'branch-001'); -- ✅
  INSERT INTO "Member" (..., "branchId" = 'branch-002'); -- ❌ Blocked
```

### 3️⃣ MANAGER Role
```
┌──────────────────────────────────────────────────┐
│ MANAGER: Full Control in Own Branch             │
├──────────────────────────────────────────────────┤
│ ✅ Can READ   │ Own branch only                  │
│ ✅ Can INSERT │ Own branch only                  │
│ ✅ Can UPDATE │ Own branch only                  │
│ ✅ Can DELETE │ Members (non-transactions)       │
│ ❌ Cannot     │ Delete transactions, other branch│
│ Use Case      │ Branch management, operations    │
└──────────────────────────────────────────────────┘

Test Commands:
  SELECT set_test_jwt_claims('MANAGER', 'branch-002', 'mgr-id');
  UPDATE "Member" SET "firstName" = 'Updated' WHERE id = 'mem-id'; -- ✅
  DELETE FROM "Member" WHERE id = 'mem-id'; -- ✅ (members OK)
  DELETE FROM "Loan" WHERE id = 'loan-id'; -- ❌ Blocked (transactions protected)
```

### 4️⃣ ADMIN Role
```
┌──────────────────────────────────────────────────┐
│ ADMIN: Unrestricted Access                      │
├──────────────────────────────────────────────────┤
│ ✅ Can READ   │ All branches, all tables         │
│ ✅ Can INSERT │ Anywhere                         │
│ ✅ Can UPDATE │ Anywhere                         │
│ ✅ Can DELETE │ Including transactions           │
│ Use Case      │ System administration, CEO       │
└──────────────────────────────────────────────────┘

Test Commands:
  SELECT set_test_jwt_claims('ADMIN', NULL, 'admin-id');
  SELECT * FROM "Member"; -- ✅ All branches
  DELETE FROM "Loan" WHERE id = 'loan-id'; -- ✅ Can delete transactions
```

### 5️⃣ MEMBER Role
```
┌──────────────────────────────────────────────────┐
│ MEMBER: Own Records Only                        │
├──────────────────────────────────────────────────┤
│ ✅ Can READ   │ Own member record & transactions │
│ ❌ Cannot     │ View others, INSERT, UPDATE, DEL │
│ Use Case      │ Self-service member portal       │
└──────────────────────────────────────────────────┘

Test Commands:
  SELECT set_test_jwt_claims('MEMBER', NULL, 'user-001');
  SELECT * FROM "Member" WHERE "userId" = 'user-001'; -- ✅ Own record
  SELECT * FROM "Member" WHERE "userId" != 'user-001'; -- ❌ Empty
  SELECT * FROM "Loan" l JOIN "Member" m ... WHERE m."userId" = 'user-001'; -- ✅
```

## 🔒 DELETE Restrictions Visualization

```
Transactional Tables (Audit Trail Protected):
┌────────────────────┬──────────┬──────────┬──────────┬────────┐
│ Table              │ CLERK    │ MANAGER  │ ADMIN    │ MEMBER │
├────────────────────┼──────────┼──────────┼──────────┼────────┤
│ Loan               │ ❌       │ ❌       │ ✅       │ ❌     │
│ Saving             │ ❌       │ ❌       │ ✅       │ ❌     │
│ Share              │ ❌       │ ❌       │ ✅       │ ❌     │
│ Repayment          │ ❌       │ ❌       │ ✅       │ ❌     │
│ Contribution       │ ❌       │ ❌       │ ✅       │ ❌     │
└────────────────────┴──────────┴──────────┴──────────┴────────┘

Non-Transactional Tables:
┌────────────────────┬──────────┬──────────┬──────────┬────────┐
│ Table              │ CLERK    │ MANAGER  │ ADMIN    │ MEMBER │
├────────────────────┼──────────┼──────────┼──────────┼────────┤
│ Member             │ ❌       │ ✅       │ ✅       │ ❌     │
└────────────────────┴──────────┴──────────┴──────────┴────────┘

Why?
• Transactional records = Financial audit trail
• Cannot be deleted by staff to prevent fraud
• Only system ADMIN can delete (with full logging)
```

## 📊 Test Results Format

When you run `test-roles.sql`, you'll see:

```sql
🧪 TEST 1: AUDITOR ROLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ JWT claims set for AUDITOR

📌 Test 1.1: View all members
   member_count  | expected
   ───────────────────────────────────────
   4             | Should see all members
   
✅ PASS

📌 Test 1.2: View branch-001 members  
   member_count  | expected
   ───────────────────────────────────────
   2             | Should see branch-001 members
   
✅ PASS

... (continues for ~25 tests)

✅ AUDITOR tests completed
✅ CLERK tests completed  
✅ MANAGER tests completed
✅ ADMIN tests completed
✅ MEMBER tests completed
✅ DELETE restriction tests completed

═══════════════════════════════════════════════════════════════════════════
✅ RLS ROLE TESTING COMPLETED
═══════════════════════════════════════════════════════════════════════════
```

## 🎯 Success Indicators

### ✅ All Tests Passed
```
Look for:
  • ✅ symbols throughout output
  • "tests completed" messages for each role
  • Expected vs actual counts match
  • No ERROR messages (except expected failures)
```

### ❌ Expected Failures
```
Some tests are commented out and labeled "should FAIL":
  • When uncommented, these should produce RLS errors
  • This proves your security is working!
  
Example:
  📌 Try to insert in other branch (should FAIL)
  --> Uncomment INSERT to test - should FAIL with RLS violation
```

## 🐛 Troubleshooting Decision Tree

```
                    ┌─────────────────┐
                    │ Error occurred? │
                    └────────┬────────┘
                             │
                  ┌──────────┴──────────┐
                  │                     │
                  ▼                     ▼
    ┌─────────────────────┐   ┌─────────────────────┐
    │ Migration errors?   │   │ Test errors?        │
    └──────────┬──────────┘   └──────────┬──────────┘
               │                          │
               ▼                          ▼
    "function does not exist"   "row violates RLS"
               │                          │
               ▼                          ▼
    Run migration.sql first    ✅ This is GOOD!
                                  RLS is working!
```

### Common Errors & Fixes

**Error:** `function public.jwt_role() does not exist`
**Fix:** Run `migration.sql` first

**Error:** `column "branchId" does not exist`  
**Fix:** Run `migration.sql` (adds columns)

**Error:** `permission denied for schema auth`
**Fix:** Use updated migration.sql (uses public schema)

**Error:** `new row violates row-level security policy`
**Fix:** ✅ This is CORRECT! Your RLS is working!

## 📁 File Reference

```
church-sacco-platform/
├── db/prisma/migrations/001_rls_init/
│   ├── migration.sql          ← Run this FIRST (creates policies)
│   ├── test-roles.sql         ← Run this SECOND (tests everything)
│   ├── TESTING.md             ← Read for step-by-step guide
│   ├── README.md              ← Full documentation
│   ├── QUICKSTART.md          ← Quick troubleshooting
│   └── VISUAL-GUIDE.md        ← This file!
│
└── RLS-TESTING-SUMMARY.md     ← High-level overview
```

## ⏭️ After Testing

Once all tests pass:

```
1. ✅ Migration applied
2. ✅ All tests passed
3. ⏭️ Assign branches to existing members
4. ⏭️ Test with real JWT tokens
5. ⏭️ Create branch management UI
6. ⏭️ Train staff on access levels
```

## 🎓 Quick Reference Card

```
╔═══════════════════════════════════════════════════════════════╗
║                    RLS TESTING CHEAT SHEET                    ║
╠═══════════════════════════════════════════════════════════════╣
║ 1. Run: migration.sql (creates policies)                     ║
║ 2. Run: test-roles.sql (tests everything)                    ║
║ 3. Look for: ✅ symbols and "completed" messages             ║
║ 4. Troubleshoot: Check TESTING.md if errors                  ║
╠═══════════════════════════════════════════════════════════════╣
║ Role Permissions Quick Reference:                            ║
║ • AUDITOR:  Read-only everywhere                             ║
║ • CLERK:    Insert/Select own branch                         ║
║ • MANAGER:  CRUD own branch (no delete transactions)         ║
║ • ADMIN:    Full access everywhere                           ║
║ • MEMBER:   View own records only                            ║
╚═══════════════════════════════════════════════════════════════╝
```

---

## 🚀 Ready to Test!

You now have everything you need to test your Row Level Security implementation!

**Start here:** Open Supabase SQL Editor and run `migration.sql`
**Then:** Run `test-roles.sql` to verify everything works
**Result:** Secure, branch-based access control! 🎉
