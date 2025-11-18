# Database Architecture

## 🗄️ Overview

The Church SACCO Platform uses **PostgreSQL 15+** as the primary database, hosted on **Supabase Cloud**. The database is designed with security, auditability, and scalability as core principles.

### Implemented Features (Phase 1 Complete)
- ✅ Multi-channel deposits (Cash, M-Pesa, Bank Transfer, Cheque)
- ✅ Automated receipt generation with QR codes
- ✅ Transaction statements with running balance calculation
- ✅ Automated monthly charges (KES 100 per active member)
- ✅ Comprehensive transaction tracking
- ✅ Row-Level Security (RLS) policies

## 📊 Entity Relationship Diagram

```
┌─────────────┐
│    User     │
│  (Auth)     │
│─────────────│
│ id (PK)     │───┐
│ email       │   │
│ password    │   │
│ role        │   │
│ isActive    │   │
└─────────────┘   │ 1:1
                  │
┌─────────────────┼───────────────────────────────────────────┐
│    Member       ▼                                           │
│─────────────────────────────────────────────────────────────│
│ id (PK)                                                     │
│ userId (FK) ──→ User                                        │
│ memberNumber (UNIQUE)                                       │
│ firstName, lastName, middleName                             │
│ email (UNIQUE)                                              │
│ idPassportNumber (UNIQUE)                                   │
│ idNumberEncrypted (BYTEA) ← Encrypted PII                  │
│ idLast4                                                     │
│ phoneEncrypted (BYTEA) ← Encrypted PII                      │
│ phoneLast4                                                  │
│ nextOfKinPhoneEncrypted (BYTEA) ← Encrypted PII            │
│ nextOfKinPhoneLast4                                         │
│ dateOfBirth, physicalAddress                                │
│ membershipStatus (ACTIVE/INACTIVE/SUSPENDED)                │
└─────────────────┬───┬───┬───┬───┬───────────────────────────┘
                  │   │   │   │   │
        ┌─────────┘   │   │   │   └─────────┐
        │ 1:N         │   │   │             │ 1:N
        ▼             │   │   │             ▼
┌──────────────┐      │   │   │      ┌──────────────┐
│ Beneficiary  │      │   │   │      │ Contribution │
│──────────────│      │   │   │      │──────────────│
│ id (PK)      │      │   │   │      │ id (PK)      │
│ memberId (FK)│      │   │   │      │ memberId (FK)│
│ fullName     │      │   │   │      │ type         │
│ relationship │      │   │   │      │ amount       │
└──────────────┘      │   │   │      │ receiptNumber│
                      │   │   │      │ (UNIQUE)     │
                      │   │   │      └──────────────┘
                      │   │   │
                1:N   │   │   │ 1:N
                      ▼   │   ▼
              ┌──────────┐│ ┌──────────┐
              │  Saving  ││ │  Share   │
              │──────────││ │──────────│
              │ id (PK)  ││ │ id (PK)  │
              │memberId  ││ │memberId  │
              │ type     ││ │ numShares│
              │ amount   ││ │shareValue│
              │ balance  ││ │totalValue│
              └──────────┘│ └──────────┘
                          │
                    1:N   │
                          ▼
                  ┌────────────┐
                  │    Loan    │
                  │────────────│
                  │ id (PK)    │
                  │ memberId   │───┐
                  │ loanNumber │   │ 1:N
                  │ amount     │   │
                  │ balance    │   │
                  │ status     │   │
                  │ purpose    │   │
                  └────────────┘   │
                                   ▼
                            ┌──────────────┐
                            │  Repayment   │
                            │──────────────│
                            │ id (PK)      │
                            │ loanId (FK)  │
                            │ amount       │
                            │ principal    │
                            │ interest     │
                            │receiptNumber │
                            │ (UNIQUE)     │
                            └──────────────┘
```

## 📋 Core Tables

### 1. User (Authentication)

```sql
CREATE TABLE "User" (
  id        TEXT PRIMARY KEY,
  email     TEXT UNIQUE NOT NULL,
  password  TEXT NOT NULL,
  role      TEXT DEFAULT 'MEMBER',
  isActive  BOOLEAN DEFAULT TRUE,
  createdAt TIMESTAMPTZ DEFAULT NOW(),
  updatedAt TIMESTAMPTZ DEFAULT NOW()
);
```

