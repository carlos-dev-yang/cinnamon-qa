/**
 * Enhanced Test Case Repository for Adaptive Testing
 * Handles all database operations related to test cases with adaptation patterns and reliability tracking
 */

import { BaseRepository } from './base.repository';
import type { 
  TestCase, 
  TestCaseInsert, 
  TestCaseUpdate,
  AdaptationPattern 
} from '../types/database';

export class TestCaseRepository extends BaseRepository {
  private readonly tableName = 'test_cases';

  /**
   * Create a new test case
   */
  async create(data: TestCaseInsert): Promise<TestCase> {
    const { data: result, error } = await this.client
      .from(this.tableName)
      .insert(data)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create test case: ${error.message}`);
    }

    return result;
  }

  /**
   * Get test case by ID
   */
  async getById(id: string): Promise<TestCase | null> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to get test case: ${error.message}`);
    }

    return data;
  }

  /**
   * Update test case by ID
   */
  async updateById(id: string, data: TestCaseUpdate): Promise<TestCase> {
    const { data: result, error } = await this.client
      .from(this.tableName)
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update test case: ${error.message}`);
    }

    return result;
  }

  /**
   * Find test cases by name (partial match)
   */
  async findByName(name: string): Promise<TestCase[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .ilike('name', `%${name}%`)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to find test cases by name: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Find test cases by tags
   */
  async findByTags(tags: string[]): Promise<TestCase[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .overlaps('tags', tags)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to find test cases by tags: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Find test cases by reliability score range
   */
  async findByReliabilityScore(
    minScore: number = 0,
    maxScore: number = 1
  ): Promise<TestCase[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .gte('reliability_score', minScore)
      .lte('reliability_score', maxScore)
      .eq('is_active', true)
      .order('reliability_score', { ascending: false });

    if (error) {
      throw new Error(`Failed to find test cases by reliability: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Find test cases with their latest test run and adaptation metrics
   */
  async findWithLatestRun(): Promise<Array<TestCase & { latest_run?: any }>> {
    const { data, error } = await this.client
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
          failed_steps,
          adapted_steps,
          adaptation_count,
          recovery_attempts,
          container_id
        )
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to find test cases with runs: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Duplicate a test case
   */
  async duplicate(id: string, newName?: string): Promise<TestCase> {
    const original = await this.getById(id);
    if (!original) {
      throw new Error(`Test case with ID ${id} not found`);
    }

    const duplicateData: TestCaseInsert = {
      name: newName || `${original.name} (Copy)`,
      url: original.url,
      original_scenario: original.original_scenario,
      refined_scenario: original.refined_scenario,
      test_config: original.test_config,
      tags: original.tags,
      created_by: original.created_by,
      // Don't copy adaptation patterns or reliability score - let it build up naturally
      adaptation_patterns: [],
      reliability_score: 0.0
    };

    return this.create(duplicateData);
  }

  /**
   * Archive a test case (soft delete)
   */
  async archive(id: string): Promise<TestCase> {
    return this.updateById(id, { is_active: false });
  }

  /**
   * Restore an archived test case
   */
  async restore(id: string): Promise<TestCase> {
    return this.updateById(id, { is_active: true });
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
    let query = this.client
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
      throw new Error(`Failed to find active test cases: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Add adaptation pattern to test case
   */
  async addAdaptationPattern(
    id: string,
    pattern: Omit<AdaptationPattern, 'created_at'>
  ): Promise<TestCase> {
    const testCase = await this.getById(id);
    if (!testCase) {
      throw new Error(`Test case with ID ${id} not found`);
    }

    const newPattern: AdaptationPattern = {
      ...pattern,
      created_at: new Date().toISOString()
    };

    const updatedPatterns = [...(testCase.adaptation_patterns || []), newPattern];

    // Keep only the latest 10 patterns to avoid unbounded growth
    if (updatedPatterns.length > 10) {
      updatedPatterns.splice(0, updatedPatterns.length - 10);
    }

    return this.updateById(id, {
      adaptation_patterns: updatedPatterns
    });
  }

  /**
   * Get adaptation patterns for a test case
   */
  async getAdaptationPatterns(id: string): Promise<AdaptationPattern[]> {
    const testCase = await this.getById(id);
    return testCase?.adaptation_patterns || [];
  }

  /**
   * Update reliability score
   */
  async updateReliabilityScore(id: string, score: number): Promise<TestCase> {
    // Ensure score is within valid range
    const clampedScore = Math.max(0, Math.min(1, score));
    
    return this.updateById(id, {
      reliability_score: clampedScore
    });
  }

  /**
   * Find similar test cases based on URL and scenario content
   */
  async findSimilar(
    url: string,
    scenario: string,
    limit: number = 5
  ): Promise<TestCase[]> {
    // Simple similarity search - could be enhanced with vector similarity
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('url', url)
      .eq('is_active', true)
      .order('reliability_score', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to find similar test cases: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get test cases that need reliability updates
   */
  async getStaleReliabilityScores(daysSinceUpdate: number = 7): Promise<TestCase[]> {
    const threshold = new Date(Date.now() - daysSinceUpdate * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('is_active', true)
      .lt('updated_at', threshold)
      .order('updated_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to get stale reliability scores: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get test case statistics including adaptive metrics
   */
  async getStatistics(): Promise<{
    total: number;
    active: number;
    archived: number;
    withRuns: number;
    avgReliabilityScore: number;
    highReliability: number; // reliability > 0.8
    lowReliability: number;  // reliability < 0.3
    withAdaptationPatterns: number;
  }> {
    const { data: allStats, error: statsError } = await this.client
      .from(this.tableName)
      .select('is_active, reliability_score, adaptation_patterns');

    if (statsError) {
      throw new Error(`Failed to get test case statistics: ${statsError.message}`);
    }

    const stats = (allStats || []).reduce(
      (acc, testCase) => {
        acc.total += 1;
        if (testCase.is_active) {
          acc.active += 1;
          acc.reliabilitySum += testCase.reliability_score || 0;
          
          if (testCase.reliability_score >= 0.8) {
            acc.highReliability += 1;
          } else if (testCase.reliability_score < 0.3) {
            acc.lowReliability += 1;
          }

          if (testCase.adaptation_patterns && testCase.adaptation_patterns.length > 0) {
            acc.withAdaptationPatterns += 1;
          }
        } else {
          acc.archived += 1;
        }
        return acc;
      },
      {
        total: 0,
        active: 0,
        archived: 0,
        reliabilitySum: 0,
        highReliability: 0,
        lowReliability: 0,
        withAdaptationPatterns: 0
      }
    );

    // Get count of test cases with runs
    const { data: withRunsData, error: runsError } = await this.client
      .from('test_execution_summary')
      .select('test_case_id')
      .gt('total_runs', 0);

    if (runsError) {
      throw new Error(`Failed to get test cases with runs: ${runsError.message}`);
    }

    return {
      total: stats.total,
      active: stats.active,
      archived: stats.archived,
      withRuns: withRunsData?.length || 0,
      avgReliabilityScore: stats.active > 0 ? stats.reliabilitySum / stats.active : 0,
      highReliability: stats.highReliability,
      lowReliability: stats.lowReliability,
      withAdaptationPatterns: stats.withAdaptationPatterns
    };
  }

  /**
   * Search test cases with full-text search
   */
  async search(
    query: string,
    options?: {
      limit?: number;
      includeArchived?: boolean;
    }
  ): Promise<TestCase[]> {
    let dbQuery = this.client
      .from(this.tableName)
      .select('*')
      .or(`name.ilike.%${query}%,original_scenario.ilike.%${query}%,url.ilike.%${query}%`)
      .order('reliability_score', { ascending: false });

    if (!options?.includeArchived) {
      dbQuery = dbQuery.eq('is_active', true);
    }

    if (options?.limit) {
      dbQuery = dbQuery.limit(options.limit);
    }

    const { data, error } = await dbQuery;

    if (error) {
      throw new Error(`Failed to search test cases: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Update test configuration
   */
  async updateTestConfig(
    id: string,
    configUpdate: Partial<TestCase['test_config']>
  ): Promise<TestCase> {
    const testCase = await this.getById(id);
    if (!testCase) {
      throw new Error(`Test case with ID ${id} not found`);
    }

    const updatedConfig = {
      ...testCase.test_config,
      ...configUpdate
    };

    return this.updateById(id, {
      test_config: updatedConfig
    });
  }

  /**
   * Get test cases ordered by reliability for prioritization
   */
  async getOrderedByReliability(limit: number = 50): Promise<TestCase[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('is_active', true)
      .order('reliability_score', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to get test cases by reliability: ${error.message}`);
    }

    return data || [];
  }
}