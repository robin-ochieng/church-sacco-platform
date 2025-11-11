-- Row Level Security Policies
-- Add custom RLS policies here for Supabase or similar

-- Example: Enable RLS on users table
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Example: Policy for users to read their own data
-- CREATE POLICY "Users can view own profile" ON users
--   FOR SELECT
--   USING (auth.uid() = id);
