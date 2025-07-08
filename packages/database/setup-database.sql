-- Cinnamon-QA Database Setup
-- This file combines all migrations for easy execution in Supabase SQL Editor
-- Created: 2025-01-08

-- =====================================================
-- Migration 001: Initial Schema
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Migration tracking table
CREATE TABLE IF NOT EXISTS schema_migrations (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    executed_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- Migration 003: Adaptive Testing Schema
-- =====================================================

-- Drop existing tables (reverse dependency order)
DROP TABLE IF EXISTS ai_analysis CASCADE;
DROP TABLE IF EXISTS storage_references CASCADE;
DROP TABLE IF EXISTS test_steps CASCADE;
DROP TABLE IF EXISTS test_runs CASCADE;
DROP TABLE IF EXISTS test_cases CASCADE;

-- Create enhanced test_cases table with adaptation patterns and reliability scores
CREATE TABLE test_cases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Basic test information
    name VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    original_scenario TEXT NOT NULL,
    refined_scenario TEXT,
    
    -- Enhanced adaptive features
    adaptation_patterns JSONB DEFAULT '[]',  -- Learned adaptation patterns
    reliability_score DECIMAL(3,2) DEFAULT 0.00 CHECK (reliability_score >= 0.00 AND reliability_score <= 1.00),
    
    -- Flexible configuration for adaptive testing
    test_config JSONB DEFAULT '{
        "viewport": {"width": 1920, "height": 1080},
        "timeout": 30000,
        "headless": true,
        "adaptiveMode": true,
        "maxAdaptations": 5,
        "recoveryStrategies": ["wait", "retry", "alternative_selector"],
        "aiValidation": {
            "enabled": true,
            "confidence_threshold": 0.8,
            "validation_points": ["before_action", "after_action"]
        }
    }',
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    tags TEXT[] DEFAULT '{}'
);

-- Create enhanced test_runs table with adaptation and container tracking
CREATE TABLE test_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    test_case_id UUID NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
    
    -- Enhanced status with adaptation support
    status VARCHAR(20) NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'running', 'completed', 'failed', 'adapted', 'cancelled')),
    
    -- Container management
    container_id VARCHAR(100),  -- Docker container ID for isolation
    
    -- Adaptive execution metrics
    adaptation_count INTEGER DEFAULT 0,
    recovery_attempts INTEGER DEFAULT 0,
    
    -- Timing information
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,
    
    -- Step tracking
    total_steps INTEGER DEFAULT 0,
    completed_steps INTEGER DEFAULT 0,
    failed_steps INTEGER DEFAULT 0,
    adapted_steps INTEGER DEFAULT 0,
    skipped_steps INTEGER DEFAULT 0,
    
    -- Environment and configuration
    environment JSONB DEFAULT '{
        "browser": "chrome",
        "viewport": {"width": 1920, "height": 1080},
        "userAgent": null,
        "timezone": "UTC"
    }',
    
    -- Container isolation settings
    container_config JSONB DEFAULT '{
        "isolated": true,
        "resourceLimits": {
            "memory": "2GB",
            "cpu": "1"
        }
    }',
    
    -- Performance and error tracking
    metrics JSONB DEFAULT '{}',
    error_summary TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create enhanced test_steps table with adaptation support
CREATE TABLE test_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    test_run_id UUID NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    
    -- Step definition with adaptation awareness
    action VARCHAR(50) NOT NULL,
    target JSONB,
    input_data JSONB,
    
    -- Original vs adapted step tracking
    original_action VARCHAR(50),
    original_target JSONB,
    adaptation_reason TEXT,
    
    -- Execution results
    status VARCHAR(20) DEFAULT 'pending' 
        CHECK (status IN ('pending', 'running', 'success', 'failed', 'adapted', 'skipped')),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,
    
    -- Error and recovery information
    error_type VARCHAR(100),
    error_message TEXT,
    error_details JSONB,
    recovery_strategy VARCHAR(50),
    
    -- Enhanced snapshots and validation
    snapshot_path TEXT,
    snapshot_metadata JSONB,
    ai_validation_result JSONB,  -- AI confidence scores and analysis
    
    -- Extended debugging data
    dom_snapshot JSONB,
    console_logs JSONB,
    network_logs JSONB,
    performance_metrics JSONB,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(test_run_id, step_number)
);