**Purpose:** Authentication and authorization  
**Key Features:**

- Role-based access (ADMIN, MEMBER, TREASURER, SECRETARY, CHAIRMAN)
- Managed by Supabase Auth
- 1:1 relationship with Member

### 2. Member (Core Profile)

```sql
CREATE TABLE "Member" (
  id                      TEXT PRIMARY KEY,
  userId                  TEXT UNIQUE NOT NULL REFERENCES "User"(id),
  memberNumber            TEXT UNIQUE NOT NULL,
  firstName               TEXT NOT NULL,
  lastName                TEXT NOT NULL,
  email                   TEXT UNIQUE NOT NULL,

  -- PII Encrypted Fields
  idPassportNumber        TEXT UNIQUE NOT NULL,
  idNumberEncrypted       BYTEA,
  idLast4                 VARCHAR(4),
  phoneEncrypted          BYTEA,
  phoneLast4              VARCHAR(4),
  nextOfKinPhoneEncrypted BYTEA,
  nextOfKinPhoneLast4     VARCHAR(4),

  -- Personal Information
  dateOfBirth             TIMESTAMPTZ NOT NULL,
  physicalAddress         TEXT NOT NULL,
  occupation              TEXT,
  membershipStatus        TEXT DEFAULT 'ACTIVE',

  -- Timestamps
  joiningDate             TIMESTAMPTZ DEFAULT NOW(),
  createdAt               TIMESTAMPTZ DEFAULT NOW(),
  updatedAt               TIMESTAMPTZ DEFAULT NOW(),

  -- Indexes for encrypted search
  CONSTRAINT idx_id_last4 CREATE INDEX ON (idLast4),
  CONSTRAINT idx_phone_last4 CREATE INDEX ON (phoneLast4)
);
```

**Purpose:** Member profile and personal information  
**Key Features:**

- PII encryption for sensitive data
- Last 4 digits for search/display
- Member number for identification
- Multiple phone numbers supported

### 3. Beneficiary (Next of Kin)

```sql
CREATE TABLE "Beneficiary" (
  id           TEXT PRIMARY KEY,
  memberId     TEXT NOT NULL REFERENCES "Member"(id),
  fullName     TEXT NOT NULL,
  age          INTEGER,
  relationship TEXT NOT NULL,
  createdAt    TIMESTAMPTZ DEFAULT NOW(),
  updatedAt    TIMESTAMPTZ DEFAULT NOW()
);
```

**Purpose:** Track member beneficiaries  
**Key Features:**

- Multiple beneficiaries per member
- Required for member registration

### 4. Saving

```sql
CREATE TABLE "Saving" (
  id           TEXT PRIMARY KEY,
  memberId     TEXT NOT NULL REFERENCES "Member"(id),
  type         TEXT DEFAULT 'REGULAR',
  amount       DECIMAL(10,2) NOT NULL,
  balance      DECIMAL(10,2) DEFAULT 0,
  interestRate DECIMAL(5,2) DEFAULT 0,
  startDate    TIMESTAMPTZ DEFAULT NOW(),
  maturityDate TIMESTAMPTZ,
  createdAt    TIMESTAMPTZ DEFAULT NOW(),
  updatedAt    TIMESTAMPTZ DEFAULT NOW()
);
```

**Purpose:** Member savings accounts  
**Key Features:**

- Multiple saving types (REGULAR, FIXED, EMERGENCY)
- Interest rate tracking
- Maturity date for fixed deposits

### 5. Share

```sql
CREATE TABLE "Share" (
  id             TEXT PRIMARY KEY,
  memberId       TEXT NOT NULL REFERENCES "Member"(id),
  numberOfShares INTEGER DEFAULT 0,
  shareValue     DECIMAL(10,2) NOT NULL,
  totalValue     DECIMAL(10,2) DEFAULT 0,
  purchaseDate   TIMESTAMPTZ DEFAULT NOW(),
  createdAt      TIMESTAMPTZ DEFAULT NOW(),
  updatedAt      TIMESTAMPTZ DEFAULT NOW()
);
```

