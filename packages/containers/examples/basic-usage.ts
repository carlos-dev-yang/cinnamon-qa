import { RedisClient } from '@cinnamon-qa/queue';
import { createLogger } from '@cinnamon-qa/logger';
import { SimpleContainerPool } from '../src';

const logger = createLogger({ context: 'BasicUsageExample' });

async function basicUsageExample() {
  // Initialize Redis client
  const redisClient = new RedisClient({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  });
  
  await redisClient.connect();

  // Initialize container pool
  const containerPool = new SimpleContainerPool(redisClient);
  
  try {
    // Initialize pool with 2 containers
    await containerPool.initialize();
    logger.info('Container pool initialized successfully');

    // Check pool status
    const status = await containerPool.getPoolStatus();
    logger.info('Pool status', { status });

    // Allocate a container for test
    const testRunId = 'test-run-' + Date.now();
    const container = await containerPool.allocateContainer(testRunId);
    
    if (container) {
      logger.info('Allocated container', { containerId: container.id, port: container.port, sseUrl: container.sseUrl });

      // Simulate test execution
      logger.info('Simulating test execution');
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Release container
      await containerPool.releaseContainer(container.id);
      logger.info('Container released');
    } else {
      logger.info('No containers available');
    }

    // Check final pool status
    const finalStatus = await containerPool.getPoolStatus();
    logger.info('Final pool status', { finalStatus });
    
  } catch (error) {
    logger.error('Error in container pool usage', { error });
  } finally {
    // Cleanup
    await containerPool.shutdown();
    await redisClient.disconnect();
  }
}

// Run example if this file is executed directly
if (require.main === module) {
  basicUsageExample().catch(error => logger.error('Basic usage example failed', { error }));
}

export { basicUsageExample };