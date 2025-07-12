import { EventEmitter } from 'events';
import { createLogger } from '@cinnamon-qa/logger';
import { RedisClient } from '@cinnamon-qa/queue';
import { Container, ContainerState } from './types';

export enum TestPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum AllocationStrategy {
  FIFO = 'fifo',
  PRIORITY = 'priority',
  LOAD_BALANCED = 'load_balanced',
  RESOURCE_OPTIMIZED = 'resource_optimized',
}

export interface ResourceRequest {
  testRunId: string;
  priority: TestPriority;
  requestedAt: Date;
  timeoutMs: number;
  maxRetries: number;
  requiredResources?: {
    minMemoryMB?: number;
    maxCpuPercent?: number;
    networkBandwidth?: number;
  };
  metadata?: Record<string, any>;
}

export interface AllocationResult {
  success: boolean;
  container?: Container;
  waitTimeMs: number;
  retryCount: number;
  errors: string[];
  allocatedAt?: Date;
  degradedMode: boolean;
}

export interface ResourceConfig {
  allocationStrategy: AllocationStrategy;
  enablePriorityQueue: boolean;
  enableGracefulDegradation: boolean;
  enableResourceOptimization: boolean;
  maxWaitTimeMs: number;
  maxRetries: number;
  degradationThresholds: {
    queueSizeThreshold: number;
    avgWaitTimeThreshold: number;
    failureRateThreshold: number;
  };
  resourceLimits: {
    maxMemoryPerContainerMB: number;
    maxCpuPerContainerPercent: number;
    maxConcurrentAllocations: number;
  };
}

export interface ResourceMetrics {
  totalRequests: number;
  successfulAllocations: number;
  failedAllocations: number;
  timeoutAllocations: number;
  degradedAllocations: number;
  averageWaitTime: number;
  averageResourceUtilization: number;
  queueMetrics: {
    currentSize: number;
    averageSize: number;
    maxSize: number;
    peakWaitTime: number;
  };
  performanceMetrics: {
    allocationsPerMinute: number;
    failureRate: number;
    resourceEfficiency: number;
  };
}

export interface OptimizationRecommendation {
  type: 'performance' | 'capacity' | 'configuration' | 'infrastructure';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  suggestedAction: string;
  expectedImpact: string;
  implementationCost: 'low' | 'medium' | 'high';
}

export class ResourceManager extends EventEmitter {
  private readonly logger = createLogger({ context: 'ResourceManager' });
  private redisClient: RedisClient;
  private config: ResourceConfig;
  private priorityQueues: Map<TestPriority, ResourceRequest[]> = new Map();
  private activeAllocations: Map<string, ResourceRequest> = new Map();
  private metrics: ResourceMetrics;
  private isProcessingQueue = false;
  private queueProcessor?: NodeJS.Timeout;
  
  // Analytics data
  private allocationHistory: Array<{
    request: ResourceRequest;
    result: AllocationResult;
    timestamp: Date;
  }> = [];
  
  private resourceUsageHistory: Array<{
    timestamp: Date;
    totalMemoryMB: number;
    totalCpuPercent: number;
    containerCount: number;
    queueSize: number;
  }> = [];

  constructor(redisClient: RedisClient, config?: Partial<ResourceConfig>) {
    super();
    this.redisClient = redisClient;
    this.config = {
      allocationStrategy: AllocationStrategy.PRIORITY,
      enablePriorityQueue: true,
      enableGracefulDegradation: true,
      enableResourceOptimization: true,
      maxWaitTimeMs: 600000, // 10 minutes
      maxRetries: 3,
      degradationThresholds: {
        queueSizeThreshold: 10,
        avgWaitTimeThreshold: 60000, // 1 minute
        failureRateThreshold: 0.2, // 20%
      },
      resourceLimits: {
        maxMemoryPerContainerMB: 512,
        maxCpuPerContainerPercent: 80,
        maxConcurrentAllocations: 10,
      },
      ...config,
    };

    this.initializeMetrics();
    this.initializePriorityQueues();
    this.startQueueProcessor();
  }

