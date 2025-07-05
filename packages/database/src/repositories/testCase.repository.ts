/**
 * Test Case Repository
 * 
 * Handles all database operations related to test cases
 */

import { BaseRepository } from './base.repository';
import type { TestCase, TestCaseInsert, TestCaseUpdate } from '../types';
import { DatabaseError } from '../types';

export class TestCaseRepository extends BaseRepository<TestCase, TestCaseInsert, TestCaseUpdate> {
  protected tableName = 'test_cases';

  /**
   * Find test cases by name (partial match)
   */
  async findByName(name: string): Promise<TestCase[]> {
    try {
      const { data, error } = await this.client.client
        .from(this.tableName)
        .select('*')
        .ilike('name', `%${name}%`)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        throw new DatabaseError(`Failed to find test cases by name: ${error.message}`, error.code);
      }

      return data as TestCase[];
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(`Unexpected error finding test cases by name: ${error}`);
    }
  }

  /**
   * Find test cases by tags
   */
  async findByTags(tags: string[]): Promise<TestCase[]> {
    try {
      const { data, error } = await this.client.client
        .from(this.tableName)
        .select('*')
        .overlaps('tags', tags)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        throw new DatabaseError(`Failed to find test cases by tags: ${error.message}`, error.code);
      }

      return data as TestCase[];
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(`Unexpected error finding test cases by tags: ${error}`);
    }
  }

  /**
   * Find test cases with their latest test run
   */
  async findWithLatestRun(): Promise<(TestCase & { latest_run?: any })[]> {
    try {
      const { data, error } = await this.client.client
        .from(this.tableName)
        .select(`
          *,
          test_runs!inner (
            id,
            status,
            created_at,
            duration_ms,
            total_steps,
            completed_steps,
            failed_steps
          )
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        throw new DatabaseError(`Failed to find test cases with runs: ${error.message}`, error.code);
      }

      return data as any[];
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(`Unexpected error finding test cases with runs: ${error}`);
    }
  }

  /**
   * Duplicate a test case
   */
  async duplicate(id: string, newName?: string): Promise<TestCase> {
    try {
      // First, get the original test case
      const original = await this.findByIdOrThrow(id);

      // Create a copy with new name
      const duplicateData: TestCaseInsert = {
        name: newName || `${original.name} (Copy)`,
        url: original.url,
        original_scenario: original.original_scenario,
        refined_scenario: original.refined_scenario,
        test_config: original.test_config,
        tags: original.tags,
        created_by: original.created_by,
      };

      return await this.create(duplicateData);
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(`Unexpected error duplicating test case: ${error}`);
    }
  }

  /**
   * Archive a test case (soft delete)
   */
  async archive(id: string): Promise<TestCase> {
    return await this.updateById(id, { is_active: false } as TestCaseUpdate);
  }

  /**
   * Restore an archived test case
   */
  async restore(id: string): Promise<TestCase> {
    return await this.updateById(id, { is_active: true } as TestCaseUpdate);
  }

  /**
   * Find active test cases only
   */
  async findActive(options?: {
    limit?: number;
    offset?: number;
    orderBy?: string;
    ascending?: boolean;
  }): Promise<TestCase[]> {
    try {
      let query = this.client.client
        .from(this.tableName)
        .select('*')
        .eq('is_active', true);

      if (options?.orderBy) {
        query = query.order(options.orderBy, { ascending: options.ascending ?? true });
      } else {
        query = query.order('created_at', { ascending: false });
      }

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      if (options?.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 100) - 1);
      }

      const { data, error } = await query;

      if (error) {
        throw new DatabaseError(`Failed to find active test cases: ${error.message}`, error.code);
      }

      return data as TestCase[];
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(`Unexpected error finding active test cases: ${error}`);
    }
  }

  /**
   * Get test case statistics
   */
  async getStatistics(): Promise<{
    total: number;
    active: number;
    archived: number;
    withRuns: number;
  }> {
    try {
      const [totalCount, activeCount, withRunsResult] = await Promise.all([
        this.count(),
        this.count({ is_active: true }),
        this.client.client
          .from(this.tableName)
          .select('id')
          .eq('is_active', true)
          .in('id', [])
      ]);

      const withRuns = withRunsResult.data?.length || 0;

      return {
        total: totalCount,
        active: activeCount,
        archived: totalCount - activeCount,
        withRuns,
      };
    } catch (error) {
      throw new DatabaseError(`Failed to get test case statistics: ${error}`);
    }
  }
}