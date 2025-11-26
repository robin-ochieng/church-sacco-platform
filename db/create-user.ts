import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = "robinochieng73@gmail.com";
  const password = "Password123!"; // Default password
  // Hash for 'Password123!'
  const hashedPassword =
    "$2b$10$rKZYpZxOGc7vCH3UIxjfme1JEcLxLxHN/xvC3z8yDNWjpHxNxKHx2";

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      password: hashedPassword,
      role: "ADMIN",
      isActive: true,
    },
    create: {
      id: "robin-001",
      email,
      password: hashedPassword,
      role: "ADMIN",
      isActive: true,
    },
  });

  console.log(`✅ User created/updated: ${user.email}`);
  console.log(`🔑 Password: ${password}`);
  console.log(`👤 Role: ${user.role}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
