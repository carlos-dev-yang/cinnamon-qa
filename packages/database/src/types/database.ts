/**
 * Database type definitions
 * 
 * Note: This is a placeholder for Supabase generated types.
 * Run `npm run generate-types` to generate actual types from Supabase schema.
 */

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
          test_config: Record<string, any>;
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
          test_config?: Record<string, any>;
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
          test_config?: Record<string, any>;
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
          status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
          started_at: string | null;
          completed_at: string | null;
          duration_ms: number | null;
          total_steps: number;
          completed_steps: number;
          failed_steps: number;
          skipped_steps: number;
          environment: Record<string, any>;
          error_summary: string | null;
          metrics: Record<string, any>;
          created_at: string;
        };
        Insert: {
          id?: string;
          test_case_id: string;
          status?: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
          started_at?: string | null;
          completed_at?: string | null;
          duration_ms?: number | null;
          total_steps?: number;
          completed_steps?: number;
          failed_steps?: number;
          skipped_steps?: number;
          environment?: Record<string, any>;
          error_summary?: string | null;
          metrics?: Record<string, any>;
          created_at?: string;
        };
        Update: {
          id?: string;
          test_case_id?: string;
          status?: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
          started_at?: string | null;
          completed_at?: string | null;
          duration_ms?: number | null;
          total_steps?: number;
          completed_steps?: number;
          failed_steps?: number;
          skipped_steps?: number;
          environment?: Record<string, any>;
          error_summary?: string | null;
          metrics?: Record<string, any>;
          created_at?: string;
        };
      };
      test_steps: {
        Row: {
          id: string;
          test_run_id: string;
          step_number: number;
          action: string;
          target: Record<string, any> | null;
          input_data: Record<string, any> | null;
          status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
          started_at: string | null;
          completed_at: string | null;
          duration_ms: number | null;
          error_type: string | null;
          error_message: string | null;
          error_details: Record<string, any> | null;
          snapshot_path: string | null;
          snapshot_metadata: Record<string, any> | null;
          dom_snapshot: Record<string, any> | null;
          console_logs: Record<string, any> | null;
          network_logs: Record<string, any> | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          test_run_id: string;
          step_number: number;
          action: string;
          target?: Record<string, any> | null;
          input_data?: Record<string, any> | null;
          status?: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
          started_at?: string | null;
          completed_at?: string | null;
          duration_ms?: number | null;
          error_type?: string | null;
          error_message?: string | null;
          error_details?: Record<string, any> | null;
          snapshot_path?: string | null;
          snapshot_metadata?: Record<string, any> | null;
          dom_snapshot?: Record<string, any> | null;
          console_logs?: Record<string, any> | null;
          network_logs?: Record<string, any> | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          test_run_id?: string;
          step_number?: number;
          action?: string;
          target?: Record<string, any> | null;
          input_data?: Record<string, any> | null;
          status?: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
          started_at?: string | null;
          completed_at?: string | null;
          duration_ms?: number | null;
          error_type?: string | null;
          error_message?: string | null;
          error_details?: Record<string, any> | null;
          snapshot_path?: string | null;
          snapshot_metadata?: Record<string, any> | null;
          dom_snapshot?: Record<string, any> | null;
          console_logs?: Record<string, any> | null;
          network_logs?: Record<string, any> | null;
          created_at?: string;
        };
      };
      storage_references: {
        Row: {
          id: string;
          bucket_name: string;
          file_path: string;
          file_type: string;
          file_size_bytes: number | null;
          mime_type: string | null;
          test_run_id: string | null;
          test_step_id: string | null;
          metadata: Record<string, any>;
          created_at: string;
          last_accessed_at: string;
          expires_at: string | null;
          is_archived: boolean;
          archived_at: string | null;
          storage_url: string;
          access_count: number;
        };
        Insert: {
          id?: string;
          bucket_name?: string;
          file_path: string;
          file_type: string;
          file_size_bytes?: number | null;
          mime_type?: string | null;
          test_run_id?: string | null;
          test_step_id?: string | null;
          metadata?: Record<string, any>;
          created_at?: string;
          last_accessed_at?: string;
          expires_at?: string | null;
          is_archived?: boolean;
          archived_at?: string | null;
          access_count?: number;
        };
        Update: {
          id?: string;
          bucket_name?: string;
          file_path?: string;
          file_type?: string;
          file_size_bytes?: number | null;
          mime_type?: string | null;
          test_run_id?: string | null;
          test_step_id?: string | null;
          metadata?: Record<string, any>;
          created_at?: string;
          last_accessed_at?: string;
          expires_at?: string | null;
          is_archived?: boolean;
          archived_at?: string | null;
          access_count?: number;
        };
      };
    };
  };
}