/**
 * Enhanced Database type definitions for Adaptive Testing
 * Aligned with PRD requirements and storage strategy
 */

// ===== CORE ADAPTIVE TESTING TYPES =====

export type TestStatus = 'pending' | 'running' | 'completed' | 'failed' | 'adapted' | 'cancelled';
export type StepStatus = 'pending' | 'running' | 'success' | 'failed' | 'adapted' | 'skipped';
export type ContainerStatus = 'allocated' | 'in_use' | 'idle' | 'terminated' | 'error';
export type FileType = 'screenshot' | 'video' | 'har' | 'report';
export type BucketName = 'screenshots' | 'test-artifacts' | 'reports';
export type AnalysisType = 'scenario_analysis' | 'step_generation' | 'adaptation' | 'validation' | 'recovery';
export type EventType = 'step_start' | 'step_complete' | 'step_error' | 'step_adapted' | 'recovery_attempted' | 'test_complete';

// ===== ADAPTIVE TESTING DOMAIN TYPES =====

export interface AdaptationPattern {
  pattern: string;
  reason: string;
  success_rate: number;
  confidence: number;
  created_at: string;
}

export interface StepAdaptation {
  reason: string;
  originalAction: {
    type: string;
    selector: string;
    value?: string;
  };
  adaptedAction: {
    type: string;
    selector: string;
    value?: string;
  };
  confidence: number;
  timestamp: string;
  aiSuggestion?: string;
}

export interface RecoveryAttempt {
  strategy: string;
  reason: string;
  waitTime?: number;
  retryCount?: number;
  success: boolean;
  timestamp: string;
  errorMessage?: string;
}

export interface PageState {
  url: string;
  title: string;
  readyState: string;
  timestamp: string;
  visibleElements: ElementInfo[];
  interactableElements: string[];
  hasErrors: boolean;
  loadTime?: number;
  networkActivity?: string;
}

