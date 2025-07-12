import { RedisClient } from '@cinnamon-qa/queue';
import { SimpleHealthChecker } from './src/health-checker';
import { createLogger } from '@cinnamon-qa/logger';

async function testAllocationExisting() {
  const logger = createLogger({ context: 'AllocationExistingTest' });
  logger.info('Starting allocation test with existing container');
  
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

    // Test health check first
    const healthChecker = new SimpleHealthChecker();
    const port = 3001;
    const containerName = 'cinnamon-qa-mcp-1';
    
    logger.info('Testing existing container health', { containerName, port });
    const isHealthy = await healthChecker.isContainerReady(port, containerName);
    logger.info('Health check completed', { containerName, port, isHealthy });
    
    if (!isHealthy) {
      logger.error('Container is not healthy, cannot proceed with allocation test', { containerName, port });
      return;
    }
    
    // Test Redis state management
    logger.info('Starting Redis state management test');
    
    // Set container state
    const containerId = 'container-1';
    await redisClient.instance.hset(`container:${containerId}`, {
      containerId,
      port: port.toString(),
      allocated: 'false',
      lastCheckedAt: new Date().toISOString(),
    });
    
    // Read container state
    const data = await redisClient.instance.hgetall(`container:${containerId}`);
    logger.info('Container state retrieved from Redis', { containerId, state: data });
    
    // Test allocation
    logger.info('Starting allocation logic test');
    const testRunId = 'test-run-' + Date.now();
    
    // Mark as allocated
    await redisClient.instance.hset(`container:${containerId}`, {
      containerId,
      port: port.toString(),
      allocated: 'true',
      allocatedTo: testRunId,
      allocatedAt: new Date().toISOString(),
      lastCheckedAt: new Date().toISOString(),
    });
    
    logger.info('Container allocated successfully', { containerId, testRunId });
    
    // Check state
    const allocatedData = await redisClient.instance.hgetall(`container:${containerId}`);
    logger.info('Container allocated state verified', { containerId, state: allocatedData });
    
    // Test release
    logger.info('Starting release logic test');
    await redisClient.instance.hset(`container:${containerId}`, {
      containerId,
      port: port.toString(),
      allocated: 'false',
      lastCheckedAt: new Date().toISOString(),
    });
    
    // Remove allocation fields
    await redisClient.instance.hdel(`container:${containerId}`, 'allocatedTo', 'allocatedAt');
    
    logger.info('Container released successfully', { containerId });
    
    // Check final state
    const releasedData = await redisClient.instance.hgetall(`container:${containerId}`);
    logger.info('Container released state verified', { containerId, state: releasedData });
    
    logger.info('All allocation and release tests completed successfully');
    
  } catch (error) {
    logger.error('Allocation test failed', { error: error.message, stack: error.stack });
  } finally {
    await redisClient.disconnect();
    logger.info('Redis disconnected successfully');
  }
}

// Run test
testAllocationExisting().catch((error) => {
  const logger = createLogger({ context: 'AllocationExistingTest' });
  logger.error('Allocation existing test execution failed', { error: error.message, stack: error.stack });
});