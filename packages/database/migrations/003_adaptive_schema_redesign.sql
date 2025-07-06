-- Migration: Adaptive Testing Schema Redesign
-- Created: 2025-01-06
-- Description: Complete schema redesign to support adaptive testing features from PRD
--              Includes container management, adaptations, recovery attempts, and enhanced storage

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

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

-- Create enhanced test_steps table with extensive adaptation support
CREATE TABLE test_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    test_run_id UUID NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
    
    -- Step identification
    step_number INTEGER NOT NULL,
    action VARCHAR(100) NOT NULL,
    
    -- Flexible target definition with alternatives
    target JSONB DEFAULT '{}',
    input_data JSONB DEFAULT '{}',
    
    -- Enhanced status with adaptation
    status VARCHAR(20) DEFAULT 'pending' 
        CHECK (status IN ('pending', 'running', 'success', 'failed', 'adapted', 'skipped')),
    
    -- Page state capture (before/after)
    page_state_before JSONB DEFAULT '{}',
    page_state_after JSONB DEFAULT '{}',
    
    -- Adaptation tracking
    adaptations JSONB DEFAULT '[]',  -- Array of adaptation records
    recovery_attempts JSONB DEFAULT '[]',  -- Array of recovery attempt records
    
    -- Timing information
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,
    
    -- Error handling
    error_type VARCHAR(100),
    error_message TEXT,
    error_details JSONB DEFAULT '{}',
    
    -- State capture
    dom_snapshot JSONB DEFAULT '{}',  -- Compressed DOM state
    console_logs JSONB DEFAULT '[]',  -- Filtered console entries
    network_logs JSONB DEFAULT '[]', -- Key network requests only
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create container_allocations table for exclusive container management
CREATE TABLE container_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Container identification
    container_id VARCHAR(100) NOT NULL UNIQUE,
    test_run_id UUID REFERENCES test_runs(id) ON DELETE SET NULL,
    
    -- Allocation lifecycle
    allocated_at TIMESTAMPTZ DEFAULT NOW(),
    released_at TIMESTAMPTZ,
    status VARCHAR(20) NOT NULL DEFAULT 'active' 
        CHECK (status IN ('active', 'released', 'error', 'cleaning')),
    
    -- Container health and metadata
    metadata JSONB DEFAULT '{
        "health": "healthy",
        "lastHeartbeat": null,
        "resourceUsage": {},
        "errorCount": 0
    }',
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create enhanced storage_references table with lifecycle management
CREATE TABLE storage_references (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Storage location
    bucket_name VARCHAR(100) NOT NULL 
        CHECK (bucket_name IN ('screenshots', 'test-artifacts', 'reports')),
    file_path TEXT NOT NULL,
    
    -- File information
    file_type VARCHAR(50) NOT NULL 
        CHECK (file_type IN ('screenshot', 'video', 'har', 'report')),
    file_size_bytes BIGINT,
    mime_type VARCHAR(100),
    
    -- Relations
    test_run_id UUID REFERENCES test_runs(id) ON DELETE CASCADE,
    test_step_id UUID REFERENCES test_steps(id) ON DELETE CASCADE,
    
    -- Enhanced metadata for adaptive context
    metadata JSONB DEFAULT '{
        "format": null,
        "quality": null,
        "resolution": null,
        "was_adapted": false,
        "adaptation_reason": null,
        "capture_context": null
    }',
    
    -- Lifecycle management
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_accessed_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    is_archived BOOLEAN DEFAULT false,
    archived_at TIMESTAMPTZ,
    
    -- Access tracking
    access_count INTEGER DEFAULT 0,
    
    -- Generated Supabase URL (placeholder for project-id)
    storage_url TEXT GENERATED ALWAYS AS 
        ('https://[project-id].supabase.co/storage/v1/object/public/' || bucket_name || '/' || file_path) STORED
);

-- Create AI analysis tracking table
CREATE TABLE ai_analysis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Relations
    test_case_id UUID REFERENCES test_cases(id) ON DELETE CASCADE,
    test_run_id UUID REFERENCES test_runs(id) ON DELETE CASCADE,
    test_step_id UUID REFERENCES test_steps(id) ON DELETE CASCADE,
    
    -- Analysis details
    analysis_type VARCHAR(50) NOT NULL 
        CHECK (analysis_type IN ('scenario_analysis', 'step_generation', 'adaptation', 'validation', 'recovery')),
    input_data JSONB NOT NULL,
    output_data JSONB NOT NULL,
    
    -- AI model information
    model_used VARCHAR(100) DEFAULT 'gemini-pro',
    confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0.00 AND confidence_score <= 1.00),
    
    -- Token usage tracking
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    processing_time_ms INTEGER,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create test execution events table for real-time tracking
CREATE TABLE test_execution_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Relations
    test_run_id UUID NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
    test_step_id UUID REFERENCES test_steps(id) ON DELETE CASCADE,
    
    -- Event details
    event_type VARCHAR(50) NOT NULL 
        CHECK (event_type IN ('step_start', 'step_complete', 'step_error', 'step_adapted', 'recovery_attempted', 'test_complete')),
    
    -- Event data
    event_data JSONB DEFAULT '{}',
    message TEXT,
    
    -- Adaptation context
    adaptation JSONB DEFAULT NULL,  -- Adaptation details when applicable
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance indexes for core queries
CREATE INDEX idx_test_cases_created_at ON test_cases(created_at DESC);
CREATE INDEX idx_test_cases_reliability ON test_cases(reliability_score DESC);
CREATE INDEX idx_test_cases_active ON test_cases(is_active) WHERE is_active = true;
CREATE INDEX idx_test_cases_tags ON test_cases USING GIN (tags);

