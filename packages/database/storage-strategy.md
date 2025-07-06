# Storage Strategy for Cinnamon-QA

## Overview

This document outlines the comprehensive storage strategy for Cinnamon-QA's adaptive test execution system, balancing between structured PostgreSQL tables, semi-structured JSONB data, and binary file storage with automated lifecycle management.

## Core Principles

1. **Cost Optimization**: WebP as primary screenshot format (30-50% smaller)
2. **Adaptive Storage**: Extended retention for failed tests and adaptations
3. **Automated Lifecycle**: File-type based expiration with tracking
4. **Performance First**: Strategic use of JSONB for flexibility without sacrificing query performance

## Data Classification and Storage Approach

### 1. Structured Data (PostgreSQL Tables)
Core entities requiring strict schema and relationships:
- **Test Cases**: Core test definitions, adaptation patterns, reliability scores
- **Test Runs**: Execution records with adaptation/recovery counts
- **Test Steps**: Basic step info with status tracking
- **Container Allocations**: Exclusive container management
- **Storage References**: File tracking with lifecycle management

### 2. Semi-Structured Data (JSONB Columns)
Flexible data that varies between instances:
- **Test Configuration**: Variable viewport sizes, timeouts, browser settings, adaptive mode settings
- **Step Targets**: Flexible selector definitions with alternatives
- **Error Details**: Stack traces, element states, debug info
- **Page States**: Before/after snapshots of page conditions
- **Adaptations**: Dynamic step modifications and reasons
- **Recovery Attempts**: Failed recovery strategies and outcomes
- **DOM Snapshots**: Compressed DOM structure for debugging
- **Console/Network Logs**: Filtered arrays of log entries

### 3. Binary/Large Data (Supabase Storage)
External files with managed lifecycle:
- **Screenshots**: WebP images (80% quality, 1920x1080 max)
- **Videos**: Full test recordings (Premium feature, 7-day retention)
- **HAR Files**: Complete network activity logs
- **Test Reports**: Generated HTML reports with adaptation timeline

## Enhanced Storage Architecture

```
PostgreSQL Database
├── test_cases (table)
│   ├── test_config (JSONB) - flexible configuration
│   └── adaptation_patterns (JSONB) - learned patterns
├── test_runs (table)
│   ├── environment (JSONB) - browser info, viewport
│   ├── metrics (JSONB) - performance data
│   └── container_config (JSONB) - isolation settings
├── test_steps (table)
│   ├── target (JSONB) - flexible selector storage
│   ├── input_data (JSONB) - various input formats
│   ├── error_details (JSONB) - detailed error info
│   ├── page_state_before (JSONB) - pre-execution state
│   ├── page_state_after (JSONB) - post-execution state
│   ├── adaptations (JSONB) - step modifications
│   ├── recovery_attempts (JSONB) - recovery history
│   ├── dom_snapshot (JSONB) - compressed DOM
│   ├── console_logs (JSONB) - filtered console entries
│   └── network_logs (JSONB) - key requests only
├── container_allocations (table)
│   └── metadata (JSONB) - container health metrics
└── storage_references (table) - enhanced file tracking

Supabase Storage
├── screenshots/ (bucket)
│   └── {year}/{month}/{day}/{test_run_id}/{step_number}_{timestamp}.webp
├── test-artifacts/ (bucket)
│   ├── videos/{test_run_id}/recording_{timestamp}.mp4
│   └── har/{test_run_id}/network_{timestamp}.har
└── reports/ (bucket)
    └── {year}/{month}/{test_run_id}/report_{timestamp}.html
```

## JSONB Usage Guidelines for Adaptive Testing

### When to Use JSONB

1. **Adaptive Data**: Information that changes based on test execution
2. **Page States**: Dynamic page conditions that vary per site
3. **Recovery Patterns**: Flexible strategies learned over time
4. **Configuration Variants**: Test-specific settings and overrides

### Enhanced JSONB Examples

```sql
-- Adaptive Test Configuration
{
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
}

-- Page State Capture
{
  "url": "https://example.com/login",
  "title": "Login Page",
  "readyState": "complete",
  "timestamp": "2025-01-06T10:30:00Z",
  "visibleElements": [
    {
      "selector": "#username",
      "type": "input",
      "enabled": true,
      "visible": true,
      "boundingBox": {"x": 100, "y": 200, "width": 200, "height": 40}
    }
  ],
  "interactableElements": ["#username", "#password", "button[type=submit]"],
  "hasErrors": false,
  "loadTime": 1234,
  "networkActivity": "idle"
}

-- Step Adaptation Record
{
  "adaptations": [
    {
      "reason": "Element not found with original selector",
      "originalAction": {
        "type": "click",
        "selector": "button.login"
      },
      "adaptedAction": {
        "type": "click",
        "selector": "button[type='submit']"
      },
      "confidence": 0.92,
      "timestamp": "2025-01-06T10:31:00Z",
      "aiSuggestion": "Found alternative selector with similar properties"
    }
  ]
}

-- Recovery Attempt Record
{
  "attempts": [
    {
      "strategy": "wait_and_retry",
      "reason": "Element temporarily not visible",
      "waitTime": 2000,
      "success": true,
      "timestamp": "2025-01-06T10:32:00Z"
    }
  ]
}
```

