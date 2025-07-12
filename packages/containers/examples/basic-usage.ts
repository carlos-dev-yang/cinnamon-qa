import { RedisClient } from '@cinnamon-qa/queue';
import { SimpleContainerPool } from '../src';

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
    console.log('Container pool initialized successfully');

    // Check pool status
    const status = await containerPool.getPoolStatus();
    console.log('Pool status:', status);

    // Allocate a container for test
    const testRunId = 'test-run-' + Date.now();
    const container = await containerPool.allocateContainer(testRunId);
    
    if (container) {
      console.log(`Allocated container: ${container.id} on port ${container.port}`);
      console.log(`SSE URL: ${container.sseUrl}`);

      // Simulate test execution
      console.log('Simulating test execution...');
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Release container
      await containerPool.releaseContainer(container.id);
      console.log('Container released');
    } else {
      console.log('No containers available');
    }

    // Check final pool status
    const finalStatus = await containerPool.getPoolStatus();
    console.log('Final pool status:', finalStatus);
    
  } catch (error) {
    console.error('Error in container pool usage:', error);
  } finally {
    // Cleanup
    await containerPool.shutdown();
    await redisClient.disconnect();
  }
}

// Run example if this file is executed directly
if (require.main === module) {
  basicUsageExample().catch(console.error);
}

export { basicUsageExample };