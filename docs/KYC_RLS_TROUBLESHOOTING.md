# Applying KYC Storage RLS Policies - Troubleshooting Guide

## The Problem

When running RLS policies from the SQL Editor, you may get this error:

```
ERROR: 42501: must be owner of table objects
```

This happens because the SQL Editor runs queries with your user's permissions, not as the database owner.

## Solutions (Choose One)

### Solution 1: Use Supabase Dashboard Storage Policies UI (Recommended)

This is the easiest method and doesn't require superuser privileges.

1.  **Go to Supabase Dashboard**: [https://app.supabase.com](https://app.supabase.com)
2.  Select your project
3.  Navigate to **Storage** in left sidebar
4.  Click on the **Policies** tab (at the top, next to Configuration)
5.  You should see "storage.objects" table
6.  Click **"New Policy"** button

**For EACH of the 4 policies below:**

#### Policy 1: INSERT (Upload)

-   Click **"Create a policy"**
-   Choose **"Create policy from scratch"** or **"For full customization"**
-   Fill in:
    -   **Policy name**: `Users can upload their own KYC documents`
    -   **Allowed operation**: `INSERT`
    -   **Target roles**: `authenticated`
    -   **USING expression**: Leave blank (not needed for INSERT)
    -   **WITH CHECK expression**:
        
        ```sql
        bucket_id = 'kyc' AND (storage.foldername(name))[1] = auth.uid()::text
        ```
        

#### Policy 2: SELECT (View)

-   **Policy name**: `Users can view their own KYC documents`
-   **Allowed operation**: `SELECT`
-   **Target roles**: `authenticated`
-   **USING expression**:
    
    ```sql
    bucket_id = 'kyc' AND (storage.foldername(name))[1] = auth.uid()::text
    ```
    
-   **WITH CHECK expression**: Leave blank

#### Policy 3: UPDATE

-   **Policy name**: `Users can update their own KYC documents`
-   **Allowed operation**: `UPDATE`
-   **Target roles**: `authenticated`
-   **USING expression**:
    
    ```sql
    bucket_id = 'kyc' AND (storage.foldername(name))[1] = auth.uid()::text
    ```
    

#### Policy 4: DELETE

-   **Policy name**: `Users can delete their own KYC documents`
-   **Allowed operation**: `DELETE`
-   **Target roles**: `authenticated`
-   **USING expression**:
    
    ```sql
    bucket_id = 'kyc' AND (storage.foldername(name))[1] = auth.uid()::text
    ```
    

### Solution 2: Use Supabase CLI with Migration

If you have Supabase CLI installed and linked to your project:

1.  **Create migration file**:
    
    ```powershell
    cd dbsupabase migration new kyc_storage_rls_policies
    ```
    
2.  **Copy the SQL** from `db/sql/kyc-storage-rls-policies.sql` into the generated migration file
    
3.  **Apply migration**:
    
    ```powershell
    supabase db push
    ```
    

### Solution 3: Request Supabase to Run SQL

If the Storage UI doesn't work and you don't have CLI access:

1.  Go to **SQL Editor**
    
2.  Try running just the policy creation (without ALTER TABLE):
    
    ```sql
    -- Skip the ALTER TABLE line-- Just run the CREATE POLICY statementsCREATE POLICY "Users can upload their own KYC documents"ON storage.objects FOR INSERTTO authenticatedWITH CHECK (  bucket_id = 'kyc' AND  (storage.foldername(name))[1] = auth.uid()::text);-- Repeat for other 3 policies...
    ```
    
3.  If that still fails, contact Supabase support or check if RLS is already enabled
    

### Solution 4: Check if RLS is Already Enabled

RLS might already be enabled. Check by running:

```sql
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'storage' AND tablename = 'objects';
```

If `rowsecurity = true`, skip the `ALTER TABLE` command and just run the `CREATE POLICY` statements.

## Verification

After applying policies, verify they exist:

```sql
SELECT   schemaname,   tablename,   policyname,   permissive,   roles,   cmd FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage'ORDER BY policyname;
```

You should see your 4 KYC policies listed.

## Testing the Policies

Test from your Next.js app or browser console:

```javascript
// This should work (uploading to own folder)const { data, error } = await supabase.storage  .from('kyc')  .upload(`${user.id}/test.jpg`, file);console.log('Upload result:', { data, error });// This should fail (trying to access another user's file)const { data: downloadData, error: downloadError } = await supabase.storage  .from('kyc')  .download('some-other-user-id/file.jpg');console.log('Should fail:', downloadError); // Should show permission error
```

## Why the Permissions Error Occurs

-   **Supabase SQL Editor** runs with your project's `postgres` role
-   **Storage policies** require modifications to system tables owned by `supabase_storage_admin`
-   **Storage UI** uses internal APIs that have proper permissions
-   **Supabase CLI** connects with elevated privileges

## Summary

**Best approach**: Use the **Storage → Policies UI** in Supabase Dashboard. It's designed specifically for this purpose and handles permissions correctly.

The SQL file (`db/sql/kyc-storage-rls-policies.sql`) is kept for documentation and reference purposes.