**Purpose:** Share capital management  
**Key Features:**

- Track share purchases
- Automatic total value calculation

### 6. Loan

```sql
CREATE TABLE "Loan" (
  id                    TEXT PRIMARY KEY,
  memberId              TEXT NOT NULL REFERENCES "Member"(id),
  loanNumber            TEXT UNIQUE NOT NULL,
  amount                DECIMAL(10,2) NOT NULL,
  interestRate          DECIMAL(5,2) NOT NULL,
  durationMonths        INTEGER NOT NULL,
  status                TEXT DEFAULT 'PENDING',
  purpose               TEXT NOT NULL,
  applicationDate       TIMESTAMPTZ DEFAULT NOW(),
  approvalDate          TIMESTAMPTZ,
  disbursementDate      TIMESTAMPTZ,
  balance               DECIMAL(10,2) NOT NULL,
  monthlyPayment        DECIMAL(10,2) NOT NULL,
  guarantorName         TEXT NOT NULL,
  guarantorPhone        TEXT NOT NULL,
  guarantorNationalId   TEXT NOT NULL,
  collateralDescription TEXT,
  createdAt             TIMESTAMPTZ DEFAULT NOW(),
  updatedAt             TIMESTAMPTZ DEFAULT NOW()
);
```

**Purpose:** Loan management  
**Key Features:**

- Workflow states (PENDING → APPROVED → DISBURSED → REPAYING → COMPLETED)
- Guarantor information
- Interest calculation
- Payment schedule

### 7. Repayment

```sql
CREATE TABLE "Repayment" (
  id              TEXT PRIMARY KEY,
  loanId          TEXT NOT NULL REFERENCES "Loan"(id),
  amount          DECIMAL(10,2) NOT NULL,
  paymentDate     TIMESTAMPTZ DEFAULT NOW(),
  principalAmount DECIMAL(10,2) NOT NULL,
  interestAmount  DECIMAL(10,2) NOT NULL,
  balanceAfter    DECIMAL(10,2) NOT NULL,
  paymentMethod   TEXT DEFAULT 'CASH',
  receiptNumber   TEXT UNIQUE NOT NULL,  -- Auto-generated
  createdAt       TIMESTAMPTZ DEFAULT NOW(),
  updatedAt       TIMESTAMPTZ DEFAULT NOW()
);
```

**Purpose:** Loan repayment tracking  
**Key Features:**

- Automatic receipt generation
- Principal/interest breakdown
- Payment method tracking

### 8. Contribution

```sql
CREATE TABLE "Contribution" (
  id               TEXT PRIMARY KEY,
  memberId         TEXT NOT NULL REFERENCES "Member"(id),
  type             TEXT NOT NULL,
  amount           DECIMAL(10,2) NOT NULL,
  contributionDate TIMESTAMPTZ DEFAULT NOW(),
  paymentMethod    TEXT DEFAULT 'CASH',
  receiptNumber    TEXT UNIQUE NOT NULL,  -- Auto-generated
  description      TEXT,
  createdAt        TIMESTAMPTZ DEFAULT NOW(),
  updatedAt        TIMESTAMPTZ DEFAULT NOW()
);
```

**Purpose:** Member contributions  
**Key Features:**

- Multiple contribution types (MONTHLY, QUARTERLY, ANNUAL, SPECIAL)
- Automatic receipt generation
- Payment method tracking

## 🔐 Security Tables

### 9. audit_log (Audit Trail)

```sql
CREATE TABLE "audit_log" (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name     TEXT NOT NULL,
  row_id         TEXT NOT NULL,
  actor          TEXT,              -- User ID from JWT
  branch_id      TEXT,              -- Branch ID from JWT
  action         TEXT NOT NULL,     -- INSERT, UPDATE, DELETE
  before_json    JSONB,             -- State before change
  after_json     JSONB,             -- State after change
  changed_fields TEXT[],            -- Array of changed fields
  at             TIMESTAMPTZ DEFAULT NOW(),

  -- Indexes
  INDEX idx_audit_log_table_name (table_name),
  INDEX idx_audit_log_row_id (row_id),
  INDEX idx_audit_log_actor (actor),
  INDEX idx_audit_log_at (at DESC)
);
```

