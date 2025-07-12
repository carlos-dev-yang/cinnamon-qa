import { exec } from 'child_process';
import { promisify } from 'util';
import { EventEmitter } from 'events';
import { RedisClient } from '@cinnamon-qa/queue';
import { SimpleHealthChecker } from './health-checker';
import { ContainerState } from './types';

const execAsync = promisify(exec);

export interface ContainerHealthStatus {
  containerId: string;
  containerName: string;
  port: number;
  isHealthy: boolean;
  lastChecked: Date;
  consecutiveFailures: number;
  resourceUsage: ResourceUsage;
  healthHistory: HealthCheckResult[];
  status: 'healthy' | 'degraded' | 'unhealthy' | 'critical';
}

export interface ResourceUsage {
  memoryUsageMB: number;
  memoryLimitMB: number;
  memoryPercentage: number;
  cpuPercentage: number;
  networkRxMB: number;
  networkTxMB: number;
  lastUpdated: Date;
}

export interface HealthCheckResult {
  timestamp: Date;
  success: boolean;
  responseTimeMs?: number;
  error?: string;
  checkType: 'tcp' | 'http' | 'docker' | 'combined';
}

export interface MonitoringConfig {
  checkIntervalMs: number;
  maxConsecutiveFailures: number;
  memoryThresholdMB: number;
  cpuThresholdPercentage: number;
  responseTimeThresholdMs: number;
  historyRetentionCount: number;
}

export class HealthMonitor extends EventEmitter {
  private healthChecker: SimpleHealthChecker;
  private redisClient: RedisClient;
  private containers: Map<string, ContainerHealthStatus> = new Map();
  private monitoringInterval?: NodeJS.Timeout;
  private resourceInterval?: NodeJS.Timeout;
  private isMonitoring = false;

  private config: MonitoringConfig = {
    checkIntervalMs: 30000, // 30 seconds
    maxConsecutiveFailures: 3,
    memoryThresholdMB: 400, // 400MB threshold
    cpuThresholdPercentage: 80, // 80% CPU threshold
    responseTimeThresholdMs: 5000, // 5 second response threshold
    historyRetentionCount: 20, // Keep last 20 checks
  };

  constructor(redisClient: RedisClient, config?: Partial<MonitoringConfig>) {
    super();
    this.redisClient = redisClient;
    this.healthChecker = new SimpleHealthChecker();
    
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  /**
   * Register a container for monitoring
   */
  registerContainer(containerId: string, containerName: string, port: number): void {
    const healthStatus: ContainerHealthStatus = {
      containerId,
      containerName,
      port,
      isHealthy: true,
      lastChecked: new Date(),
      consecutiveFailures: 0,
      resourceUsage: {
        memoryUsageMB: 0,
        memoryLimitMB: 512, // Default limit
        memoryPercentage: 0,
        cpuPercentage: 0,
        networkRxMB: 0,
        networkTxMB: 0,
        lastUpdated: new Date(),
      },
      healthHistory: [],
      status: 'healthy',
    };

    this.containers.set(containerId, healthStatus);
    console.log(`Registered container ${containerId} for health monitoring`);
    
    this.emit('containerRegistered', { containerId, containerName });
  }

  /**
   * Unregister a container from monitoring
   */
  unregisterContainer(containerId: string): void {
    const container = this.containers.get(containerId);
    if (container) {
      this.containers.delete(containerId);
      console.log(`Unregistered container ${containerId} from health monitoring`);
      this.emit('containerUnregistered', { containerId });
    }
  }

  /**
   * Start monitoring all registered containers
   */
  startMonitoring(): void {
    if (this.isMonitoring) {
      console.log('Health monitoring is already running');
      return;
    }

    console.log(`Starting health monitoring with ${this.config.checkIntervalMs}ms interval`);
    this.isMonitoring = true;

    // Health check interval
    this.monitoringInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, this.config.checkIntervalMs);

    // Resource monitoring interval (more frequent)
    this.resourceInterval = setInterval(async () => {
      await this.updateResourceUsage();
    }, this.config.checkIntervalMs / 2); // Every 15 seconds

    this.emit('monitoringStarted');
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    console.log('Stopping health monitoring');
    this.isMonitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    if (this.resourceInterval) {
      clearInterval(this.resourceInterval);
      this.resourceInterval = undefined;
    }

    this.emit('monitoringStopped');
  }

  /**
   * Perform health checks on all registered containers
   */
  private async performHealthChecks(): Promise<void> {
    console.log(`Performing health checks on ${this.containers.size} containers`);

    const checkPromises = Array.from(this.containers.entries()).map(([containerId, status]) =>
      this.checkContainerHealth(containerId, status)
    );

    await Promise.allSettled(checkPromises);
  }

