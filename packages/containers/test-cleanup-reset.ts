import { RedisClient } from '@cinnamon-qa/queue';
import { ContainerPoolManager } from './src/container-pool-manager';
import { createLogger } from '@cinnamon-qa/logger';

async function testCleanupAndReset() {
  const logger = createLogger({ context: 'CleanupResetTest' });
  logger.info('Starting container cleanup and reset system test');

  // Initialize Redis client
  const redisClient = new RedisClient({
    host: 'localhost',
    port: 6379,
    db: 0,
  });

  try {
    await redisClient.connect();
    logger.info('Redis connected successfully');

    // Initialize pool manager with cleanup and reset
    const poolManager = new ContainerPoolManager(redisClient);
    logger.info('Initializing container pool with cleanup and reset');
    
    await poolManager.initialize();
    logger.info('Container pool initialized successfully');

    // Test 1: Basic allocation with automatic reset on allocation
    logger.info('Starting Test 1: Allocation with automatic reset');
    const container1 = await poolManager.allocateContainer('test-run-1');
    if (container1) {
      logger.info('Container allocated successfully', { containerId: container1.id });
    } else {
      logger.warn('Container allocation returned null');
    }
    
    // Simulate some work
    logger.info('Simulating test work for 5 seconds');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Test 2: Release with automatic cleanup
    logger.info('Starting Test 2: Release with automatic cleanup');
    if (container1) {
      await poolManager.releaseContainer(container1.id);
      logger.info('Container released successfully', { containerId: container1.id });
    }

    // Test 3: Manual cleanup
    logger.info('Starting Test 3: Manual cleanup test');
    const container2 = await poolManager.allocateContainer('test-run-2');
    if (container2) {
      logger.info('Container allocated for manual cleanup test', { containerId: container2.id });
      
      // Perform manual cleanup
      await poolManager.cleanupContainer(container2.id);
      logger.info('Manual cleanup completed successfully', { containerId: container2.id });
      
      await poolManager.releaseContainer(container2.id);
    }

    // Test 4: Manual reset with different strategies
    logger.info('Starting Test 4: Manual reset strategies test');
    const container3 = await poolManager.allocateContainer('test-run-3');
    if (container3) {
      logger.info('Container allocated for reset test', { containerId: container3.id });
      
      // Test manual reset
      await poolManager.resetContainer(container3.id);
      logger.info('Manual reset completed successfully', { containerId: container3.id });
      
      await poolManager.releaseContainer(container3.id);
    }

    // Test 5: Configuration and statistics
    logger.info('Starting Test 5: Cleanup and Reset Configuration');
    const stats = poolManager.getCleanupResetStats();
    logger.info('Cleanup and reset configuration retrieved', {
      cleanupConfig: stats.cleanupConfig,
      resetConfig: stats.resetConfig,
      activeResets: stats.activeResets
    });

    // Test 6: Cleanup service configuration
    logger.info('Starting Test 6: Cleanup service configuration test');
    const cleanupService = poolManager.getCleanupService();
    const originalConfig = cleanupService.getConfig();
    logger.info('Original cleanup configuration retrieved', { config: originalConfig });
    
    // Update configuration
    cleanupService.updateConfig({
      timeoutMs: 45000,
      maxRetries: 5,
      validateCleanup: true,
    });
    
    const updatedConfig = cleanupService.getConfig();
    logger.info('Cleanup configuration updated successfully', { config: updatedConfig });

    // Test 7: Reset manager configuration
    logger.info('Starting Test 7: Reset manager configuration test');
    const resetManager = poolManager.getResetManager();
    const originalResetConfig = resetManager.getConfig();
    logger.info('Original reset configuration retrieved', { config: originalResetConfig });
    
    // Update reset configuration
    resetManager.updateConfig({
      enableAutoReset: true,
      resetOnAllocation: false, // Disable auto-reset for next test
      resetOnRelease: true,
      maxResetAttempts: 2,
    });
    
    const updatedResetConfig = resetManager.getConfig();
    logger.info('Reset configuration updated successfully', { config: updatedResetConfig });

    // Test 8: Test without auto-reset on allocation
    logger.info('Starting Test 8: Test without auto-reset on allocation');
    const container4 = await poolManager.allocateContainer('test-run-4');
    if (container4) {
      logger.info('Container allocated without auto-reset', { containerId: container4.id });
      await poolManager.releaseContainer(container4.id);
      logger.info('Container released with auto-reset on release', { containerId: container4.id });
    }

    // Test 9: Reset statistics
    logger.info('Starting Test 9: Reset statistics');
    const resetStats = resetManager.getResetStats();
    logger.info('Reset statistics retrieved', { stats: resetStats });

    // Test 10: Error handling and validation
    logger.info('Starting Test 10: Error handling test');
    try {
      await poolManager.cleanupContainer('non-existent-container');
    } catch (error) {
      logger.info('Correctly caught error for non-existent container cleanup', { error: error.message });
    }

    try {
      await poolManager.resetContainer('non-existent-container');
    } catch (error) {
      logger.info('Correctly caught error for non-existent container reset', { error: error.message });
    }

    // Test 11: Concurrent operations
    logger.info('Starting Test 11: Concurrent cleanup/reset operations');
    const concurrentPromises: Promise<void>[] = [];
    
    // Allocate both containers
    const concurrentContainer1 = await poolManager.allocateContainer('concurrent-1');
    const concurrentContainer2 = await poolManager.allocateContainer('concurrent-2');
    
    if (concurrentContainer1 && concurrentContainer2) {
      // Try concurrent cleanup and reset
      concurrentPromises.push(
        poolManager.cleanupContainer(concurrentContainer1.id)
      );
      concurrentPromises.push(
        poolManager.resetContainer(concurrentContainer2.id)
      );
      
      await Promise.allSettled(concurrentPromises);
      logger.info('Concurrent cleanup and reset operations completed successfully');
      
      // Release containers
      await poolManager.releaseContainer(concurrentContainer1.id);
      await poolManager.releaseContainer(concurrentContainer2.id);
    }

    logger.info('All cleanup and reset tests completed successfully');

    // Final cleanup
    logger.info('Initiating shutdown process');
    await poolManager.shutdown();
    logger.info('Pool manager shutdown completed successfully');

  } catch (error) {
    logger.error('Cleanup and reset test failed', { error: error.message, stack: error.stack });
  } finally {
    await redisClient.disconnect();
    logger.info('Redis disconnected successfully');
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  const logger = createLogger({ context: 'CleanupResetTest' });
  logger.info('Received SIGINT - shutting down gracefully');
  process.exit(0);
});

// Run the test
testCleanupAndReset().catch((error) => {
  const logger = createLogger({ context: 'CleanupResetTest' });
  logger.error('Cleanup and reset test execution failed', { error: error.message, stack: error.stack });
});