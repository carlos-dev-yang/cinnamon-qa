/**
 * Test Run Repository
 * Handles all database operations related to test runs
 */

import { DatabaseClient, db } from '../client';
import type { 
  TestRun, 
  TestRunInsert, 
  TestRunUpdate,
  TestStep 
} from '../types/database';

export class TestRunRepository {
  private client: DatabaseClient;

  constructor(client: DatabaseClient = db) {
    this.client = client;
  }

  /**
   * Create a new test run
   */
  async create(data: TestRunInsert): Promise<TestRun> {
    const { data: result, error } = await this.client.client
      .from('test_runs')
      .insert(data)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create test run: ${error.message}`);
    }

    return result;
  }

  /**
   * Get test run by ID
   */
  async findById(id: string): Promise<TestRun | null> {
    const { data, error } = await this.client.client
      .from('test_runs')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to get test run: ${error.message}`);
    }

    return data;
  }

  /**
   * Get test run with steps
   */
  async findByIdWithSteps(id: string): Promise<TestRun & { test_steps?: TestStep[] } | null> {
    const { data, error } = await this.client.client
      .from('test_runs')
      .select(`
        *,
        test_steps (*)
      `)
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to get test run with steps: ${error.message}`);
    }

    return data;
  }

  /**
   * Update test run
   */
  async update(id: string, data: TestRunUpdate): Promise<TestRun> {
    const { data: result, error } = await this.client.client
      .from('test_runs')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update test run: ${error.message}`);
    }

    return result;
  }

  /**
   * Delete test run
   */
  async delete(id: string): Promise<void> {
    const { error } = await this.client.client
      .from('test_runs')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete test run: ${error.message}`);
    }
  }

  /**
   * Get test runs by test case ID
   */
  async findByTestCaseId(testCaseId: string): Promise<TestRun[]> {
    const { data, error } = await this.client.client
      .from('test_runs')
      .select('*')
      .eq('test_case_id', testCaseId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get test runs by test case: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get recent test runs
   */
  async findRecent(limit: number = 10): Promise<TestRun[]> {
    const { data, error } = await this.client.client
      .from('test_runs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to get recent test runs: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Update test run status
   */
  async updateStatus(id: string, status: TestRun['status']): Promise<void> {
    const updateData: TestRunUpdate = { status };
    
    if (status === 'completed' || status === 'failed' || status === 'adapted') {
      updateData.completed_at = new Date().toISOString();
    }

    const { error } = await this.client.client
      .from('test_runs')
      .update(updateData)
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to update test run status: ${error.message}`);
    }
  }
}