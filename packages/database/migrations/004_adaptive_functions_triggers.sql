-- Migration: Adaptive Testing Functions and Triggers
-- Created: 2025-01-06
-- Description: Enhanced functions and triggers for adaptive testing automation

-- Function: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-update updated_at for test_cases
DROP TRIGGER IF EXISTS update_test_cases_updated_at ON test_cases;
CREATE TRIGGER update_test_cases_updated_at 
    BEFORE UPDATE ON test_cases
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function: Calculate test run duration and update adaptation metrics
CREATE OR REPLACE FUNCTION calculate_test_run_metrics()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculate duration if both timestamps are present
    IF NEW.completed_at IS NOT NULL AND NEW.started_at IS NOT NULL THEN
        NEW.duration_ms = EXTRACT(EPOCH FROM (NEW.completed_at - NEW.started_at)) * 1000;
    END IF;
    
    -- Update step counts from test_steps
    IF NEW.status IN ('completed', 'failed', 'adapted') THEN
        SELECT 
            COUNT(*),
            COUNT(CASE WHEN status = 'success' THEN 1 END),
            COUNT(CASE WHEN status = 'failed' THEN 1 END),
            COUNT(CASE WHEN status = 'adapted' THEN 1 END),
            COUNT(CASE WHEN status = 'skipped' THEN 1 END)
        INTO 
            NEW.total_steps,
            NEW.completed_steps,
            NEW.failed_steps,
            NEW.adapted_steps,
            NEW.skipped_steps
        FROM test_steps 
        WHERE test_run_id = NEW.id;
        
        -- Calculate adaptation count
        SELECT COALESCE(SUM(jsonb_array_length(adaptations)), 0)
        INTO NEW.adaptation_count
        FROM test_steps 
        WHERE test_run_id = NEW.id AND adaptations IS NOT NULL;
        
        -- Calculate recovery attempts
        SELECT COALESCE(SUM(jsonb_array_length(recovery_attempts)), 0)
        INTO NEW.recovery_attempts
        FROM test_steps 
        WHERE test_run_id = NEW.id AND recovery_attempts IS NOT NULL;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-calculate metrics for test_runs
DROP TRIGGER IF EXISTS calculate_test_run_metrics_trigger ON test_runs;
CREATE TRIGGER calculate_test_run_metrics_trigger 
    BEFORE INSERT OR UPDATE ON test_runs
    FOR EACH ROW EXECUTE FUNCTION calculate_test_run_metrics();

-- Function: Calculate test step duration
CREATE OR REPLACE FUNCTION calculate_test_step_duration()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.completed_at IS NOT NULL AND NEW.started_at IS NOT NULL THEN
        NEW.duration_ms = EXTRACT(EPOCH FROM (NEW.completed_at - NEW.started_at)) * 1000;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-calculate duration for test_steps
DROP TRIGGER IF EXISTS calculate_test_step_duration_trigger ON test_steps;
CREATE TRIGGER calculate_test_step_duration_trigger 
    BEFORE INSERT OR UPDATE ON test_steps
    FOR EACH ROW EXECUTE FUNCTION calculate_test_step_duration();

-- Function: Set enhanced storage expiration based on test results and adaptations
CREATE OR REPLACE FUNCTION set_storage_expiration()
RETURNS TRIGGER AS $$
DECLARE
    test_status VARCHAR(20);
    adaptation_count INTEGER;
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
        END CASE;
    END IF;
    
    -- Get test run information for extended retention logic
    IF NEW.test_run_id IS NOT NULL THEN
        SELECT status, COALESCE(tr.adaptation_count, 0)
        INTO test_status, adaptation_count
        FROM test_runs tr
        WHERE id = NEW.test_run_id;
        
        -- Extended retention for failed or adapted tests
        IF test_status = 'failed' OR adaptation_count > 0 THEN
            NEW.expires_at = NEW.expires_at + INTERVAL '60 days';
        END IF;
        
        -- Extra retention for highly adapted tests (learning value)
        IF adaptation_count > 3 THEN
            NEW.expires_at = NEW.expires_at + INTERVAL '30 days';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-set storage expiration
DROP TRIGGER IF EXISTS set_storage_expiration_trigger ON storage_references;
CREATE TRIGGER set_storage_expiration_trigger
    BEFORE INSERT ON storage_references
    FOR EACH ROW EXECUTE FUNCTION set_storage_expiration();

-- Function: Update access tracking on storage retrieval
CREATE OR REPLACE FUNCTION update_storage_access()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_accessed_at = NOW();
    NEW.access_count = OLD.access_count + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Track storage access
DROP TRIGGER IF EXISTS update_storage_access_trigger ON storage_references;
CREATE TRIGGER update_storage_access_trigger
    BEFORE UPDATE OF last_accessed_at ON storage_references
    FOR EACH ROW EXECUTE FUNCTION update_storage_access();

