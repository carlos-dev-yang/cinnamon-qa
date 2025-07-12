import { RedisClient } from '@cinnamon-qa/queue';
import { ContainerPoolManager } from './src';
import { createLogger } from '@cinnamon-qa/logger';

async function testPoolManager() {
  const logger = createLogger({ context: 'PoolManagerTest' });
  logger.info('Starting advanced container pool manager test');
  
  // Initialize Redis client
  const redisClient = new RedisClient({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    db: 0,
  });
  
  try {
    logger.info('Connecting to Redis');
    await redisClient.connect();
    logger.info('Redis connected successfully');

    // Clean up existing container if any
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    try {
      await execAsync('docker rm -f cinnamon-qa-mcp-1 cinnamon-qa-mcp-2');
    } catch {
      // Ignore if containers don't exist
    }

    // Initialize container pool manager
    logger.info('Initializing container pool manager');
    const poolManager = new ContainerPoolManager(redisClient);
    
    // This might fail due to container startup issues, but let's see metrics
    try {
      await poolManager.initialize();
      logger.info('Container pool manager initialized successfully');
    } catch (error) {
      logger.warn('Pool initialization encountered issues', { error: error.message });
    }

    // Check initial status
    logger.info('Checking initial pool status');
    const initialStatus = await poolManager.getPoolStatus();
    logger.info('Initial pool status retrieved', {
      metrics: initialStatus.metrics,
      containerCount: initialStatus.containers.length,
      queueSize: initialStatus.queue.size
    });

    // Test allocation without waiting (should fail if no containers)
    logger.info('Starting Test 1: Immediate allocation (no wait)');
    const testRunId1 = 'test-run-immediate-' + Date.now();
    const container1 = await poolManager.allocateContainer(testRunId1, false);
    
    if (container1) {
      logger.info('Immediate allocation successful', {
        containerId: container1.id,
        testRunId: testRunId1
      });
      
      // Test second immediate allocation
      logger.info('Starting Test 2: Second immediate allocation');
      const testRunId2 = 'test-run-immediate2-' + Date.now();
      const container2 = await poolManager.allocateContainer(testRunId2, false);
      
      if (container2) {
        logger.info('Second allocation successful', {
          containerId: container2.id,
          testRunId: testRunId2
        });
        
        // Test third allocation (should fail)
        logger.info('Starting Test 3: Third immediate allocation (should fail)');
        const testRunId3 = 'test-run-immediate3-' + Date.now();
        const container3 = await poolManager.allocateContainer(testRunId3, false);
        
        if (container3) {
          logger.warn('Unexpected result: third allocation succeeded when pool should be full', {
            containerId: container3.id,
            testRunId: testRunId3
          });
        } else {
          logger.info('Third allocation correctly failed - pool is full');
        }
        
        // Test release
        logger.info('Starting Test 4: Release first container');
        await poolManager.releaseContainer(container1.id);
        logger.info('First container released successfully', { containerId: container1.id });
        
        // Test allocation after release
        logger.info('Starting Test 5: Allocation after release');
        const testRunId4 = 'test-run-after-release-' + Date.now();
        const container4 = await poolManager.allocateContainer(testRunId4, false);
        
        if (container4) {
          logger.info('Allocation after release successful', {
            containerId: container4.id,
            testRunId: testRunId4
          });
          await poolManager.releaseContainer(container4.id);
        } else {
          logger.error('Allocation after release failed');
        }
        
        // Clean up
        await poolManager.releaseContainer(container2.id);
        logger.info('Second container released successfully', { containerId: container2.id });
        
      } else {
        logger.error('Second allocation failed');
      }
    } else {
      logger.info('No containers available for immediate allocation');
    }

    // Test queue functionality (simulate with fake containers in Redis)
    logger.info('Starting Test 6: Queue functionality simulation');
    
    // Manually set both containers as allocated to test queue
    await redisClient.instance.hset('container:container-1', {
      containerId: 'container-1',
      port: '3001',
      allocated: 'true',
      allocatedTo: 'fake-test-1',
      lastCheckedAt: new Date().toISOString(),
    });
    
    await redisClient.instance.hset('container:container-2', {
      containerId: 'container-2',
      port: '3002',
      allocated: 'true',
      allocatedTo: 'fake-test-2',
      lastCheckedAt: new Date().toISOString(),
    });

    // Test queue with timeout
    logger.info('Starting Test 7: Queue allocation with timeout');
    const testRunIdQueue = 'test-run-queue-' + Date.now();
    
    const startTime = Date.now();
    const queuedContainer = await poolManager.allocateContainer(testRunIdQueue, true, 5000); // 5 second timeout
    const endTime = Date.now();
    
    if (queuedContainer) {
      logger.warn('Unexpected result: queued allocation succeeded when containers should be busy', {
        containerId: queuedContainer.id,
        testRunId: testRunIdQueue
      });
    } else {
      logger.info('Queued allocation correctly timed out', {
        timeoutMs: endTime - startTime,
        testRunId: testRunIdQueue
      });
    }

    // Final status
    logger.info('Checking final pool status');
    const finalStatus = await poolManager.getPoolStatus();
    logger.info('Final pool status retrieved', {
      metrics: finalStatus.metrics,
      queueStatus: finalStatus.queue
    });
    
    logger.info('Initiating container pool manager shutdown');
    await poolManager.shutdown();
    logger.info('Container pool manager shutdown completed successfully');
    
  } catch (error) {
    logger.error('Pool manager test failed', { error: error.message, stack: error.stack });
  } finally {
    await redisClient.disconnect();
    logger.info('Redis disconnected successfully');
  }
}

// Run test
testPoolManager().catch((error) => {
  const logger = createLogger({ context: 'PoolManagerTest' });
  logger.error('Pool manager test execution failed', { error: error.message, stack: error.stack });
});