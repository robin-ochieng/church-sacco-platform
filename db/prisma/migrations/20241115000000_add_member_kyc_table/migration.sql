-- CreateTable
CREATE TABLE "MemberKyc" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "idFrontKey" TEXT,
    "idBackKey" TEXT,
    "photoKey" TEXT,
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberKyc_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MemberKyc_memberId_key" ON "MemberKyc"("memberId");

-- CreateIndex
CREATE INDEX "MemberKyc_memberId_idx" ON "MemberKyc"("memberId");

-- AddForeignKey
ALTER TABLE "MemberKyc" ADD CONSTRAINT "MemberKyc_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
