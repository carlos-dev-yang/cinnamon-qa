# Storage Strategy for Cinnamon-QA

## Overview

This document outlines the storage strategy for handling various types of data in Cinnamon-QA, balancing between structured PostgreSQL tables and unstructured storage.

## Data Classification and Storage Approach

### 1. Structured Data (PostgreSQL Tables)
- **Test Cases**: Core test definitions, metadata
- **Test Runs**: Execution records, status tracking
- **Basic Step Info**: Action types, targets, status

### 2. Semi-Structured Data (JSONB Columns)
- **Test Configuration**: Variable viewport sizes, timeouts, browser settings
- **Step Targets**: Flexible selector definitions (CSS, XPath, coordinates)
- **Error Details**: Stack traces, element states, debug info
- **DOM Snapshots**: Compressed DOM structure for debugging
- **Console/Network Logs**: Arrays of log entries

### 3. Binary/Large Data (Supabase Storage)
- **Screenshots**: WebP images of each step (optimized for size)
- **Videos**: Full test execution recordings
- **HAR Files**: Complete network activity logs
- **Test Reports**: Generated HTML/PDF reports

## Storage Architecture

```
PostgreSQL Database
├── test_cases (table)
│   └── test_config (JSONB) - flexible configuration
├── test_runs (table)
│   ├── environment (JSONB) - browser info, viewport
│   └── metrics (JSONB) - performance data
├── test_steps (table)
│   ├── target (JSONB) - flexible selector storage
│   ├── input_data (JSONB) - various input formats
│   ├── error_details (JSONB) - detailed error info
│   ├── dom_snapshot (JSONB) - compressed DOM
│   ├── console_logs (JSONB) - console entries
│   └── network_logs (JSONB) - key requests
└── storage_references (table) - tracks all external files

Supabase Storage
├── screenshots/ (bucket)
│   └── {test_run_id}/{step_number}.webp
├── test-artifacts/ (bucket)
│   ├── videos/{test_run_id}/recording.mp4
│   └── har/{test_run_id}/network.har
└── reports/ (bucket)
    └── {test_run_id}/report.html
```

## JSONB Usage Guidelines

### When to Use JSONB

1. **Variable Structure**: Data that varies significantly between instances
2. **Future Flexibility**: Fields that might evolve without schema changes
3. **Array Data**: Lists of similar items (logs, errors)
4. **Nested Objects**: Complex hierarchical data

### JSONB Examples

```sql
-- Test Configuration
{
  "viewport": {"width": 1920, "height": 1080},
  "timeout": 30000,
  "headless": true,
  "slowMo": 100,
  "customHeaders": {"X-Test": "true"}
}

-- Step Target (flexible selector)
{
  "type": "css",
  "value": "button.submit",
  "alternatives": ["#submit-btn", "[type='submit']"],
  "waitOptions": {"timeout": 5000, "visible": true}
}

-- DOM Snapshot (compressed)
{
  "timestamp": "2024-01-15T10:30:00Z",
  "url": "https://example.com",
  "title": "Example Page",
  "elements": [
    {"tag": "button", "id": "submit", "text": "Submit", "visible": true}
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
-- Storage references with Supabase integration
CREATE TABLE storage_references (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Storage location
    bucket_name VARCHAR(100) NOT NULL DEFAULT 'screenshots',
    file_path TEXT NOT NULL,
    
    -- File information
    file_type VARCHAR(50) NOT NULL,
    file_size_bytes BIGINT,
    mime_type VARCHAR(100),
    
    -- Relations
    test_run_id UUID REFERENCES test_runs(id) ON DELETE CASCADE,
    test_step_id UUID REFERENCES test_steps(id) ON DELETE CASCADE,
    
    -- Metadata (resolution, checksum, etc.)
    metadata JSONB DEFAULT '{}',
    
    -- Lifecycle management
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_accessed_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    is_archived BOOLEAN DEFAULT false,
    archived_at TIMESTAMPTZ,
    
    -- Generated Supabase URL
    storage_url TEXT GENERATED ALWAYS AS 
        ('https://[project-id].supabase.co/storage/v1/object/public/' 
         || bucket_name || '/' || file_path) STORED,
    
    -- Access tracking
    access_count INTEGER DEFAULT 0
);
```

### 3. Automatic Lifecycle Management

The system automatically manages file lifecycles based on type:

```sql
-- Automatic expiration setting
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
    
    -- Extend retention for failed tests
    IF EXISTS (
        SELECT 1 FROM test_runs 
        WHERE id = NEW.test_run_id AND status = 'failed'
    ) THEN
        NEW.expires_at = NEW.expires_at + INTERVAL '60 days';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 4. Storage Access Patterns

Track file access for better lifecycle decisions:

```sql
-- Update access tracking
CREATE OR REPLACE FUNCTION update_storage_access_time()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_accessed_at = NOW();
    NEW.access_count = COALESCE(OLD.access_count, 0) + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 5. Storage Cleanup Strategies

```sql
-- Archive expired files
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
$$ LANGUAGE plpgsql;

-- Schedule periodic cleanup (Supabase Edge Function or cron)
SELECT cron.schedule(
    'archive-expired-storage',
    '0 2 * * *', -- Run at 2 AM daily
    'SELECT archive_expired_storage();'
);
```

### 6. Storage Integration with Application

