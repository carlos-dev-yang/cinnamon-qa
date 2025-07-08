import { BaseRepository } from './base.repository';
import type { 
  ContainerAllocation, 
  ContainerAllocationInsert, 
  ContainerAllocationUpdate
} from '../types/database';

type ContainerStatus = 'allocated' | 'in_use' | 'idle' | 'terminated' | 'error';
type ContainerMetadata = {
  health: string;
  resourceUsage: Record<string, any>;
  errorCount: number;
};

export class ContainerAllocationRepository extends BaseRepository<ContainerAllocation, ContainerAllocationInsert, ContainerAllocationUpdate> {
  protected readonly tableName = 'container_allocations';

  /**
   * Create a new container allocation
   */
  async create(data: ContainerAllocationInsert): Promise<ContainerAllocation> {
    const { data: result, error } = await this.client.client
      .from(this.tableName)
      .insert(data)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create container allocation: ${error.message}`);
    }

    return result;
  }

  /**
   * Get container allocation by ID
   */
  async getById(id: string): Promise<ContainerAllocation | null> {
    const { data, error } = await this.client.client
      .from(this.tableName)
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to get container allocation: ${error.message}`);
    }

    return data;
  }

  /**
   * Get container allocation by container ID
   */
  async getByContainerId(containerId: string): Promise<ContainerAllocation | null> {
    const { data, error } = await this.client.client
      .from(this.tableName)
      .select('*')
      .eq('container_id', containerId)
      .order('allocated_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to get container allocation by container ID: ${error.message}`);
    }

    return data;
  }

  /**
   * Get active container allocation for a test run
   */
  async getActiveByTestRunId(testRunId: string): Promise<ContainerAllocation | null> {
    const { data, error } = await this.client.client
      .from(this.tableName)
      .select('*')
      .eq('test_run_id', testRunId)
      .eq('status', 'active')
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to get active container allocation: ${error.message}`);
    }

    return data;
  }

  /**
   * Get all active container allocations
   */
  async getActiveAllocations(): Promise<ContainerAllocation[]> {
    const { data, error } = await this.client.client
      .from(this.tableName)
      .select('*')
      .eq('status', 'active')
      .order('allocated_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get active allocations: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get available containers (not actively allocated)
   */
  async getAvailableContainers(): Promise<string[]> {
    // Get all container IDs that are not currently active
    const { data, error } = await this.client.client
      .from(this.tableName)
      .select('container_id')
      .neq('status', 'active')
      .order('released_at', { ascending: false, nullsFirst: false });

    if (error) {
      throw new Error(`Failed to get available containers: ${error.message}`);
    }

    // Return unique container IDs
    const containerIds = data?.map((item: any) => item.container_id) || [];
    return [...new Set(containerIds)];
  }

  /**
   * Allocate a container for a test run
   */
  async allocateContainer(containerId: string, testRunId: string): Promise<ContainerAllocation> {
    // First check if container is available
    const existing = await this.getByContainerId(containerId);
    if (existing && existing.status === 'in_use') {
      throw new Error(`Container ${containerId} is already allocated`);
    }

    // Create new allocation
    const allocation: ContainerAllocationInsert = {
      container_id: containerId,
      test_run_id: testRunId,
      status: 'in_use',
      metadata: {
        health: 'healthy',
        resourceUsage: {},
        errorCount: 0
      }
    };

    return this.create(allocation);
  }

  /**
   * Release a container allocation
   */
  async releaseContainer(containerId: string): Promise<ContainerAllocation | null> {
    const { data, error } = await this.client.client
      .from(this.tableName)
      .update({
        status: 'terminated',
        released_at: new Date().toISOString()
      } as ContainerAllocationUpdate)
      .eq('container_id', containerId)
      .eq('status', 'active')
      .select()
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to release container: ${error.message}`);
    }

    return data;
  }

  /**
   * Update container status
   */
  async updateStatus(
    containerId: string, 
    status: ContainerStatus, 
    metadata?: Record<string, any>
  ): Promise<ContainerAllocation | null> {
    const updateData: ContainerAllocationUpdate = { status };
    
    if (metadata) {
      updateData.metadata = metadata as ContainerMetadata;
    }

    if (status === 'terminated') {
      updateData.released_at = new Date().toISOString();
    }

    const { data, error } = await this.client.client
      .from(this.tableName)
      .update(updateData)
      .eq('container_id', containerId)
      .eq('status', 'active')
      .select()
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to update container status: ${error.message}`);
    }

    return data;
  }

  /**
   * Update container health metadata
   */
  async updateHealth(
    containerId: string,
    health: string,
    resourceUsage?: Record<string, any>
  ): Promise<void> {
    const allocation = await this.getByContainerId(containerId);
    if (!allocation || allocation.status !== 'in_use') {
      return; // Container not active, skip health update
    }

    const updatedMetadata = {
      ...allocation.metadata,
      health,
      lastHeartbeat: new Date().toISOString(),
      ...(resourceUsage && { resourceUsage })
    };

    await this.client.client
      .from(this.tableName)
      .update({ metadata: updatedMetadata } as ContainerAllocationUpdate)
      .eq('id', allocation.id);
  }

  /**
   * Get container utilization statistics
   */
  async getUtilizationStats(): Promise<{
    total: number;
    active: number;
    available: number;
    avgDurationMinutes: number;
  }> {
    const { data: stats, error } = await this.client.client
      .from('container_utilization')
      .select('*');

    if (error) {
      throw new Error(`Failed to get utilization stats: ${error.message}`);
    }

    const total = stats?.length || 0;
    const active = stats?.filter(s => s.status === 'active').length || 0;
    const available = total - active;
    const avgDurationMinutes = stats?.length ? 
      stats.reduce((sum, s) => sum + s.duration_minutes, 0) / stats.length : 0;

    return {
      total,
      active,
      available,
      avgDurationMinutes
    };
  }

  /**
   * Clean up stale allocations (containers that haven't reported in)
   */
  async cleanupStaleAllocations(staleThresholdMinutes = 30): Promise<number> {
    const staleThreshold = new Date(Date.now() - staleThresholdMinutes * 60 * 1000).toISOString();
    
    const { data, error } = await this.client.client
      .from(this.tableName)
      .update({
        status: 'error',
        released_at: new Date().toISOString()
      } as ContainerAllocationUpdate)
      .eq('status', 'active')
      .lt('allocated_at', staleThreshold)
      .select('id');

    if (error) {
      throw new Error(`Failed to cleanup stale allocations: ${error.message}`);
    }

    return data?.length || 0;
  }

  /**
   * Delete old allocation records
   */
  async deleteOldRecords(olderThanDays = 30): Promise<number> {
    const threshold = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString();
    
    const { data, error } = await this.client.client
      .from(this.tableName)
      .delete()
      .neq('status', 'active')
      .lt('created_at', threshold)
      .select('id');

    if (error) {
      throw new Error(`Failed to delete old allocation records: ${error.message}`);
    }

    return data?.length || 0;
  }
}