## Storage Management Strategy

### 1. File Organization

```
screenshots/{year}/{month}/{day}/{test_run_id}/{step_number}_{timestamp}.webp
test-artifacts/videos/{test_run_id}/recording_{timestamp}.mp4
test-artifacts/har/{test_run_id}/network_{timestamp}.har
reports/{year}/{month}/{test_run_id}/report_{timestamp}.html
```

Benefits:
- Date-based partitioning for easy cleanup
- Unique paths prevent overwrites
- Logical grouping for browsing
- Separate buckets for different file types

### 2. Enhanced Storage References Table

```sql
CREATE TABLE storage_references (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Storage location
    bucket_name VARCHAR(100) NOT NULL,
    file_path TEXT NOT NULL,
    
    -- File information
    file_type VARCHAR(50) NOT NULL CHECK (file_type IN ('screenshot', 'video', 'har', 'report')),
    file_size_bytes BIGINT,
    mime_type VARCHAR(100),
    
    -- Relations
    test_run_id UUID REFERENCES test_runs(id) ON DELETE CASCADE,
    test_step_id UUID REFERENCES test_steps(id) ON DELETE CASCADE,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    -- Lifecycle management
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_accessed_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    is_archived BOOLEAN DEFAULT false,
    archived_at TIMESTAMPTZ,
    
    -- Generated Supabase URL
    storage_url TEXT GENERATED ALWAYS AS 
        (CASE 
            WHEN bucket_name IS NOT NULL AND file_path IS NOT NULL 
            THEN 'https://[project-id].supabase.co/storage/v1/object/public/' || bucket_name || '/' || file_path
            ELSE NULL
        END) STORED,
    
    -- Access tracking
    access_count INTEGER DEFAULT 0,
    
    -- Indexes
    INDEX idx_test_run_files (test_run_id),
    INDEX idx_expiration (expires_at) WHERE is_archived = false,
    INDEX idx_file_type (file_type)
);
```

### 3. Automatic Lifecycle Management

```sql
-- Automatic expiration setting based on file type and test result
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
        END CASE;
    END IF;
    
    -- Extended retention for failed or adapted tests
    IF EXISTS (
        SELECT 1 FROM test_runs 
        WHERE id = NEW.test_run_id 
        AND (status = 'failed' OR adaptation_count > 0)
    ) THEN
        NEW.expires_at = NEW.expires_at + INTERVAL '60 days';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_storage_expiration_trigger
BEFORE INSERT ON storage_references
FOR EACH ROW EXECUTE FUNCTION set_storage_expiration();
```

### 4. Storage Access Patterns

```sql
-- Update access tracking on file retrieval
CREATE OR REPLACE FUNCTION update_storage_access()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE storage_references
    SET 
        last_accessed_at = NOW(),
        access_count = access_count + 1
    WHERE id = NEW.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 5. Storage Cleanup Strategies

```sql
-- Archive expired files
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
        RETURNING 1
    )
    SELECT COUNT(*) INTO archived_count FROM archived;
    
    RETURN archived_count;
END;
$$ LANGUAGE plpgsql;

-- Cleanup job (can be scheduled via pg_cron or external scheduler)
SELECT cron.schedule(
    'archive-expired-storage',
    '0 2 * * *', -- Run at 2 AM daily
    'SELECT archive_expired_storage();'
);
```

### 6. Storage Integration with Adaptive Testing

```typescript
// Enhanced screenshot saving with adaptation context
async function saveAdaptiveScreenshot(
    testRunId: string,
    testStepId: string,
    screenshot: Buffer,
    pageState: PageState,
    adaptation?: StepAdaptation
): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const date = new Date();
    
    // Construct file path with date partitioning
    const filePath = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}/${testRunId}/step_${testStepId}_${timestamp}.webp`;
    
    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
        .from('screenshots')
        .upload(filePath, screenshot, {
            contentType: 'image/webp',
            cacheControl: '3600',
            upsert: false
        });
    
    if (error) throw error;
    
    // Create reference with adaptive metadata
    const { data: ref } = await supabase
        .from('storage_references')
        .insert({
            bucket_name: 'screenshots',
            file_path: filePath,
            file_type: 'screenshot',
            file_size_bytes: screenshot.length,
            mime_type: 'image/webp',
            test_run_id: testRunId,
            test_step_id: testStepId,
            metadata: {
                format: 'webp',
                quality: 80,
                resolution: '1920x1080',
                page_url: pageState.url,
                was_adapted: !!adaptation,
                adaptation_reason: adaptation?.reason,
                capture_context: 'adaptive_test'
            }
        })
        .select('storage_url')
        .single();
    
    return ref.storage_url;
}
```

