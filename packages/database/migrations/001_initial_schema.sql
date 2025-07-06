-- Migration: Initial Schema
-- Created: 2025-01-05T00:00:00.000Z
-- Description: Create initial database schema for Cinnamon QA

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Test Cases: Core test definitions
CREATE TABLE IF NOT EXISTS test_cases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    original_scenario TEXT NOT NULL,
    refined_scenario TEXT,
    test_config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    tags TEXT[] DEFAULT '{}'
);

-- Test Runs: Individual executions of test cases
CREATE TABLE IF NOT EXISTS test_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    test_case_id UUID NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,
    total_steps INTEGER DEFAULT 0,
    completed_steps INTEGER DEFAULT 0,
    failed_steps INTEGER DEFAULT 0,
    skipped_steps INTEGER DEFAULT 0,
    environment JSONB DEFAULT '{}',
    error_summary TEXT,
    metrics JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Test Steps: Individual step executions
CREATE TABLE IF NOT EXISTS test_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    test_run_id UUID NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    action VARCHAR(50) NOT NULL,
    target JSONB,
    input_data JSONB,
    status VARCHAR(20) DEFAULT 'pending',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,
    error_type VARCHAR(100),
    error_message TEXT,
    error_details JSONB,
    snapshot_path TEXT,
    snapshot_metadata JSONB,
    dom_snapshot JSONB,
    console_logs JSONB,
    network_logs JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Storage References: Track files in Supabase Storage
CREATE TABLE IF NOT EXISTS storage_references (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bucket_name VARCHAR(100) NOT NULL DEFAULT 'screenshots',
    file_path TEXT NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    file_size_bytes BIGINT,
    mime_type VARCHAR(100),
    test_run_id UUID REFERENCES test_runs(id) ON DELETE CASCADE,
    test_step_id UUID REFERENCES test_steps(id) ON DELETE CASCADE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_accessed_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    is_archived BOOLEAN DEFAULT false,
    archived_at TIMESTAMPTZ,
    storage_url TEXT GENERATED ALWAYS AS 
        ('https://[project-id].supabase.co/storage/v1/object/public/' || bucket_name || '/' || file_path) STORED,
    access_count INTEGER DEFAULT 0
);

-- AI Analysis Results: Store AI processing results
CREATE TABLE IF NOT EXISTS ai_analysis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    test_case_id UUID REFERENCES test_cases(id) ON DELETE CASCADE,
    analysis_type VARCHAR(50) NOT NULL,
    input_data JSONB NOT NULL,
    output_data JSONB NOT NULL,
    model_used VARCHAR(100),
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    processing_time_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_test_cases_created_at ON test_cases(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_test_cases_tags ON test_cases USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_test_cases_active ON test_cases(is_active);

CREATE INDEX IF NOT EXISTS idx_test_runs_test_case_id ON test_runs(test_case_id);
CREATE INDEX IF NOT EXISTS idx_test_runs_status ON test_runs(status);
CREATE INDEX IF NOT EXISTS idx_test_runs_created_at ON test_runs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_test_steps_test_run_id ON test_steps(test_run_id);
CREATE INDEX IF NOT EXISTS idx_test_steps_status ON test_steps(status);
CREATE INDEX IF NOT EXISTS idx_test_steps_step_number ON test_steps(test_run_id, step_number);

CREATE INDEX IF NOT EXISTS idx_storage_refs_test_run_id ON storage_references(test_run_id);
CREATE INDEX IF NOT EXISTS idx_storage_refs_test_step_id ON storage_references(test_step_id);
CREATE INDEX IF NOT EXISTS idx_storage_refs_expires_at ON storage_references(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_storage_refs_file_type ON storage_references(file_type);
CREATE INDEX IF NOT EXISTS idx_storage_refs_created_at ON storage_references(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_storage_refs_archived ON storage_references(is_archived, archived_at) WHERE is_archived = true;

CREATE INDEX IF NOT EXISTS idx_ai_analysis_test_case_id ON ai_analysis(test_case_id);
CREATE INDEX IF NOT EXISTS idx_ai_analysis_type ON ai_analysis(analysis_type);
CREATE INDEX IF NOT EXISTS idx_ai_analysis_created_at ON ai_analysis(created_at DESC);

-- JSONB indexes for common queries
CREATE INDEX IF NOT EXISTS idx_error_type ON test_steps ((error_details->>'type'));
CREATE INDEX IF NOT EXISTS idx_selector_type ON test_steps ((target->>'type'));
CREATE INDEX IF NOT EXISTS idx_test_config ON test_cases USING GIN (test_config);

-- Add constraints
ALTER TABLE test_runs ADD CONSTRAINT IF NOT EXISTS chk_status 
    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled'));

ALTER TABLE test_steps ADD CONSTRAINT IF NOT EXISTS chk_step_status 
    CHECK (status IN ('pending', 'running', 'success', 'failed', 'skipped'));

ALTER TABLE storage_references ADD CONSTRAINT IF NOT EXISTS chk_file_type 
    CHECK (file_type IN ('screenshot', 'video', 'har', 'report', 'dom_snapshot', 'console_log'));

ALTER TABLE storage_references ADD CONSTRAINT IF NOT EXISTS chk_bucket_name 
    CHECK (bucket_name IN ('screenshots', 'test-artifacts', 'reports'));

-- Add unique constraints
ALTER TABLE test_steps ADD CONSTRAINT IF NOT EXISTS unique_test_run_step_number 
    UNIQUE(test_run_id, step_number);

ALTER TABLE storage_references ADD CONSTRAINT IF NOT EXISTS unique_bucket_path 
    UNIQUE(bucket_name, file_path);