CREATE INDEX idx_test_runs_test_case_id ON test_runs(test_case_id);
CREATE INDEX idx_test_runs_status ON test_runs(status);
CREATE INDEX idx_test_runs_container_id ON test_runs(container_id) WHERE container_id IS NOT NULL;
CREATE INDEX idx_test_runs_created_at ON test_runs(created_at DESC);
CREATE INDEX idx_test_runs_adaptation_count ON test_runs(adaptation_count) WHERE adaptation_count > 0;

CREATE INDEX idx_test_steps_test_run_id ON test_steps(test_run_id);
CREATE INDEX idx_test_steps_status ON test_steps(status);
CREATE INDEX idx_test_steps_step_number ON test_steps(test_run_id, step_number);
CREATE INDEX idx_test_steps_adapted ON test_steps(test_run_id) WHERE status = 'adapted';

CREATE INDEX idx_container_allocations_container_id ON container_allocations(container_id);
CREATE INDEX idx_container_allocations_status ON container_allocations(status);
CREATE INDEX idx_container_allocations_test_run_id ON container_allocations(test_run_id) WHERE test_run_id IS NOT NULL;

CREATE INDEX idx_storage_refs_test_run_id ON storage_references(test_run_id);
CREATE INDEX idx_storage_refs_test_step_id ON storage_references(test_step_id) WHERE test_step_id IS NOT NULL;
CREATE INDEX idx_storage_refs_expires_at ON storage_references(expires_at) WHERE is_archived = false;
CREATE INDEX idx_storage_refs_file_type ON storage_references(file_type);
CREATE INDEX idx_storage_refs_created_at ON storage_references(created_at DESC);

CREATE INDEX idx_ai_analysis_test_case_id ON ai_analysis(test_case_id) WHERE test_case_id IS NOT NULL;
CREATE INDEX idx_ai_analysis_test_run_id ON ai_analysis(test_run_id) WHERE test_run_id IS NOT NULL;
CREATE INDEX idx_ai_analysis_type ON ai_analysis(analysis_type);
CREATE INDEX idx_ai_analysis_created_at ON ai_analysis(created_at DESC);

CREATE INDEX idx_events_test_run_id ON test_execution_events(test_run_id);
CREATE INDEX idx_events_type ON test_execution_events(event_type);
CREATE INDEX idx_events_created_at ON test_execution_events(created_at DESC);

-- JSONB indexes for adaptive queries
CREATE INDEX idx_adaptations ON test_steps USING GIN (adaptations);
CREATE INDEX idx_page_state_url ON test_steps ((page_state_before->>'url'));
CREATE INDEX idx_recovery_attempts ON test_steps USING GIN (recovery_attempts);
CREATE INDEX idx_adaptation_patterns ON test_cases USING GIN (adaptation_patterns);
CREATE INDEX idx_storage_metadata ON storage_references USING GIN (metadata);
CREATE INDEX idx_storage_adapted ON storage_references ((metadata->>'was_adapted'));
CREATE INDEX idx_test_config ON test_cases USING GIN (test_config);
CREATE INDEX idx_environment ON test_runs USING GIN (environment);

-- Unique constraints
ALTER TABLE test_steps ADD CONSTRAINT unique_test_run_step_number 
    UNIQUE(test_run_id, step_number);

ALTER TABLE storage_references ADD CONSTRAINT unique_bucket_path 
    UNIQUE(bucket_name, file_path);

ALTER TABLE container_allocations ADD CONSTRAINT unique_active_container
    UNIQUE(container_id) DEFERRABLE INITIALLY DEFERRED;

-- Comments for documentation
COMMENT ON TABLE test_cases IS 'Core test definitions with adaptive patterns and reliability tracking';
COMMENT ON TABLE test_runs IS 'Individual test executions with container isolation and adaptation metrics';
COMMENT ON TABLE test_steps IS 'Individual step executions with extensive adaptation and state tracking';
COMMENT ON TABLE container_allocations IS 'Exclusive container management for test isolation';
COMMENT ON TABLE storage_references IS 'File tracking with automated lifecycle management';
COMMENT ON TABLE ai_analysis IS 'AI processing results and token usage tracking';
COMMENT ON TABLE test_execution_events IS 'Real-time event tracking for SSE updates';

COMMENT ON COLUMN test_cases.adaptation_patterns IS 'Learned adaptation patterns for improving reliability';
COMMENT ON COLUMN test_cases.reliability_score IS 'Test reliability score based on historical success/adaptation rates';
COMMENT ON COLUMN test_runs.container_id IS 'Docker container ID for isolated execution';
COMMENT ON COLUMN test_runs.adaptation_count IS 'Number of adaptations performed during execution';
COMMENT ON COLUMN test_steps.adaptations IS 'Array of adaptation records with reasons and confidence scores';
COMMENT ON COLUMN test_steps.page_state_before IS 'Page state snapshot before step execution';
COMMENT ON COLUMN test_steps.page_state_after IS 'Page state snapshot after step execution';
COMMENT ON COLUMN storage_references.metadata IS 'File metadata including adaptive context and quality settings';