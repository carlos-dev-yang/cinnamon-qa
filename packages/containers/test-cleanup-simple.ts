import { RedisClient } from '@cinnamon-qa/queue';
import { ContainerPoolManager } from './src/container-pool-manager';
import { createLogger } from '@cinnamon-qa/logger';

async function testCleanupSimple() {
  const logger = createLogger({ context: 'CleanupSimpleTest' });
  logger.info('Starting simple cleanup test');

  // Initialize Redis client
  const redisClient = new RedisClient({
    host: 'localhost',
    port: 6379,
    db: 0,
  });

  try {
    await redisClient.connect();
    logger.info('Redis connected successfully');

    // Initialize pool manager
    const poolManager = new ContainerPoolManager(redisClient);
    
    // Disable auto-reset for simpler testing
    const resetManager = poolManager.getResetManager();
    resetManager.updateConfig({
      enableAutoReset: false,
      resetOnAllocation: false,
      resetOnRelease: false,
    });
    
    logger.info('Initializing container pool');
    await poolManager.initialize();
    logger.info('Container pool initialized successfully');

    // Simple allocation test
    logger.info('Starting simple allocation test');
    const container1 = await poolManager.allocateContainer('test-run-1');
    if (container1) {
      logger.info('Container allocated successfully', {
        containerId: container1.containerId,
        port: container1.port,
        name: container1.name
      });
    } else {
      logger.warn('Container allocation returned null');
    }
    
    if (container1) {
      // Test manual cleanup
      logger.info('Starting manual cleanup test');
      await poolManager.cleanupContainer(container1.containerId);
      logger.info('Manual cleanup completed successfully', { containerId: container1.containerId });
      
      // Test manual reset
      logger.info('Starting manual reset test');
      await poolManager.resetContainer(container1.containerId);
      logger.info('Manual reset completed successfully', { containerId: container1.containerId });
      
      // Release container
      logger.info('Starting container release test');
      await poolManager.releaseContainer(container1.containerId);
      logger.info('Container released successfully', { containerId: container1.containerId });
    }

    // Configuration test
    logger.info('Starting configuration test');
    const stats = poolManager.getCleanupResetStats();
    logger.info('Configuration retrieved successfully', {
      activeResets: stats.activeResets.length,
      resetEnabled: stats.resetConfig.enableAutoReset,
      cleanupTimeout: stats.cleanupConfig.timeoutMs
    });

    logger.info('Simple cleanup tests completed successfully');

    // Shutdown
    logger.info('Initiating shutdown process');
    await poolManager.shutdown();
    logger.info('Pool manager shutdown completed successfully');

  } catch (error) {
    logger.error('Simple cleanup test failed', { error: error.message, stack: error.stack });
  } finally {
    await redisClient.disconnect();
    logger.info('Redis disconnected successfully');
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  const logger = createLogger({ context: 'CleanupSimpleTest' });
  logger.info('Received SIGINT - shutting down gracefully');
  process.exit(0);
});

// Run the test
testCleanupSimple().catch((error) => {
  const logger = createLogger({ context: 'CleanupSimpleTest' });
  logger.error('Simple cleanup test execution failed', { error: error.message, stack: error.stack });
});