  /**
   * Check health of a specific container
   */
  private async checkContainerHealth(containerId: string, status: ContainerHealthStatus): Promise<void> {
    const startTime = Date.now();

    try {
      const detailedResult = await this.healthChecker.checkDetailedHealth(
        status.port,
        status.containerName
      );

      const responseTime = Date.now() - startTime;
      const isHealthy = detailedResult.healthy && responseTime < this.config.responseTimeThresholdMs;

      // Record health check result
      const healthResult: HealthCheckResult = {
        timestamp: new Date(),
        success: isHealthy,
        responseTimeMs: responseTime,
        error: detailedResult.error,
        checkType: 'combined',
      };

      this.recordHealthCheck(containerId, healthResult, isHealthy);

    } catch (error) {
      const healthResult: HealthCheckResult = {
        timestamp: new Date(),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        checkType: 'combined',
      };

      this.recordHealthCheck(containerId, healthResult, false);
    }
  }

  /**
   * Record health check result and update container status
   */
  private recordHealthCheck(containerId: string, result: HealthCheckResult, isHealthy: boolean): void {
    const container = this.containers.get(containerId);
    if (!container) return;

    // Update health history
    container.healthHistory.push(result);
    if (container.healthHistory.length > this.config.historyRetentionCount) {
      container.healthHistory.shift();
    }

    // Update health status
    container.lastChecked = result.timestamp;
    container.isHealthy = isHealthy;

    if (isHealthy) {
      container.consecutiveFailures = 0;
    } else {
      container.consecutiveFailures++;
    }

    // Determine overall status
    const previousStatus = container.status;
    container.status = this.determineContainerStatus(container);

    // Emit events for status changes
    if (previousStatus !== container.status) {
      console.log(`Container ${containerId} status changed: ${previousStatus} → ${container.status}`);
      this.emit('statusChanged', {
        containerId,
        previousStatus,
        newStatus: container.status,
        container: { ...container }
      });
    }

    // Emit specific events
    if (!isHealthy) {
      this.emit('healthCheckFailed', {
        containerId,
        consecutiveFailures: container.consecutiveFailures,
        result,
        container: { ...container }
      });
    }

    if (container.consecutiveFailures >= this.config.maxConsecutiveFailures) {
      this.emit('containerUnhealthy', {
        containerId,
        consecutiveFailures: container.consecutiveFailures,
        container: { ...container }
      });
    }
  }

  /**
   * Update resource usage for all containers
   */
  private async updateResourceUsage(): Promise<void> {
    const containerNames = Array.from(this.containers.values()).map(c => c.containerName);
    
    for (const containerName of containerNames) {
      try {
        const stats = await this.getContainerStats(containerName);
        if (stats) {
          const container = Array.from(this.containers.values())
            .find(c => c.containerName === containerName);
          
          if (container) {
            const previousUsage = container.resourceUsage;
            container.resourceUsage = stats;

            // Check for resource thresholds
            if (stats.memoryUsageMB > this.config.memoryThresholdMB) {
              this.emit('memoryThresholdExceeded', {
                containerId: container.containerId,
                memoryUsage: stats.memoryUsageMB,
                threshold: this.config.memoryThresholdMB,
                container: { ...container }
              });
            }

            if (stats.cpuPercentage > this.config.cpuThresholdPercentage) {
              this.emit('cpuThresholdExceeded', {
                containerId: container.containerId,
                cpuUsage: stats.cpuPercentage,
                threshold: this.config.cpuThresholdPercentage,
                container: { ...container }
              });
            }

            // Emit resource update event if significant change
            if (Math.abs(stats.memoryUsageMB - previousUsage.memoryUsageMB) > 50 ||
                Math.abs(stats.cpuPercentage - previousUsage.cpuPercentage) > 20) {
              this.emit('resourceUsageUpdated', {
                containerId: container.containerId,
                resourceUsage: stats,
                container: { ...container }
              });
            }
          }
        }
      } catch (error) {
        console.error(`Failed to get stats for container ${containerName}:`, error);
      }
    }
  }

