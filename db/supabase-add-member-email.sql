-- Migration: Add email column to Member table
-- Date: 2025-11-11
-- Description: Add email field to Member table to store member email addresses directly

-- Add email column to Member table
ALTER TABLE "Member" 
ADD COLUMN IF NOT EXISTS "email" VARCHAR(255);

-- Add unique constraint on email
ALTER TABLE "Member"
ADD CONSTRAINT "Member_email_key" UNIQUE ("email");

-- Update existing records to use email from User table (if any exist)
UPDATE "Member" m
SET "email" = u.email
FROM "User" u
WHERE m."userId" = u.id
AND m."email" IS NULL;

-- Make email NOT NULL after populating existing records
ALTER TABLE "Member"
ALTER COLUMN "email" SET NOT NULL;

-- Add comment
COMMENT ON COLUMN "Member"."email" IS 'Member email address (same as User email for consistency)';
