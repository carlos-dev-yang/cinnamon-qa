import { createLogger } from '@cinnamon-qa/logger';
import { ContainerPoolManager } from './container-pool-manager';
import { HealthMonitor, ContainerHealthStatus } from './health-monitor';

export interface DashboardData {
  timestamp: Date;
  poolMetrics: {
    totalContainers: number;
    availableContainers: number;
    allocatedContainers: number;
    queueSize: number;
    averageAllocationTime: number;
    totalAllocations: number;
    totalReleases: number;
    failedAllocations: number;
  };
  healthMetrics: {
    isMonitoring: boolean;
    totalContainers: number;
    healthyContainers: number;
    degradedContainers: number;
    unhealthyContainers: number;
    criticalContainers: number;
    averageResponseTime: number;
    lastCheckTime: Date | null;
  };
  containerDetails: Array<{
    containerId: string;
    containerName: string;
    port: number;
    status: 'healthy' | 'degraded' | 'unhealthy' | 'critical';
    allocated: boolean;
    allocatedTo?: string;
    isHealthy: boolean;
    consecutiveFailures: number;
    lastChecked: Date;
    resourceUsage: {
      memoryUsageMB: number;
      memoryPercentage: number;
      cpuPercentage: number;
      networkRxMB: number;
      networkTxMB: number;
    };
    recentErrors: string[];
  }>;
}

export class HealthDashboard {
  private readonly logger = createLogger({ context: 'HealthDashboard' });
  private poolManager: ContainerPoolManager;
  private healthMonitor: HealthMonitor;

  constructor(poolManager: ContainerPoolManager, healthMonitor: HealthMonitor) {
    this.poolManager = poolManager;
    this.healthMonitor = healthMonitor;
  }

  /**
   * Get comprehensive dashboard data
   */
  async getDashboardData(): Promise<DashboardData> {
    const poolStatus = await this.poolManager.getPoolStatus();
    const healthStats = this.healthMonitor.getMonitoringStats();
    const healthStatuses = this.healthMonitor.getHealthStatus();

    const containerDetails = healthStatuses.map(health => {
      const poolContainer = poolStatus.containers.find(c => c.id === health.containerId);
      
      // Get recent errors from health history
      const recentErrors = health.healthHistory
        .slice(-5)
        .filter(h => !h.success && h.error)
        .map(h => h.error!)
        .filter((error, index, array) => array.indexOf(error) === index); // Remove duplicates

      return {
        containerId: health.containerId,
        containerName: health.containerName,
        port: health.port,
        status: health.status,
        allocated: poolContainer?.allocated || false,
        allocatedTo: poolContainer?.allocatedTo,
        isHealthy: health.isHealthy,
        consecutiveFailures: health.consecutiveFailures,
        lastChecked: health.lastChecked,
        resourceUsage: {
          memoryUsageMB: health.resourceUsage.memoryUsageMB,
          memoryPercentage: health.resourceUsage.memoryPercentage,
          cpuPercentage: health.resourceUsage.cpuPercentage,
          networkRxMB: health.resourceUsage.networkRxMB,
          networkTxMB: health.resourceUsage.networkTxMB,
        },
        recentErrors,
      };
    });

    return {
      timestamp: new Date(),
      poolMetrics: poolStatus.metrics,
      healthMetrics: healthStats,
      containerDetails,
    };
  }

