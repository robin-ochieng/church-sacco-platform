import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed for ACK Thiboro SACCO...');

  // Create admin user
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@ackthiboro.com' },
    update: {},
    create: {
      id: 'admin-001',
      email: 'admin@ackthiboro.com',
      password: '$2b$10$rKZYpZxOGc7vCH3UIxjfme1JEcLxLxHN/xvC3z8yDNWjpHxNxKHx2', // Password123!
      role: 'ADMIN',
      isActive: true,
    },
  });

  console.log('✅ Created admin user:', adminUser.email);

  // Create sample member user
  const memberUser = await prisma.user.upsert({
    where: { email: 'john.kamau@example.com' },
    update: {},
    create: {
      id: 'user-001',
      email: 'john.kamau@example.com',
      password: '$2b$10$rKZYpZxOGc7vCH3UIxjfme1JEcLxLxHN/xvC3z8yDNWjpHxNxKHx2', // Password123!
      role: 'MEMBER',
      isActive: true,
    },
  });

  console.log('✅ Created member user:', memberUser.email);

  // Create member profile
  const member = await prisma.member.upsert({
    where: { memberNumber: 'ACK-001' },
    update: {},
    create: {
      id: 'member-001',
      userId: memberUser.id,
      memberNumber: 'ACK-001',
      firstName: 'John',
      lastName: 'Kamau',
      email: 'john.kamau@example.com',
      telephone: '+254712345678',
      idPassportNumber: '12345678',
      dateOfBirth: new Date('1985-05-15'),
      physicalAddress: 'Thiboro, Nyeri',
      occupation: 'Teacher',
      nextOfKinName: 'Jane Kamau',
      nextOfKinPhone: '+254723456789',
      nextOfKinRelationship: 'Spouse',
      membershipStatus: 'ACTIVE',
    },
  });

  console.log('✅ Created member profile:', member.memberNumber);

  // Create sample saving account
  const saving = await prisma.saving.create({
    data: {
      id: 'saving-001',
      memberId: member.id,
      type: 'REGULAR',
      amount: 5000,
      balance: 5000,
      interestRate: 5.0,
    },
  });

  console.log('✅ Created saving account with balance: KES', saving.balance.toString());

  // Create sample shares
  const shares = await prisma.share.create({
    data: {
      id: 'share-001',
      memberId: member.id,
      numberOfShares: 10,
      shareValue: 1000,
      totalValue: 10000,
    },
  });

  console.log('✅ Created shares:', shares.numberOfShares, 'shares @ KES', shares.shareValue.toString(), 'each');

  console.log('🎉 ACK Thiboro SACCO database seeded successfully!');
  console.log('\n📋 Demo Credentials:');
  console.log('   Admin: admin@ackthiboro.com / Password123!');
  console.log('   Member: john.kamau@example.com / Password123!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
