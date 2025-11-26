import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = "robinochieng73@gmail.com";
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (user) {
    console.log(
      `User found: ${user.email}, Role: ${user.role}, Active: ${user.isActive}`,
    );
  } else {
    console.log(`User ${email} not found in the database.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