-- Function: Archive expired storage files with smart retention
CREATE OR REPLACE FUNCTION archive_expired_storage()
RETURNS INTEGER AS $$
DECLARE
    archived_count INTEGER;
BEGIN
    WITH archived AS (
        UPDATE storage_references
        SET 
            is_archived = true,
            archived_at = NOW()
        WHERE 
            expires_at < NOW() 
            AND is_archived = false
            AND access_count < 5  -- Keep frequently accessed files
            AND NOT (metadata->>'was_adapted')::boolean  -- Keep adaptation examples
        RETURNING 1
    )
    SELECT COUNT(*) INTO archived_count FROM archived;
    
    RETURN archived_count;
END;
$$ LANGUAGE plpgsql;

-- Function: Update test case reliability score based on execution history
CREATE OR REPLACE FUNCTION update_test_case_reliability()
RETURNS TRIGGER AS $$
DECLARE
    success_rate DECIMAL;
    adaptation_rate DECIMAL;
    total_runs INTEGER;
    reliability DECIMAL;
BEGIN
    -- Only calculate when test run is completed
    IF NEW.status NOT IN ('completed', 'failed', 'adapted') THEN
        RETURN NEW;
    END IF;
    
    -- Calculate success and adaptation rates
    SELECT 
        COUNT(*),
        COUNT(CASE WHEN status = 'completed' THEN 1 END)::DECIMAL / COUNT(*),
        COUNT(CASE WHEN adaptation_count > 0 THEN 1 END)::DECIMAL / COUNT(*)
    INTO 
        total_runs,
        success_rate,
        adaptation_rate
    FROM test_runs 
    WHERE test_case_id = NEW.test_case_id 
    AND status IN ('completed', 'failed', 'adapted');
    
    -- Calculate reliability score (success rate adjusted by adaptation frequency)
    -- High adaptations reduce reliability, but successful adaptations are better than failures
    reliability = CASE 
        WHEN total_runs = 0 THEN 0.00
        WHEN adaptation_rate = 0 THEN success_rate  -- No adaptations needed
        ELSE success_rate * (1 - (adaptation_rate * 0.3))  -- Adaptations reduce score by 30%
    END;
    
    -- Ensure reliability is between 0 and 1
    reliability = GREATEST(0.00, LEAST(1.00, reliability));
    
    -- Update test case reliability score
    UPDATE test_cases 
    SET 
        reliability_score = reliability,
        updated_at = NOW()
    WHERE id = NEW.test_case_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Update reliability score after test completion
DROP TRIGGER IF EXISTS update_test_case_reliability_trigger ON test_runs;
CREATE TRIGGER update_test_case_reliability_trigger
    AFTER UPDATE ON test_runs
    FOR EACH ROW 
    WHEN (NEW.status IS DISTINCT FROM OLD.status)
    EXECUTE FUNCTION update_test_case_reliability();

-- Function: Auto-release container allocation on test completion
CREATE OR REPLACE FUNCTION auto_release_container()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status IN ('completed', 'failed', 'cancelled') AND NEW.container_id IS NOT NULL THEN
        UPDATE container_allocations
        SET 
            status = 'released',
            released_at = NOW()
        WHERE container_id = NEW.container_id AND status = 'active';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-release containers
DROP TRIGGER IF EXISTS auto_release_container_trigger ON test_runs;
CREATE TRIGGER auto_release_container_trigger
    AFTER UPDATE ON test_runs
    FOR EACH ROW 
    WHEN (NEW.status IS DISTINCT FROM OLD.status)
    EXECUTE FUNCTION auto_release_container();

-- Function: Create execution event on step changes
CREATE OR REPLACE FUNCTION create_execution_event()
RETURNS TRIGGER AS $$
DECLARE
    event_type VARCHAR(50);
    event_data JSONB;
    adaptation_data JSONB;
