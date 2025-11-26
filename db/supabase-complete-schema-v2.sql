-- ============================================================================
-- ACK Thiboro SACCO Platform - Complete Schema for Supabase
-- Description: Full database schema including Phase 1 & Phase 2 updates
-- Date: 2025-11-25
-- Version: 2.0
-- ============================================================================

-- This script can be run on a fresh Supabase database or used as reference
-- For existing databases, use supabase-phase2-loan-updates.sql instead

-- --------------------------------------------------------------------------
-- STEP 1: Drop existing tables and types (CAREFUL - THIS DELETES DATA!)
-- --------------------------------------------------------------------------
-- Uncomment the following lines ONLY if you want a fresh start

-- DROP TABLE IF EXISTS "MpesaMessage" CASCADE;
-- DROP TABLE IF EXISTS "Transaction" CASCADE;
-- DROP TABLE IF EXISTS "Contribution" CASCADE;
-- DROP TABLE IF EXISTS "Repayment" CASCADE;
-- DROP TABLE IF EXISTS "Loan" CASCADE;
-- DROP TABLE IF EXISTS "Share" CASCADE;
-- DROP TABLE IF EXISTS "Saving" CASCADE;
-- DROP TABLE IF EXISTS "Beneficiary" CASCADE;
-- DROP TABLE IF EXISTS "MemberKyc" CASCADE;
-- DROP TABLE IF EXISTS "Member" CASCADE;
-- DROP TABLE IF EXISTS "User" CASCADE;

-- DROP TYPE IF EXISTS "MpesaMessageStatus" CASCADE;
-- DROP TYPE IF EXISTS "TransactionChannel" CASCADE;
-- DROP TYPE IF EXISTS "TransactionStatus" CASCADE;
-- DROP TYPE IF EXISTS "TransactionType" CASCADE;
-- DROP TYPE IF EXISTS "ContributionType" CASCADE;
-- DROP TYPE IF EXISTS "LoanStatus" CASCADE;
-- DROP TYPE IF EXISTS "SavingType" CASCADE;
-- DROP TYPE IF EXISTS "Gender" CASCADE;
-- DROP TYPE IF EXISTS "UserRole" CASCADE;