### 7. Storage Optimization for Adaptive Testing

1. **WebP Screenshot Strategy**:
   - **Quality**: 80% - optimal balance for QA debugging
   - **Resolution**: Capped at 1920x1080
   - **Compression**: Lossy for general screenshots, lossless for error states
   - **Adaptive Context**: Include adaptation markers in filename

2. **DOM Snapshot Compression**:
   ```typescript
   function compressDOMSnapshot(pageState: PageState): object {
     return {
       url: pageState.url,
       title: pageState.title,
       // Only store interactable elements
       elements: pageState.interactableElements.map(el => ({
         s: el.selector,  // shortened keys
         t: el.type,
         e: el.enabled,
         v: el.visible
       })),
       timestamp: pageState.capturedAt
     };
   }
   ```

3. **Log Filtering for Adaptations**:
   - Store all logs during adaptations
   - Filter to errors/warnings for successful steps
   - Keep network logs for failed requests
   - Preserve console logs around adaptation points

## Access Patterns and Indexes

### Common Queries for Adaptive Testing

1. **Get adapted steps with screenshots**:
```sql
SELECT 
    ts.*,
    sr.storage_url as screenshot_url,
    ts.adaptations
FROM test_steps ts
LEFT JOIN storage_references sr ON ts.id = sr.test_step_id
WHERE ts.test_run_id = ?
    AND ts.status = 'adapted'
ORDER BY ts.step_number;
```

2. **Find common adaptation patterns**:
```sql
SELECT 
    adaptations->>'reason' as adaptation_reason,
    COUNT(*) as occurrence_count,
    AVG((adaptations->>'confidence')::float) as avg_confidence
FROM test_steps,
    jsonb_array_elements(adaptations) as adaptations
WHERE adaptations IS NOT NULL
GROUP BY adaptations->>'reason'
ORDER BY occurrence_count DESC;
```

3. **Storage usage by test status**:
```sql
SELECT 
    tr.status,
    COUNT(sr.*) as file_count,
    SUM(sr.file_size_bytes) / 1024 / 1024 as total_mb,
    AVG(sr.file_size_bytes) / 1024 as avg_kb
FROM storage_references sr
JOIN test_runs tr ON sr.test_run_id = tr.id
GROUP BY tr.status;
```

### Index Strategy

```sql
-- JSONB indexes for adaptive queries
CREATE INDEX idx_adaptations ON test_steps USING GIN (adaptations);
CREATE INDEX idx_page_state_url ON test_steps ((page_state_before->>'url'));
CREATE INDEX idx_recovery_attempts ON test_steps USING GIN (recovery_attempts);
CREATE INDEX idx_adaptation_patterns ON test_cases USING GIN (adaptation_patterns);

-- Storage reference indexes
CREATE INDEX idx_storage_metadata ON storage_references USING GIN (metadata);
CREATE INDEX idx_storage_adapted ON storage_references ((metadata->>'was_adapted'));
```

## Best Practices for Adaptive Testing Storage

1. **Adaptation Data Hygiene**:
   - Regularly analyze adaptation patterns
   - Archive successful adaptation strategies
   - Clean up obsolete recovery attempts
   - Monitor adaptation frequency per URL pattern

2. **Performance Optimization**:
   - Use partial indexes for adaptation queries
   - Implement lazy loading for adaptation history
   - Cache frequently accessed adaptation patterns
   - Batch process adaptation analytics

3. **Cost Management**:
   - Aggressive cleanup for non-adapted tests
   - Extended retention for valuable adaptations
   - Monitor storage growth per adaptation type
   - Implement storage quotas per test case

4. **Reliability**:
   - Always capture before/after states for adaptations
   - Store adaptation confidence scores
   - Track selector reliability over time
   - Maintain adaptation audit trail

## Migration Strategy

For implementing adaptive storage features:

1. **Phase 1**: Add JSONB columns for adaptations
2. **Phase 2**: Implement lifecycle management triggers
3. **Phase 3**: Migrate existing data with default values
4. **Phase 4**: Enable adaptive-specific indexes