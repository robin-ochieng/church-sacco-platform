-- =====================================================
-- KYC Storage Bucket RLS Policies
-- =====================================================
-- This file contains Row Level Security policies for the KYC storage bucket
-- Apply these policies in Supabase Dashboard > SQL Editor
-- OR use the Supabase CLI: supabase db push
-- =====================================================

-- Enable RLS on storage.objects (if not already enabled)
-- Note: This may already be enabled by default in Supabase
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for re-running)
DROP POLICY IF EXISTS "Users can upload their own KYC documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own KYC documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own KYC documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own KYC documents" ON storage.objects;

-- Policy 1: Upload (INSERT)
-- Allows authenticated users to upload files only to their own folder
CREATE POLICY "Users can upload their own KYC documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'kyc' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 2: View (SELECT)
-- Allows authenticated users to view only their own files
CREATE POLICY "Users can view their own KYC documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'kyc' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 3: Update
-- Allows authenticated users to update only their own files
CREATE POLICY "Users can update their own KYC documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'kyc' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 4: Delete
-- Allows authenticated users to delete only their own files
CREATE POLICY "Users can delete their own KYC documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'kyc' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- =====================================================
-- Verification Query
-- =====================================================
-- Run this to verify policies were created successfully:
-- SELECT 
--   schemaname, 
--   tablename, 
--   policyname, 
--   permissive, 
--   roles, 
--   cmd 
-- FROM pg_policies 
-- WHERE tablename = 'objects' 
-- AND schemaname = 'storage'
-- AND policyname LIKE '%KYC%';