  /**
   * Request resource allocation with advanced options
   */
  async requestAllocation(request: ResourceRequest): Promise<AllocationResult> {
    const startTime = Date.now();
    this.logger.info('Resource allocation requested', {
      testRunId: request.testRunId,
      priority: request.priority,
      timeoutMs: request.timeoutMs,
    });

    // Validate request
    const validationError = this.validateRequest(request);
    if (validationError) {
      const result: AllocationResult = {
        success: false,
        waitTimeMs: 0,
        retryCount: 0,
        errors: [validationError],
        degradedMode: false,
      };
      this.recordAllocationHistory(request, result);
      return result;
    }

    // Check if degraded mode should be enabled
    const degradedMode = this.shouldEnableDegradedMode();
    if (degradedMode) {
      this.logger.warn('Operating in degraded mode', {
        testRunId: request.testRunId,
        reason: 'Resource constraints detected',
      });
    }

    // Add to appropriate queue based on strategy
    await this.enqueueRequest(request);
    
    // Wait for allocation with timeout
    try {
      const result = await this.waitForAllocation(request, degradedMode);
      result.waitTimeMs = Date.now() - startTime;
      
      this.updateMetrics(request, result);
      this.recordAllocationHistory(request, result);
      
      if (result.success) {
        this.logger.info('Resource allocation successful', {
          testRunId: request.testRunId,
          waitTimeMs: result.waitTimeMs,
          degradedMode: result.degradedMode,
        });
        this.emit('allocationSuccess', { request, result });
      } else {
        this.logger.warn('Resource allocation failed', {
          testRunId: request.testRunId,
          errors: result.errors,
        });
        this.emit('allocationFailure', { request, result });
      }

      return result;
    } catch (error) {
      const result: AllocationResult = {
        success: false,
        waitTimeMs: Date.now() - startTime,
        retryCount: 0,
        errors: [error instanceof Error ? error.message : 'Unknown allocation error'],
        degradedMode,
      };
      
      this.updateMetrics(request, result);
      this.recordAllocationHistory(request, result);
      this.emit('allocationError', { request, result, error });
      
      return result;
    }
  }

  /**
   * Release allocated resources
   */
  async releaseAllocation(testRunId: string): Promise<void> {
    const request = this.activeAllocations.get(testRunId);
    if (request) {
      this.activeAllocations.delete(testRunId);
      this.logger.info('Resource allocation released', { testRunId });
      this.emit('allocationReleased', { testRunId, request });
      
      // Update metrics
      this.metrics.successfulAllocations++;
    }
  }

  /**
   * Get current resource metrics
   */
  getMetrics(): ResourceMetrics {
    return { ...this.metrics };
  }

