# Phase 2 — Loan Lifecycle Management

## 🔹 Overview

Phase 2 covers the entire loan lifecycle — from digital loan application and guarantor approval to disbursement, repayment, and schedule management.

All logic reflects the form's policies:

| Policy | Value |
|--------|-------|
| Interest | 12% p.a. (reducing balance) |
| Late penalty | 10% of unpaid balance |
| Processing fee | KES 300 + insurance deducted at issue |
| Repayment start | 30 days after disbursement |
| Top-up eligibility | Allowed at 75% repayment |
| Loan limit | 3 × savings (≤ KES 1.5M) |

---

## Phase 2 — Subtasks & Copilot Prompts

### P2.1 – Loan Application Module (API + UI)

**Goal:** Digitize sections A & B of the form – personal + loan info.

**Copilot prompt:**

> "In apps/backend/src/modules/loans, create LoanController with:
> 
> - POST /loans for new loan application.
> - DTO fields: member_id, loan_amount, purpose, repayment_months, monthly_income, source_income.
> - Validate eligibility: savings ≥ 6 months and loan ≤ 3 × savings (2 × if first loan).
> - Auto-apply processing fee 300 and deduct insurance if mode = 'net'.
> - Status workflow: draft → submitted → under_review → approved → disbursed → active → closed.
> - Tests for eligibility and fee calculations.
> 
> In apps/frontend, build /loans/apply form replicating the paper form fields and validations with Zod."

---

### P2.2 – Guarantor Selection & Digital Approvals (Section D)

**Goal:** Mirror guarantor declaration and signatures.

**Copilot prompt:**

> "Add guarantors table with (id, loan_id, guarantor_member_id, amount_guaranteed, status [pending|approved|declined], signature_key, approved_at).
> 
> Create POST /loans/:id/guarantors to add guarantors and PATCH /loans/:id/guarantors/:gid/approve to digitally approve (OTP or signature image).
> 
> Restrict guarantor eligibility to members ≥ 12 months and shares ≥ guaranteed amount.
> 
> Add e2e tests for approval workflow and exposure limit enforcement.
> 
> On frontend, build 'Select Guarantors' step showing member list + share balances and approval buttons linked to Supabase Auth session."

---

### P2.3 – Loan Approval & Disbursement (Section F – Official Use)

**Goal:** Implement committee approval + funds release logic.

**Copilot prompt:**

> "Extend LoanController with POST /loans/:id/approve and POST /loans/:id/disburse.
> 
> - Approval records approver_id (chairman/secretary/treasurer).
> - Compute net disbursed = gross – (loan_form_fee 300 + insurance + arrears + optional savings/shares deductions).
> - Insert transaction type 'disbursement' with receipt_no.
> - Send M-Pesa B2C stub event (status=pending).
> 
> Add audit entries for each action and unit tests verifying net amount and status transitions."

---

### P2.4 – Repayment Schedule & Computation

**Goal:** Build amortization table + repayment API.

**Copilot prompt:**

> "Create loan_schedules table (id, loan_id, installment_no, due_date, principal_due, interest_due, penalty_due, principal_paid, interest_paid, status).
> 
> Generate schedule on approval: reducing balance, interest 12% p.a. monthly = 1%, repayment starts 30 days post-disbursement.
> 
> Implement service generateSchedule(loan_id) and unit test with fixtures (verify final balance ≈ 0).
> 
> Expose GET /loans/:id/schedule to return breakdown for UI."

---

### P2.5 – Repayment Posting & Allocation

**Goal:** Handle repayments from M-Pesa or manual deposit.

**Copilot prompt:**

> "Add POST /loans/:id/repayments that allocates amount to interest → principal → penalty order, updates loan_schedules, and marks paid when balance ≤ 0.
> 
> Link to existing transactions table (type='repayment').
> 
> Write integration tests for partial and full payments + overpayment carry-forward.
> 
> In frontend /loans/:id, add 'Make Repayment' modal posting to this endpoint."

---

### P2.6 – Interest Accrual & Penalty Jobs

**Goal:** Automate monthly interest + late fees (Section B & policy clauses).

**Copilot prompt:**

> "Add BullMQ processor loan-interest that runs monthly on due instalments: adds interest 1% of remaining principal.
> 
> Add penalty-job that applies 10% of overdue installment amount after 5 days past due.
> 
> Post transactions(type='interest'|'penalty') and log audit entries.
> 
> Add unit tests for both processors with sample loans."

---

### P2.7 – Loan Dashboard (UI + Summary API)

**Goal:** Give members and officers overview of loan status.

**Copilot prompt:**

> "Create GET /loans/summary?member_id returning: active loan balance, amount repaid, next due date, arrears.
> 
> Add aggregation SQL view for efficiency.
> 
> In frontend /dashboard/loans, render cards 'Active Loan', 'Next Payment', 'Guarantor Exposures'.
> 
> Add RTL tests for correct display of values and status colors."

---

### P2.8 – Top-Up Eligibility and Business Rules

**Goal:** Enforce policy 75% repayment before top-up.

**Copilot prompt:**

> "Add service LoanService.checkTopUpEligibility(member_id) that returns true only if current loan principal paid ≥ 75%.
> 
> Expose GET /loans/topup/eligibility for UI.
> 
> Add tests for edge cases (74% → false, 75% → true)."

---

### P2.9 – Digital Signatures & Agreements

**Goal:** Capture applicant and guarantor acknowledgements (Section E & D signatures).

**Copilot prompt:**

> "Integrate Supabase Storage bucket signatures.
> 
> Add PATCH /loans/:id/signatures for applicant/guarantors to upload image or drawn signature via canvas.
> 
> Store keys and timestamp in loan_signatures table (loan_id, party, file_key, signed_at).
> 
> Add PDF generator service LoanAgreementService that merges loan details + signatures into a printable agreement (Puppeteer).
> 
> Test that generated PDF includes applicant and guarantor names/signatures."

---

### P2.10 – Loan Verification & Audit Logging

**Goal:** Ensure audit consistency for every state change.

**Copilot prompt:**

> "Extend audit trigger to capture table=loans actions.
> 
> Add apps/backend/test/loan_audit.spec.ts verifying that each status transition adds audit_log entry (actor, action, before/after).
> 
> Include fields loan_amount, approved_by, disbursed_at in comparison."

---

### P2.11 – Reports & Analytics

**Goal:** Quick loan portfolio KPIs.

**Copilot prompt:**

> "Add GET /reports/loans aggregating: total disbursed, active balance, arrears %, average term, top 5 borrowers, PAR > 30.
> 
> Build admin dashboard page with charts (Recharts) displaying these metrics.
> 
> Add e2e test that returns expected shape and auth guard only for managers."

---

### P2.12 – RLS & Security Verification

**Goal:** Ensure branch/role isolation still holds.

**Copilot prompt:**

> "Extend rls.spec.ts:
> 
> - Clerk(A) can't see loans of Branch B.
> - Guarantor can view only loans they guarantee.
> - Manager has read/write in branch.
> 
> Confirm Supabase policies for loans and guarantors reflect these rules."

---

## ✅ Phase 2 Definition of Done

- [ ] Loan form digitized per official fields (A–E)
- [ ] Guarantors added and digitally approve
- [ ] Loans approved → disbursed with net amount calculation
- [ ] Repayment schedule generated & viewable
- [ ] Repayments post via API and M-Pesa matching
- [ ] Interest & penalties auto-run monthly
- [ ] Member dashboard shows loan progress & arrears
- [ ] Audit trail records all changes and RLS tests pass