```typescript
// Example: Saving screenshot with reference
async function saveScreenshot(
    testRunId: string,
    testStepId: string,
    screenshot: Buffer
): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    // Construct file path
    const filePath = `${year}/${month}/${day}/${testRunId}/step_${testStepId}_${timestamp}.webp`;
    
    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
        .from('screenshots')
        .upload(filePath, screenshot, {
            contentType: 'image/webp',
            cacheControl: '3600'
        });
    
    if (error) throw error;
    
    // Create reference in database
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
                compression: 'lossy'
            }
        })
        .select('storage_url')
        .single();
    
    return ref.storage_url;
}
```

### 7. Storage Optimization

1. **Screenshot Format Strategy**:
   - **WebP (Primary)**: Default format for all QA screenshots
     - 30-50% smaller than PNG (significant cost savings)
     - Quality setting: 80% (optimal for QA debugging purposes)
     - Excellent browser support (98%+ modern browsers)
     - Supports both lossy and lossless compression
   - **PNG (Future consideration)**: Only if pixel-perfect accuracy becomes required
   - **Optimization benefits for QA platform**:
     - Faster loading in test reports
     - Reduced storage costs
     - Better user experience when reviewing test results
   - Resize to max 1920x1080 if larger to save bandwidth

2. **DOM Snapshot Compression**:
   - Store only relevant elements
   - Use short property names
   - Gzip before storing in JSONB

3. **Log Filtering**:
   - Store only warnings and errors by default
   - Limit console logs to last 100 entries
   - Filter network logs to failed requests

## Access Patterns and Indexes

### Common Queries

1. **Get all steps for a test run with screenshots**:
```sql
SELECT 
  ts.*,
  sr.file_path as screenshot_url
FROM test_steps ts
LEFT JOIN storage_references sr ON ts.id = sr.test_step_id
WHERE ts.test_run_id = ?
ORDER BY ts.step_number;
```

2. **Find tests with specific error types**:
```sql
SELECT * FROM test_steps
WHERE error_details->>'type' = 'timeout'
  AND created_at > NOW() - INTERVAL '7 days';
```

3. **Analyze selector usage**:
```sql
SELECT 
  target->>'type' as selector_type,
  COUNT(*) as usage_count
FROM test_steps
GROUP BY target->>'type';
```

### Index Strategy

```sql
-- JSONB indexes for common queries
CREATE INDEX idx_error_type ON test_steps ((error_details->>'type'));
CREATE INDEX idx_selector_type ON test_steps ((target->>'type'));
CREATE INDEX idx_test_config ON test_cases USING GIN (test_config);
```

## Best Practices

1. **Data Hygiene**:
   - Regular cleanup of old artifacts
   - Monitor storage usage with dashboards
   - Compress large text data
   - Set appropriate expiration dates based on test importance

2. **Performance**:
   - Use partial indexes for common filters
   - Avoid storing huge objects in JSONB
   - Paginate when loading many screenshots
   - Implement lazy loading for screenshot galleries

3. **Cost Optimization**:
   - Use WebP for all screenshots (primary strategy)
   - Monitor storage usage per test run
   - Implement automatic cleanup policies
   - Consider different retention periods for different test types

4. **Reliability**:
   - Always store critical data in structured columns
   - Use JSONB for enhancement, not core functionality
   - Maintain referential integrity with foreign keys
   - Test screenshot conversion pipelines thoroughly

## Storage Reference Benefits

The enhanced `storage_references` table provides:

1. **Automatic URL Generation**: The `storage_url` generated column provides instant access URLs
2. **Lifecycle Management**: Automatic expiration dates based on file type
3. **Access Tracking**: Monitor file usage with `access_count` and `last_accessed_at`
4. **Flexible Metadata**: JSONB column for storing file-specific information
5. **Archival System**: Soft delete with `is_archived` flag

## Supabase-Specific Considerations

### 1. Storage Buckets Setup
```sql
-- Create buckets via Supabase Dashboard or API
-- Set appropriate CORS policies for each bucket
INSERT INTO storage.buckets (id, name, public) VALUES
    ('screenshots', 'screenshots', true),
    ('test-artifacts', 'test-artifacts', true),
    ('reports', 'reports', true);
```

### 2. Storage Policies
```sql
-- Example: Allow authenticated users to upload
CREATE POLICY "Allow authenticated uploads" ON storage.objects
    FOR INSERT TO authenticated
    USING (bucket_id IN ('screenshots', 'test-artifacts', 'reports'));

-- Example: Public read access
CREATE POLICY "Public read access" ON storage.objects
    FOR SELECT TO public
    USING (bucket_id IN ('screenshots', 'test-artifacts', 'reports'));
```

### 3. Edge Functions for Cleanup
```typescript
// Supabase Edge Function for storage cleanup
import { createClient } from '@supabase/supabase-js'

export async function cleanupExpiredStorage() {
    const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    
    // Get archived files
    const { data: archivedFiles } = await supabase
        .from('storage_references')
        .select('bucket_name, file_path')
        .eq('is_archived', true)
        .lt('archived_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) // 7 days old
    
    // Delete from storage
    for (const file of archivedFiles || []) {
        await supabase.storage
            .from(file.bucket_name)
            .remove([file.file_path])
    }
    
    // Delete references
    await supabase
        .from('storage_references')
        .delete()
        .eq('is_archived', true)
        .lt('archived_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
}
```

## Migration Strategy

For future schema changes:

1. **Adding Fields**: Use JSONB first, migrate to column if needed
2. **Changing Structure**: Write migration functions for JSONB data
3. **Storage Changes**: Update paths gradually with backwards compatibility
4. **URL Updates**: Update generated column formula when changing project ID