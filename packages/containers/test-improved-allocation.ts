import { RedisClient } from '@cinnamon-qa/queue';
import { SimpleContainerPool } from './src';
import { createLogger } from '@cinnamon-qa/logger';

async function testImprovedAllocation() {
  const logger = createLogger({ context: 'ImprovedAllocationTest' });
  logger.info('Starting improved container allocation test');
  
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

    // Initialize container pool
    logger.info('Initializing container pool');
    const containerPool = new SimpleContainerPool(redisClient);
    
    // Initialize pool with 2 containers
    await containerPool.initialize();
    logger.info('Container pool initialized successfully');

    // Wait for containers to be fully ready
    logger.info('Waiting for containers to be ready');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Test 1: Single allocation
    logger.info('Starting Test 1: Single allocation');
    const testRunId1 = 'test-run-' + Date.now();
    const container1 = await containerPool.allocateContainer(testRunId1);
    
    if (container1) {
      logger.info('Test 1 completed successfully', {
        containerId: container1.id,
        port: container1.port,
        testRunId: testRunId1
      });
      
      // Check pool status after first allocation
      const status1 = await containerPool.getPoolStatus();
      logger.info('Pool status after first allocation', {
        total: status1.total,
        available: status1.available,
        allocated: status1.allocated
      });
      
      // Test 2: Second allocation
      logger.info('Starting Test 2: Second allocation');
      const testRunId2 = 'test-run-' + (Date.now() + 1);
      const container2 = await containerPool.allocateContainer(testRunId2);
      
      if (container2) {
        logger.info('Test 2 completed successfully', {
          containerId: container2.id,
          port: container2.port,
          testRunId: testRunId2
        });
        
        // Check pool status with both allocated
        const status2 = await containerPool.getPoolStatus();
        logger.info('Pool status with both containers allocated', {
          total: status2.total,
          available: status2.available,
          allocated: status2.allocated
        });
        
        // Test 3: Third allocation (should fail or wait)
        logger.info('Starting Test 3: Third allocation (should fail)');
        const testRunId3 = 'test-run-' + (Date.now() + 2);
        const container3 = await containerPool.allocateContainer(testRunId3);
        
        if (container3) {
          logger.warn('Test 3 unexpected result: container allocated when pool should be full', {
            containerId: container3.id,
            testRunId: testRunId3
          });
        } else {
          logger.info('Test 3 completed successfully: no container available as expected');
        }
        
        // Test 4: Release first container
        logger.info('Starting Test 4: Release first container');
        await containerPool.releaseContainer(container1.id);
        logger.info('First container released successfully', { containerId: container1.id });
        
        // Test 5: Allocate after release
        logger.info('Starting Test 5: Allocate after release');
        const testRunId4 = 'test-run-' + (Date.now() + 3);
        const container4 = await containerPool.allocateContainer(testRunId4);
        
        if (container4) {
          logger.info('Test 5 completed successfully: container re-allocated after release', {
            containerId: container4.id,
            port: container4.port,
            testRunId: testRunId4
          });
          
          // Clean up
          await containerPool.releaseContainer(container4.id);
        } else {
          logger.error('Test 5 failed: could not allocate container after release');
        }
        
        // Clean up second container
        await containerPool.releaseContainer(container2.id);
        logger.info('Second container released successfully', { containerId: container2.id });
        
      } else {
        logger.error('Test 2 failed: could not allocate second container');
      }
    } else {
      logger.error('Test 1 failed: could not allocate first container');
    }

    // Final status check
    const finalStatus = await containerPool.getPoolStatus();
    logger.info('Final pool status', finalStatus);
    
    logger.info('Initiating container pool shutdown');
    await containerPool.shutdown();
    logger.info('Container pool shutdown completed successfully');
    
  } catch (error) {
    logger.error('Improved allocation test failed', { error: error.message, stack: error.stack });
  } finally {
    await redisClient.disconnect();
    logger.info('Redis disconnected successfully');
  }
}

// Run test
testImprovedAllocation().catch((error) => {
  const logger = createLogger({ context: 'ImprovedAllocationTest' });
  logger.error('Improved allocation test execution failed', { error: error.message, stack: error.stack });
});