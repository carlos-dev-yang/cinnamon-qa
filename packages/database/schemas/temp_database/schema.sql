-- Cinnamon-QA Database Schema
-- PostgreSQL with JSONB for flexible data storage

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- Core Tables (Structured Data)
-- =====================================================

-- Test Cases: Core test definitions
CREATE TABLE test_cases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    original_scenario TEXT NOT NULL, -- User's natural language input
    refined_scenario TEXT, -- AI-refined version
    test_config JSONB DEFAULT '{}', -- Flexible config (viewport, timeout, etc.)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by VARCHAR(255), -- For future user management
    is_active BOOLEAN DEFAULT true,
    tags TEXT[] DEFAULT '{}', -- Array of tags for categorization
    
    -- Indexes
    INDEX idx_test_cases_created_at (created_at DESC),
    INDEX idx_test_cases_tags USING GIN (tags),
    INDEX idx_test_cases_active (is_active)
);

-- Test Runs: Individual executions of test cases
CREATE TABLE test_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    test_case_id UUID NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, running, completed, failed, cancelled
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER, -- Total execution time in milliseconds
    
    -- Summary statistics
    total_steps INTEGER DEFAULT 0,
    completed_steps INTEGER DEFAULT 0,
    failed_steps INTEGER DEFAULT 0,
    skipped_steps INTEGER DEFAULT 0,
    
    -- Execution context
    environment JSONB DEFAULT '{}', -- Browser info, viewport, etc.
    error_summary TEXT, -- High-level error description if failed
    
    -- Performance metrics
    metrics JSONB DEFAULT '{}', -- CPU, memory, network stats
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Indexes
    INDEX idx_test_runs_test_case_id (test_case_id),
    INDEX idx_test_runs_status (status),
    INDEX idx_test_runs_created_at (created_at DESC),
    
    -- Constraints
    CONSTRAINT chk_status CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled'))
);

-- Test Steps: Structured step data (normalized)
CREATE TABLE test_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    test_run_id UUID NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    
    -- Step definition
    action VARCHAR(50) NOT NULL, -- navigate, click, type, assert, wait, etc.
    target JSONB, -- Flexible target definition (selector, coordinates, etc.)
    input_data JSONB, -- Input values, expected results, etc.
    
    -- Execution results
    status VARCHAR(20) DEFAULT 'pending', -- pending, running, success, failed, skipped
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,
    
    -- Error handling
    error_type VARCHAR(100), -- timeout, element_not_found, assertion_failed, etc.
    error_message TEXT,
    error_details JSONB, -- Stack trace, element state, etc.
    
    -- Snapshot reference
    snapshot_path TEXT, -- Path in Supabase Storage
    snapshot_metadata JSONB, -- Size, format, viewport, etc.
    
    -- DOM and console data (for debugging)
    dom_snapshot JSONB, -- Compressed DOM structure
    console_logs JSONB, -- Array of console entries
    network_logs JSONB, -- Key network requests
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Indexes
    INDEX idx_test_steps_test_run_id (test_run_id),
    INDEX idx_test_steps_status (status),
    INDEX idx_test_steps_step_number (test_run_id, step_number),
    
    -- Constraints
    CONSTRAINT chk_step_status CHECK (status IN ('pending', 'running', 'success', 'failed', 'skipped')),
    UNIQUE(test_run_id, step_number)
);

-- =====================================================
-- Analysis and AI Data (Semi-structured)
-- =====================================================

-- AI Analysis Results: Store AI processing results
CREATE TABLE ai_analysis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    test_case_id UUID REFERENCES test_cases(id) ON DELETE CASCADE,
    analysis_type VARCHAR(50) NOT NULL, -- scenario_parsing, step_generation, error_analysis
    
    -- Input and output
    input_data JSONB NOT NULL,
    output_data JSONB NOT NULL,
    
    -- AI metadata
    model_used VARCHAR(100),
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    processing_time_ms INTEGER,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Indexes
    INDEX idx_ai_analysis_test_case_id (test_case_id),
    INDEX idx_ai_analysis_type (analysis_type),
    INDEX idx_ai_analysis_created_at (created_at DESC)
);

