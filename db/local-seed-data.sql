-- Local Database Seed Data
-- Password for both users: Password123!

-- Insert your member user
INSERT INTO "User" (id, email, password, role, "isActive", "createdAt", "updatedAt")
VALUES (
  'user-001',
  'robinochieng73@gmail.com',
  '$2b$10$rKZYpZxOGc7vCH3UIxjfme1JEcLxLxHN/xvC3z8yDNWjpHxNxKHx2',
  'MEMBER',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  password = EXCLUDED.password,
  "updatedAt" = NOW();

-- Insert admin user for testing
INSERT INTO "User" (id, email, password, role, "isActive", "createdAt", "updatedAt")
VALUES (
  'admin-001',
  'admin@ackthiboro.com',
  '$2b$10$rKZYpZxOGc7vCH3UIxjfme1JEcLxLxHN/xvC3z8yDNWjpHxNxKHx2',
  'ADMIN',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  password = EXCLUDED.password,
  "updatedAt" = NOW();

-- Verify users were created
SELECT id, email, role, "isActive" FROM "User";