  /**
   * Get optimization recommendations based on current performance
   */
  async getOptimizationRecommendations(): Promise<OptimizationRecommendation[]> {
    const recommendations: OptimizationRecommendation[] = [];
    const metrics = this.getMetrics();

    // High failure rate recommendation
    if (metrics.performanceMetrics.failureRate > this.config.degradationThresholds.failureRateThreshold) {
      recommendations.push({
        type: 'performance',
        severity: 'high',
        title: 'High Allocation Failure Rate',
        description: `Current failure rate is ${(metrics.performanceMetrics.failureRate * 100).toFixed(1)}%, exceeding the ${(this.config.degradationThresholds.failureRateThreshold * 100).toFixed(1)}% threshold.`,
        suggestedAction: 'Consider increasing container pool size or optimizing allocation strategy',
        expectedImpact: 'Reduce allocation failures by 30-50%',
        implementationCost: 'medium',
      });
    }

    // High queue size recommendation
    if (metrics.queueMetrics.currentSize > this.config.degradationThresholds.queueSizeThreshold) {
      recommendations.push({
        type: 'capacity',
        severity: 'medium',
        title: 'High Queue Size',
        description: `Current queue size is ${metrics.queueMetrics.currentSize}, exceeding threshold of ${this.config.degradationThresholds.queueSizeThreshold}.`,
        suggestedAction: 'Consider adding more containers to the pool or optimizing test execution time',
        expectedImpact: 'Reduce average wait time by 40-60%',
        implementationCost: 'low',
      });
    }

    // Low resource efficiency recommendation
    if (metrics.performanceMetrics.resourceEfficiency < 0.7) {
      recommendations.push({
        type: 'configuration',
        severity: 'medium',
        title: 'Low Resource Efficiency',
        description: `Resource efficiency is ${(metrics.performanceMetrics.resourceEfficiency * 100).toFixed(1)}%, indicating potential optimization opportunities.`,
        suggestedAction: 'Review allocation strategy and consider implementing resource-optimized allocation',
        expectedImpact: 'Improve resource utilization by 20-30%',
        implementationCost: 'low',
      });
    }

    // High average wait time recommendation
    if (metrics.averageWaitTime > this.config.degradationThresholds.avgWaitTimeThreshold) {
      recommendations.push({
        type: 'performance',
        severity: 'high',
        title: 'High Average Wait Time',
        description: `Average wait time is ${(metrics.averageWaitTime / 1000).toFixed(1)}s, exceeding threshold of ${(this.config.degradationThresholds.avgWaitTimeThreshold / 1000).toFixed(1)}s.`,
        suggestedAction: 'Implement priority-based allocation or increase parallel processing capacity',
        expectedImpact: 'Reduce wait time by 50-70%',
        implementationCost: 'medium',
      });
    }

    // Infrastructure scaling recommendation
    if (metrics.performanceMetrics.allocationsPerMinute > 50) {
      recommendations.push({
        type: 'infrastructure',
        severity: 'low',
        title: 'High Load Pattern Detected',
        description: `Processing ${metrics.performanceMetrics.allocationsPerMinute.toFixed(1)} allocations per minute indicates heavy usage.`,
        suggestedAction: 'Consider implementing auto-scaling or load distribution across multiple nodes',
        expectedImpact: 'Improve system stability and reduce latency during peak loads',
        implementationCost: 'high',
      });
    }

    return recommendations;
  }

  /**
   * Get detailed resource usage analytics
   */
  getResourceAnalytics(): {
    utilizationTrends: Array<{ timestamp: Date; utilization: number }>;
    allocationPatterns: Array<{ hour: number; count: number; avgWaitTime: number }>;
    priorityDistribution: Record<TestPriority, number>;
    failureAnalysis: {
      timeoutFailures: number;
      resourceFailures: number;
      systemFailures: number;
    };
  } {
    // Calculate utilization trends
    const utilizationTrends = this.resourceUsageHistory.slice(-100).map(entry => ({
      timestamp: entry.timestamp,
      utilization: (entry.totalMemoryMB / (entry.containerCount * this.config.resourceLimits.maxMemoryPerContainerMB)),
    }));

    // Calculate allocation patterns by hour
    const hourlyPatterns = new Map<number, { count: number; totalWaitTime: number }>();
    this.allocationHistory.slice(-1000).forEach(entry => {
      const hour = entry.timestamp.getHours();
      const current = hourlyPatterns.get(hour) || { count: 0, totalWaitTime: 0 };
      current.count++;
      current.totalWaitTime += entry.result.waitTimeMs;
      hourlyPatterns.set(hour, current);
    });

    const allocationPatterns = Array.from(hourlyPatterns.entries()).map(([hour, data]) => ({
      hour,
      count: data.count,
      avgWaitTime: data.count > 0 ? data.totalWaitTime / data.count : 0,
    }));

    // Calculate priority distribution
    const priorityDistribution: Record<TestPriority, number> = {
      [TestPriority.LOW]: 0,
      [TestPriority.NORMAL]: 0,
      [TestPriority.HIGH]: 0,
      [TestPriority.CRITICAL]: 0,
    };

    this.allocationHistory.slice(-1000).forEach(entry => {
      priorityDistribution[entry.request.priority]++;
    });

    // Analyze failure patterns
    const failures = this.allocationHistory.filter(entry => !entry.result.success);
    const failureAnalysis = {
      timeoutFailures: failures.filter(f => f.result.errors.some(e => e.includes('timeout'))).length,
      resourceFailures: failures.filter(f => f.result.errors.some(e => e.includes('resource'))).length,
      systemFailures: failures.filter(f => !f.result.errors.some(e => e.includes('timeout') || e.includes('resource'))).length,
    };

    return {
      utilizationTrends,
      allocationPatterns,
      priorityDistribution,
      failureAnalysis,
    };
  }