-- =====================================================
-- Storage Management Tables
-- =====================================================

-- Storage References: Track all files in Supabase Storage
CREATE TABLE storage_references (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Storage location
    bucket_name VARCHAR(100) NOT NULL DEFAULT 'screenshots',
    file_path TEXT NOT NULL,
    
    -- File information
    file_type VARCHAR(50) NOT NULL, -- screenshot, video, har, report
    file_size_bytes BIGINT,
    mime_type VARCHAR(100),
    
    -- Relations
    test_run_id UUID REFERENCES test_runs(id) ON DELETE CASCADE,
    test_step_id UUID REFERENCES test_steps(id) ON DELETE CASCADE,
    
    -- Metadata
    metadata JSONB DEFAULT '{}', -- Resolution, format, compression, checksum, etc.
    
    -- Lifecycle management
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_accessed_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ, -- For automatic cleanup
    is_archived BOOLEAN DEFAULT false,
    archived_at TIMESTAMPTZ,
    
    -- Supabase Storage URL (generated column)
    -- Note: Replace [project-id] with actual Supabase project ID
    storage_url TEXT GENERATED ALWAYS AS 
        ('https://[project-id].supabase.co/storage/v1/object/public/' || bucket_name || '/' || file_path) STORED,
    
    -- Access tracking
    access_count INTEGER DEFAULT 0,
    
    -- Indexes
    INDEX idx_storage_refs_test_run_id (test_run_id),
    INDEX idx_storage_refs_test_step_id (test_step_id),
    INDEX idx_storage_refs_expires_at (expires_at) WHERE expires_at IS NOT NULL,
    INDEX idx_storage_refs_file_type (file_type),
    INDEX idx_storage_refs_created_at (created_at DESC),
    INDEX idx_storage_refs_archived (is_archived, archived_at) WHERE is_archived = true,
    
    -- Constraints
    CONSTRAINT chk_file_type CHECK (file_type IN ('screenshot', 'video', 'har', 'report', 'dom_snapshot', 'console_log')),
    CONSTRAINT chk_bucket_name CHECK (bucket_name IN ('screenshots', 'test-artifacts', 'reports')),
    UNIQUE(bucket_name, file_path)
);

-- =====================================================
-- Reporting and Analytics Views
-- =====================================================

-- View: Test execution summary
CREATE VIEW test_execution_summary AS
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

-- View: Recent test activity
CREATE VIEW recent_test_activity AS
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

-- =====================================================
-- Functions and Triggers
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
CREATE TRIGGER calculate_test_run_duration_trigger 
    BEFORE INSERT OR UPDATE ON test_runs
    FOR EACH ROW EXECUTE FUNCTION calculate_test_run_duration();

-- Function: Update last_accessed_at for storage references
CREATE OR REPLACE FUNCTION update_storage_access_time()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_accessed_at = NOW();
    NEW.access_count = COALESCE(OLD.access_count, 0) + 1;
    RETURN NEW;
END;
$$ language 'plpgsql';

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
CREATE TRIGGER set_storage_expiration_trigger
    BEFORE INSERT ON storage_references
    FOR EACH ROW EXECUTE FUNCTION set_storage_expiration();

-- =====================================================
-- Storage Policies (Supabase specific)
-- =====================================================

-- Row Level Security (RLS) - Enable after auth implementation
-- ALTER TABLE test_cases ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE test_runs ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE test_steps ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- Initial Data and Configuration
-- =====================================================

-- Storage buckets configuration (to be created via Supabase dashboard)
-- Buckets needed:
-- 1. screenshots - for test step screenshots
-- 2. test-artifacts - for HAR files, videos, etc.
-- 3. reports - for generated test reports

-- =====================================================
-- Maintenance Queries
-- =====================================================

-- Query: Clean up old storage references
-- DELETE FROM storage_references 
-- WHERE expires_at < NOW() AND is_archived = false;

-- Query: Archive old test runs
-- UPDATE test_runs 
-- SET status = 'archived' 
-- WHERE created_at < NOW() - INTERVAL '90 days';