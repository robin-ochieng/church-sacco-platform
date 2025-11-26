-- Create Supabase Roles
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role;
  END IF;
END
$$;

-- Create Mock Auth Schema and Functions for Local Dev
CREATE SCHEMA IF NOT EXISTS auth;

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULL::uuid; -- Mock implementation
$$;

CREATE OR REPLACE FUNCTION auth.jwt()
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT '{"role":"anon"}'::jsonb; -- Mock implementation
$$;

CREATE OR REPLACE FUNCTION auth.role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT 'anon'; -- Mock implementation
$$;

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MEMBER', 'TREASURER', 'SECRETARY', 'CHAIRMAN');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'DISBURSED', 'ACTIVE', 'CLOSED', 'REJECTED', 'DEFAULTED');

-- CreateEnum
CREATE TYPE "SavingType" AS ENUM ('REGULAR', 'FIXED', 'EMERGENCY');

-- CreateEnum
CREATE TYPE "ContributionType" AS ENUM ('MONTHLY', 'QUARTERLY', 'ANNUAL', 'SPECIAL');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'MEMBER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Member" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "memberNumber" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "middleName" TEXT,
    "gender" "Gender" NOT NULL DEFAULT 'OTHER',
    "email" TEXT NOT NULL,
    "guardianName" TEXT,
    "idPassportNumber" TEXT NOT NULL,
    "idNumberEncrypted" BYTEA,
    "idLast4" VARCHAR(4),
    "physicalAddress" TEXT NOT NULL,
    "poBox" TEXT,
    "churchGroup" TEXT,
    "telephone" TEXT NOT NULL,
    "phoneEncrypted" BYTEA,
    "phoneLast4" VARCHAR(4),
    "telephoneAlt" TEXT,
    "phoneAltEncrypted" BYTEA,
    "phoneAltLast4" VARCHAR(4),
    "occupation" TEXT,
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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Beneficiary" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "age" INTEGER,
    "relationship" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Beneficiary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Saving" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "type" "SavingType" NOT NULL DEFAULT 'REGULAR',
    "amount" DECIMAL(10,2) NOT NULL,
    "balance" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "interestRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "maturityDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Saving_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Share" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "numberOfShares" INTEGER NOT NULL DEFAULT 0,
    "shareValue" DECIMAL(10,2) NOT NULL,
    "totalValue" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "purchaseDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Share_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Loan" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "loanNumber" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "interestRate" DECIMAL(5,2) NOT NULL,
    "durationMonths" INTEGER NOT NULL,
    "status" "LoanStatus" NOT NULL DEFAULT 'DRAFT',
    "purpose" TEXT NOT NULL,
    "applicationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvalDate" TIMESTAMP(3),
    "disbursementDate" TIMESTAMP(3),
    "balance" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "monthlyPayment" DECIMAL(10,2),
    "monthlyIncome" DECIMAL(10,2) NOT NULL,
    "sourceOfIncome" TEXT NOT NULL,
    "processingFee" DECIMAL(10,2),
    "insuranceFee" DECIMAL(10,2),
    "disbursementMode" TEXT,
    "guarantorName" TEXT,
    "guarantorPhone" TEXT,
    "guarantorNationalId" TEXT,
    "collateralDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "branchId" TEXT,

    CONSTRAINT "Loan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Repayment" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "principalAmount" DECIMAL(10,2) NOT NULL,
    "interestAmount" DECIMAL(10,2) NOT NULL,
    "balanceAfter" DECIMAL(10,2) NOT NULL,
    "paymentMethod" TEXT NOT NULL DEFAULT 'CASH',
    "receiptNumber" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Repayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contribution" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "type" "ContributionType" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "contributionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paymentMethod" TEXT NOT NULL DEFAULT 'CASH',
    "receiptNumber" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contribution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Member_userId_key" ON "Member"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Member_memberNumber_key" ON "Member"("memberNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Member_email_key" ON "Member"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Member_idPassportNumber_key" ON "Member"("idPassportNumber");

-- CreateIndex
CREATE INDEX "Member_idLast4_idx" ON "Member"("idLast4");

-- CreateIndex
CREATE INDEX "Member_phoneLast4_idx" ON "Member"("phoneLast4");

-- CreateIndex
CREATE INDEX "Member_phoneAltLast4_idx" ON "Member"("phoneAltLast4");

-- CreateIndex
CREATE INDEX "Member_nextOfKinPhoneLast4_idx" ON "Member"("nextOfKinPhoneLast4");

-- CreateIndex
CREATE INDEX "Member_memberNumber_idx" ON "Member"("memberNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Loan_loanNumber_key" ON "Loan"("loanNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Repayment_receiptNumber_key" ON "Repayment"("receiptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Contribution_receiptNumber_key" ON "Contribution"("receiptNumber");

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Beneficiary" ADD CONSTRAINT "Beneficiary_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Saving" ADD CONSTRAINT "Saving_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Share" ADD CONSTRAINT "Share_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repayment" ADD CONSTRAINT "Repayment_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contribution" ADD CONSTRAINT "Contribution_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