**Purpose:** Complete audit trail of all changes  
**Key Features:**

- Before/after snapshots in JSONB
- Track actor and branch context
- Changed fields for UPDATE operations
- Point-in-time reconstruction

### 10. receipt_sequences (Receipt Management)

```sql
CREATE TABLE "receipt_sequences" (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id            TEXT NOT NULL,
  year_month           TEXT NOT NULL,      -- YYYYMM format
  last_sequence_number INTEGER DEFAULT 0,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(branch_id, year_month)
);
```

**Purpose:** Track receipt number sequences  
**Key Features:**

- Branch-specific sequences
- Monthly reset
- Concurrency-safe increments
- Format: `BR{branch}-YYYYMM-{NNNNN}`

## 🔒 Security Features

### Row-Level Security (RLS)

PostgreSQL RLS policies enforce data access at the database level:

```sql
-- Example: Members can only view their own data
CREATE POLICY member_view_own ON "Member"
  FOR SELECT
  USING (userId = auth.uid()::TEXT);

-- Example: Admins can view all data
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

### PII Encryption

Sensitive data encrypted using pgcrypto:

```sql
-- Encryption function
CREATE FUNCTION enc(data TEXT, key TEXT)
RETURNS BYTEA AS $$
BEGIN
  RETURN pgp_sym_encrypt(data, key, 'cipher-algo=aes256');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Decryption function