BEGIN
    -- Determine event type based on status change
    event_type = CASE 
        WHEN NEW.status = 'running' AND OLD.status = 'pending' THEN 'step_start'
        WHEN NEW.status = 'success' AND OLD.status = 'running' THEN 'step_complete'
        WHEN NEW.status = 'failed' AND OLD.status = 'running' THEN 'step_error'
        WHEN NEW.status = 'adapted' THEN 'step_adapted'
        ELSE NULL
    END;
    
    -- Only create events for meaningful status changes
    IF event_type IS NOT NULL THEN
        -- Prepare event data
        event_data = jsonb_build_object(
            'stepNumber', NEW.step_number,
            'action', NEW.action,
            'duration', NEW.duration_ms,
            'hasScreenshot', (SELECT COUNT(*) > 0 FROM storage_references 
                            WHERE test_step_id = NEW.id AND file_type = 'screenshot')
        );
        
        -- Include adaptation data if applicable
        IF event_type = 'step_adapted' AND NEW.adaptations IS NOT NULL THEN
            adaptation_data = NEW.adaptations;
        END IF;
        
        -- Insert event
        INSERT INTO test_execution_events (
            test_run_id, 
            test_step_id, 
            event_type, 
            event_data, 
            adaptation,
            message
        ) VALUES (
            NEW.test_run_id,
            NEW.id,
            event_type,
            event_data,
            adaptation_data,
            CASE 
                WHEN event_type = 'step_error' THEN NEW.error_message
                WHEN event_type = 'step_adapted' THEN 'Step adapted due to page state changes'
                ELSE NULL
            END
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Create execution events
DROP TRIGGER IF EXISTS create_execution_event_trigger ON test_steps;
CREATE TRIGGER create_execution_event_trigger
    AFTER UPDATE ON test_steps
    FOR EACH ROW 
    WHEN (NEW.status IS DISTINCT FROM OLD.status)
    EXECUTE FUNCTION create_execution_event();

-- Cleanup job for expired storage (scheduled daily at 2 AM)
SELECT cron.schedule(
    'archive-expired-storage',
    '0 2 * * *',
    'SELECT archive_expired_storage();'
);

-- Cleanup job for old execution events (keep only 30 days)
SELECT cron.schedule(
    'cleanup-old-events',
    '0 3 * * *',
    'DELETE FROM test_execution_events WHERE created_at < NOW() - INTERVAL ''30 days'';'
);

-- Create enhanced views for analytics and reporting
CREATE OR REPLACE VIEW test_execution_summary AS
SELECT 
    tc.id as test_case_id,
    tc.name as test_case_name,
    tc.reliability_score,
    COUNT(DISTINCT tr.id) as total_runs,
    COUNT(DISTINCT CASE WHEN tr.status = 'completed' THEN tr.id END) as successful_runs,
    COUNT(DISTINCT CASE WHEN tr.status = 'failed' THEN tr.id END) as failed_runs,
    COUNT(DISTINCT CASE WHEN tr.adaptation_count > 0 THEN tr.id END) as runs_with_adaptations,
    AVG(tr.duration_ms) as avg_duration_ms,
    AVG(tr.adaptation_count) as avg_adaptations_per_run,
    MAX(tr.created_at) as last_run_at
FROM test_cases tc
LEFT JOIN test_runs tr ON tc.id = tr.test_case_id
GROUP BY tc.id, tc.name, tc.reliability_score;

CREATE OR REPLACE VIEW recent_test_activity AS
SELECT 
    tr.id,
    tc.name as test_name,
    tr.status,
    tr.started_at,
    tr.duration_ms,
    tr.failed_steps,
    tr.total_steps,
    tr.adaptation_count,
    tr.container_id
FROM test_runs tr
JOIN test_cases tc ON tr.test_case_id = tc.id
WHERE tr.created_at > NOW() - INTERVAL '7 days'
ORDER BY tr.created_at DESC;

CREATE OR REPLACE VIEW adaptation_analytics AS
SELECT 
    tc.name as test_case_name,
    ts.action,
    adaptation->>'reason' as adaptation_reason,
    (adaptation->>'confidence')::decimal as confidence_score,
    COUNT(*) as occurrence_count,
    AVG((adaptation->>'confidence')::decimal) as avg_confidence
FROM test_steps ts
JOIN test_runs tr ON ts.test_run_id = tr.id
JOIN test_cases tc ON tr.test_case_id = tc.id,
    jsonb_array_elements(ts.adaptations) as adaptation
WHERE ts.adaptations IS NOT NULL
GROUP BY tc.name, ts.action, adaptation->>'reason', (adaptation->>'confidence')::decimal
ORDER BY occurrence_count DESC;

CREATE OR REPLACE VIEW container_utilization AS
SELECT 
    ca.container_id,
    ca.status,
    ca.allocated_at,
    ca.released_at,
    tr.id as current_test_run_id,
    tc.name as current_test_name,
    EXTRACT(EPOCH FROM (COALESCE(ca.released_at, NOW()) - ca.allocated_at)) / 60 as duration_minutes
FROM container_allocations ca
LEFT JOIN test_runs tr ON ca.test_run_id = tr.id
LEFT JOIN test_cases tc ON tr.test_case_id = tc.id
ORDER BY ca.allocated_at DESC;

CREATE OR REPLACE VIEW storage_usage_summary AS
SELECT 
    sr.file_type,
    sr.bucket_name,
    COUNT(*) as file_count,
    SUM(sr.file_size_bytes) / 1024 / 1024 as total_mb,
    AVG(sr.file_size_bytes) / 1024 as avg_kb,
    COUNT(CASE WHEN sr.is_archived THEN 1 END) as archived_count,
    COUNT(CASE WHEN (sr.metadata->>'was_adapted')::boolean THEN 1 END) as adaptation_files
FROM storage_references sr
GROUP BY sr.file_type, sr.bucket_name
ORDER BY total_mb DESC;