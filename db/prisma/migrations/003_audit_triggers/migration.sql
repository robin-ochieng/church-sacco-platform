-- ============================================================================
-- Audit Trail Migration - Comprehensive Change Tracking
-- ============================================================================
-- This migration creates:
-- 1. audit_log table to store all changes
-- 2. Generic trigger function to capture INSERT/UPDATE/DELETE
-- 3. Triggers on all key tables
-- 4. Helper functions to extract JWT claims
-- ============================================================================

-- ============================================================================
-- STEP 1: Create audit_log table
-- ============================================================================
CREATE TABLE IF NOT EXISTS "audit_log" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  row_id TEXT NOT NULL,
  actor TEXT,                    -- User ID from JWT (jwt->>'sub')
  branch_id TEXT,                -- Branch ID from JWT (jwt->>'branch_id')
  action TEXT NOT NULL,          -- INSERT, UPDATE, DELETE
  before_json JSONB,             -- State before change (NULL for INSERT)
  after_json JSONB,              -- State after change (NULL for DELETE)
  changed_fields TEXT[],         -- Array of changed field names (for UPDATE)
  at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_audit_log_table_name ON "audit_log"(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_log_row_id ON "audit_log"(row_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON "audit_log"(actor);
CREATE INDEX IF NOT EXISTS idx_audit_log_branch_id ON "audit_log"(branch_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON "audit_log"(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_at ON "audit_log"(at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_table_row ON "audit_log"(table_name, row_id);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_audit_log_actor_table_at ON "audit_log"(actor, table_name, at DESC);

-- ============================================================================
-- STEP 2: Create helper functions to extract JWT claims
-- ============================================================================

-- Function to get current actor (user ID) from JWT
CREATE OR REPLACE FUNCTION get_current_actor()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  jwt_claims JSONB;
  actor_id TEXT;
BEGIN
  -- Try to get JWT claims from auth context
  BEGIN
    jwt_claims := current_setting('request.jwt.claims', true)::JSONB;
    actor_id := jwt_claims->>'sub';
  EXCEPTION WHEN OTHERS THEN
    actor_id := NULL;
  END;
  
  -- If not available, try to get from custom setting
  IF actor_id IS NULL OR actor_id = '' THEN
    BEGIN
      actor_id := current_setting('app.current_user_id', true);
    EXCEPTION WHEN OTHERS THEN
      actor_id := NULL;
    END;
  END IF;
  
  -- Fallback to session user
  IF actor_id IS NULL OR actor_id = '' THEN
    actor_id := current_user;
  END IF;
  
  RETURN actor_id;
END;
$$;

-- Function to get current branch ID from JWT
CREATE OR REPLACE FUNCTION get_current_branch_id()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  jwt_claims JSONB;
  branch TEXT;
BEGIN
  -- Try to get JWT claims from auth context
  BEGIN
    jwt_claims := current_setting('request.jwt.claims', true)::JSONB;
    branch := jwt_claims->>'branch_id';
  EXCEPTION WHEN OTHERS THEN
    branch := NULL;
  END;
  
  -- If not available, try to get from custom setting
  IF branch IS NULL OR branch = '' THEN
    BEGIN
      branch := current_setting('app.current_branch_id', true);
    EXCEPTION WHEN OTHERS THEN
      branch := NULL;
    END;
  END IF;
  
  RETURN branch;
END;
$$;

-- ============================================================================
-- STEP 3: Create generic audit trigger function
-- ============================================================================
CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  audit_row "audit_log";
  old_data JSONB;
  new_data JSONB;
  changed_fields TEXT[];
  field_name TEXT;
BEGIN
  -- Initialize audit record
  audit_row.id := gen_random_uuid();
  audit_row.table_name := TG_TABLE_NAME;
  audit_row.action := TG_OP;
  audit_row.at := NOW();
  audit_row.actor := get_current_actor();
  audit_row.branch_id := get_current_branch_id();

  -- Handle different operations
  IF TG_OP = 'INSERT' THEN
    -- For INSERT: capture NEW state, determine row_id
    new_data := to_jsonb(NEW);
    audit_row.row_id := COALESCE(
      (new_data->>'id')::TEXT,
      (new_data->>'userId')::TEXT,
      NEW::TEXT
    );
    audit_row.after_json := new_data;
    audit_row.before_json := NULL;
    audit_row.changed_fields := NULL;

  ELSIF TG_OP = 'UPDATE' THEN
    -- For UPDATE: capture OLD and NEW state, calculate changed fields
    old_data := to_jsonb(OLD);
    new_data := to_jsonb(NEW);
    
    audit_row.row_id := COALESCE(
      (new_data->>'id')::TEXT,
      (old_data->>'id')::TEXT,
      (new_data->>'userId')::TEXT,
      (old_data->>'userId')::TEXT,
      NEW::TEXT
    );
    
    audit_row.before_json := old_data;
    audit_row.after_json := new_data;
    
    -- Calculate changed fields
    changed_fields := ARRAY[]::TEXT[];
    FOR field_name IN SELECT jsonb_object_keys(new_data)
    LOOP
      IF old_data->field_name IS DISTINCT FROM new_data->field_name THEN
        changed_fields := array_append(changed_fields, field_name);
      END IF;
    END LOOP;
    audit_row.changed_fields := changed_fields;

  ELSIF TG_OP = 'DELETE' THEN
    -- For DELETE: capture OLD state
    old_data := to_jsonb(OLD);
    audit_row.row_id := COALESCE(
      (old_data->>'id')::TEXT,
      (old_data->>'userId')::TEXT,
      OLD::TEXT
    );
    audit_row.before_json := old_data;
    audit_row.after_json := NULL;
    audit_row.changed_fields := NULL;

  END IF;

  -- Insert audit record
  INSERT INTO "audit_log" (
    id, 
    table_name, 
    row_id, 
    actor, 
    branch_id, 
    action, 
    before_json, 
    after_json, 
    changed_fields, 
    at
  )
  VALUES (
    audit_row.id,
    audit_row.table_name,
    audit_row.row_id,
    audit_row.actor,
    audit_row.branch_id,
    audit_row.action,
    audit_row.before_json,
    audit_row.after_json,
    audit_row.changed_fields,
    audit_row.at
  );

  -- Return appropriate value based on operation
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- ============================================================================
-- STEP 4: Create triggers on key tables
-- ============================================================================

-- Drop existing audit triggers if they exist
DROP TRIGGER IF EXISTS audit_trigger ON "User" CASCADE;
DROP TRIGGER IF EXISTS audit_trigger ON "Member" CASCADE;
DROP TRIGGER IF EXISTS audit_trigger ON "Saving" CASCADE;
DROP TRIGGER IF EXISTS audit_trigger ON "Share" CASCADE;
DROP TRIGGER IF EXISTS audit_trigger ON "Loan" CASCADE;
DROP TRIGGER IF EXISTS audit_trigger ON "Repayment" CASCADE;
DROP TRIGGER IF EXISTS audit_trigger ON "Contribution" CASCADE;
DROP TRIGGER IF EXISTS audit_trigger ON "Beneficiary" CASCADE;

-- User table audit
CREATE TRIGGER audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON "User"
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- Member table audit
CREATE TRIGGER audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON "Member"
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- Saving table audit
CREATE TRIGGER audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON "Saving"
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- Share table audit
CREATE TRIGGER audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON "Share"
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- Loan table audit
CREATE TRIGGER audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON "Loan"
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- Repayment table audit
CREATE TRIGGER audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON "Repayment"
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- Contribution table audit
CREATE TRIGGER audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON "Contribution"
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- Beneficiary table audit
CREATE TRIGGER audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON "Beneficiary"
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- ============================================================================
-- STEP 5: Create helper views for audit queries
-- ============================================================================

-- View to get latest state of each record
CREATE OR REPLACE VIEW "audit_log_latest" AS
SELECT DISTINCT ON (table_name, row_id)
  id,
  table_name,
  row_id,
  actor,
  branch_id,
  action,
  before_json,
  after_json,
  changed_fields,
  at
FROM "audit_log"
ORDER BY table_name, row_id, at DESC;

-- View to get audit trail with user details
CREATE OR REPLACE VIEW "audit_log_with_user" AS
SELECT 
  a.id,
  a.table_name,
  a.row_id,
  a.actor,
  u.email AS actor_email,
  CONCAT(m."firstName", ' ', m."lastName") AS actor_name,
  a.branch_id,
  a.action,
  a.before_json,
  a.after_json,
  a.changed_fields,
  a.at
FROM "audit_log" a
LEFT JOIN "User" u ON u.id = a.actor
LEFT JOIN "Member" m ON m."userId" = u.id;

-- ============================================================================
-- STEP 6: Create helper functions for audit queries
-- ============================================================================

-- Function to get audit trail for a specific record
CREATE OR REPLACE FUNCTION get_audit_trail(
  p_table_name TEXT,
  p_row_id TEXT,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  id UUID,
  actor TEXT,
  action TEXT,
  changed_fields TEXT[],
  before_json JSONB,
  after_json JSONB,
  at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id,
    a.actor,
    a.action,
    a.changed_fields,
    a.before_json,
    a.after_json,
    a.at
  FROM "audit_log" a
  WHERE a.table_name = p_table_name
    AND a.row_id = p_row_id
  ORDER BY a.at DESC
  LIMIT p_limit;
END;
$$;

-- Function to get changes by actor
CREATE OR REPLACE FUNCTION get_audit_by_actor(
  p_actor TEXT,
  p_from_date TIMESTAMPTZ DEFAULT NULL,
  p_to_date TIMESTAMPTZ DEFAULT NULL,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  id UUID,
  table_name TEXT,
  row_id TEXT,
  action TEXT,
  changed_fields TEXT[],
  at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id,
    a.table_name,
    a.row_id,
    a.action,
    a.changed_fields,
    a.at
  FROM "audit_log" a
  WHERE a.actor = p_actor
    AND (p_from_date IS NULL OR a.at >= p_from_date)
    AND (p_to_date IS NULL OR a.at <= p_to_date)
  ORDER BY a.at DESC
  LIMIT p_limit;
END;
$$;

-- Function to reconstruct record state at a specific point in time
CREATE OR REPLACE FUNCTION get_record_at_time(
  p_table_name TEXT,
  p_row_id TEXT,
  p_at TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  result JSONB;
BEGIN
  -- Get the last state before or at the specified time
  SELECT 
    CASE 
      WHEN action = 'DELETE' THEN before_json
      ELSE after_json
    END INTO result
  FROM "audit_log"
  WHERE table_name = p_table_name
    AND row_id = p_row_id
    AND at <= p_at
  ORDER BY at DESC
  LIMIT 1;
  
  RETURN result;
END;
$$;

-- Function to get change summary by table
CREATE OR REPLACE FUNCTION get_audit_summary(
  p_from_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
  p_to_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  table_name TEXT,
  insert_count BIGINT,
  update_count BIGINT,
  delete_count BIGINT,
  total_changes BIGINT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.table_name,
    COUNT(*) FILTER (WHERE a.action = 'INSERT') AS insert_count,
    COUNT(*) FILTER (WHERE a.action = 'UPDATE') AS update_count,
    COUNT(*) FILTER (WHERE a.action = 'DELETE') AS delete_count,
    COUNT(*) AS total_changes
  FROM "audit_log" a
  WHERE a.at >= p_from_date
    AND a.at <= p_to_date
  GROUP BY a.table_name
  ORDER BY total_changes DESC;
END;
$$;

-- ============================================================================
-- STEP 7: Grant appropriate permissions
-- ============================================================================

-- Grant SELECT on audit_log to authenticated users (they can view audit trails)
-- Note: Adjust these based on your RLS policies
GRANT SELECT ON "audit_log" TO authenticated;
GRANT SELECT ON "audit_log_latest" TO authenticated;
GRANT SELECT ON "audit_log_with_user" TO authenticated;

-- Grant EXECUTE on helper functions
GRANT EXECUTE ON FUNCTION get_audit_trail(TEXT, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_audit_by_actor(TEXT, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_record_at_time(TEXT, TEXT, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION get_audit_summary(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- ============================================================================
-- STEP 8: Create RLS policies for audit_log
-- ============================================================================

-- Enable RLS on audit_log
ALTER TABLE "audit_log" ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own audit trail
CREATE POLICY audit_log_view_own ON "audit_log"
  FOR SELECT
  USING (actor = auth.uid()::TEXT OR actor = current_user);

-- Policy: Admins can view all audit trails
CREATE POLICY audit_log_view_admin ON "audit_log"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "User" u
      WHERE u.id = auth.uid()::TEXT
      AND u.role IN ('ADMIN', 'CHAIRMAN')
    )
  );

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these after migration to verify setup:

-- 1. Check audit_log table structure
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'audit_log';

-- 2. Test audit trigger by inserting a test record
-- INSERT INTO "Member" (...) VALUES (...);
-- SELECT * FROM "audit_log" WHERE table_name = 'Member' ORDER BY at DESC LIMIT 1;

-- 3. Test helper functions
-- SELECT * FROM get_audit_trail('Member', 'some-member-id');
-- SELECT * FROM get_audit_summary();

-- ============================================================================
-- DONE!
-- ============================================================================
-- All changes are now being tracked in audit_log
-- Every INSERT/UPDATE/DELETE captures:
--   - Who made the change (actor from JWT)
--   - When it happened (at timestamp)
--   - What changed (before_json, after_json, changed_fields)
--   - Which branch context (branch_id from JWT)
--
-- Use helper functions to:
--   - View audit trail: get_audit_trail(table, id)
--   - Reconstruct history: get_record_at_time(table, id, timestamp)
--   - Get change summary: get_audit_summary()
-- ============================================================================
