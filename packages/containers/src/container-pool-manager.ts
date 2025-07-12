import { RedisClient } from '@cinnamon-qa/queue';
import { PlaywrightMcpContainer } from './container';
import { SimpleHealthChecker } from './health-checker';
import { DockerInspector } from './docker-inspector';
import { AllocationQueue, QueuedRequest } from './allocation-queue';
import { HealthMonitor, ContainerHealthStatus } from './health-monitor';
import { CleanupService } from './cleanup-service';
import { ContainerResetManager } from './container-reset-manager';
import { Container, ContainerState, ContainerPoolConfig } from './types';

export interface PoolMetrics {
  totalContainers: number;
  availableContainers: number;
  allocatedContainers: number;
  queueSize: number;
  averageAllocationTime: number;
  totalAllocations: number;
  totalReleases: number;
  failedAllocations: number;
}

export class ContainerPoolManager {
  private containers: Map<string, PlaywrightMcpContainer> = new Map();
  private healthChecker: SimpleHealthChecker;
  private dockerInspector: DockerInspector;
  private redisClient: RedisClient;
  private allocationQueue: AllocationQueue;
  private healthMonitor: HealthMonitor;
  private cleanupService: CleanupService;
  private resetManager: ContainerResetManager;
  
  // Metrics
  private metrics: PoolMetrics = {
    totalContainers: 0,
    availableContainers: 0,
    allocatedContainers: 0,
    queueSize: 0,
    averageAllocationTime: 0,
    totalAllocations: 0,
    totalReleases: 0,
    failedAllocations: 0,
  };
  
  // Fixed pool configuration for 2 containers
  private readonly poolConfig: ContainerPoolConfig = {
    containers: [
      { id: 'container-1', name: 'cinnamon-qa-mcp-1', port: 3001 },
      { id: 'container-2', name: 'cinnamon-qa-mcp-2', port: 3002 },
    ],
  };

  constructor(redisClient: RedisClient) {
    this.redisClient = redisClient;
    this.healthChecker = new SimpleHealthChecker();
    this.dockerInspector = new DockerInspector();
    this.allocationQueue = new AllocationQueue(redisClient);
    this.healthMonitor = new HealthMonitor(redisClient);
    this.cleanupService = new CleanupService();
    this.resetManager = new ContainerResetManager(this.cleanupService, this.healthChecker);
    
    // Setup event listeners
    this.setupHealthMonitorEvents();
    this.setupCleanupEvents();
    this.setupResetEvents();
  }

  /**
   * Setup health monitor event listeners
   */
  private setupHealthMonitorEvents(): void {
    this.healthMonitor.on('containerUnhealthy', async (event) => {
      console.log(`Container ${event.containerId} marked as unhealthy (${event.consecutiveFailures} failures)`);
      await this.handleUnhealthyContainer(event.containerId);
    });

    this.healthMonitor.on('memoryThresholdExceeded', (event) => {
      console.warn(`Container ${event.containerId} exceeded memory threshold: ${event.memoryUsage}MB > ${event.threshold}MB`);
    });

    this.healthMonitor.on('cpuThresholdExceeded', (event) => {
      console.warn(`Container ${event.containerId} exceeded CPU threshold: ${event.cpuUsage}% > ${event.threshold}%`);
    });

    this.healthMonitor.on('statusChanged', (event) => {
      console.log(`Container ${event.containerId} status changed: ${event.previousStatus} → ${event.newStatus}`);
    });
  }

  /**
   * Setup cleanup service event listeners
   */
  private setupCleanupEvents(): void {
    this.cleanupService.on('cleanupStarted', (event) => {
      console.log(`🧹 Cleanup started for container ${event.containerName}`);
    });

    this.cleanupService.on('cleanupCompleted', (event) => {
      console.log(`✅ Cleanup completed for container ${event.containerName}`);
    });

    this.cleanupService.on('cleanupFailed', (event) => {
      console.warn(`⚠️ Cleanup failed for container ${event.containerName}:`, event.result.errors);
    });
  }

  /**
   * Setup reset manager event listeners
   */
  private setupResetEvents(): void {
    this.resetManager.on('resetStarted', (event) => {
      console.log(`🔄 Container reset started for ${event.containerName} (${event.reason})`);
    });

    this.resetManager.on('resetCompleted', (event) => {
      console.log(`✅ Container reset completed for ${event.containerName} using ${event.strategy}`);
    });

    this.resetManager.on('resetFailed', (event) => {
      console.error(`❌ Container reset failed for ${event.containerName}:`, event.result.errors);
    });
  }

