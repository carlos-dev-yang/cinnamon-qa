/**
 * Test Case Repository
 * Handles all database operations related to test cases
 */

import { DatabaseClient, db } from '../client';
import type { 
  TestCase, 
  TestCaseInsert, 
  TestCaseUpdate,
  TestRun 
} from '../types/database';

export class TestCaseRepository {
  private client: DatabaseClient;

  constructor(client: DatabaseClient = db) {
    this.client = client;
  }

  /**
   * Create a new test case
   */
  async create(data: TestCaseInsert): Promise<TestCase> {
    const { data: result, error } = await this.client.client
      .from('test_cases')
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
  async findById(id: string): Promise<TestCase | null> {
    const { data, error } = await this.client.client
      .from('test_cases')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to get test case: ${error.message}`);
    }

    return data;
  }

  /**
   * Get test case with test runs
   */
  async findByIdWithRuns(id: string): Promise<TestCase & { test_runs?: TestRun[] } | null> {
    const { data, error } = await this.client.client
      .from('test_cases')
      .select(`
        *,
        test_runs (*)
      `)
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to get test case with runs: ${error.message}`);
    }

    return data;
  }

  /**
   * Update test case
   */
  async update(id: string, data: TestCaseUpdate): Promise<TestCase> {
    const { data: result, error } = await this.client.client
      .from('test_cases')
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
   * Delete test case
   */
  async delete(id: string): Promise<void> {
    const { error } = await this.client.client
      .from('test_cases')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete test case: ${error.message}`);
    }
  }

  /**
   * List all test cases
   */
  async findAll(options?: {
    limit?: number;
    offset?: number;
    orderBy?: string;
    ascending?: boolean;
  }): Promise<TestCase[]> {
    let query = this.client.client
      .from('test_cases')
      .select('*');

    if (options?.orderBy) {
      query = query.order(options.orderBy, { ascending: options.ascending ?? true });
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 100) - 1);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to list test cases: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Search test cases by name or tags
   */
  async search(searchTerm: string): Promise<TestCase[]> {
    const { data, error } = await this.client.client
      .from('test_cases')
      .select('*')
      .or(`name.ilike.%${searchTerm}%,tags.cs.{${searchTerm}}`)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to search test cases: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Update reliability score
   */
  async updateReliabilityScore(id: string, score: number): Promise<void> {
    const { error } = await this.client.client
      .from('test_cases')
      .update({ reliability_score: score })
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to update reliability score: ${error.message}`);
    }
  }
}