-- Create step adaptations tracking table
CREATE TABLE test_step_adaptations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    test_step_id UUID NOT NULL REFERENCES test_steps(id) ON DELETE CASCADE,
    
    -- Adaptation details
    adaptation_type VARCHAR(50) NOT NULL,  -- selector_change, wait_added, action_modified, etc.
    original_value JSONB,
    adapted_value JSONB,
    
    -- AI assistance tracking
    ai_suggestion JSONB,
    ai_confidence DECIMAL(3,2),
    
    -- Success tracking
    was_successful BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create page states table for advanced DOM tracking
CREATE TABLE page_states (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    test_step_id UUID NOT NULL REFERENCES test_steps(id) ON DELETE CASCADE,
    
    -- State capture timing
    capture_type VARCHAR(20) NOT NULL CHECK (capture_type IN ('before', 'after', 'error')),
    
    -- DOM and visual state
    dom_hash VARCHAR(64),  -- Hash of DOM structure for change detection
    visual_hash VARCHAR(64),  -- Hash of screenshot for visual regression
    
    -- Detailed state information
    dom_structure JSONB,  -- Compressed DOM tree
    computed_styles JSONB,  -- Key element styles
    accessibility_tree JSONB,  -- A11y information
    
    -- Performance data at capture time
    performance_metrics JSONB,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create container allocations table
CREATE TABLE container_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    container_id VARCHAR(100) UNIQUE NOT NULL,
    
    -- Container lifecycle
    status VARCHAR(20) NOT NULL DEFAULT 'allocated'
        CHECK (status IN ('allocated', 'in_use', 'idle', 'terminated', 'error')),
    
    -- Resource allocation
    allocated_memory VARCHAR(10),
    allocated_cpu VARCHAR(10),
    
    -- Usage tracking
    test_run_id UUID REFERENCES test_runs(id) ON DELETE SET NULL,
    allocated_at TIMESTAMPTZ DEFAULT NOW(),
    released_at TIMESTAMPTZ,
    last_health_check TIMESTAMPTZ DEFAULT NOW(),
    
    -- Container metadata
    image_version VARCHAR(50),
    host_info JSONB
);

-- Create test execution events for real-time tracking
CREATE TABLE test_execution_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    test_run_id UUID NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
    
    -- Event information
    event_type VARCHAR(50) NOT NULL,  -- step_started, step_completed, adaptation_triggered, etc.
    event_data JSONB NOT NULL,
    
    -- SSE support
    sequence_number BIGSERIAL,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enhanced AI analysis table
CREATE TABLE ai_analysis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Flexible references
    test_case_id UUID REFERENCES test_cases(id) ON DELETE CASCADE,
    test_run_id UUID REFERENCES test_runs(id) ON DELETE CASCADE,
    test_step_id UUID REFERENCES test_steps(id) ON DELETE CASCADE,
    
    -- Analysis details
    analysis_type VARCHAR(50) NOT NULL,
    input_data JSONB NOT NULL,
    output_data JSONB NOT NULL,
    
    -- Model tracking
    model_used VARCHAR(100),
    model_version VARCHAR(50),
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    processing_time_ms INTEGER,
    
    -- Quality metrics
    confidence_score DECIMAL(3,2),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enhanced storage references with lifecycle management