  /**
   * Update resource configuration
   */
  updateConfig(newConfig: Partial<ResourceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.info('Resource configuration updated', { config: newConfig });
    this.emit('configUpdated', this.config);
  }

  /**
   * Validate resource request
   */
  private validateRequest(request: ResourceRequest): string | null {
    if (!request.testRunId) {
      return 'Test run ID is required';
    }

    if (request.timeoutMs <= 0 || request.timeoutMs > this.config.maxWaitTimeMs) {
      return `Timeout must be between 1 and ${this.config.maxWaitTimeMs}ms`;
    }

    if (request.maxRetries < 0 || request.maxRetries > this.config.maxRetries) {
      return `Max retries must be between 0 and ${this.config.maxRetries}`;
    }

    if (this.activeAllocations.has(request.testRunId)) {
      return 'Allocation already exists for this test run ID';
    }

    if (this.activeAllocations.size >= this.config.resourceLimits.maxConcurrentAllocations) {
      return 'Maximum concurrent allocations reached';
    }

    return null;
  }

  /**
   * Check if degraded mode should be enabled
   */
  private shouldEnableDegradedMode(): boolean {
    if (!this.config.enableGracefulDegradation) {
      return false;
    }

    const queueSize = this.getTotalQueueSize();
    const avgWaitTime = this.metrics.averageWaitTime;
    const failureRate = this.metrics.performanceMetrics.failureRate;

    return (
      queueSize > this.config.degradationThresholds.queueSizeThreshold ||
      avgWaitTime > this.config.degradationThresholds.avgWaitTimeThreshold ||
      failureRate > this.config.degradationThresholds.failureRateThreshold
    );
  }

  /**
   * Add request to appropriate queue
   */
  private async enqueueRequest(request: ResourceRequest): Promise<void> {
    if (this.config.enablePriorityQueue) {
      const queue = this.priorityQueues.get(request.priority) || [];
      queue.push(request);
      this.priorityQueues.set(request.priority, queue);
    } else {
      const normalQueue = this.priorityQueues.get(TestPriority.NORMAL) || [];
      normalQueue.push(request);
      this.priorityQueues.set(TestPriority.NORMAL, normalQueue);
    }

    this.updateQueueMetrics();
    this.emit('requestQueued', { request });
  }