  /**
   * Generate console dashboard output
   */
  async printDashboard(): Promise<void> {
    const data = await this.getDashboardData();
    
    this.logger.info('\n' + '='.repeat(80));
    this.logger.info('CONTAINER HEALTH DASHBOARD');
    this.logger.info('='.repeat(80));
    this.logger.info(`Generated: ${data.timestamp.toISOString()}`);
    
    // Pool Metrics
    this.logger.info('\nPOOL METRICS:');
    this.logger.info(`   Total Containers: ${data.poolMetrics.totalContainers}`);
    this.logger.info(`   Available: ${data.poolMetrics.availableContainers} | Allocated: ${data.poolMetrics.allocatedContainers}`);
    this.logger.info(`   Queue Size: ${data.poolMetrics.queueSize}`);
    this.logger.info(`   Total Allocations: ${data.poolMetrics.totalAllocations} | Failed: ${data.poolMetrics.failedAllocations}`);
    this.logger.info(`   Avg Allocation Time: ${data.poolMetrics.averageAllocationTime.toFixed(2)}ms`);

    // Health Metrics
    this.logger.info('\nHEALTH METRICS:');
    this.logger.info(`   Monitoring: ${data.healthMetrics.isMonitoring ? 'Active' : 'Stopped'}`);
    this.logger.info(`   Last Check: ${data.healthMetrics.lastCheckTime?.toISOString() || 'Never'}`);
    this.logger.info(`   Status Distribution:`);
    this.logger.info(`     Healthy: ${data.healthMetrics.healthyContainers}`);
    this.logger.info(`     Degraded: ${data.healthMetrics.degradedContainers}`);
    this.logger.info(`     Unhealthy: ${data.healthMetrics.unhealthyContainers}`);
    this.logger.info(`     Critical: ${data.healthMetrics.criticalContainers}`);
    this.logger.info(`   Avg Response Time: ${data.healthMetrics.averageResponseTime.toFixed(2)}ms`);

    // Container Details
    this.logger.info('\nCONTAINER DETAILS:');
    for (const container of data.containerDetails) {
      const statusIcon = this.getStatusIcon(container.status);
      const allocationStatus = container.allocated ? `🔒 ${container.allocatedTo}` : '🆓 Available';
      
      this.logger.info(`\n   ${statusIcon} ${container.containerName} (${container.containerId})`);
      this.logger.info(`     Port: ${container.port} | Status: ${container.status} | ${allocationStatus}`);
      this.logger.info(`     Health: ${container.isHealthy ? 'Yes' : 'No'} | Failures: ${container.consecutiveFailures}`);
      this.logger.info(`     Last Check: ${container.lastChecked.toISOString()}`);
      this.logger.info(`     Resources: ${container.resourceUsage.memoryUsageMB.toFixed(1)}MB (${container.resourceUsage.memoryPercentage.toFixed(1)}%) | CPU: ${container.resourceUsage.cpuPercentage.toFixed(1)}%`);
      this.logger.info(`     Network: RX ${container.resourceUsage.networkRxMB.toFixed(2)}MB | TX ${container.resourceUsage.networkTxMB.toFixed(2)}MB`);
      
      if (container.recentErrors.length > 0) {
        this.logger.info(`     Recent Errors:`);
        container.recentErrors.slice(0, 3).forEach(error => {
          this.logger.info(`       - ${error}`);
        });
      }
    }

    this.logger.info('\n' + '='.repeat(80));
  }

  /**
   * Generate JSON dashboard data for API
   */
  async getDashboardJson(): Promise<string> {
    const data = await this.getDashboardData();
    return JSON.stringify(data, null, 2);
  }

  /**
   * Get simplified status for quick checks
   */
  async getSystemStatus(): Promise<{
    overall: 'healthy' | 'degraded' | 'unhealthy' | 'critical';
    monitoring: boolean;
    containersUp: number;
    containersTotal: number;
    issues: string[];
  }> {
    const data = await this.getDashboardData();
    const issues: string[] = [];

    // Check monitoring status
    if (!data.healthMetrics.isMonitoring) {
      issues.push('Health monitoring is not active');
    }

    // Check container health
    if (data.healthMetrics.criticalContainers > 0) {
      issues.push(`${data.healthMetrics.criticalContainers} containers in critical state`);
    }
    if (data.healthMetrics.unhealthyContainers > 0) {
      issues.push(`${data.healthMetrics.unhealthyContainers} containers unhealthy`);
    }
    if (data.poolMetrics.availableContainers === 0 && data.poolMetrics.queueSize > 0) {
      issues.push(`No available containers, ${data.poolMetrics.queueSize} requests queued`);
    }

    // Determine overall status
    let overall: 'healthy' | 'degraded' | 'unhealthy' | 'critical';
    if (data.healthMetrics.criticalContainers > 0) {
      overall = 'critical';
    } else if (data.healthMetrics.unhealthyContainers > 0) {
      overall = 'unhealthy';
    } else if (data.healthMetrics.degradedContainers > 0 || data.poolMetrics.availableContainers === 0) {
      overall = 'degraded';
    } else {
      overall = 'healthy';
    }

    return {
      overall,
      monitoring: data.healthMetrics.isMonitoring,
      containersUp: data.healthMetrics.healthyContainers + data.healthMetrics.degradedContainers,
      containersTotal: data.healthMetrics.totalContainers,
      issues,
    };
  }

  /**
   * Start periodic dashboard printing
   */
  startPeriodicDashboard(intervalMs: number = 60000): NodeJS.Timeout {
    this.logger.info('Starting periodic dashboard updates', { intervalSeconds: intervalMs / 1000 });
    
    return setInterval(async () => {
      try {
        await this.printDashboard();
      } catch (error) {
        this.logger.error('Failed to generate dashboard', { error });
      }
    }, intervalMs);
  }

  private getStatusIcon(status: string): string {
    switch (status) {
      case 'healthy': return '[OK]';
      case 'degraded': return '[WARN]';
      case 'unhealthy': return '[FAIL]';
      case 'critical': return '[CRIT]';
      default: return '[?]';
    }
  }
}