/**
 * Test Step Repository
 * 
 * Handles all database operations related to test steps
 */

import { BaseRepository } from './base.repository';
import type { TestStep, TestStepInsert, TestStepUpdate, TestStepStatus } from '../types';
import { DatabaseError } from '../types';

export class TestStepRepository extends BaseRepository<TestStep, TestStepInsert, TestStepUpdate> {
  protected tableName = 'test_steps';

  /**
   * Find test steps by test run ID
   */
  async findByTestRunId(testRunId: string): Promise<TestStep[]> {
    try {
      const { data, error } = await this.client.client
        .from(this.tableName)
        .select('*')
        .eq('test_run_id', testRunId)
        .order('step_number', { ascending: true });

      if (error) {
        throw new DatabaseError(`Failed to find test steps by test run: ${error.message}`, error.code);
      }

      return data as TestStep[];
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(`Unexpected error finding test steps by test run: ${error}`);
    }
  }

  /**
   * Find test steps with storage references (screenshots, etc.)
   */
  async findWithStorageReferences(testRunId: string): Promise<(TestStep & { storage_references: any[] })[]> {
    try {
      const { data, error } = await this.client.client
        .from(this.tableName)
        .select(`
          *,
          storage_references (
            id,
            file_type,
            file_path,
            storage_url,
            created_at
          )
        `)
        .eq('test_run_id', testRunId)
        .order('step_number', { ascending: true });

      if (error) {
        throw new DatabaseError(`Failed to find test steps with storage: ${error.message}`, error.code);
      }

      return data as any[];
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(`Unexpected error finding test steps with storage: ${error}`);
    }
  }

  /**
   * Update step status
   */
  async updateStatus(id: string, status: TestStepStatus, additionalData?: {
    started_at?: string;
    completed_at?: string;
    error_type?: string;
    error_message?: string;
    error_details?: Record<string, any>;
  }): Promise<TestStep> {
    try {
      const updateData: TestStepUpdate = {
        status,
        ...additionalData,
      };

      // Auto-set timestamps based on status
      if (status === 'running' && !additionalData?.started_at) {
        updateData.started_at = new Date().toISOString();
      } else if (['success', 'failed', 'skipped'].includes(status) && !additionalData?.completed_at) {
        updateData.completed_at = new Date().toISOString();
      }

      return await this.updateById(id, updateData);
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(`Unexpected error updating test step status: ${error}`);
    }
  }

  /**
   * Add snapshot to step
   */
  async addSnapshot(id: string, snapshotPath: string, metadata?: Record<string, any>): Promise<TestStep> {
    return await this.updateById(id, {
      snapshot_path: snapshotPath,
      snapshot_metadata: metadata,
    } as TestStepUpdate);
  }

  /**
   * Add DOM snapshot to step
   */
  async addDomSnapshot(id: string, domSnapshot: Record<string, any>): Promise<TestStep> {
    return await this.updateById(id, {
      dom_snapshot: domSnapshot,
    } as TestStepUpdate);
  }

  /**
   * Add console logs to step
   */
  async addConsoleLogs(id: string, logs: Record<string, any>): Promise<TestStep> {
    return await this.updateById(id, {
      console_logs: logs,
    } as TestStepUpdate);
  }

  /**
   * Add network logs to step
   */
  async addNetworkLogs(id: string, logs: Record<string, any>): Promise<TestStep> {
    return await this.updateById(id, {
      network_logs: logs,
    } as TestStepUpdate);
  }

  /**
   * Create multiple steps for a test run
   */
  async createBatch(steps: TestStepInsert[]): Promise<TestStep[]> {
    try {
      const { data, error } = await this.client.client
        .from(this.tableName)
        .insert(steps)
        .select();

      if (error) {
        throw new DatabaseError(`Failed to create test steps batch: ${error.message}`, error.code);
      }

      return data as TestStep[];
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(`Unexpected error creating test steps batch: ${error}`);
    }
  }

  /**
   * Find failed steps
   */
  async findFailed(testRunId?: string): Promise<TestStep[]> {
    try {
      let query = this.client.client
        .from(this.tableName)
        .select('*')
        .eq('status', 'failed')
        .order('created_at', { ascending: false });

      if (testRunId) {
        query = query.eq('test_run_id', testRunId);
      }

      const { data, error } = await query;

      if (error) {
        throw new DatabaseError(`Failed to find failed steps: ${error.message}`, error.code);
      }

      return data as TestStep[];
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(`Unexpected error finding failed steps: ${error}`);
    }
  }

  /**
   * Get step statistics for a test run
   */
  async getStatistics(testRunId: string): Promise<{
    total: number;
    pending: number;
    running: number;
    success: number;
    failed: number;
    skipped: number;
    averageDuration: number | null;
  }> {
    try {
      const { data, error } = await this.client.client
        .from(this.tableName)
        .select('*')
        .eq('test_run_id', testRunId);

      if (error) {
        throw new DatabaseError(`Failed to get step statistics: ${error.message}`, error.code);
      }

      const steps = data as TestStep[];
      const total = steps.length;
      const pending = steps.filter(s => s.status === 'pending').length;
      const running = steps.filter(s => s.status === 'running').length;
      const success = steps.filter(s => s.status === 'success').length;
      const failed = steps.filter(s => s.status === 'failed').length;
      const skipped = steps.filter(s => s.status === 'skipped').length;

      const completedSteps = steps.filter(s => 
        s.status === 'success' && s.duration_ms !== null
      );
      
      const averageDuration = completedSteps.length > 0
        ? completedSteps.reduce((sum, s) => sum + (s.duration_ms || 0), 0) / completedSteps.length
        : null;

      return {
        total,
        pending,
        running,
        success,
        failed,
        skipped,
        averageDuration,
      };
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(`Unexpected error getting step statistics: ${error}`);
    }
  }

  /**
   * Find steps by action type
   */
  async findByAction(action: string, limit?: number): Promise<TestStep[]> {
    try {
      let query = this.client.client
        .from(this.tableName)
        .select('*')
        .eq('action', action)
        .order('created_at', { ascending: false });

      if (limit) {
        query = query.limit(limit);
      }

      const { data, error } = await query;

      if (error) {
        throw new DatabaseError(`Failed to find steps by action: ${error.message}`, error.code);
      }

      return data as TestStep[];
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(`Unexpected error finding steps by action: ${error}`);
    }
  }

  /**
   * Find current step (running or latest pending) for a test run
   */
  async findCurrentStep(testRunId: string): Promise<TestStep | null> {
    try {
      // First try to find a running step
      const { data: runningStep, error: runningError } = await this.client.client
        .from(this.tableName)
        .select('*')
        .eq('test_run_id', testRunId)
        .eq('status', 'running')
        .single();

      if (!runningError && runningStep) {
        return runningStep as TestStep;
      }

      // If no running step, find the next pending step
      const { data: pendingStep, error: pendingError } = await this.client.client
        .from(this.tableName)
        .select('*')
        .eq('test_run_id', testRunId)
        .eq('status', 'pending')
        .order('step_number', { ascending: true })
        .limit(1)
        .single();

      if (pendingError && pendingError.code === 'PGRST116') {
        return null; // No current step
      }

      if (pendingError) {
        throw new DatabaseError(`Failed to find current step: ${pendingError.message}`, pendingError.code);
      }

      return pendingStep as TestStep;
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(`Unexpected error finding current step: ${error}`);
    }
  }
}