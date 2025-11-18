-- Update password for test user
-- New password: test123
UPDATE "User" SET password = '$2b$10$DMEJQ4m4udjQEFK/w/Xss.eT75HYDed7RgxoReD.50wd2psMSmH1y' 
WHERE email = 'robinochieng73@gmail.com';

-- Verify update
SELECT email, LEFT(password, 30) as password_hash, role FROM "User" WHERE email = 'robinochieng73@gmail.com';