CREATE TABLE storage_references (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Storage location
    bucket_name VARCHAR(100) NOT NULL DEFAULT 'screenshots',
    file_path TEXT NOT NULL,
    
    -- File information
    file_type VARCHAR(50) NOT NULL,
    file_size_bytes BIGINT,
    mime_type VARCHAR(100),
    
    -- Enhanced relations
    test_run_id UUID REFERENCES test_runs(id) ON DELETE CASCADE,
    test_step_id UUID REFERENCES test_steps(id) ON DELETE CASCADE,
    
    -- Extended metadata
    metadata JSONB DEFAULT '{}',
    compression_info JSONB,
    
    -- Lifecycle management
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_accessed_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    is_archived BOOLEAN DEFAULT false,
    archived_at TIMESTAMPTZ,
    
    -- Access tracking
    access_count INTEGER DEFAULT 0,
    
    UNIQUE(bucket_name, file_path)
);

-- =====================================================
-- Indexes for Performance
-- =====================================================

-- Test cases indexes
CREATE INDEX idx_test_cases_created_at ON test_cases(created_at DESC);
CREATE INDEX idx_test_cases_tags ON test_cases USING GIN (tags);
CREATE INDEX idx_test_cases_active ON test_cases(is_active);
CREATE INDEX idx_test_cases_reliability ON test_cases(reliability_score DESC);

-- Test runs indexes
CREATE INDEX idx_test_runs_test_case_id ON test_runs(test_case_id);
CREATE INDEX idx_test_runs_status ON test_runs(status);
CREATE INDEX idx_test_runs_created_at ON test_runs(created_at DESC);
CREATE INDEX idx_test_runs_container_id ON test_runs(container_id);

-- Test steps indexes
CREATE INDEX idx_test_steps_test_run_id ON test_steps(test_run_id);
CREATE INDEX idx_test_steps_status ON test_steps(status);
CREATE INDEX idx_test_steps_step_number ON test_steps(test_run_id, step_number);

-- Adaptations indexes
CREATE INDEX idx_adaptations_test_step_id ON test_step_adaptations(test_step_id);
CREATE INDEX idx_adaptations_type ON test_step_adaptations(adaptation_type);
CREATE INDEX idx_adaptations_success ON test_step_adaptations(was_successful);

-- Page states indexes
CREATE INDEX idx_page_states_test_step_id ON page_states(test_step_id);
CREATE INDEX idx_page_states_capture_type ON page_states(capture_type);
CREATE INDEX idx_page_states_hashes ON page_states(dom_hash, visual_hash);

-- Container allocations indexes
CREATE INDEX idx_container_status ON container_allocations(status);
CREATE INDEX idx_container_test_run ON container_allocations(test_run_id);

-- Execution events indexes
CREATE INDEX idx_events_test_run_id ON test_execution_events(test_run_id);
CREATE INDEX idx_events_type ON test_execution_events(event_type);
CREATE INDEX idx_events_sequence ON test_execution_events(sequence_number);

-- AI analysis indexes
CREATE INDEX idx_ai_analysis_test_case_id ON ai_analysis(test_case_id);
CREATE INDEX idx_ai_analysis_test_run_id ON ai_analysis(test_run_id);
CREATE INDEX idx_ai_analysis_test_step_id ON ai_analysis(test_step_id);
CREATE INDEX idx_ai_analysis_type ON ai_analysis(analysis_type);

