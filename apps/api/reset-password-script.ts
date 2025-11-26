import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = 'robinochieng73@gmail.com';
  const password = 'password'; // Simple password
  
  console.log(`Updating role for ${email} to TREASURER...`);
  
  const user = await prisma.user.update({
    where: { email },
    data: {
      role: 'TREASURER',
    },
  });

  console.log('✅ Role updated successfully.');
  console.log('   Email:', user.email);
  console.log('   Role:', user.role);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
