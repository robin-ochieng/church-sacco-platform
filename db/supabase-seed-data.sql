-- ACK Thiboro SACCO - Seed Data
-- Run this in Supabase SQL Editor to populate initial data

-- Insert admin user
INSERT INTO "User" (id, email, password, role, "isActive", "createdAt", "updatedAt")
VALUES (
  'admin-001',
  'admin@ackthiboro.com',
  '$2b$10$rKZYpZxOGc7vCH3UIxjfme1JEcLxLxHN/xvC3z8yDNWjpHxNxKHx2', -- Password123!
  'ADMIN',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (email) DO NOTHING;

-- Insert sample member user
INSERT INTO "User" (id, email, password, role, "isActive", "createdAt", "updatedAt")
VALUES (
  'user-001',
  'robinochieng73@gmail.com',
  '$2b$10$rKZYpZxOGc7vCH3UIxjfme1JEcLxLxHN/xvC3z8yDNWjpHxNxKHx2', -- Password123!
  'MEMBER',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (email) DO NOTHING;

-- Insert member profile (updated field names)
INSERT INTO "Member" (
  id, "userId", "memberNumber", "firstName", "lastName", "telephone", "idPassportNumber",
  "dateOfBirth", "physicalAddress", occupation, "nextOfKinName", "nextOfKinPhone", 
  "nextOfKinRelationship", "joiningDate", "membershipStatus", "registrationFee",
  "agreedToTerms", "agreedToRefundPolicy", "createdAt", "updatedAt"
)
VALUES (
  'member-001',
  'user-001',
  'ACK-001',
  'Robin',
  'Ochieng',
  '+254712345678',
  '12345678',
  '1985-05-15',
  'Thiboro, Nyeri',
  'Teacher',
  'Jane Achieng',
  '+254723456789',
  'Spouse',
  NOW(),
  'ACTIVE',
  2000.00,
  true,
  true,
  NOW(),
  NOW()
)
ON CONFLICT ("memberNumber") DO NOTHING;

-- Insert saving account
INSERT INTO "Saving" (
  id, "memberId", type, amount, balance, "interestRate", "startDate", "createdAt", "updatedAt"
)
VALUES (
  'saving-001',
  'member-001',
  'REGULAR',
  5000.00,
  5000.00,
  5.00,
  NOW(),
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Insert shares
INSERT INTO "Share" (
  id, "memberId", "numberOfShares", "shareValue", "totalValue", "purchaseDate", "createdAt", "updatedAt"
)
VALUES (
  'share-001',
  'member-001',
  10,
  1000.00,
  10000.00,
  NOW(),
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Success message with demo credentials
SELECT 
  '🎉 ACK Thiboro SACCO seed data inserted successfully!' AS message,
  'admin@ackthiboro.com' AS admin_email,
  'robinochieng73@gmail.com' AS member_email,
  'Password123!' AS password_for_both;