export interface ElementInfo {
  selector: string;
  type: string;
  enabled: boolean;
  visible: boolean;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface TestConfig {
  viewport: {
    width: number;
    height: number;
  };
  timeout: number;
  headless: boolean;
  adaptiveMode: boolean;
  maxAdaptations: number;
  recoveryStrategies: string[];
  aiValidation: {
    enabled: boolean;
    confidence_threshold: number;
    validation_points: string[];
  };
}

export interface Environment {
  browser: string;
  viewport: {
    width: number;
    height: number;
  };
  userAgent?: string;
  timezone: string;
}

export interface ContainerConfig {
  isolated: boolean;
  resourceLimits: {
    memory: string;
    cpu: string;
  };
}

export interface StorageMetadata {
  format?: string;
  quality?: number;
  resolution?: string;
  was_adapted: boolean;
  adaptation_reason?: string;
  capture_context?: string;
}

export interface ContainerMetadata {
  health: string;
  lastHeartbeat?: string;
  resourceUsage: Record<string, any>;
  errorCount: number;
}

// ===== DATABASE SCHEMA TYPES =====

export interface Database {
  public: {
    Tables: {
      test_cases: {
        Row: {
          id: string;
          name: string;
          url: string;
          original_scenario: string;
          refined_scenario: string | null;
          adaptation_patterns: AdaptationPattern[];
          reliability_score: number;
          test_config: TestConfig;
          created_at: string;
          updated_at: string;
          created_by: string | null;
          is_active: boolean;
          tags: string[];
        };
        Insert: {
          id?: string;
          name: string;
          url: string;
          original_scenario: string;
          refined_scenario?: string | null;
          adaptation_patterns?: AdaptationPattern[];
          reliability_score?: number;
          test_config?: TestConfig;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          is_active?: boolean;
          tags?: string[];
        };
        Update: {
          id?: string;
          name?: string;
          url?: string;
          original_scenario?: string;
          refined_scenario?: string | null;
          adaptation_patterns?: AdaptationPattern[];
          reliability_score?: number;
          test_config?: TestConfig;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          is_active?: boolean;
          tags?: string[];
        };
      };
      test_runs: {
        Row: {
          id: string;
          test_case_id: string;
          status: TestStatus;
          container_id: string | null;
          adaptation_count: number;
          recovery_attempts: number;
          started_at: string | null;
          completed_at: string | null;
          duration_ms: number | null;
          total_steps: number;
          completed_steps: number;
          failed_steps: number;
          adapted_steps: number;
          skipped_steps: number;
          environment: Environment;
          container_config: ContainerConfig;
          metrics: Record<string, any>;
          error_summary: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          test_case_id: string;
          status?: TestStatus;
          container_id?: string | null;
          adaptation_count?: number;
          recovery_attempts?: number;
          started_at?: string | null;
          completed_at?: string | null;
          duration_ms?: number | null;
          total_steps?: number;
          completed_steps?: number;
          failed_steps?: number;
          adapted_steps?: number;
          skipped_steps?: number;
          environment?: Environment;
          container_config?: ContainerConfig;
          metrics?: Record<string, any>;
          error_summary?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          test_case_id?: string;
          status?: TestStatus;
          container_id?: string | null;
          adaptation_count?: number;
          recovery_attempts?: number;
          started_at?: string | null;
          completed_at?: string | null;
          duration_ms?: number | null;
          total_steps?: number;
          completed_steps?: number;
          failed_steps?: number;
          adapted_steps?: number;
          skipped_steps?: number;
          environment?: Environment;
          container_config?: ContainerConfig;
          metrics?: Record<string, any>;
          error_summary?: string | null;
          created_at?: string;
        };
      };
      test_steps: {
        Row: {
          id: string;
          test_run_id: string;
          step_number: number;
          action: string;
          target: Record<string, any>;
          input_data: Record<string, any>;
          status: StepStatus;
          page_state_before: PageState;
          page_state_after: PageState;
          adaptations: StepAdaptation[];
          recovery_attempts: RecoveryAttempt[];
          started_at: string | null;
          completed_at: string | null;
          duration_ms: number | null;
          error_type: string | null;
          error_message: string | null;
          error_details: Record<string, any>;
          dom_snapshot: Record<string, any>;
          console_logs: Record<string, any>[];
          network_logs: Record<string, any>[];
          created_at: string;
        };
        Insert: {
          id?: string;
          test_run_id: string;
          step_number: number;
          action: string;
          target?: Record<string, any>;
          input_data?: Record<string, any>;
          status?: StepStatus;
          page_state_before?: PageState;
          page_state_after?: PageState;
          adaptations?: StepAdaptation[];
          recovery_attempts?: RecoveryAttempt[];
          started_at?: string | null;
          completed_at?: string | null;
          duration_ms?: number | null;
          error_type?: string | null;
          error_message?: string | null;
          error_details?: Record<string, any>;
          dom_snapshot?: Record<string, any>;
          console_logs?: Record<string, any>[];
          network_logs?: Record<string, any>[];
          created_at?: string;
        };
        Update: {
          id?: string;
          test_run_id?: string;
          step_number?: number;
          action?: string;
          target?: Record<string, any>;
          input_data?: Record<string, any>;
          status?: StepStatus;
          page_state_before?: PageState;
          page_state_after?: PageState;
          adaptations?: StepAdaptation[];
          recovery_attempts?: RecoveryAttempt[];
          started_at?: string | null;
          completed_at?: string | null;
          duration_ms?: number | null;
          error_type?: string | null;
          error_message?: string | null;
          error_details?: Record<string, any>;
          dom_snapshot?: Record<string, any>;
          console_logs?: Record<string, any>[];
          network_logs?: Record<string, any>[];
          created_at?: string;
        };
      };
      container_allocations: {
        Row: {
          id: string;
          container_id: string;
          test_run_id: string | null;
          allocated_at: string;
          released_at: string | null;
          status: ContainerStatus;
          metadata: ContainerMetadata;
          created_at: string;
        };
        Insert: {
          id?: string;
          container_id: string;
          test_run_id?: string | null;
          allocated_at?: string;
          released_at?: string | null;
          status?: ContainerStatus;
          metadata?: ContainerMetadata;
          created_at?: string;
        };
        Update: {
          id?: string;
          container_id?: string;
          test_run_id?: string | null;
          allocated_at?: string;
          released_at?: string | null;
          status?: ContainerStatus;
          metadata?: ContainerMetadata;
          created_at?: string;
        };
      };
      storage_references: {
        Row: {
          id: string;
          bucket_name: BucketName;
          file_path: string;
          file_type: FileType;
          file_size_bytes: number | null;
          mime_type: string | null;
          test_run_id: string | null;
          test_step_id: string | null;
          metadata: StorageMetadata;
          created_at: string;
          last_accessed_at: string;
          expires_at: string | null;
          is_archived: boolean;
          archived_at: string | null;
          access_count: number;
          storage_url: string;
        };
        Insert: {
          id?: string;
          bucket_name?: BucketName;
          file_path: string;
          file_type: FileType;
          file_size_bytes?: number | null;
          mime_type?: string | null;
          test_run_id?: string | null;
          test_step_id?: string | null;
          metadata?: StorageMetadata;
          created_at?: string;
          last_accessed_at?: string;
          expires_at?: string | null;
          is_archived?: boolean;
          archived_at?: string | null;
          access_count?: number;
        };
        Update: {
          id?: string;
          bucket_name?: BucketName;
          file_path?: string;
          file_type?: FileType;
          file_size_bytes?: number | null;
          mime_type?: string | null;
          test_run_id?: string | null;
          test_step_id?: string | null;
          metadata?: StorageMetadata;
          created_at?: string;
          last_accessed_at?: string;
          expires_at?: string | null;
          is_archived?: boolean;
          archived_at?: string | null;
          access_count?: number;
        };
      };
      ai_analysis: {
        Row: {
          id: string;
          test_case_id: string | null;
          test_run_id: string | null;
          test_step_id: string | null;
          analysis_type: AnalysisType;
          input_data: Record<string, any>;
          output_data: Record<string, any>;
          model_used: string;
          confidence_score: number | null;
          prompt_tokens: number | null;
          completion_tokens: number | null;
          processing_time_ms: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          test_case_id?: string | null;
          test_run_id?: string | null;
          test_step_id?: string | null;
          analysis_type: AnalysisType;
          input_data: Record<string, any>;
          output_data: Record<string, any>;
          model_used?: string;
          confidence_score?: number | null;
          prompt_tokens?: number | null;
          completion_tokens?: number | null;
          processing_time_ms?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          test_case_id?: string | null;
          test_run_id?: string | null;
          test_step_id?: string | null;
          analysis_type?: AnalysisType;
          input_data?: Record<string, any>;
          output_data?: Record<string, any>;
          model_used?: string;
          confidence_score?: number | null;
          prompt_tokens?: number | null;
          completion_tokens?: number | null;
          processing_time_ms?: number | null;
          created_at?: string;
        };
      };
      test_execution_events: {
        Row: {
          id: string;
          test_run_id: string;
          test_step_id: string | null;
          event_type: EventType;
          event_data: Record<string, any>;
          message: string | null;
          adaptation: StepAdaptation | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          test_run_id: string;
          test_step_id?: string | null;
          event_type: EventType;
          event_data?: Record<string, any>;
          message?: string | null;
          adaptation?: StepAdaptation | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          test_run_id?: string;
          test_step_id?: string | null;
          event_type?: EventType;
          event_data?: Record<string, any>;
          message?: string | null;
          adaptation?: StepAdaptation | null;
          created_at?: string;
        };
      };
    };
    Views: {
      test_execution_summary: {
        Row: {
          test_case_id: string;
          test_case_name: string;
          reliability_score: number;
          total_runs: number;
          successful_runs: number;
          failed_runs: number;
          runs_with_adaptations: number;
          avg_duration_ms: number;
          avg_adaptations_per_run: number;
          last_run_at: string;
        };
      };
      recent_test_activity: {
        Row: {
          id: string;
          test_name: string;
          status: TestStatus;
          started_at: string;
          duration_ms: number;
          failed_steps: number;
          total_steps: number;
          adaptation_count: number;
          container_id: string;
        };
      };
      adaptation_analytics: {
        Row: {
          test_case_name: string;
          action: string;
          adaptation_reason: string;
          confidence_score: number;
          occurrence_count: number;
          avg_confidence: number;
        };
      };
      container_utilization: {
        Row: {
          container_id: string;
          status: ContainerStatus;
          allocated_at: string;
          released_at: string | null;
          current_test_run_id: string | null;
          current_test_name: string | null;
          duration_minutes: number;
        };
      };
      storage_usage_summary: {
        Row: {
          file_type: FileType;
          bucket_name: BucketName;
          file_count: number;
          total_mb: number;
          avg_kb: number;
          archived_count: number;
          adaptation_files: number;
        };
      };
    };
  };
}

// ===== UTILITY TYPES =====

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];