CREATE FUNCTION dec(data BYTEA, key TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN pgp_sym_decrypt(data, key);
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Encrypted Fields:**

- ID/Passport numbers
- Phone numbers (all types)
- Next of kin phone numbers

**Search Strategy:**

- Store last 4 digits for display/search
- Full decryption requires encryption key

## 🔄 Database Triggers

### 1. PII Encryption Triggers

Automatically encrypt PII on INSERT/UPDATE:

```sql
CREATE TRIGGER member_encrypt_pii
  BEFORE INSERT OR UPDATE ON "Member"
  FOR EACH ROW
  EXECUTE FUNCTION encrypt_member_pii();
```

### 2. Audit Triggers

Capture all changes automatically:

```sql
CREATE TRIGGER audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON "Member"
  FOR EACH ROW
  EXECUTE FUNCTION audit_trigger_func();
```

### 3. Receipt Generation Triggers

Auto-generate receipt numbers:

```sql
CREATE TRIGGER repayment_receipt_trigger
  BEFORE INSERT ON "Repayment"
  FOR EACH ROW
  EXECUTE FUNCTION repayment_generate_receipt_trigger();
```

### 4. Immutability Triggers

Prevent modification of critical fields:

```sql
CREATE TRIGGER repayment_receipt_immutable
  BEFORE UPDATE ON "Repayment"
  FOR EACH ROW
  EXECUTE FUNCTION prevent_receipt_update_trigger();
```

## 📈 Indexes

### Performance Indexes

```sql
-- Member search indexes
CREATE INDEX idx_member_number ON "Member"(memberNumber);
CREATE INDEX idx_member_email ON "Member"(email);
CREATE INDEX idx_member_status ON "Member"(membershipStatus);

-- Financial indexes
CREATE INDEX idx_loan_status ON "Loan"(status);
CREATE INDEX idx_loan_member ON "Loan"(memberId);
CREATE INDEX idx_repayment_loan ON "Repayment"(loanId);
CREATE INDEX idx_repayment_date ON "Repayment"(paymentDate DESC);

-- Receipt indexes
CREATE INDEX idx_repayment_receipt ON "Repayment"(receiptNumber);
CREATE INDEX idx_contribution_receipt ON "Contribution"(receiptNumber);

-- Audit log indexes
CREATE INDEX idx_audit_table_row ON "audit_log"(table_name, row_id);
CREATE INDEX idx_audit_actor_at ON "audit_log"(actor, at DESC);
```

## 📊 Database Views

### 1. MemberWithDecryptedPII

Decrypt PII for authorized access:

```sql
CREATE VIEW "MemberWithDecryptedPII" AS
SELECT
  m.*,
  dec(m.idNumberEncrypted, current_setting('pii.encryption_key')) AS idNumberDecrypted,
  dec(m.phoneEncrypted, current_setting('pii.encryption_key')) AS phoneDecrypted,
  dec(m.nextOfKinPhoneEncrypted, current_setting('pii.encryption_key')) AS nextOfKinPhoneDecrypted
FROM "Member" m;
```

### 2. receipt_audit_view

Unified view of all receipts:

```sql
CREATE VIEW "receipt_audit_view" AS
SELECT
  'Repayment' AS source_table,
  r.receiptNumber,
  r.amount,
  r.paymentDate AS transaction_date,
  m.memberNumber,
  m.firstName || ' ' || m.lastName AS member_name
FROM "Repayment" r
JOIN "Loan" l ON l.id = r.loanId
JOIN "Member" m ON m.id = l.memberId

UNION ALL

SELECT
  'Contribution' AS source_table,
  c.receiptNumber,
  c.amount,
  c.contributionDate AS transaction_date,
  m.memberNumber,
  m.firstName || ' ' || m.lastName AS member_name
FROM "Contribution" c
JOIN "Member" m ON m.id = c.memberId;
```

### 3. audit_log_with_user

Audit log with user details:

```sql
CREATE VIEW "audit_log_with_user" AS
SELECT
  a.*,
  u.email AS actor_email,
  m.firstName || ' ' || m.lastName AS actor_name
FROM "audit_log" a
LEFT JOIN "User" u ON u.id = a.actor
LEFT JOIN "Member" m ON m.userId = u.id;
```

## 🔄 Migrations

### Migration Strategy

1. **001_rls_init** - Row-level security policies
2. **002_pgcrypto_pii** - PII encryption system
3. **003_audit_triggers** - Audit trail system
4. **004_receipt_sequences** - Receipt numbering system

### Migration Files Location

```
db/prisma/migrations/
├── 001_rls_init/
│   └── migration.sql
├── 002_pgcrypto_pii/
│   └── migration.sql
├── 003_audit_triggers/
│   └── migration.sql
└── 004_receipt_sequences/
    └── migration.sql
```

## 📊 Database Statistics

### Estimated Row Counts (Production Scale)

| Table        | Small SACCO | Medium SACCO | Large SACCO |
| ------------ | ----------- | ------------ | ----------- |
| User         | 100         | 1,000        | 10,000      |
| Member       | 100         | 1,000        | 10,000      |
| Beneficiary  | 200         | 2,000        | 20,000      |
| Saving       | 100         | 1,000        | 10,000      |
| Share        | 100         | 1,000        | 10,000      |
| Loan         | 50          | 500          | 5,000       |
| Repayment    | 500         | 10,000       | 100,000     |
| Contribution | 1,000       | 20,000       | 200,000     |
| audit_log    | 10,000      | 100,000      | 1,000,000   |
| receipt_seq  | 12          | 120          | 1,200       |

## 🔧 Database Maintenance

### Backup Strategy

- **Daily backups** - Automated via Supabase
- **Point-in-time recovery** - 7-day window
- **Manual backups** - Before major migrations

### Monitoring

- Query performance monitoring
- Connection pool monitoring
- Disk space monitoring
- Slow query logging

### Optimization

- Regular VACUUM operations
- Index maintenance
- Query plan analysis
- Statistics updates

## 📖 Database Functions Reference

### PII Functions

- `enc(data, key)` - Encrypt data
- `dec(data, key)` - Decrypt data
- `get_last4(data)` - Extract last 4 characters
- `mask_last4(data)` - Mask with asterisks

### Audit Functions

- `get_audit_trail(table, id)` - Get record history
- `get_audit_by_actor(actor)` - Get user's changes
- `get_record_at_time(table, id, timestamp)` - Point-in-time reconstruction
- `get_audit_summary()` - Change statistics

### Receipt Functions

- `generate_receipt_number(branch)` - Generate receipt
- `get_current_receipt_sequence(branch, month)` - Get current sequence
- `validate_receipt_number(receipt)` - Validate format
- `parse_receipt_number(receipt)` - Parse components

---

_Document Version: 1.0_  
_Last Updated: January 12, 2025_  
_Status: ✅ Active_
