-- ACK Thiboro SACCO - Update Member table to match registration form (Reg.01A & Reg.01B)
-- Run this in Supabase SQL Editor after the initial schema

-- Add new columns to Member table
ALTER TABLE "Member" 
  ADD COLUMN IF NOT EXISTS "guardianName" TEXT,
  ADD COLUMN IF NOT EXISTS "poBox" TEXT,
  ADD COLUMN IF NOT EXISTS "telephoneAlt" TEXT,
  ADD COLUMN IF NOT EXISTS "passportPhotoUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "refereeName" TEXT,
  ADD COLUMN IF NOT EXISTS "refereePhone" TEXT,
  ADD COLUMN IF NOT EXISTS "refereeSignature" TEXT,
  ADD COLUMN IF NOT EXISTS "witnessName" TEXT,
  ADD COLUMN IF NOT EXISTS "witnessSignature" TEXT,
  ADD COLUMN IF NOT EXISTS "witnessDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "registrationFee" DECIMAL(10,2) DEFAULT 2000.00,
  ADD COLUMN IF NOT EXISTS "memberSignature" TEXT,
  ADD COLUMN IF NOT EXISTS "agreedToTerms" BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS "agreedToRefundPolicy" BOOLEAN DEFAULT false;

-- Rename columns to match form terminology (if they don't exist with new names)
DO $$
BEGIN
  -- Rename nationalId to idPassportNumber
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'Member' AND column_name = 'nationalId') THEN
    ALTER TABLE "Member" RENAME COLUMN "nationalId" TO "idPassportNumber";
  END IF;

  -- Rename address to physicalAddress
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'Member' AND column_name = 'address') THEN
    ALTER TABLE "Member" RENAME COLUMN "address" TO "physicalAddress";
  END IF;

  -- Rename phoneNumber to telephone
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'Member' AND column_name = 'phoneNumber') THEN
    ALTER TABLE "Member" RENAME COLUMN "phoneNumber" TO "telephone";
  END IF;
END $$;

-- Update unique constraint
ALTER TABLE "Member" 
  DROP CONSTRAINT IF EXISTS "Member_nationalId_key";

ALTER TABLE "Member" 
  ADD CONSTRAINT "Member_idPassportNumber_key" UNIQUE ("idPassportNumber");

-- Create Beneficiary table (from Reg.01B)
CREATE TABLE IF NOT EXISTS "Beneficiary" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "age" INTEGER,
    "relationship" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Beneficiary_pkey" PRIMARY KEY ("id")
);

-- Add foreign key for Beneficiary
ALTER TABLE "Beneficiary" 
  ADD CONSTRAINT "Beneficiary_memberId_fkey" 
  FOREIGN KEY ("memberId") REFERENCES "Member"("id") 
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Create index on memberId for better query performance
CREATE INDEX IF NOT EXISTS "Beneficiary_memberId_idx" ON "Beneficiary"("memberId");

SELECT '✅ Member table and Beneficiary table updated to match registration forms!' AS message;