  /**
   * Handle unhealthy container with reset manager
   */
  private async handleUnhealthyContainer(containerId: string): Promise<void> {
    const container = this.containers.get(containerId);
    if (!container) return;

    try {
      console.log(`Handling unhealthy container ${containerId} with reset manager`);
      
      // Use reset manager instead of simple restart
      const resetResult = await this.resetManager.resetOnHealthFailure(container);
      
      if (resetResult?.success) {
        // Re-register with health monitor after successful reset
        this.healthMonitor.registerContainer(containerId, container.name, container.port);
        console.log(`Container ${containerId} reset and re-registered successfully`);
      } else {
        console.error(`Failed to reset container ${containerId}:`, resetResult?.errors);
        // Mark container as problematic (in production, might trigger replacement)
      }
    } catch (error) {
      console.error(`Failed to handle unhealthy container ${containerId}:`, error);
    }
  }

  /**
   * Initialize the container pool
   */
  async initialize(): Promise<void> {
    console.log('Initializing container pool manager...');
    
    // Initialize Docker environment
    await this.dockerInspector.initialize();

    // Create and start containers
    for (const config of this.poolConfig.containers) {
      const container = new PlaywrightMcpContainer(
        config.id,
        config.name,
        config.port
      );
      
      try {
        await container.start();
        this.containers.set(config.id, container);
        
        // Initialize Redis state
        await this.updateContainerState(config.id, {
          containerId: config.id,
          port: config.port,
          allocated: false,
          lastCheckedAt: new Date(),
        });
        
        // Register with health monitor
        this.healthMonitor.registerContainer(config.id, config.name, config.port);
        
        console.log(`Container ${config.id} started successfully on port ${config.port}`);
      } catch (error) {
        console.error(`Failed to start container ${config.id}:`, error);
        this.metrics.failedAllocations++;
      }
    }

    // Start health monitoring
    this.healthMonitor.startMonitoring();
    
    // Update metrics
    await this.updateMetrics();
    console.log('Container pool manager initialized with health monitoring');
  }

  /**
   * Allocate a container (with queue support)
   */
  async allocateContainer(testRunId: string, waitForAvailable = true, timeoutMs = 300000): Promise<Container | null> {
    const startTime = Date.now();
    
    try {
      // Try immediate allocation first
      const immediateContainer = await this.tryImmediateAllocation(testRunId);
      if (immediateContainer) {
        this.metrics.totalAllocations++;
        this.updateAllocationTime(Date.now() - startTime);
        await this.updateMetrics();
        return immediateContainer;
      }

      // If no container available and not waiting, return null
      if (!waitForAvailable) {
        this.metrics.failedAllocations++;
        await this.updateMetrics();
        return null;
      }

      // Add to queue and wait
      console.log(`No containers immediately available, queuing ${testRunId}`);
      await this.allocationQueue.enqueue(testRunId, timeoutMs);
      
      // Poll for container availability
      const container = await this.waitForContainer(testRunId, timeoutMs);
      
      if (container) {
        this.metrics.totalAllocations++;
        this.updateAllocationTime(Date.now() - startTime);
      } else {
        this.metrics.failedAllocations++;
      }
      
      await this.updateMetrics();
      return container;
      
    } catch (error) {
      console.error('Error in container allocation:', error);
      this.metrics.failedAllocations++;
      await this.updateMetrics();
      return null;
    }
  }

  /**
   * Try to allocate a container immediately
   */
  private async tryImmediateAllocation(testRunId: string): Promise<Container | null> {
    // Find available container
    const availableContainer = await this.findAvailableContainer();
    if (!availableContainer) {
      return null;
    }

    // Health check
    const containerObj = this.containers.get(availableContainer.containerId);
    const containerName = containerObj?.name;
    
    const isHealthy = await this.healthChecker.isContainerReady(
      availableContainer.port, 
      containerName
    );
    
    if (!isHealthy) {
      console.log(`Container ${availableContainer.containerId} is unhealthy, attempting restart...`);
      
      // Try to restart and check again
      if (containerObj) {
        try {
          await containerObj.restart();
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          const isHealthyAfterRestart = await this.healthChecker.isContainerReady(
            availableContainer.port, 
            containerName
          );
          
          if (!isHealthyAfterRestart) {
            console.log(`Container ${availableContainer.containerId} still unhealthy after restart`);
            return null;
          }
        } catch (error) {
          console.error(`Failed to restart container ${availableContainer.containerId}:`, error);
          return null;
        }
      }
    }

    // Perform reset on allocation if enabled
    const resetResult = await this.resetManager.resetOnAllocation(containerObj);
    if (resetResult && !resetResult.success) {
      console.warn(`Reset on allocation failed for ${availableContainer.containerId}, proceeding anyway`);
    }

    // Allocate container
    await this.markAsAllocated(availableContainer.containerId, testRunId);
    if (containerObj) {
      containerObj.allocate(testRunId);
      return containerObj.getInfo();
    }

    return null;
  }

