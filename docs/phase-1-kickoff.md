# Phase 1 - Member Registration & Core Transactions

**Status:** In Progress  
**Branch:** phase-1  
**Start Date:** November 14, 2025  
**Target Completion:** TBD

---

## Phase 1 Goals

### 1. Member Registration with KYC Upload
**Objective:** Enable complete member onboarding with document verification capability.

**Features:**
- ✅ Member registration form (personal details, beneficiaries)
- ✅ KYC document upload (ID, passport, proof of residence)
- ✅ File validation (type, size, sanitization)
- ✅ Secure storage with user isolation (RLS)
- ⏳ Admin approval workflow
- ⏳ Email notifications on status changes

**Acceptance Criteria:**
- [ ] User can register with complete profile information
- [ ] User can upload multiple KYC documents (max 5MB each)
- [ ] System validates file types (PDF, JPG, PNG only)
- [ ] Documents stored securely in Supabase Storage with RLS
- [ ] Admin can view pending registrations
- [ ] Admin can approve/reject with comments
- [ ] Member receives email notification of status change

---

### 2. Cashier Posts Deposit → Receipt PDF with QR
**Objective:** Manual deposit recording by cashiers with automated receipt generation.

**Features:**
- ⏳ Cashier role & permissions
- ⏳ Deposit transaction form (member lookup, amount, type)
- ⏳ Transaction validation (balance checks, limits)
- ⏳ Receipt PDF generation with QR code
- ⏳ Receipt number sequence (auto-increment)
- ⏳ Transaction audit trail

**Acceptance Criteria:**
- [ ] Cashier can search for member by ID/name/phone
- [ ] Cashier can record deposit with amount and transaction type
- [ ] System generates unique receipt number (e.g., SAV-2025-0001)
- [ ] PDF receipt includes:
  - Member details
  - Transaction details (amount, date, type)
  - QR code (transaction verification)
  - Cashier signature/stamp
- [ ] Receipt downloadable and email-able
- [ ] Transaction recorded in database with audit trail
- [ ] Receipt QR code scannable for verification

---

### 3. Member Balance & Statement View
**Objective:** Members can view their account balance and transaction history.

**Features:**
- ⏳ Member dashboard with account summary
- ⏳ Balance display (savings, shares, loans)
- ⏳ Transaction statement (paginated, filterable)
- ⏳ Date range filtering
- ⏳ Transaction type filtering
- ⏳ Export to PDF/CSV

**Acceptance Criteria:**
- [ ] Member sees current balances for all account types
- [ ] Statement shows all transactions in reverse chronological order
- [ ] Statement includes: date, type, description, amount, balance
- [ ] Member can filter by date range (last 7 days, 30 days, 90 days, custom)
- [ ] Member can filter by transaction type (deposits, withdrawals, fees)
- [ ] Member can download statement as PDF
- [ ] Statement pagination works (20 transactions per page)
- [ ] Balance updates reflect immediately after new transactions

---

### 4. Monthly Maintenance Fee (KES 100) - Automated Job
**Objective:** Automated monthly charge with comprehensive audit logging.

**Features:**
- ⏳ Scheduled job (cron) - runs 1st of each month
- ⏳ Fee calculation logic (KES 100 per active member)
- ⏳ Balance check (skip if insufficient funds)
- ⏳ Transaction creation (fee deduction)
- ⏳ Audit logging (success/failure with reasons)
- ⏳ Admin notification summary
- ⏳ Retry mechanism for failures

**Acceptance Criteria:**
- [ ] Job runs automatically on 1st of each month at 00:00 EAT
- [ ] Job charges KES 100 to all active members
- [ ] Job skips members with insufficient balance (< KES 100)
- [ ] Each charge creates a transaction record (type: MAINTENANCE_FEE)
- [ ] Audit log captures:
  - Job execution time
  - Total members processed
  - Successful charges
  - Failed charges (with reasons)
  - Total amount collected
