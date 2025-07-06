-- Migration: Functions and Triggers
-- Created: 2025-01-05T00:01:00.000Z
-- Description: Add database functions and triggers for automated tasks

-- Function: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger: Auto-update updated_at for test_cases
DROP TRIGGER IF EXISTS update_test_cases_updated_at ON test_cases;
CREATE TRIGGER update_test_cases_updated_at 
    BEFORE UPDATE ON test_cases
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function: Calculate test run duration
CREATE OR REPLACE FUNCTION calculate_test_run_duration()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.completed_at IS NOT NULL AND NEW.started_at IS NOT NULL THEN
        NEW.duration_ms = EXTRACT(EPOCH FROM (NEW.completed_at - NEW.started_at)) * 1000;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger: Auto-calculate duration for test_runs
DROP TRIGGER IF EXISTS calculate_test_run_duration_trigger ON test_runs;
CREATE TRIGGER calculate_test_run_duration_trigger 
    BEFORE INSERT OR UPDATE ON test_runs
    FOR EACH ROW EXECUTE FUNCTION calculate_test_run_duration();

-- Function: Set default expiration for storage files
CREATE OR REPLACE FUNCTION set_storage_expiration()
RETURNS TRIGGER AS $$
BEGIN
    -- Set default expiration based on file type
    IF NEW.expires_at IS NULL THEN
        CASE NEW.file_type
            WHEN 'screenshot' THEN
                NEW.expires_at = NOW() + INTERVAL '30 days';
            WHEN 'video' THEN
                NEW.expires_at = NOW() + INTERVAL '7 days';
            WHEN 'har' THEN
                NEW.expires_at = NOW() + INTERVAL '30 days';
            WHEN 'report' THEN
                NEW.expires_at = NOW() + INTERVAL '90 days';
            ELSE
                NEW.expires_at = NOW() + INTERVAL '30 days';
        END CASE;
    END IF;
    
    -- Extend expiration for failed test runs
    IF EXISTS (
        SELECT 1 FROM test_runs 
        WHERE id = NEW.test_run_id 
        AND status = 'failed'
    ) THEN
        NEW.expires_at = NEW.expires_at + INTERVAL '60 days';
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger: Auto-set storage expiration
DROP TRIGGER IF EXISTS set_storage_expiration_trigger ON storage_references;
CREATE TRIGGER set_storage_expiration_trigger
    BEFORE INSERT ON storage_references
    FOR EACH ROW EXECUTE FUNCTION set_storage_expiration();

-- Function: Archive old storage files
CREATE OR REPLACE FUNCTION archive_expired_storage()
RETURNS void AS $$
BEGIN
    UPDATE storage_references
    SET 
        is_archived = true,
        archived_at = NOW()
    WHERE 
        expires_at < NOW() 
        AND is_archived = false;
END;
$$ language 'plpgsql';

-- Function: Calculate test step duration
CREATE OR REPLACE FUNCTION calculate_test_step_duration()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.completed_at IS NOT NULL AND NEW.started_at IS NOT NULL THEN
        NEW.duration_ms = EXTRACT(EPOCH FROM (NEW.completed_at - NEW.started_at)) * 1000;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger: Auto-calculate duration for test_steps
DROP TRIGGER IF EXISTS calculate_test_step_duration_trigger ON test_steps;
CREATE TRIGGER calculate_test_step_duration_trigger 
    BEFORE INSERT OR UPDATE ON test_steps
    FOR EACH ROW EXECUTE FUNCTION calculate_test_step_duration();

-- Create views for reporting and analytics
CREATE OR REPLACE VIEW test_execution_summary AS
SELECT 
    tc.id as test_case_id,
    tc.name as test_case_name,
    COUNT(DISTINCT tr.id) as total_runs,
    COUNT(DISTINCT CASE WHEN tr.status = 'completed' THEN tr.id END) as successful_runs,
    COUNT(DISTINCT CASE WHEN tr.status = 'failed' THEN tr.id END) as failed_runs,
    AVG(tr.duration_ms) as avg_duration_ms,
    MAX(tr.created_at) as last_run_at
FROM test_cases tc
LEFT JOIN test_runs tr ON tc.id = tr.test_case_id
GROUP BY tc.id, tc.name;

CREATE OR REPLACE VIEW recent_test_activity AS
SELECT 
    tr.id,
    tc.name as test_name,
    tr.status,
    tr.started_at,
    tr.duration_ms,
    tr.failed_steps,
    tr.total_steps
FROM test_runs tr
JOIN test_cases tc ON tr.test_case_id = tc.id
WHERE tr.created_at > NOW() - INTERVAL '7 days'
ORDER BY tr.created_at DESC;