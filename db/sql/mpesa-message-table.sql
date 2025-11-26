-- 1. Create the Status Enum
CREATE TYPE "MpesaMessageStatus" AS ENUM ('MATCHED', 'SUSPENSE', 'DUPLICATE');

-- 2. Create the MpesaMessage Table
CREATE TABLE "MpesaMessage" (
    "id" TEXT NOT NULL,
    "mpesaRef" TEXT NOT NULL,
    "msisdn" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "narrative" TEXT,
    "rawJson" JSONB NOT NULL,
    "matchedTxnId" TEXT,
    "status" "MpesaMessageStatus" NOT NULL DEFAULT 'SUSPENSE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MpesaMessage_pkey" PRIMARY KEY ("id")
);

-- 3. Create Indexes for Performance
CREATE UNIQUE INDEX "MpesaMessage_mpesaRef_key" ON "MpesaMessage"("mpesaRef");
CREATE INDEX "MpesaMessage_msisdn_idx" ON "MpesaMessage"("msisdn");
CREATE INDEX "MpesaMessage_status_idx" ON "MpesaMessage"("status");
CREATE INDEX "MpesaMessage_createdAt_idx" ON "MpesaMessage"("createdAt");

-- 4. Add Foreign Key to Transaction Table
ALTER TABLE "MpesaMessage" 
ADD CONSTRAINT "MpesaMessage_matchedTxnId_fkey" 
FOREIGN KEY ("matchedTxnId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