  /**
   * Wait for a container to become available
   */
  private async waitForContainer(testRunId: string, timeoutMs: number): Promise<Container | null> {
    const endTime = Date.now() + timeoutMs;
    const pollInterval = 1000; // Check every 1 second
    
    while (Date.now() < endTime) {
      // Check if this request is at the front of the queue
      const queuedRequest = await this.allocationQueue.dequeue();
      
      if (!queuedRequest || queuedRequest.testRunId !== testRunId) {
        // Not our turn yet, put it back if it's someone else's
        if (queuedRequest) {
          await this.allocationQueue.enqueue(
            queuedRequest.testRunId, 
            queuedRequest.timeout
          );
        }
        
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        continue;
      }
      
      // It's our turn, try to allocate
      const container = await this.tryImmediateAllocation(testRunId);
      if (container) {
        console.log(`Allocated queued container for ${testRunId}`);
        return container;
      }
      
      // Still no container available, wait a bit
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
    
    // Timeout - remove from queue
    await this.allocationQueue.remove(testRunId);
    console.log(`Allocation timeout for ${testRunId}`);
    return null;
  }

  /**
   * Release a container with cleanup
   */
  async releaseContainer(containerId: string): Promise<void> {
    const container = this.containers.get(containerId);
    if (!container) {
      console.error(`Container ${containerId} not found`);
      return;
    }

    // Perform reset on release if enabled
    const resetResult = await this.resetManager.resetOnRelease(container);
    if (resetResult && !resetResult.success) {
      console.warn(`Reset on release failed for ${containerId}:`, resetResult.errors);
      // Continue with release even if reset failed
    }

    // Update Redis state
    await this.updateContainerState(containerId, {
      containerId,
      port: container.port,
      allocated: false,
      lastCheckedAt: new Date(),
    });

    container.release();
    this.metrics.totalReleases++;
    
    // Process queue if there are waiting requests
    const queueSize = await this.allocationQueue.getQueueSize();
    if (queueSize > 0) {
      console.log(`Container ${containerId} released, processing queue (${queueSize} waiting)`);
    }
    
    await this.updateMetrics();
    console.log(`Container ${containerId} released`);
  }

  /**
   * Shutdown all containers
   */
  async shutdown(): Promise<void> {
    console.log('Shutting down container pool manager...');
    
    // Stop health monitoring
    this.healthMonitor.stopMonitoring();
    
    for (const container of this.containers.values()) {
      try {
        // Unregister from health monitor
        this.healthMonitor.unregisterContainer(container.id);
        
        await container.stop();
        await container.remove();
      } catch (error) {
        console.error(`Failed to shutdown container ${container.id}:`, error);
      }
    }
    
    // Clear Redis states
    for (const containerId of this.containers.keys()) {
      await this.redisClient.instance.del(`container:${containerId}`);
    }
    
    this.containers.clear();
    console.log('Container pool manager shutdown complete');
  }

  /**
   * Get comprehensive pool status
   */
  async getPoolStatus(): Promise<{
    metrics: PoolMetrics;
    containers: ContainerState[];
    queue: { size: number; requests: Array<{ testRunId: string; requestedAt: string; waitingMs: number }> };
  }> {
    await this.updateMetrics();
    
    const containers: ContainerState[] = [];
    for (const containerId of this.containers.keys()) {
      const state = await this.getContainerState(containerId);
      if (state) {
        containers.push(state);
      }
    }

    const queueStatus = await this.allocationQueue.getQueueStatus();

    return {
      metrics: { ...this.metrics },
      containers,
      queue: queueStatus,
    };
  }

  /**
   * Update metrics
   */
  private async updateMetrics(): Promise<void> {
    let available = 0;
    let allocated = 0;

    for (const containerId of this.containers.keys()) {
      const state = await this.getContainerState(containerId);
      if (state) {
        if (state.allocated) {
          allocated++;
        } else {
          available++;
        }
      }
    }

    this.metrics.totalContainers = this.containers.size;
    this.metrics.availableContainers = available;
    this.metrics.allocatedContainers = allocated;
    this.metrics.queueSize = await this.allocationQueue.getQueueSize();
  }

  /**
   * Update average allocation time
   */
  private updateAllocationTime(durationMs: number): void {
    const currentAvg = this.metrics.averageAllocationTime;
    const totalAllocations = this.metrics.totalAllocations;
    
    // Calculate rolling average
    this.metrics.averageAllocationTime = 
      (currentAvg * totalAllocations + durationMs) / (totalAllocations + 1);
  }

  // Helper methods (same as SimpleContainerPool)
  private async findAvailableContainer(): Promise<ContainerState | null> {
    for (const containerId of this.containers.keys()) {
      const state = await this.getContainerState(containerId);
      if (state && !state.allocated) {
        return state;
      }
    }
    return null;
  }

  private async markAsAllocated(containerId: string, testRunId: string): Promise<void> {
    const container = this.containers.get(containerId);
    if (!container) return;

    await this.updateContainerState(containerId, {
      containerId,
      port: container.port,
      allocated: true,
      allocatedTo: testRunId,
      allocatedAt: new Date(),
      lastCheckedAt: new Date(),
    });
  }

  private async getContainerState(containerId: string): Promise<ContainerState | null> {
    const data = await this.redisClient.instance.hgetall(`container:${containerId}`);
    
    if (!data || Object.keys(data).length === 0) {
      return null;
    }

    return {
      containerId: data.containerId,
      port: parseInt(data.port),
      allocated: data.allocated === 'true',
      allocatedTo: data.allocatedTo || undefined,
      allocatedAt: data.allocatedAt ? new Date(data.allocatedAt) : undefined,
      lastCheckedAt: data.lastCheckedAt ? new Date(data.lastCheckedAt) : undefined,
    };
  }

  private async updateContainerState(
    containerId: string,
    state: ContainerState
  ): Promise<void> {
    const data: Record<string, string> = {
      containerId: state.containerId,
      port: state.port.toString(),
      allocated: state.allocated.toString(),
      lastCheckedAt: state.lastCheckedAt?.toISOString() || new Date().toISOString(),
    };

    if (state.allocatedTo) {
      data.allocatedTo = state.allocatedTo;
    }
    if (state.allocatedAt) {
      data.allocatedAt = state.allocatedAt.toISOString();
    }

    await this.redisClient.instance.hset(`container:${containerId}`, data);
    
    // Set expiration for allocated state (30 minutes safety timeout)
    if (state.allocated && state.allocatedTo) {
      await this.redisClient.instance.expire(`container:${containerId}`, 1800);
    }
  }

  /**
   * Manual cleanup of a specific container
   */
  async cleanupContainer(containerId: string): Promise<void> {
    const container = this.containers.get(containerId);
    if (!container) {
      throw new Error(`Container ${containerId} not found`);
    }

    console.log(`Manual cleanup requested for container ${containerId}`);
    const cleanupResult = await this.cleanupService.cleanupContainer(containerId, container.name);
    
    if (!cleanupResult.success) {
      console.warn(`Manual cleanup failed for ${containerId}:`, cleanupResult.errors);
    } else {
      console.log(`Manual cleanup completed for ${containerId}`);
    }
  }

  /**
   * Manual reset of a specific container
   */
  async resetContainer(containerId: string): Promise<void> {
    const container = this.containers.get(containerId);
    if (!container) {
      throw new Error(`Container ${containerId} not found`);
    }

    console.log(`Manual reset requested for container ${containerId}`);
    const resetResult = await this.resetManager.resetContainer(container, 'manual');
    
    if (!resetResult.success) {
      console.warn(`Manual reset failed for ${containerId}:`, resetResult.errors);
    } else {
      console.log(`Manual reset completed for ${containerId} using ${resetResult.method}`);
      
      // Re-register with health monitor after successful reset
      this.healthMonitor.registerContainer(containerId, container.name, container.port);
    }
  }

  /**
   * Get cleanup service instance
   */
  getCleanupService(): CleanupService {
    return this.cleanupService;
  }

  /**
   * Get reset manager instance
   */
  getResetManager(): ContainerResetManager {
    return this.resetManager;
  }

  /**
   * Get cleanup and reset statistics
   */
  getCleanupResetStats(): {
    cleanupConfig: any;
    resetConfig: any;
    activeResets: string[];
  } {
    return {
      cleanupConfig: this.cleanupService.getConfig(),
      resetConfig: this.resetManager.getConfig(),
      activeResets: this.resetManager.getActiveResets(),
    };
  }
}