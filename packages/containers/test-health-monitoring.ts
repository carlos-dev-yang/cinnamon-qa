import { RedisClient } from '@cinnamon-qa/queue';
import { ContainerPoolManager } from './src/container-pool-manager';
import { HealthDashboard } from './src/health-dashboard';
import { createLogger } from '@cinnamon-qa/logger';

async function testHealthMonitoring() {
  const logger = createLogger({ context: 'HealthMonitoringTest' });
  logger.info('Starting container health monitoring system test');

  // Initialize Redis client
  const redisClient = new RedisClient({
    host: 'localhost',
    port: 6379,
    db: 0,
  });

  try {
    await redisClient.connect();
    logger.info('Redis connected successfully');

    // Initialize pool manager with health monitoring
    const poolManager = new ContainerPoolManager(redisClient);
    logger.info('Initializing container pool with health monitoring');
    
    await poolManager.initialize();
    logger.info('Container pool initialized with health monitoring successfully');

    // Create health dashboard
    const dashboard = new HealthDashboard(poolManager, (poolManager as any).healthMonitor);

    // Show initial dashboard
    logger.info('Displaying initial health dashboard');
    await dashboard.printDashboard();

    // Test allocation and release
    logger.info('Starting allocation and release test');
    const container1 = await poolManager.allocateContainer('test-run-1');
    if (container1) {
      logger.info('Container allocated successfully', { containerId: container1.containerId });
    } else {
      logger.warn('Container allocation returned null');
    }

    // Show dashboard after allocation
    await new Promise(resolve => setTimeout(resolve, 2000));
    logger.info('Displaying dashboard after allocation');
    await dashboard.printDashboard();

    // Release container
    if (container1) {
      await poolManager.releaseContainer(container1.containerId);
      logger.info('Container released successfully', { containerId: container1.containerId });
    }

    // Show dashboard after release
    await new Promise(resolve => setTimeout(resolve, 2000));
    logger.info('Displaying dashboard after release');
    await dashboard.printDashboard();

    // Test system status
    logger.info('Starting system status check');
    const systemStatus = await dashboard.getSystemStatus();
    logger.info('System status retrieved', {
      overall: systemStatus.overall,
      monitoring: systemStatus.monitoring ? 'Active' : 'Inactive',
      containersUp: systemStatus.containersUp,
      containersTotal: systemStatus.containersTotal
    });
    if (systemStatus.issues.length > 0) {
      logger.warn('System issues detected', { issues: systemStatus.issues });
    }

    // Run periodic monitoring for a bit
    logger.info('Starting periodic monitoring for 30 seconds');
    const periodicInterval = dashboard.startPeriodicDashboard(10000); // Every 10 seconds

    // Wait for 30 seconds
    await new Promise(resolve => setTimeout(resolve, 30000));

    // Stop periodic monitoring
    clearInterval(periodicInterval);
    logger.info('Periodic monitoring stopped successfully');

    // Final dashboard
    logger.info('Displaying final health dashboard');
    await dashboard.printDashboard();

    // Test JSON output
    logger.info('Retrieving JSON dashboard data');
    const jsonData = await dashboard.getDashboardJson();
    logger.info('JSON dashboard data retrieved', { data: jsonData });

    logger.info('Initiating shutdown process');
    await poolManager.shutdown();
    logger.info('Pool manager shutdown completed successfully');

  } catch (error) {
    logger.error('Health monitoring test failed', { error: error.message, stack: error.stack });
  } finally {
    await redisClient.disconnect();
    logger.info('Redis disconnected successfully');
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  const logger = createLogger({ context: 'HealthMonitoringTest' });
  logger.info('Received SIGINT - shutting down gracefully');
  process.exit(0);
});

// Run the test
testHealthMonitoring().catch((error) => {
  const logger = createLogger({ context: 'HealthMonitoringTest' });
  logger.error('Health monitoring test execution failed', { error: error.message, stack: error.stack });
});