  /**
   * Get Docker container statistics
   */
  private async getContainerStats(containerName: string): Promise<ResourceUsage | null> {
    try {
      const { stdout } = await execAsync(
        `docker stats --no-stream --format "{{.MemUsage}},{{.CPUPerc}},{{.NetIO}}" ${containerName}`,
        { timeout: 5000 }
      );

      const parts = stdout.trim().split(',');
      if (parts.length !== 3) {
        return null;
      }

      // Parse memory usage: "123.4MiB / 512MiB"
      const memoryMatch = parts[0].match(/([0-9.]+)([KMGT]?i?B)\s*\/\s*([0-9.]+)([KMGT]?i?B)/);
      const memoryUsageMB = memoryMatch ? this.parseMemoryValue(memoryMatch[1], memoryMatch[2]) : 0;
      const memoryLimitMB = memoryMatch ? this.parseMemoryValue(memoryMatch[3], memoryMatch[4]) : 512;

      // Parse CPU usage: "12.34%"
      const cpuPercentage = parseFloat(parts[1].replace('%', '')) || 0;

      // Parse network I/O: "1.23MB / 4.56MB"
      const networkMatch = parts[2].match(/([0-9.]+)([KMGT]?B)\s*\/\s*([0-9.]+)([KMGT]?B)/);
      const networkRxMB = networkMatch ? this.parseMemoryValue(networkMatch[1], networkMatch[2]) : 0;
      const networkTxMB = networkMatch ? this.parseMemoryValue(networkMatch[3], networkMatch[4]) : 0;

      return {
        memoryUsageMB,
        memoryLimitMB,
        memoryPercentage: memoryLimitMB > 0 ? (memoryUsageMB / memoryLimitMB) * 100 : 0,
        cpuPercentage,
        networkRxMB,
        networkTxMB,
        lastUpdated: new Date(),
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Parse memory value with unit to MB
   */
  private parseMemoryValue(value: string, unit: string): number {
    const numValue = parseFloat(value);
    switch (unit.toLowerCase()) {
      case 'b': return numValue / (1024 * 1024);
      case 'kb': case 'kib': return numValue / 1024;
      case 'mb': case 'mib': return numValue;
      case 'gb': case 'gib': return numValue * 1024;
      case 'tb': case 'tib': return numValue * 1024 * 1024;
      default: return numValue;
    }
  }

  /**
   * Determine container status based on health and resource usage
   */
  private determineContainerStatus(container: ContainerHealthStatus): 'healthy' | 'degraded' | 'unhealthy' | 'critical' {
    if (container.consecutiveFailures >= this.config.maxConsecutiveFailures) {
      return 'critical';
    }

    if (container.consecutiveFailures > 0) {
      return 'unhealthy';
    }

    const usage = container.resourceUsage;
    if (usage.memoryUsageMB > this.config.memoryThresholdMB || 
        usage.cpuPercentage > this.config.cpuThresholdPercentage) {
      return 'degraded';
    }

    return 'healthy';
  }

  /**
   * Get current health status of all containers
   */
  getHealthStatus(): ContainerHealthStatus[] {
    return Array.from(this.containers.values()).map(container => ({ ...container }));
  }

  /**
   * Get health status of a specific container
   */
  getContainerHealthStatus(containerId: string): ContainerHealthStatus | null {
    const container = this.containers.get(containerId);
    return container ? { ...container } : null;
  }

  /**
   * Get monitoring statistics
   */
  getMonitoringStats(): {
    isMonitoring: boolean;
    totalContainers: number;
    healthyContainers: number;
    degradedContainers: number;
    unhealthyContainers: number;
    criticalContainers: number;
    averageResponseTime: number;
    lastCheckTime: Date | null;
  } {
    const containers = Array.from(this.containers.values());
    const healthyCount = containers.filter(c => c.status === 'healthy').length;
    const degradedCount = containers.filter(c => c.status === 'degraded').length;
    const unhealthyCount = containers.filter(c => c.status === 'unhealthy').length;
    const criticalCount = containers.filter(c => c.status === 'critical').length;

    // Calculate average response time from recent checks
    const recentChecks = containers
      .flatMap(c => c.healthHistory.slice(-5))
      .filter(h => h.responseTimeMs !== undefined);
    
    const averageResponseTime = recentChecks.length > 0
      ? recentChecks.reduce((sum, h) => sum + (h.responseTimeMs || 0), 0) / recentChecks.length
      : 0;

    const lastCheckTimes = containers
      .map(c => c.lastChecked)
      .filter(date => date)
      .sort((a, b) => b.getTime() - a.getTime());

    return {
      isMonitoring: this.isMonitoring,
      totalContainers: containers.length,
      healthyContainers: healthyCount,
      degradedContainers: degradedCount,
      unhealthyContainers: unhealthyCount,
      criticalContainers: criticalCount,
      averageResponseTime,
      lastCheckTime: lastCheckTimes[0] || null,
    };
  }
}