- [ ] Admin receives email summary after job completion
- [ ] Failed charges flagged for manual review
- [ ] Job can be triggered manually via admin interface
- [ ] Job is idempotent (won't charge twice for same month)

---

## Test Matrix

### Unit Tests

| Module | Test Files | Key Test Cases | Status |
|--------|-----------|----------------|--------|
| **Member Registration** | `members.service.spec.ts` | - Create member with beneficiaries<br>- Validate required fields<br>- Handle duplicate detection<br>- PII encryption | ⏳ TODO |
| **KYC Upload** | `storage.service.spec.ts` | - File validation (type, size)<br>- Filename sanitization<br>- Signed URL generation<br>- User isolation | ✅ Done (16/16) |
| **Transaction Service** | `transactions.service.spec.ts` | - Create deposit transaction<br>- Calculate balance<br>- Generate receipt number<br>- Validate transaction types | ⏳ TODO |
| **Receipt Generator** | `receipt.service.spec.ts` | - Generate PDF with correct data<br>- Create QR code<br>- Handle missing data gracefully | ⏳ TODO |
| **Maintenance Fee Job** | `maintenance-fee.job.spec.ts` | - Calculate fees for active members<br>- Skip insufficient balances<br>- Create audit records<br>- Handle errors gracefully | ⏳ TODO |
| **Statement Service** | `statement.service.spec.ts` | - Fetch transactions with pagination<br>- Filter by date range<br>- Filter by type<br>- Calculate running balance | ⏳ TODO |

### Integration Tests

| Feature | Test Files | Key Test Cases | Status |
|---------|-----------|----------------|--------|
| **Member Onboarding** | `member-onboarding.integration.spec.ts` | - Register member → upload KYC → admin approval<br>- Email notifications sent<br>- Status transitions correct | ⏳ TODO |
| **Deposit Flow** | `deposit-flow.integration.spec.ts` | - Cashier posts deposit → receipt generated → member sees balance<br>- Transaction audit created<br>- Receipt QR code valid | ⏳ TODO |
| **Statement Generation** | `statement.integration.spec.ts` | - Multiple transactions → statement shows correct balance<br>- Filtering works across date ranges<br>- PDF export contains all data | ⏳ TODO |
| **Monthly Fee Execution** | `monthly-fee.integration.spec.ts` | - Job runs → fees deducted → audit created → email sent<br>- Insufficient balance handled<br>- Idempotency verified | ⏳ TODO |

### End-to-End (E2E) Tests

| User Journey | Test Files | Key Test Cases | Status |
|--------------|-----------|----------------|--------|
| **New Member Registration** | `member-registration.e2e-spec.ts` | - User fills form → uploads documents → submits<br>- Admin logs in → reviews → approves<br>- User receives email → can log in | ⏳ TODO |
| **Cashier Deposit** | `cashier-deposit.e2e-spec.ts` | - Cashier logs in → searches member → posts deposit<br>- Receipt PDF downloads<br>- Member sees updated balance | ⏳ TODO |
| **Member Dashboard** | `member-dashboard.e2e-spec.ts` | - Member logs in → sees balance → views statement<br>- Filters transactions → exports PDF<br>- PDF contains correct data | ⏳ TODO |
| **Monthly Fee Process** | `monthly-fee.e2e-spec.ts` | - Trigger job manually → verify fees deducted<br>- Check audit log → verify email sent<br>- Member sees fee transaction | ⏳ TODO |

---

## Environment Variables Required

### API Environment (`apps/api/.env`)

```bash
# Database (from Phase 0)
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."

# Supabase (from Phase 0)
SUPABASE_URL="https://xxx.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="eyJ..."
SUPABASE_ANON_KEY="eyJ..."

# Security (from Phase 0)
JWT_SECRET="your-secret-key"
PII_ENCRYPTION_KEY="32-char-hex-key"

# Email Service (NEW - Phase 1)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="notifications@church-sacco.com"
SMTP_PASSWORD="your-app-password"
EMAIL_FROM="Church SACCO <notifications@church-sacco.com>"

# PDF Generation (NEW - Phase 1)
PDF_TEMPLATE_DIR="./templates/pdf"
PDF_OUTPUT_DIR="./storage/receipts"

# Job Scheduler (NEW - Phase 1)
ENABLE_SCHEDULED_JOBS="true"
MAINTENANCE_FEE_AMOUNT="100"
MAINTENANCE_FEE_SCHEDULE="0 0 1 * *"  # 1st of month at 00:00

# Admin Notifications (NEW - Phase 1)
ADMIN_EMAIL="admin@church-sacco.com"
ADMIN_NOTIFICATION_ENABLED="true"

# Storage (from Phase 0)
KYC_BUCKET_NAME="kyc"
MAX_FILE_SIZE_MB="5"
ALLOWED_FILE_TYPES="application/pdf,image/jpeg,image/png"

# Application
NODE_ENV="development"
PORT="4000"
API_PREFIX="/api/v1"
WEB_ORIGIN="http://localhost:3000"
```

### Web Environment (`apps/web/.env.local`)

```bash
# API Connection (from Phase 0)
NEXT_PUBLIC_API_URL="http://localhost:4000/api/v1"
NEXT_PUBLIC_SUPABASE_URL="https://xxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJ..."

# Feature Flags (NEW - Phase 1)
NEXT_PUBLIC_ENABLE_KYC_UPLOAD="true"
NEXT_PUBLIC_ENABLE_STATEMENT_EXPORT="true"
NEXT_PUBLIC_MAX_FILE_SIZE_MB="5"
```

---

## Technical Implementation Plan

### 1. Database Changes

#### New Tables/Fields
```sql
-- Add approval workflow to Member table
ALTER TABLE "Member" 
ADD COLUMN "approvalStatus" TEXT DEFAULT 'PENDING',
ADD COLUMN "approvedBy" INTEGER,
ADD COLUMN "approvedAt" TIMESTAMP,
ADD COLUMN "rejectionReason" TEXT;

-- Transaction types enum update
ALTER TYPE "TransactionType" ADD VALUE 'MAINTENANCE_FEE';

-- Job execution audit table
CREATE TABLE "JobExecution" (
  "id" SERIAL PRIMARY KEY,
  "jobName" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "startedAt" TIMESTAMP NOT NULL,
  "completedAt" TIMESTAMP,
  "totalProcessed" INTEGER,
  "totalSuccessful" INTEGER,
  "totalFailed" INTEGER,
  "totalAmount" DECIMAL(10,2),
  "errorDetails" JSONB,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 2. New Modules/Services

#### Backend (NestJS)
- `TransactionsModule` - Handle all transaction operations
- `TransactionsService` - CRUD for transactions
- `ReceiptService` - PDF generation with QR codes
- `StatementService` - Transaction history with filtering
- `MaintenanceFeeJob` - Scheduled job using `@nestjs/schedule`
- `EmailService` - Send notifications using Nodemailer
- `ApprovalService` - Handle member approval workflow

#### Frontend (Next.js)
- `/register` - Member registration form
- `/kyc-upload` - Document upload interface
- `/dashboard` - Member balance and statement view
- `/admin/approvals` - Admin approval queue
- `/cashier/deposit` - Cashier deposit form
- `/receipt/[id]` - Receipt PDF viewer

### 3. External Dependencies

```json
// Backend (apps/api/package.json)
{
  "@nestjs/schedule": "^4.0.0",         // Cron jobs
  "pdfkit": "^0.13.0",                   // PDF generation
  "qrcode": "^1.5.3",                    // QR code generation
  "nodemailer": "^6.9.0",                // Email sending
  "@nestjs-modules/mailer": "^1.11.0"    // Email templates
}

// Frontend (apps/web/package.json)
{
  "react-dropzone": "^14.2.3",          // File upload UI
  "date-fns": "^2.30.0",                // Date filtering
  "recharts": "^2.10.0"                 // Balance charts (optional)
}
```

---

## Success Metrics

### Functional Metrics
- [ ] Member registration completion rate > 90%
- [ ] KYC document upload success rate > 95%
- [ ] Receipt generation time < 2 seconds
- [ ] Monthly fee job completion rate 100%
- [ ] Zero duplicate charges per month

### Technical Metrics
- [ ] Unit test coverage > 80%
- [ ] Integration tests cover all happy paths
- [ ] E2E tests cover critical user journeys
- [ ] API response time < 500ms (p95)
- [ ] PDF generation < 2s

### Quality Metrics
- [ ] Zero security vulnerabilities (Snyk scan)
- [ ] All TypeScript strict mode enabled
- [ ] ESLint passes with zero errors
- [ ] All RLS policies tested and working

---

## Dependencies & Blockers

### Prerequisites (From Phase 0)
- ✅ Database schema with RLS policies
- ✅ PII encryption enabled (pgcrypto)
- ✅ Audit triggers active
- ✅ Receipt sequences created
- ✅ Storage service with KYC bucket
- ✅ Data access layer standardized (Prisma)

### External Dependencies
- ⏳ SMTP service configuration (Gmail, SendGrid, etc.)
- ⏳ PDF template design
- ⏳ QR code verification endpoint
- ⏳ Admin email list

### Potential Blockers
- Email delivery reliability (SMTP configuration)
- PDF generation performance with large statements
- Job scheduler reliability (server uptime)
- File storage limits (Supabase free tier: 1GB)

---

## Next Steps

### Immediate Actions (Week 1)
1. [ ] Set up email service (Nodemailer + SMTP)
2. [ ] Create transaction schema and migrations
3. [ ] Implement TransactionsService with Prisma
4. [ ] Build member registration API endpoint
5. [ ] Integrate KYC upload with registration flow

### Week 2
1. [ ] Implement receipt PDF generation
2. [ ] Create cashier deposit form (frontend)
3. [ ] Build member dashboard (frontend)
4. [ ] Write unit tests for core services

### Week 3
1. [ ] Implement maintenance fee job
2. [ ] Create admin approval interface
3. [ ] Build statement filtering logic
4. [ ] Write integration tests

### Week 4
1. [ ] E2E testing of full flows
2. [ ] Performance testing (PDF generation, job execution)
3. [ ] Security audit (RLS, file uploads)
4. [ ] Documentation updates

---

## Review & Sign-Off

Before Phase 1 completion:

- [ ] All acceptance criteria met
- [ ] Test matrix fully executed (unit, integration, e2e)
- [ ] Security review passed
- [ ] Performance benchmarks met
- [ ] Documentation complete
- [ ] Deployment runbook created
- [ ] Rollback plan documented

**Phase 1 Owner:** TBD  
**Technical Lead:** TBD  
**QA Lead:** TBD  

---

**Last Updated:** November 14, 2025  
**Next Review:** TBD