-- Storage references indexes
CREATE INDEX idx_storage_refs_test_run_id ON storage_references(test_run_id);
CREATE INDEX idx_storage_refs_test_step_id ON storage_references(test_step_id);
CREATE INDEX idx_storage_refs_expires_at ON storage_references(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_storage_refs_file_type ON storage_references(file_type);
CREATE INDEX idx_storage_refs_archived ON storage_references(is_archived, archived_at) WHERE is_archived = true;

-- =====================================================
-- Migration 004: Functions and Triggers
-- =====================================================

-- Function: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger: Auto-update updated_at for test_cases
CREATE TRIGGER update_test_cases_updated_at BEFORE UPDATE ON test_cases
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function: Calculate test run duration and update step counts
CREATE OR REPLACE FUNCTION update_test_run_metrics()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculate duration if completed
    IF NEW.completed_at IS NOT NULL AND NEW.started_at IS NOT NULL THEN
        NEW.duration_ms = EXTRACT(EPOCH FROM (NEW.completed_at - NEW.started_at)) * 1000;
    END IF;
    
    -- Update step counts from test_steps
    IF TG_OP = 'UPDATE' AND (OLD.status != NEW.status OR OLD.completed_at IS DISTINCT FROM NEW.completed_at) THEN
        SELECT 
            COUNT(*),
            COUNT(*) FILTER (WHERE status = 'success'),
            COUNT(*) FILTER (WHERE status = 'failed'),
            COUNT(*) FILTER (WHERE status = 'adapted'),
            COUNT(*) FILTER (WHERE status = 'skipped')
        INTO 
            NEW.total_steps,
            NEW.completed_steps,
            NEW.failed_steps,
            NEW.adapted_steps,
            NEW.skipped_steps
        FROM test_steps
        WHERE test_run_id = NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger: Auto-update test run metrics
CREATE TRIGGER update_test_run_metrics_trigger 
    BEFORE INSERT OR UPDATE ON test_runs
    FOR EACH ROW EXECUTE FUNCTION update_test_run_metrics();

-- Function: Update test case reliability score based on run history
CREATE OR REPLACE FUNCTION update_test_case_reliability()
RETURNS TRIGGER AS $$
DECLARE
    success_rate DECIMAL(3,2);
    adaptation_rate DECIMAL(3,2);
    avg_recovery_attempts DECIMAL(5,2);
BEGIN
    -- Only update on test run completion
    IF NEW.status IN ('completed', 'failed', 'adapted') AND OLD.status = 'running' THEN
        -- Calculate metrics from recent runs (last 10)
        WITH recent_runs AS (
            SELECT 
                status,
                adaptation_count,
                recovery_attempts,
                total_steps,
                completed_steps
            FROM test_runs
            WHERE test_case_id = NEW.test_case_id
            ORDER BY created_at DESC
            LIMIT 10
        )
        SELECT 
            COALESCE(AVG(CASE WHEN status = 'completed' THEN 1.0 ELSE 0.0 END), 0),
            COALESCE(AVG(CASE WHEN adaptation_count > 0 THEN adaptation_count::DECIMAL / NULLIF(total_steps, 0) ELSE 0 END), 0),
            COALESCE(AVG(recovery_attempts), 0)
        INTO success_rate, adaptation_rate, avg_recovery_attempts
        FROM recent_runs;
        
        -- Calculate reliability score (weighted formula)
        UPDATE test_cases
        SET reliability_score = LEAST(1.0, GREATEST(0.0, 
            (success_rate * 0.5) + 
            ((1.0 - LEAST(adaptation_rate, 1.0)) * 0.3) + 
            ((1.0 - LEAST(avg_recovery_attempts / 10.0, 1.0)) * 0.2)
        ))
        WHERE id = NEW.test_case_id;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger: Update test case reliability on run completion
CREATE TRIGGER update_test_case_reliability_trigger
    AFTER UPDATE ON test_runs
    FOR EACH ROW EXECUTE FUNCTION update_test_case_reliability();

-- Function: Auto-generate step adaptation records
CREATE OR REPLACE FUNCTION record_step_adaptation()
RETURNS TRIGGER AS $$
BEGIN
    -- Record adaptation if step was adapted
    IF NEW.status = 'adapted' AND 
       (NEW.original_action IS NOT NULL OR NEW.original_target IS NOT NULL) THEN
        
        INSERT INTO test_step_adaptations (
            test_step_id,
            adaptation_type,
            original_value,
            adapted_value,
            was_successful
        ) VALUES (
            NEW.id,
            CASE 
                WHEN NEW.original_action != NEW.action THEN 'action_modified'
                WHEN NEW.original_target IS DISTINCT FROM NEW.target THEN 'selector_change'
                ELSE 'unknown'
            END,
            jsonb_build_object(
                'action', NEW.original_action,
                'target', NEW.original_target
            ),
            jsonb_build_object(
                'action', NEW.action,
                'target', NEW.target
            ),
            NEW.status = 'success' OR NEW.status = 'adapted'
        );
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger: Record step adaptations
CREATE TRIGGER record_step_adaptation_trigger
    AFTER INSERT OR UPDATE ON test_steps
    FOR EACH ROW EXECUTE FUNCTION record_step_adaptation();

-- Function: Update storage access tracking
CREATE OR REPLACE FUNCTION update_storage_access()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_accessed_at = NOW();
    NEW.access_count = COALESCE(OLD.access_count, 0) + 1;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Function: Set default storage expiration based on type and context
CREATE OR REPLACE FUNCTION set_storage_expiration()
RETURNS TRIGGER AS $$
DECLARE
    base_expiry INTERVAL;
    is_failed_run BOOLEAN;
BEGIN
    -- Determine base expiry by file type
    base_expiry := CASE NEW.file_type
        WHEN 'screenshot' THEN INTERVAL '30 days'
        WHEN 'video' THEN INTERVAL '7 days'
        WHEN 'har' THEN INTERVAL '30 days'
        WHEN 'report' THEN INTERVAL '90 days'
        WHEN 'dom_snapshot' THEN INTERVAL '14 days'
        WHEN 'console_log' THEN INTERVAL '14 days'
        ELSE INTERVAL '30 days'
    END;
    
    -- Check if associated with failed run
    IF NEW.test_run_id IS NOT NULL THEN
        SELECT status = 'failed' INTO is_failed_run
        FROM test_runs
        WHERE id = NEW.test_run_id;
        
        -- Extend retention for failed runs
        IF is_failed_run THEN
            base_expiry := base_expiry * 2;
        END IF;
    END IF;
    
    -- Set expiration if not already set
    IF NEW.expires_at IS NULL THEN
        NEW.expires_at = NOW() + base_expiry;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger: Auto-set storage expiration
CREATE TRIGGER set_storage_expiration_trigger
    BEFORE INSERT ON storage_references
    FOR EACH ROW EXECUTE FUNCTION set_storage_expiration();

-- Function: Update container health check timestamp
CREATE OR REPLACE FUNCTION update_container_health()
RETURNS void AS $$
BEGIN
    UPDATE container_allocations
    SET last_health_check = NOW()
    WHERE status = 'in_use'
    AND last_health_check < NOW() - INTERVAL '1 minute';
END;
$$ language 'plpgsql';

-- Function: Clean up idle containers
CREATE OR REPLACE FUNCTION cleanup_idle_containers()
RETURNS void AS $$
BEGIN
    UPDATE container_allocations
    SET 
        status = 'terminated',
        released_at = NOW()
    WHERE status = 'idle'
    AND last_health_check < NOW() - INTERVAL '5 minutes';
END;
$$ language 'plpgsql';

-- Function: Archive expired storage files
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

-- =====================================================
-- Views for Reporting and Analytics
-- =====================================================

-- View: Test execution summary with adaptive metrics
CREATE OR REPLACE VIEW test_execution_summary AS
SELECT 
    tc.id as test_case_id,
    tc.name as test_case_name,
    tc.reliability_score,
    COUNT(DISTINCT tr.id) as total_runs,
    COUNT(DISTINCT CASE WHEN tr.status = 'completed' THEN tr.id END) as successful_runs,
    COUNT(DISTINCT CASE WHEN tr.status = 'failed' THEN tr.id END) as failed_runs,
    COUNT(DISTINCT CASE WHEN tr.status = 'adapted' THEN tr.id END) as adapted_runs,
    AVG(tr.duration_ms) as avg_duration_ms,
    AVG(tr.adaptation_count) as avg_adaptations,
    AVG(tr.recovery_attempts) as avg_recovery_attempts,
    MAX(tr.created_at) as last_run_at
FROM test_cases tc
LEFT JOIN test_runs tr ON tc.id = tr.test_case_id
GROUP BY tc.id, tc.name, tc.reliability_score;

-- View: Recent test activity with container info
CREATE OR REPLACE VIEW recent_test_activity AS
SELECT 
    tr.id,
    tc.name as test_name,
    tr.status,
    tr.container_id,
    tr.started_at,
    tr.duration_ms,
    tr.failed_steps,
    tr.adapted_steps,
    tr.total_steps,
    tr.adaptation_count,
    tr.recovery_attempts
FROM test_runs tr
JOIN test_cases tc ON tr.test_case_id = tc.id
WHERE tr.created_at > NOW() - INTERVAL '7 days'
ORDER BY tr.created_at DESC;

-- View: Adaptation patterns analysis
CREATE OR REPLACE VIEW adaptation_patterns_summary AS
SELECT 
    tc.id as test_case_id,
    tc.name as test_case_name,
    tsa.adaptation_type,
    COUNT(*) as adaptation_count,
    AVG(CASE WHEN tsa.was_successful THEN 1.0 ELSE 0.0 END) as success_rate,
    AVG(tsa.ai_confidence) as avg_ai_confidence
FROM test_cases tc
JOIN test_runs tr ON tc.id = tr.test_case_id
JOIN test_steps ts ON tr.id = ts.test_run_id
JOIN test_step_adaptations tsa ON ts.id = tsa.test_step_id
GROUP BY tc.id, tc.name, tsa.adaptation_type
ORDER BY tc.name, adaptation_count DESC;

-- View: Container resource utilization
CREATE OR REPLACE VIEW container_utilization AS
SELECT 
    ca.status,
    COUNT(*) as container_count,
    COUNT(DISTINCT ca.test_run_id) as active_runs,
    AVG(EXTRACT(EPOCH FROM (COALESCE(ca.released_at, NOW()) - ca.allocated_at))) as avg_usage_seconds
FROM container_allocations ca
GROUP BY ca.status;

-- View: Storage usage by file type
CREATE OR REPLACE VIEW storage_usage_summary AS
SELECT 
    file_type,
    bucket_name,
    COUNT(*) as file_count,
    SUM(file_size_bytes) / (1024 * 1024 * 1024) as total_size_gb,
    AVG(file_size_bytes) / (1024 * 1024) as avg_size_mb,
    COUNT(*) FILTER (WHERE is_archived) as archived_count,
    COUNT(*) FILTER (WHERE expires_at < NOW() + INTERVAL '7 days' AND NOT is_archived) as expiring_soon
FROM storage_references
GROUP BY file_type, bucket_name
ORDER BY total_size_gb DESC;

-- =====================================================
-- Record migrations
-- =====================================================

INSERT INTO schema_migrations (id, name) VALUES
    ('001_initial_schema', 'Initial schema setup'),
    ('002_functions_and_triggers', 'Basic functions and triggers'),
    ('003_adaptive_schema_redesign', 'Complete adaptive testing schema'),
    ('004_adaptive_functions_triggers', 'Advanced functions and triggers for adaptive testing')
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- Create Storage Buckets (Instructions)
-- =====================================================

-- Storage buckets need to be created via Supabase dashboard:
-- 1. screenshots - Public bucket for test step screenshots
-- 2. test-artifacts - Public bucket for HAR files, videos, etc.
-- 3. reports - Public bucket for generated test reports

-- After creating buckets, run these policies in SQL editor:

/*
-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy for screenshots bucket
CREATE POLICY "Public Access" ON storage.objects FOR ALL USING (bucket_id = 'screenshots');

-- Policy for test-artifacts bucket  
CREATE POLICY "Public Access" ON storage.objects FOR ALL USING (bucket_id = 'test-artifacts');

-- Policy for reports bucket
CREATE POLICY "Public Access" ON storage.objects FOR ALL USING (bucket_id = 'reports');
*/

-- =====================================================
-- Setup Complete!
-- =====================================================

-- Next steps:
-- 1. Create the storage buckets in Supabase dashboard
-- 2. Apply the storage policies above
-- 3. Test the database connection from your application