/**
 * Test Step Repository
 * Handles all database operations related to test steps
 */

import { DatabaseClient, db } from '../client';
import type { 
  TestStep, 
  TestStepInsert, 
  TestStepUpdate 
} from '../types/database';

export class TestStepRepository {
  private client: DatabaseClient;

  constructor(client: DatabaseClient = db) {
    this.client = client;
  }

  /**
   * Create a new test step
   */
  async create(data: TestStepInsert): Promise<TestStep> {
    const { data: result, error } = await this.client.client
      .from('test_steps')
      .insert(data)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create test step: ${error.message}`);
    }

    return result;
  }

  /**
   * Get test step by ID
   */
  async findById(id: string): Promise<TestStep | null> {
    const { data, error } = await this.client.client
      .from('test_steps')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to get test step: ${error.message}`);
    }

    return data;
  }

  /**
   * Update test step
   */
  async update(id: string, data: TestStepUpdate): Promise<TestStep> {
    const { data: result, error } = await this.client.client
      .from('test_steps')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update test step: ${error.message}`);
    }

    return result;
  }

  /**
   * Delete test step
   */
  async delete(id: string): Promise<void> {
    const { error } = await this.client.client
      .from('test_steps')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete test step: ${error.message}`);
    }
  }

  /**
   * Get test steps by test run ID
   */
  async findByTestRunId(testRunId: string): Promise<TestStep[]> {
    const { data, error } = await this.client.client
      .from('test_steps')
      .select('*')
      .eq('test_run_id', testRunId)
      .order('step_number', { ascending: true });

    if (error) {
      throw new Error(`Failed to get test steps by test run: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Create multiple test steps
   */
  async createMany(steps: TestStepInsert[]): Promise<TestStep[]> {
    const { data, error } = await this.client.client
      .from('test_steps')
      .insert(steps)
      .select();

    if (error) {
      throw new Error(`Failed to create test steps: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Update test step status
   */
  async updateStatus(id: string, status: TestStep['status'], errorInfo?: {
    error_type?: string;
    error_message?: string;
    error_details?: any;
  }): Promise<void> {
    const updateData: TestStepUpdate = { 
      status,
      ...errorInfo
    };

    if (status === 'success' || status === 'failed' || status === 'adapted') {
      updateData.completed_at = new Date().toISOString();
    }

    const { error } = await this.client.client
      .from('test_steps')
      .update(updateData)
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to update test step status: ${error.message}`);
    }
  }

  /**
   * Get failed steps for a test run
   */
  async findFailedByTestRunId(testRunId: string): Promise<TestStep[]> {
    const { data, error } = await this.client.client
      .from('test_steps')
      .select('*')
      .eq('test_run_id', testRunId)
      .eq('status', 'failed')
      .order('step_number', { ascending: true });

    if (error) {
      throw new Error(`Failed to get failed test steps: ${error.message}`);
    }

    return data || [];
  }
}