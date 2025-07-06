/**
 * Test Run Repository
 * 
 * Handles all database operations related to test runs
 */

import { BaseRepository } from './base.repository';
import type { TestRun, TestRunInsert, TestRunUpdate, TestRunStatus } from '../types';
import { DatabaseError } from '../types';

export class TestRunRepository extends BaseRepository<TestRun, TestRunInsert, TestRunUpdate> {
  protected tableName = 'test_runs';

  /**
   * Find test runs by test case ID
   */
  async findByTestCaseId(testCaseId: string, options?: {
    limit?: number;
    offset?: number;
  }): Promise<TestRun[]> {
    try {
      let query = this.client.client
        .from(this.tableName)
        .select('*')
        .eq('test_case_id', testCaseId)
        .order('created_at', { ascending: false });

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      if (options?.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 100) - 1);
      }

      const { data, error } = await query;

      if (error) {
        throw new DatabaseError(`Failed to find test runs by test case: ${error.message}`, error.code);
      }

      return data as TestRun[];
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(`Unexpected error finding test runs by test case: ${error}`);
    }
  }

  /**
   * Find test runs by status
   */
  async findByStatus(status: TestRunStatus): Promise<TestRun[]> {
    try {
      const { data, error } = await this.client.client
        .from(this.tableName)
        .select('*')
        .eq('status', status)
        .order('created_at', { ascending: false });

      if (error) {
        throw new DatabaseError(`Failed to find test runs by status: ${error.message}`, error.code);
      }

      return data as TestRun[];
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(`Unexpected error finding test runs by status: ${error}`);
    }
  }

  /**
   * Find test run with test steps
   */
  async findWithSteps(id: string): Promise<TestRun & { test_steps: any[] } | null> {
    try {
      const { data, error } = await this.client.client
        .from(this.tableName)
        .select(`
          *,
          test_steps (
            id,
            step_number,
            action,
            target,
            input_data,
            status,
            started_at,
            completed_at,
            duration_ms,
            error_type,
            error_message,
            snapshot_path,
            created_at
          )
        `)
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        throw new DatabaseError(`Failed to find test run with steps: ${error.message}`, error.code);
      }

      return data as any;
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(`Unexpected error finding test run with steps: ${error}`);
    }
  }

  /**
   * Update test run status
   */
  async updateStatus(id: string, status: TestRunStatus, additionalData?: {
    started_at?: string;
    completed_at?: string;
    error_summary?: string;
  }): Promise<TestRun> {
    try {
      const updateData: TestRunUpdate = {
        status,
        ...additionalData,
      };

      // Auto-set timestamps based on status
      if (status === 'running' && !additionalData?.started_at) {
        updateData.started_at = new Date().toISOString();
      } else if (['completed', 'failed', 'cancelled'].includes(status) && !additionalData?.completed_at) {
        updateData.completed_at = new Date().toISOString();
      }

      return await this.updateById(id, updateData);
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(`Unexpected error updating test run status: ${error}`);
    }
  }

  /**
   * Update step counts
   */
  async updateStepCounts(id: string, counts: {
    total_steps?: number;
    completed_steps?: number;
    failed_steps?: number;
    skipped_steps?: number;
  }): Promise<TestRun> {
    return await this.updateById(id, counts as TestRunUpdate);
  }

  /**
   * Get recent test runs
   */
  async findRecent(days: number = 7, limit: number = 50): Promise<TestRun[]> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const { data, error } = await this.client.client
        .from(this.tableName)
        .select('*')
        .gte('created_at', cutoffDate.toISOString())
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw new DatabaseError(`Failed to find recent test runs: ${error.message}`, error.code);
      }

      return data as TestRun[];
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(`Unexpected error finding recent test runs: ${error}`);
    }
  }

  /**
   * Get test run statistics
   */
  async getStatistics(testCaseId?: string): Promise<{
    total: number;
    completed: number;
    failed: number;
    running: number;
    pending: number;
    averageDuration: number | null;
    successRate: number;
  }> {
    try {
      let baseQuery = this.client.client.from(this.tableName).select('*');
      
      if (testCaseId) {
        baseQuery = baseQuery.eq('test_case_id', testCaseId);
      }

      const { data, error } = await baseQuery;

      if (error) {
        throw new DatabaseError(`Failed to get test run statistics: ${error.message}`, error.code);
      }

      const runs = data as TestRun[];
      const total = runs.length;
      const completed = runs.filter(r => r.status === 'completed').length;
      const failed = runs.filter(r => r.status === 'failed').length;
      const running = runs.filter(r => r.status === 'running').length;
      const pending = runs.filter(r => r.status === 'pending').length;

      const completedRuns = runs.filter(r => r.status === 'completed' && r.duration_ms);
      const averageDuration = completedRuns.length > 0
        ? completedRuns.reduce((sum, r) => sum + (r.duration_ms || 0), 0) / completedRuns.length
        : null;

      const successRate = total > 0 ? (completed / total) * 100 : 0;

      return {
        total,
        completed,
        failed,
        running,
        pending,
        averageDuration,
        successRate,
      };
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(`Unexpected error getting test run statistics: ${error}`);
    }
  }

  /**
   * Cancel a running test
   */
  async cancel(id: string, reason?: string): Promise<TestRun> {
    return await this.updateStatus(id, 'cancelled', {
      completed_at: new Date().toISOString(),
      error_summary: reason || 'Test cancelled by user',
    });
  }

  /**
   * Find running tests (for monitoring)
   */
  async findRunning(): Promise<TestRun[]> {
    return await this.findByStatus('running');
  }

  /**
   * Find long-running tests (potentially stuck)
   */
  async findLongRunning(minutesThreshold: number = 30): Promise<TestRun[]> {
    try {
      const cutoffTime = new Date();
      cutoffTime.setMinutes(cutoffTime.getMinutes() - minutesThreshold);

      const { data, error } = await this.client.client
        .from(this.tableName)
        .select('*')
        .eq('status', 'running')
        .lt('started_at', cutoffTime.toISOString());

      if (error) {
        throw new DatabaseError(`Failed to find long-running tests: ${error.message}`, error.code);
      }

      return data as TestRun[];
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(`Unexpected error finding long-running tests: ${error}`);
    }
  }
}