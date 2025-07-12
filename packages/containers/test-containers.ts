import { RedisClient } from '@cinnamon-qa/queue';
import { createLogger } from '@cinnamon-qa/logger';
import { SimpleContainerPool } from './src';

const logger = createLogger({ context: 'TestContainers' });

async function testContainers() {
  logger.info('Testing Container Pool');
  
  // Initialize Redis client
  const redisClient = new RedisClient({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    db: 0,
  });
  
  try {
    logger.info('Connecting to Redis');
    await redisClient.connect();
    logger.info('Redis connected');

    // Initialize container pool
    logger.info('Initializing Container Pool');
    const containerPool = new SimpleContainerPool(redisClient);
    
    // Initialize pool with 2 containers
    await containerPool.initialize();
    logger.info('Container pool initialized');

    // Check pool status
    logger.info('Checking pool status');
    const status = await containerPool.getPoolStatus();
    logger.info('Pool status', { status });

    // Test allocation
    logger.info('Testing container allocation');
    const testRunId = 'test-run-' + Date.now();
    const container = await containerPool.allocateContainer(testRunId);
    
    if (container) {
      logger.info('Allocated container', { containerId: container.id, port: container.port, sseUrl: container.sseUrl });

      // Check status after allocation
      const statusAfterAllocation = await containerPool.getPoolStatus();
      logger.info('Status after allocation', { statusAfterAllocation });

      // Test second allocation
      logger.info('Testing second allocation');
      const container2 = await containerPool.allocateContainer('test-run-2');
      if (container2) {
        logger.info('Allocated second container', { containerId: container2.id, port: container2.port });
        
        // Check status with both allocated
        const statusBothAllocated = await containerPool.getPoolStatus();
        logger.info('Status with both allocated', { statusBothAllocated });

        // Release second container
        await containerPool.releaseContainer(container2.id);
        logger.info('Released second container');
      }

      // Release first container
      await containerPool.releaseContainer(container.id);
      logger.info('Released first container');
    } else {
      logger.info('No containers available');
    }

    // Final status check
    const finalStatus = await containerPool.getPoolStatus();
    logger.info('Final pool status', { finalStatus });
    
    logger.info('Shutting down');
    await containerPool.shutdown();
    logger.info('Container pool shutdown complete');
    
  } catch (error) {
    logger.error('Error in container pool test', { error });
  } finally {
    await redisClient.disconnect();
    logger.info('Redis disconnected');
  }
}

// Run test
testContainers().catch(error => logger.error('Test containers failed', { error }));