  /**
   * Wait for allocation with timeout
   */
  private async waitForAllocation(request: ResourceRequest, degradedMode: boolean): Promise<AllocationResult> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.removeFromQueue(request.testRunId);
        resolve({
          success: false,
          waitTimeMs: request.timeoutMs,
          retryCount: 0,
          errors: ['Allocation timeout'],
          degradedMode,
        });
      }, request.timeoutMs);

      const checkAllocation = () => {
        if (this.activeAllocations.has(request.testRunId)) {
          clearTimeout(timeout);
          resolve({
            success: true,
            waitTimeMs: Date.now() - request.requestedAt.getTime(),
            retryCount: 0,
            errors: [],
            degradedMode,
            allocatedAt: new Date(),
          });
        } else {
          setTimeout(checkAllocation, 1000);
        }
      };

      checkAllocation();
    });
  }

  /**
   * Initialize metrics
   */
  private initializeMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      successfulAllocations: 0,
      failedAllocations: 0,
      timeoutAllocations: 0,
      degradedAllocations: 0,
      averageWaitTime: 0,
      averageResourceUtilization: 0,
      queueMetrics: {
        currentSize: 0,
        averageSize: 0,
        maxSize: 0,
        peakWaitTime: 0,
      },
      performanceMetrics: {
        allocationsPerMinute: 0,
        failureRate: 0,
        resourceEfficiency: 0.8, // Default
      },
    };
  }

  /**
   * Initialize priority queues
   */
  private initializePriorityQueues(): void {
    Object.values(TestPriority).forEach(priority => {
      this.priorityQueues.set(priority, []);
    });
  }

  /**
   * Start queue processor
   */
  private startQueueProcessor(): void {
    this.queueProcessor = setInterval(() => {
      if (!this.isProcessingQueue) {
        this.processQueue();
      }
    }, 1000);
  }

  /**
   * Process queue based on strategy
   */
  private async processQueue(): Promise<void> {
    this.isProcessingQueue = true;

    try {
      const request = this.getNextRequest();
      if (request) {
        // Simulate allocation logic (this would integrate with container pool)
        const container = await this.allocateContainer(request);
        if (container) {
          this.activeAllocations.set(request.testRunId, request);
          this.removeFromQueue(request.testRunId);
        }
      }
    } catch (error) {
      this.logger.error('Error processing queue', { error });
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Get next request based on allocation strategy
   */
  private getNextRequest(): ResourceRequest | null {
    switch (this.config.allocationStrategy) {
      case AllocationStrategy.PRIORITY:
        return this.getHighestPriorityRequest();
      case AllocationStrategy.FIFO:
        return this.getOldestRequest();
      case AllocationStrategy.LOAD_BALANCED:
        return this.getLoadBalancedRequest();
      case AllocationStrategy.RESOURCE_OPTIMIZED:
        return this.getResourceOptimizedRequest();
      default:
        return this.getHighestPriorityRequest();
    }
  }

  /**
   * Get highest priority request
   */
  private getHighestPriorityRequest(): ResourceRequest | null {
    const priorities = [TestPriority.CRITICAL, TestPriority.HIGH, TestPriority.NORMAL, TestPriority.LOW];
    
    for (const priority of priorities) {
      const queue = this.priorityQueues.get(priority) || [];
      if (queue.length > 0) {
        return queue[0];
      }
    }
    
    return null;
  }

  /**
   * Get oldest request (FIFO)
   */
  private getOldestRequest(): ResourceRequest | null {
    let oldestRequest: ResourceRequest | null = null;
    let oldestTime = Date.now();

    for (const queue of this.priorityQueues.values()) {
      for (const request of queue) {
        if (request.requestedAt.getTime() < oldestTime) {
          oldestTime = request.requestedAt.getTime();
          oldestRequest = request;
        }
      }
    }

    return oldestRequest;
  }

  /**
   * Get load balanced request (simplified)
   */
  private getLoadBalancedRequest(): ResourceRequest | null {
    // For now, return the request from the queue with the least items
    let smallestQueue: ResourceRequest[] | null = null;
    let smallestSize = Infinity;

    for (const queue of this.priorityQueues.values()) {
      if (queue.length > 0 && queue.length < smallestSize) {
        smallestSize = queue.length;
        smallestQueue = queue;
      }
    }

    return smallestQueue && smallestQueue.length > 0 ? smallestQueue[0] : null;
  }

  /**
   * Get resource optimized request (simplified)
   */
  private getResourceOptimizedRequest(): ResourceRequest | null {
    // For now, return request with lowest resource requirements
    let optimalRequest: ResourceRequest | null = null;
    let lowestResourceScore = Infinity;

    for (const queue of this.priorityQueues.values()) {
      for (const request of queue) {
        const resourceScore = this.calculateResourceScore(request);
        if (resourceScore < lowestResourceScore) {
          lowestResourceScore = resourceScore;
          optimalRequest = request;
        }
      }
    }

    return optimalRequest;
  }

  /**
   * Calculate resource score for optimization
   */
  private calculateResourceScore(request: ResourceRequest): number {
    const memory = request.requiredResources?.minMemoryMB || 256;
    const cpu = request.requiredResources?.maxCpuPercent || 50;
    const bandwidth = request.requiredResources?.networkBandwidth || 10;
    
    return memory + (cpu * 2) + bandwidth;
  }

  /**
   * Set container allocation callback (to be called by ContainerPoolManager)
   */
  private containerAllocationCallback?: (testRunId: string) => Promise<Container | null>;

  setContainerAllocationCallback(callback: (testRunId: string) => Promise<Container | null>): void {
    this.containerAllocationCallback = callback;
  }

  /**
   * Allocate container using the provided callback
   */
  private async allocateContainer(request: ResourceRequest): Promise<Container | null> {
    if (!this.containerAllocationCallback) {
      this.logger.warn('No container allocation callback set, using simulation');
      // Fallback simulation
      if (Math.random() > 0.2) { // 80% success rate
        return {
          id: `container-${Date.now()}`,
          name: `test-container-${request.testRunId}`,
          port: 3001,
          sseUrl: 'http://localhost:3001/sse',
          status: 'allocated' as any,
        };
      }
      return null;
    }

    try {
      return await this.containerAllocationCallback(request.testRunId);
    } catch (error) {
      this.logger.error('Container allocation callback failed', { 
        testRunId: request.testRunId, 
        error 
      });
      return null;
    }
  }

  /**
   * Remove request from queue
   */
  private removeFromQueue(testRunId: string): void {
    for (const [priority, queue] of this.priorityQueues.entries()) {
      const index = queue.findIndex(req => req.testRunId === testRunId);
      if (index >= 0) {
        queue.splice(index, 1);
        this.priorityQueues.set(priority, queue);
        break;
      }
    }
    this.updateQueueMetrics();
  }

  /**
   * Get total queue size
   */
  private getTotalQueueSize(): number {
    return Array.from(this.priorityQueues.values())
      .reduce((total, queue) => total + queue.length, 0);
  }

  /**
   * Update queue metrics
   */
  private updateQueueMetrics(): void {
    const currentSize = this.getTotalQueueSize();
    this.metrics.queueMetrics.currentSize = currentSize;
    this.metrics.queueMetrics.maxSize = Math.max(this.metrics.queueMetrics.maxSize, currentSize);
    
    // Update average size (simple moving average)
    this.metrics.queueMetrics.averageSize = 
      (this.metrics.queueMetrics.averageSize * 0.9) + (currentSize * 0.1);
  }

  /**
   * Update overall metrics
   */
  private updateMetrics(request: ResourceRequest, result: AllocationResult): void {
    this.metrics.totalRequests++;

    if (result.success) {
      this.metrics.successfulAllocations++;
    } else {
      this.metrics.failedAllocations++;
      if (result.errors.some(e => e.includes('timeout'))) {
        this.metrics.timeoutAllocations++;
      }
    }

    if (result.degradedMode) {
      this.metrics.degradedAllocations++;
    }

    // Update average wait time
    this.metrics.averageWaitTime = 
      (this.metrics.averageWaitTime * (this.metrics.totalRequests - 1) + result.waitTimeMs) / 
      this.metrics.totalRequests;

    // Update peak wait time
    this.metrics.queueMetrics.peakWaitTime = Math.max(
      this.metrics.queueMetrics.peakWaitTime, 
      result.waitTimeMs
    );

    // Update performance metrics
    this.metrics.performanceMetrics.failureRate = 
      this.metrics.failedAllocations / this.metrics.totalRequests;
  }

  /**
   * Record allocation history for analytics
   */
  private recordAllocationHistory(request: ResourceRequest, result: AllocationResult): void {
    this.allocationHistory.push({
      request: { ...request },
      result: { ...result },
      timestamp: new Date(),
    });

    // Keep last 10000 entries
    if (this.allocationHistory.length > 10000) {
      this.allocationHistory = this.allocationHistory.slice(-5000);
    }
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown(): Promise<void> {
    if (this.queueProcessor) {
      clearInterval(this.queueProcessor);
      this.queueProcessor = undefined;
    }

    this.priorityQueues.clear();
    this.activeAllocations.clear();
    this.allocationHistory = [];
    this.resourceUsageHistory = [];

    this.logger.info('Resource manager shutdown complete');
  }
}