import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const BRANCHES = ["branch-a", "branch-b"];
const PASSWORD_HASH =
  "$2b$10$Oqdl2RgCdDz80jBGlMC4EO/5.4vO3n9uxQJ12HcOidSFp6P.CMAb6"; // Password123!

async function main() {
  console.log("🌱 Starting database seed for ACK Thiboro SACCO...");

  // Create admin user
  const adminUser = await prisma.user.upsert({
    where: { email: "admin@ackthiboro.com" },
    update: {
      password: PASSWORD_HASH,
    },
    create: {
      id: "admin-001",
      email: "admin@ackthiboro.com",
      password: PASSWORD_HASH,
      role: "ADMIN",
      isActive: true,
    },
  });

  console.log("✅ Created admin user:", adminUser.email);

  // Create treasurer user (Teller)
  const treasurerUser = await prisma.user.upsert({
    where: { email: "teller@ackthiboro.com" },
    update: {
      password: PASSWORD_HASH,
    },
    create: {
      id: "teller-001",
      email: "teller@ackthiboro.com",
      password: PASSWORD_HASH,
      role: "TREASURER",
      isActive: true,
    },
  });

  console.log("✅ Created treasurer/teller user:", treasurerUser.email);

  // Seed Branches
  for (const branchId of BRANCHES) {
    console.log(`\n📍 Seeding ${branchId}...`);

    for (let i = 1; i <= 8; i++) {
      const memberNum = i + (branchId === "branch-b" ? 8 : 0);
      const paddedNum = memberNum.toString().padStart(3, "0");
      const email = `member${paddedNum}@${branchId}.com`;
      const phone = `+2547${branchId === "branch-a" ? "1" : "2"}${paddedNum.padStart(7, "0")}`; // +254710000001 etc

      // Create User
      const user = await prisma.user.upsert({
        where: { email },
        update: {
          password: PASSWORD_HASH,
        },
        create: {
          id: `user-${branchId}-${paddedNum}`,
          email,
          password: PASSWORD_HASH,
          role: "MEMBER",
          isActive: true,
        },
      });

      // Create Member
      const joiningDate = new Date();
      // Set some members to have joined 6+ months ago (first 4 of each branch)
      if (i <= 4) {
        joiningDate.setMonth(joiningDate.getMonth() - 7);
      }

      const member = await prisma.member.upsert({
        where: { memberNumber: `ACK-${branchId.toUpperCase()}-${paddedNum}` },
        update: {},
        create: {
          id: `member-${branchId}-${paddedNum}`,
          userId: user.id,
          memberNumber: `ACK-${branchId.toUpperCase()}-${paddedNum}`,
          firstName: `Member${paddedNum}`,
          lastName: `${branchId.toUpperCase()}`,
          email,
          telephone: phone,
          idPassportNumber: `ID-${branchId}-${paddedNum}`,
          dateOfBirth: new Date("1990-01-01"),
          physicalAddress: `${branchId} Location`,
          nextOfKinName: `NOK ${paddedNum}`,
          nextOfKinPhone: `+25479${paddedNum.padStart(7, "0")}`,
          nextOfKinRelationship: "Sibling",
          membershipStatus: "ACTIVE",
          branchId: branchId,
          joiningDate: joiningDate,
          registrationFee: 2000,
        },
      });

      // Create Savings Account
      const saving = await prisma.saving.upsert({
        where: { id: `saving-${branchId}-${paddedNum}` },
        update: {
          balance: 0, // Will be updated by transactions loop
        },
        create: {
          id: `saving-${branchId}-${paddedNum}`,
          memberId: member.id,
          type: "REGULAR",
          amount: 0,
          balance: 0,
          branchId: branchId,
          startDate: joiningDate,
        },
      });

      // Generate Transactions (Deposits/Charges) for last 3 months
      // Only for members who joined > 3 months ago (which is the first 4)
      if (i <= 4) {
        const today = new Date();
        let currentBalance = 0;

        // We want transactions for 3 months ago, 2 months ago, 1 month ago
        for (let m = 3; m >= 1; m--) {
          const date = new Date(today);
          date.setMonth(today.getMonth() - m);

          // Deposit
          const depositAmount = 1000;
          currentBalance += depositAmount;

          await prisma.transaction.upsert({
            where: { receiptNumber: `RCP-DEP-${branchId}-${paddedNum}-${m}` },
            update: {},
            create: {
              id: `txn-dep-${branchId}-${paddedNum}-${m}`,
              memberId: member.id,
              branchId: branchId,
              amount: depositAmount,
              type: "SAVINGS_DEPOSIT",
              channel: "CASH",
              status: "POSTED",
              reference: `DEP-${branchId}-${paddedNum}-${m}`,
              receiptNumber: `RCP-DEP-${branchId}-${paddedNum}-${m}`,
              narration: `Monthly Deposit - Month -${m}`,
              valueDate: date,
              balanceAfter: currentBalance,
            },
          });

          // Charge
          const chargeAmount = 50;
          currentBalance -= chargeAmount;

          await prisma.transaction.upsert({
            where: { receiptNumber: `RCP-CHG-${branchId}-${paddedNum}-${m}` },
            update: {},
            create: {
              id: `txn-chg-${branchId}-${paddedNum}-${m}`,
              memberId: member.id,
              branchId: branchId,
              amount: chargeAmount,
              type: "MONTHLY_CHARGE",
              channel: "SYSTEM",
              status: "POSTED",
              reference: `CHG-${branchId}-${paddedNum}-${m}`,
              receiptNumber: `RCP-CHG-${branchId}-${paddedNum}-${m}`,
              narration: `Monthly Charge - Month -${m}`,
              valueDate: date,
              balanceAfter: currentBalance,
            },
          });
        }

        // Update final saving balance
        await prisma.saving.update({
          where: { id: saving.id },
          data: { balance: currentBalance },
        });
      }
    }
  }

  // Create Suspense M-Pesa Messages
  console.log("\n🧩 Creating Suspense M-Pesa Messages...");
  await prisma.mpesaMessage.createMany({
    data: [
      {
        mpesaRef: "SUSPENSE001",
        msisdn: "254712345678", // Unknown number
        amount: 500,
        narrative: "Unknown Payment",
        rawJson: {},
        status: "SUSPENSE",
      },
      {
        mpesaRef: "SUSPENSE002",
        msisdn: "254787654321", // Another unknown number
        amount: 1500,
        narrative: "Erroneous Transfer",
        rawJson: {},
        status: "SUSPENSE",
      },
    ],
    skipDuplicates: true,
  });

  console.log("🎉 ACK Thiboro SACCO database seeded successfully!");
  console.log("\n📋 Demo Credentials:");
  console.log("   Admin: admin@ackthiboro.com / Password123!");
  console.log("   Teller: teller@ackthiboro.com / Password123!");
  console.log(
    "   Members: member001@branch-a.com ... member016@branch-b.com / Password123!",
  );
}

main()
  .catch((e) => {
    console.error("❌ Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
