import { RedisClient } from '@cinnamon-qa/queue';
import { createLogger } from '@cinnamon-qa/logger';
import { PlaywrightMcpContainer } from './container';
import { SimpleHealthChecker } from './health-checker';
import { DockerInspector } from './docker-inspector';
import { AllocationQueue, QueuedRequest } from './allocation-queue';
import { HealthMonitor, ContainerHealthStatus } from './health-monitor';
import { CleanupService } from './cleanup-service';
import { ContainerResetManager } from './container-reset-manager';
import { ResourceManager, TestPriority, ResourceRequest, AllocationResult } from './resource-manager';
import { TimeoutManager, TimeoutSession } from './timeout-manager';
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
  private readonly logger = createLogger({ context: 'ContainerPoolManager' });
  private containers: Map<string, PlaywrightMcpContainer> = new Map();
  private healthChecker: SimpleHealthChecker;
  private dockerInspector: DockerInspector;
  private redisClient: RedisClient;
  private allocationQueue: AllocationQueue;
  private healthMonitor: HealthMonitor;
  private cleanupService: CleanupService;
  private resetManager: ContainerResetManager;
  private resourceManager: ResourceManager;
  private timeoutManager: TimeoutManager;
  
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
    this.resourceManager = new ResourceManager(redisClient);
    this.timeoutManager = new TimeoutManager();
    
    // Setup event listeners
    this.setupHealthMonitorEvents();
    this.setupCleanupEvents();
    this.setupResetEvents();
    this.setupResourceManagerEvents();
    this.setupTimeoutManagerEvents();

    // Set up resource manager callback for actual container allocation
    this.resourceManager.setContainerAllocationCallback(async (testRunId: string) => {
      return await this.tryImmediateAllocation(testRunId);
    });
  }

  /**
   * Setup health monitor event listeners
   */
  private setupHealthMonitorEvents(): void {
    this.healthMonitor.on('containerUnhealthy', async (event) => {
      this.logger.info('Container marked as unhealthy', { containerId: event.containerId, consecutiveFailures: event.consecutiveFailures });
      await this.handleUnhealthyContainer(event.containerId);
    });

    this.healthMonitor.on('memoryThresholdExceeded', (event) => {
      this.logger.warn('Container exceeded memory threshold', { containerId: event.containerId, memoryUsage: event.memoryUsage, threshold: event.threshold });
    });

    this.healthMonitor.on('cpuThresholdExceeded', (event) => {
      this.logger.warn('Container exceeded CPU threshold', { containerId: event.containerId, cpuUsage: event.cpuUsage, threshold: event.threshold });
    });

    this.healthMonitor.on('statusChanged', (event) => {
      this.logger.info('Container status changed', { containerId: event.containerId, previousStatus: event.previousStatus, newStatus: event.newStatus });
    });
  }

  /**
   * Setup cleanup service event listeners
   */
  private setupCleanupEvents(): void {
    this.cleanupService.on('cleanupStarted', (event) => {
      this.logger.info('Cleanup started for container', { containerName: event.containerName });
    });

    this.cleanupService.on('cleanupCompleted', (event) => {
      this.logger.info('Cleanup completed for container', { containerName: event.containerName });
    });

    this.cleanupService.on('cleanupFailed', (event) => {
      this.logger.warn('Cleanup failed for container', { containerName: event.containerName, errors: event.result.errors });
    });
  }

  /**
   * Setup reset manager event listeners
   */
  private setupResetEvents(): void {
    this.resetManager.on('resetStarted', (event) => {
      this.logger.info('Container reset started', { containerName: event.containerName, reason: event.reason });
    });

    this.resetManager.on('resetCompleted', (event) => {
      this.logger.info('Container reset completed', { containerName: event.containerName, strategy: event.strategy });
    });

    this.resetManager.on('resetFailed', (event) => {
      this.logger.error('Container reset failed', { containerName: event.containerName, errors: event.result.errors });
    });
  }

  /**
   * Setup resource manager event listeners
   */
  private setupResourceManagerEvents(): void {
    this.resourceManager.on('allocationSuccess', (event) => {
      this.logger.info('Resource allocation successful', { 
        testRunId: event.request.testRunId, 
        waitTimeMs: event.result.waitTimeMs 
      });
    });

    this.resourceManager.on('allocationFailure', (event) => {
      this.logger.warn('Resource allocation failed', { 
        testRunId: event.request.testRunId, 
        errors: event.result.errors 
      });
    });

    this.resourceManager.on('allocationError', (event) => {
      this.logger.error('Resource allocation error', { 
        testRunId: event.request.testRunId, 
        error: event.error 
      });
    });

    this.resourceManager.on('requestQueued', (event) => {
      this.logger.info('Resource request queued', { 
        testRunId: event.request.testRunId, 
        priority: event.request.priority 
      });
    });
  }

  /**
   * Setup timeout manager event listeners
   */
  private setupTimeoutManagerEvents(): void {
    this.timeoutManager.on('sessionStarted', (event) => {
      this.logger.info('Timeout session started', { 
        sessionId: event.session.id, 
        testRunId: event.session.testRunId,
        timeoutMs: event.session.timeoutMs 
      });
    });

    this.timeoutManager.on('timeoutWarning', (event) => {
      this.logger.warn('Timeout warning', { 
        sessionId: event.session.id, 
        testRunId: event.session.testRunId,
        remainingTimeMs: event.event.remainingTimeMs 
      });
    });

    this.timeoutManager.on('sessionTimeout', (event) => {
      this.logger.error('Session timeout', { 
        sessionId: event.session.id, 
        testRunId: event.session.testRunId,
        executionTimeMs: event.event.totalElapsedMs 
      });
    });

    this.timeoutManager.on('timeoutExtended', (event) => {
      this.logger.info('Timeout extended', { 
        sessionId: event.session.id, 
        testRunId: event.session.testRunId,
        newTimeoutMs: event.session.timeoutMs 
      });
    });
  }

  /**
   * Handle unhealthy container with reset manager
   */
  private async handleUnhealthyContainer(containerId: string): Promise<void> {
    const container = this.containers.get(containerId);
    if (!container) return;

    try {
      this.logger.info('Handling unhealthy container with reset manager', { containerId });
      
      // Use reset manager instead of simple restart
      const resetResult = await this.resetManager.resetOnHealthFailure(container);
      
      if (resetResult?.success) {
        // Re-register with health monitor after successful reset
        this.healthMonitor.registerContainer(containerId, container.name, container.port);
        this.logger.info('Container reset and re-registered successfully', { containerId });
      } else {
        this.logger.error('Failed to reset container', { containerId, errors: resetResult?.errors });
        // Mark container as problematic (in production, might trigger replacement)
      }
    } catch (error) {
      this.logger.error('Failed to handle unhealthy container', { containerId, error });
    }
  }

  /**
   * Initialize the container pool
   */
  async initialize(): Promise<void> {
    this.logger.info('Initializing container pool manager');
    
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
          id: config.id,
          port: config.port,
          allocated: false,
          lastCheckedAt: new Date(),
        });
        
        // Register with health monitor
        this.healthMonitor.registerContainer(config.id, config.name, config.port);
        
        this.logger.info('Container started successfully', { containerId: config.id, port: config.port });
      } catch (error) {
        this.logger.error('Failed to start container', { containerId: config.id, error });
        this.metrics.failedAllocations++;
      }
    }

    // Start health monitoring
    this.healthMonitor.startMonitoring();
    
    // Update metrics
    await this.updateMetrics();
    this.logger.info('Container pool manager initialized with health monitoring');
  }

  /**
   * Allocate a container (with queue support) - Legacy method
   */
  async allocateContainer(testRunId: string, waitForAvailable = true, timeoutMs = 300000): Promise<Container | null> {
    // Use advanced allocation with default settings
    return this.allocateContainerAdvanced({
      testRunId,
      priority: TestPriority.NORMAL,
      requestedAt: new Date(),
      timeoutMs,
      maxRetries: 3,
    });
  }

  /**
   * Advanced container allocation with resource management
   */
  async allocateContainerAdvanced(request: ResourceRequest): Promise<Container | null> {
    this.logger.info('Advanced container allocation requested', {
      testRunId: request.testRunId,
      priority: request.priority,
      timeoutMs: request.timeoutMs,
    });

    // Start timeout session
    const timeoutSessionId = this.timeoutManager.startSession(request.testRunId, request.timeoutMs);

    try {
      // Try immediate allocation first
      const immediateContainer = await this.tryImmediateAllocation(request.testRunId);
      if (immediateContainer) {
        // Complete timeout session
        this.timeoutManager.completeSession(timeoutSessionId);
        
        this.metrics.totalAllocations++;
        await this.updateMetrics();
        
        this.logger.info('Immediate container allocation successful', {
          testRunId: request.testRunId,
          containerId: immediateContainer.id,
        });
        
        return immediateContainer;
      }

      // Use resource manager for advanced allocation
      const allocationResult = await this.resourceManager.requestAllocation(request);
      
      if (allocationResult.success && allocationResult.container) {
        // Complete timeout session
        this.timeoutManager.completeSession(timeoutSessionId);
        
        this.metrics.totalAllocations++;
        this.updateAllocationTime(allocationResult.waitTimeMs);
        await this.updateMetrics();
        
        this.logger.info('Advanced container allocation successful', {
          testRunId: request.testRunId,
          containerId: allocationResult.container.id,
          waitTimeMs: allocationResult.waitTimeMs,
          degradedMode: allocationResult.degradedMode,
        });
        
        return allocationResult.container;
      } else {
        // Complete timeout session
        this.timeoutManager.completeSession(timeoutSessionId);
        
        this.metrics.failedAllocations++;
        await this.updateMetrics();
        
        this.logger.warn('Advanced container allocation failed', {
          testRunId: request.testRunId,
          errors: allocationResult.errors,
          waitTimeMs: allocationResult.waitTimeMs,
        });
        
        return null;
      }
      
    } catch (error) {
      // Complete timeout session
      this.timeoutManager.completeSession(timeoutSessionId);
      
      this.logger.error('Error in advanced container allocation', { 
        testRunId: request.testRunId, 
        error 
      });
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
    const containerObj = this.containers.get(availableContainer.id);
    const containerName = containerObj?.name;
    
    const isHealthy = await this.healthChecker.isContainerReady(
      availableContainer.port, 
      containerName
    );
    
    if (!isHealthy) {
      this.logger.info('Container is unhealthy, attempting restart', { containerId: availableContainer.id });
      
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
            this.logger.info('Container still unhealthy after restart', { containerId: availableContainer.id });
            return null;
          }
        } catch (error) {
          this.logger.error('Failed to restart container', { containerId: availableContainer.id, error });
          return null;
        }
      }
    }

    // Perform reset on allocation if enabled
    const resetResult = await this.resetManager.resetOnAllocation(containerObj);
    if (resetResult && !resetResult.success) {
      this.logger.warn('Reset on allocation failed, proceeding anyway', { containerId: availableContainer.id });
    }

    // Allocate container
    await this.markAsAllocated(availableContainer.id, testRunId);
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
        this.logger.info('Allocated queued container', { testRunId });
        return container;
      }
      
      // Still no container available, wait a bit
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
    
    // Timeout - remove from queue
    await this.allocationQueue.remove(testRunId);
    this.logger.info('Allocation timeout', { testRunId });
    return null;
  }

  /**
   * Release a container with cleanup
   */
  async releaseContainer(containerId: string): Promise<void> {
    const container = this.containers.get(containerId);
    if (!container) {
      this.logger.error('Container not found', { containerId });
      return;
    }

    // Get current allocation info
    const containerState = await this.getContainerState(containerId);
    const testRunId = containerState?.allocatedTo;

    // Perform reset on release if enabled
    const resetResult = await this.resetManager.resetOnRelease(container);
    if (resetResult && !resetResult.success) {
      this.logger.warn('Reset on release failed', { containerId, errors: resetResult.errors });
      // Continue with release even if reset failed
    }

    // Release from resource manager if testRunId exists
    if (testRunId) {
      await this.resourceManager.releaseAllocation(testRunId);
    }

    // Update Redis state
    await this.updateContainerState(containerId, {
      id: containerId,
      port: container.port,
      allocated: false,
      lastCheckedAt: new Date(),
    });

    container.release();
    this.metrics.totalReleases++;
    
    // Process queue if there are waiting requests
    const queueSize = await this.allocationQueue.getQueueSize();
    if (queueSize > 0) {
      this.logger.info('Container released, processing queue', { containerId, queueSize });
    }
    
    await this.updateMetrics();
    this.logger.info('Container released', { containerId, testRunId });
  }

  /**
   * Shutdown all containers
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down container pool manager');
    
    // Stop health monitoring
    this.healthMonitor.stopMonitoring();
    
    // Shutdown resource manager and timeout manager
    await this.resourceManager.shutdown();
    await this.timeoutManager.shutdown();
    
    for (const container of this.containers.values()) {
      try {
        // Unregister from health monitor
        this.healthMonitor.unregisterContainer(container.id);
        
        await container.stop();
        await container.remove();
      } catch (error) {
        this.logger.error('Failed to shutdown container', { containerId: container.id, error });
      }
    }
    
    // Clear Redis states
    for (const containerId of this.containers.keys()) {
      await this.redisClient.instance.del(`container:${containerId}`);
    }
    
    this.containers.clear();
    this.logger.info('Container pool manager shutdown complete');
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
      id: containerId,
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
      id: data.containerId,
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
      containerId: state.id,
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

    this.logger.info('Manual cleanup requested for container', { containerId });
    const cleanupResult = await this.cleanupService.cleanupContainer(containerId, container.name);
    
    if (!cleanupResult.success) {
      this.logger.warn('Manual cleanup failed', { containerId, errors: cleanupResult.errors });
    } else {
      this.logger.info('Manual cleanup completed', { containerId });
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

    this.logger.info('Manual reset requested for container', { containerId });
    const resetResult = await this.resetManager.resetContainer(container, 'manual');
    
    if (!resetResult.success) {
      this.logger.warn('Manual reset failed', { containerId, errors: resetResult.errors });
    } else {
      this.logger.info('Manual reset completed', { containerId, method: resetResult.method });
      
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

  /**
   * Get resource manager instance
   */
  getResourceManager(): ResourceManager {
    return this.resourceManager;
  }

  /**
   * Get timeout manager instance
   */
  getTimeoutManager(): TimeoutManager {
    return this.timeoutManager;
  }

  /**
   * Get comprehensive system analytics
   */
  async getSystemAnalytics(): Promise<{
    poolMetrics: PoolMetrics;
    resourceMetrics: any;
    timeoutMetrics: any;
    resourceAnalytics: any;
    optimizationRecommendations: any[];
  }> {
    const poolStatus = await this.getPoolStatus();
    const resourceMetrics = this.resourceManager.getMetrics();
    const timeoutMetrics = this.timeoutManager.getMetrics();
    const resourceAnalytics = this.resourceManager.getResourceAnalytics();
    const optimizationRecommendations = await this.resourceManager.getOptimizationRecommendations();

    return {
      poolMetrics: poolStatus.metrics,
      resourceMetrics,
      timeoutMetrics,
      resourceAnalytics,
      optimizationRecommendations,
    };
  }

  /**
   * Request timeout extension for a test
   */
  async requestTimeoutExtension(testRunId: string, reason?: string): Promise<boolean> {
    // Find active timeout session for this test
    const activeSessions = this.timeoutManager.getActiveSessions();
    const session = activeSessions.find(s => s.testRunId === testRunId);
    
    if (!session) {
      this.logger.warn('No active timeout session found for test', { testRunId });
      return false;
    }

    return await this.timeoutManager.requestExtension(session.id, reason);
  }

  /**
   * Get test execution status including timeout information
   */
  getTestExecutionStatus(testRunId: string): {
    containerAllocated: boolean;
    containerId?: string;
    timeoutSession?: any;
    resourceRequest?: any;
  } {
    // Find allocated container
    const allocatedContainer = Array.from(this.containers.entries())
      .find(([_, container]) => (container as any).testRunId === testRunId);

    // Find timeout session
    const activeSessions = this.timeoutManager.getActiveSessions();
    const timeoutSession = activeSessions.find(s => s.testRunId === testRunId);

    return {
      containerAllocated: !!allocatedContainer,
      containerId: allocatedContainer?.[0],
      timeoutSession: timeoutSession ? {
        id: timeoutSession.id,
        remainingTimeMs: timeoutSession.timeoutMs - (Date.now() - timeoutSession.startTime.getTime()),
        extensionsUsed: timeoutSession.extensionsUsed,
        strategy: timeoutSession.strategy,
      } : undefined,
    };
  }

  /**
   * Update resource management configuration
   */
  updateResourceConfig(config: any): void {
    this.resourceManager.updateConfig(config);
    this.logger.info('Resource management configuration updated', { config });
  }

  /**
   * Update timeout management configuration
   */
  updateTimeoutConfig(config: any): void {
    this.timeoutManager.updateConfig(config);
    this.logger.info('Timeout management configuration updated', { config });
  }
}