// ===== TYPE ALIASES FOR EASIER IMPORT =====
export type TestCase = Tables<'test_cases'>;
export type TestRun = Tables<'test_runs'>;
export type TestStep = Tables<'test_steps'>;
export type ContainerAllocation = Tables<'container_allocations'>;
export type StorageReference = Tables<'storage_references'>;
export type AIAnalysis = Tables<'ai_analysis'>;
export type TestExecutionEvent = Tables<'test_execution_events'>;

// Insert and Update types
export type TestCaseInsert = Database['public']['Tables']['test_cases']['Insert'];
export type TestRunInsert = Database['public']['Tables']['test_runs']['Insert'];
export type TestStepInsert = Database['public']['Tables']['test_steps']['Insert'];
export type ContainerAllocationInsert = Database['public']['Tables']['container_allocations']['Insert'];
export type StorageReferenceInsert = Database['public']['Tables']['storage_references']['Insert'];
export type AIAnalysisInsert = Database['public']['Tables']['ai_analysis']['Insert'];
export type TestExecutionEventInsert = Database['public']['Tables']['test_execution_events']['Insert'];

export type TestCaseUpdate = Database['public']['Tables']['test_cases']['Update'];
export type TestRunUpdate = Database['public']['Tables']['test_runs']['Update'];
export type TestStepUpdate = Database['public']['Tables']['test_steps']['Update'];
export type ContainerAllocationUpdate = Database['public']['Tables']['container_allocations']['Update'];
export type StorageReferenceUpdate = Database['public']['Tables']['storage_references']['Update'];
export type AIAnalysisUpdate = Database['public']['Tables']['ai_analysis']['Update'];
export type TestExecutionEventUpdate = Database['public']['Tables']['test_execution_events']['Update'];