-- --------------------------------------------------------------------------
-- STEP 2: Create Enums (with IF NOT EXISTS pattern)
-- --------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserRole') THEN
    CREATE TYPE "UserRole" AS ENUM (
      'ADMIN', 
      'MEMBER', 
      'TREASURER', 
      'SECRETARY', 
      'CHAIRMAN',
      'CLERK',
      'MANAGER'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Gender') THEN
    CREATE TYPE "Gender" AS ENUM (
      'MALE',
      'FEMALE',
      'OTHER'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LoanStatus') THEN
    CREATE TYPE "LoanStatus" AS ENUM (
      'DRAFT',
      'SUBMITTED',
      'UNDER_REVIEW',
      'APPROVED',
      'DISBURSED',
      'ACTIVE',
      'CLOSED',
      'REJECTED',
      'DEFAULTED'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SavingType') THEN
    CREATE TYPE "SavingType" AS ENUM (
      'REGULAR',
      'FIXED',
      'EMERGENCY'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ContributionType') THEN
    CREATE TYPE "ContributionType" AS ENUM (
      'MONTHLY',
      'QUARTERLY',
      'ANNUAL',
      'SPECIAL'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TransactionType') THEN
    CREATE TYPE "TransactionType" AS ENUM (
      'SAVINGS_DEPOSIT',
      'SHARES_DEPOSIT',
      'SPECIAL_CONTRIBUTION',
      'MAINTENANCE_FEE',
      'MONTHLY_CHARGE',
      'WITHDRAWAL',
      'ADJUSTMENT',
      'LOAN_DISBURSEMENT',
      'LOAN_REPAYMENT'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TransactionStatus') THEN
    CREATE TYPE "TransactionStatus" AS ENUM (
      'PENDING',
      'POSTED',
      'REVERSED'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TransactionChannel') THEN
    CREATE TYPE "TransactionChannel" AS ENUM (
      'CASH',
      'BANK_TRANSFER',
      'MOBILE_MONEY',
      'CHEQUE',
      'SYSTEM'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MpesaMessageStatus') THEN
    CREATE TYPE "MpesaMessageStatus" AS ENUM (
      'MATCHED',
      'SUSPENSE',
      'DUPLICATE'
    );
  END IF;
END
$$;

-- --------------------------------------------------------------------------
-- STEP 3: Create Tables (with IF NOT EXISTS pattern)
-- --------------------------------------------------------------------------

-- User Table
CREATE TABLE IF NOT EXISTS "User" (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role "UserRole" NOT NULL DEFAULT 'MEMBER',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Member Table (Extended with Phase 1 fields)
CREATE TABLE IF NOT EXISTS "Member" (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL UNIQUE,
  "memberNumber" TEXT NOT NULL UNIQUE,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "middleName" TEXT,
  gender "Gender" NOT NULL DEFAULT 'OTHER',
  email TEXT NOT NULL UNIQUE,
  "guardianName" TEXT,
  "idPassportNumber" TEXT NOT NULL UNIQUE,
  "idNumberEncrypted" BYTEA,
  "idLast4" VARCHAR(4),
  "physicalAddress" TEXT NOT NULL,
  "poBox" TEXT,
  "churchGroup" TEXT,
  telephone TEXT NOT NULL,
  "phoneEncrypted" BYTEA,
  "phoneLast4" VARCHAR(4),
  "telephoneAlt" TEXT,
  "phoneAltEncrypted" BYTEA,
  "phoneAltLast4" VARCHAR(4),
  occupation TEXT,
  "employerName" TEXT,
  "employerAddress" TEXT,
  "passportPhotoUrl" TEXT,
  "dateOfBirth" TIMESTAMP(3) NOT NULL,
  "refereeMemberNo" TEXT,
  "refereeName" TEXT,
  "refereePhone" TEXT,
  "refereeSignature" TEXT,
  "nextOfKinName" TEXT NOT NULL,
  "nextOfKinPhone" TEXT NOT NULL,
  "nextOfKinPhoneEncrypted" BYTEA,
  "nextOfKinPhoneLast4" VARCHAR(4),
  "nextOfKinRelationship" TEXT NOT NULL,
  "witnessName" TEXT,
  "witnessSignature" TEXT,
  "witnessDate" TIMESTAMP(3),
  "registrationFee" DECIMAL(10,2) NOT NULL DEFAULT 2000,
  "joiningDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "membershipStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
  "memberSignature" TEXT,
  "branchId" TEXT,
  "verifiedBy" TEXT,
  "verifiedAt" TIMESTAMP(3),
  "agreedToTerms" BOOLEAN NOT NULL DEFAULT false,
  "agreedToRefundPolicy" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT "Member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE
);

-- Beneficiary Table
CREATE TABLE IF NOT EXISTS "Beneficiary" (
  id TEXT PRIMARY KEY,
  "memberId" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  age INTEGER,
  relationship TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT "Beneficiary_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"(id) ON DELETE CASCADE
);

-- MemberKyc Table
CREATE TABLE IF NOT EXISTS "MemberKyc" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "memberId" TEXT NOT NULL UNIQUE,
  "idFrontKey" TEXT,
  "idBackKey" TEXT,
  "photoKey" TEXT,
  "verifiedBy" TEXT,
  "verifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT "MemberKyc_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"(id) ON DELETE CASCADE
);

-- Saving Table
CREATE TABLE IF NOT EXISTS "Saving" (
  id TEXT PRIMARY KEY,
  "memberId" TEXT NOT NULL,
  type "SavingType" NOT NULL DEFAULT 'REGULAR',
  amount DECIMAL(10,2) NOT NULL,
  balance DECIMAL(10,2) NOT NULL DEFAULT 0,
  "interestRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "maturityDate" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "branchId" TEXT,
  
  CONSTRAINT "Saving_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"(id) ON DELETE CASCADE
);

-- Share Table
CREATE TABLE IF NOT EXISTS "Share" (
  id TEXT PRIMARY KEY,
  "memberId" TEXT NOT NULL,
  "numberOfShares" INTEGER NOT NULL DEFAULT 0,
  "shareValue" DECIMAL(10,2) NOT NULL,
  "totalValue" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "purchaseDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "branchId" TEXT,
  
  CONSTRAINT "Share_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"(id) ON DELETE CASCADE
);

-- Loan Table (Updated with Phase 2 fields)
CREATE TABLE IF NOT EXISTS "Loan" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "memberId" TEXT NOT NULL,
  "loanNumber" TEXT NOT NULL UNIQUE,
  amount DECIMAL(10,2) NOT NULL,
  "interestRate" DECIMAL(5,2) NOT NULL,
  "durationMonths" INTEGER NOT NULL,
  status "LoanStatus" NOT NULL DEFAULT 'DRAFT',
  purpose TEXT NOT NULL,
  "applicationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approvalDate" TIMESTAMP(3),
  "disbursementDate" TIMESTAMP(3),
  balance DECIMAL(10,2) NOT NULL DEFAULT 0,
  "monthlyPayment" DECIMAL(10,2),
  
  -- Phase 2: Application Details
  "monthlyIncome" DECIMAL(10,2) NOT NULL,
  "sourceOfIncome" TEXT NOT NULL,
  "processingFee" DECIMAL(10,2),
  "insuranceFee" DECIMAL(10,2),
  "disbursementMode" TEXT,
  
  -- Guarantor Details (Optional at application stage)
  "guarantorName" TEXT,
  "guarantorPhone" TEXT,
  "guarantorNationalId" TEXT,
  "collateralDescription" TEXT,
  
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "branchId" TEXT,
  
  CONSTRAINT "Loan_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"(id) ON DELETE CASCADE
);

-- Repayment Table
CREATE TABLE IF NOT EXISTS "Repayment" (
  id TEXT PRIMARY KEY,
  "loanId" TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "principalAmount" DECIMAL(10,2) NOT NULL,
  "interestAmount" DECIMAL(10,2) NOT NULL,
  "balanceAfter" DECIMAL(10,2) NOT NULL,
  "paymentMethod" TEXT NOT NULL DEFAULT 'CASH',
  "receiptNumber" TEXT NOT NULL UNIQUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "branchId" TEXT,
  
  CONSTRAINT "Repayment_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"(id) ON DELETE CASCADE
);

-- Contribution Table
CREATE TABLE IF NOT EXISTS "Contribution" (
  id TEXT PRIMARY KEY,
  "memberId" TEXT NOT NULL,
  type "ContributionType" NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  "contributionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "paymentMethod" TEXT NOT NULL DEFAULT 'CASH',
  "receiptNumber" TEXT NOT NULL UNIQUE,
  description TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "branchId" TEXT,
  
  CONSTRAINT "Contribution_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"(id) ON DELETE CASCADE
);

-- Transaction Table (Phase 1.3+)
CREATE TABLE IF NOT EXISTS "Transaction" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "memberId" TEXT NOT NULL,
  "cashierId" TEXT,
  "branchId" TEXT,
  amount DECIMAL(12,2) NOT NULL,
  type "TransactionType" NOT NULL,
  channel "TransactionChannel" NOT NULL,
  status "TransactionStatus" NOT NULL DEFAULT 'POSTED',
  reference TEXT,
  narration TEXT,
  "receiptNumber" TEXT UNIQUE,
  "valueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "balanceAfter" DECIMAL(14,2) NOT NULL DEFAULT 0,
  metadata JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT "Transaction_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"(id) ON DELETE CASCADE,
  CONSTRAINT "Transaction_cashierId_fkey" FOREIGN KEY ("cashierId") REFERENCES "User"(id)
);

-- MpesaMessage Table
CREATE TABLE IF NOT EXISTS "MpesaMessage" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "mpesaRef" TEXT NOT NULL UNIQUE,
  msisdn TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  narrative TEXT,
  "rawJson" JSONB NOT NULL,
  "matchedTxnId" TEXT,
  status "MpesaMessageStatus" NOT NULL DEFAULT 'SUSPENSE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT "MpesaMessage_matchedTxnId_fkey" FOREIGN KEY ("matchedTxnId") REFERENCES "Transaction"(id)
);

-- --------------------------------------------------------------------------
-- STEP 4: Create Indexes (with IF NOT EXISTS pattern)
-- --------------------------------------------------------------------------

-- Member indexes
CREATE INDEX IF NOT EXISTS "idx_member_idLast4" ON "Member"("idLast4");
CREATE INDEX IF NOT EXISTS "idx_member_phoneLast4" ON "Member"("phoneLast4");
CREATE INDEX IF NOT EXISTS "idx_member_phoneAltLast4" ON "Member"("phoneAltLast4");
CREATE INDEX IF NOT EXISTS "idx_member_nextOfKinPhoneLast4" ON "Member"("nextOfKinPhoneLast4");
CREATE INDEX IF NOT EXISTS "idx_member_memberNumber" ON "Member"("memberNumber");

-- MemberKyc indexes
CREATE INDEX IF NOT EXISTS "idx_memberKyc_memberId" ON "MemberKyc"("memberId");

-- Loan indexes
CREATE INDEX IF NOT EXISTS "idx_loan_status" ON "Loan"(status);
CREATE INDEX IF NOT EXISTS "idx_loan_memberId" ON "Loan"("memberId");
CREATE INDEX IF NOT EXISTS "idx_loan_branchId" ON "Loan"("branchId");
CREATE INDEX IF NOT EXISTS "idx_loan_applicationDate" ON "Loan"("applicationDate");

-- Transaction indexes
CREATE INDEX IF NOT EXISTS "idx_transaction_memberId" ON "Transaction"("memberId");
CREATE INDEX IF NOT EXISTS "idx_transaction_branchId_valueDate" ON "Transaction"("branchId", "valueDate");

-- MpesaMessage indexes
CREATE INDEX IF NOT EXISTS "idx_mpesa_msisdn" ON "MpesaMessage"(msisdn);
CREATE INDEX IF NOT EXISTS "idx_mpesa_status" ON "MpesaMessage"(status);
CREATE INDEX IF NOT EXISTS "idx_mpesa_createdAt" ON "MpesaMessage"("createdAt");

-- --------------------------------------------------------------------------
-- STEP 5: Create Helpful Views
-- --------------------------------------------------------------------------

-- Loan Summary View
CREATE OR REPLACE VIEW "loan_summary_view" AS
SELECT 
  l.id,
  l."loanNumber",
  l."memberId",
  m."memberNumber",
  m."firstName" || ' ' || m."lastName" AS "memberName",
  l.amount,
  l."interestRate",
  l."durationMonths",
  l.status,
  l.purpose,
  l."monthlyIncome",
  l."sourceOfIncome",
  l."processingFee",
  l."insuranceFee",
  l."disbursementMode",
  l.balance,
  l."monthlyPayment",
  l."applicationDate",
  l."approvalDate",
  l."disbursementDate",
  l."guarantorName",
  l."createdAt",
  l."updatedAt"
FROM "Loan" l
INNER JOIN "Member" m ON l."memberId" = m.id;

-- --------------------------------------------------------------------------
-- Success Message
-- --------------------------------------------------------------------------
SELECT 'ACK Thiboro SACCO complete database schema created successfully!' AS message;
SELECT 'Schema version: 2.0 (includes Phase 1 & Phase 2 updates)' AS version;
