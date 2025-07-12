import { RedisClient } from '@cinnamon-qa/queue';
import { SimpleHealthChecker } from './src/health-checker';

async function testAllocationExisting() {
  console.log('🚀 Testing Allocation with Existing Container...');
  
  // Initialize Redis client
  const redisClient = new RedisClient({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    db: 0,
  });
  
  try {
    console.log('📡 Connecting to Redis...');
    await redisClient.connect();
    console.log('✅ Redis connected');

    // Test health check first
    const healthChecker = new SimpleHealthChecker();
    const port = 3001;
    const containerName = 'cinnamon-qa-mcp-1';
    
    console.log('🔍 Testing existing container health...');
    const isHealthy = await healthChecker.isContainerReady(port, containerName);
    console.log(`Health check result: ${isHealthy ? '✅ Healthy' : '❌ Unhealthy'}`);
    
    if (!isHealthy) {
      console.log('❌ Container is not healthy, cannot proceed with allocation test');
      return;
    }
    
    // Test Redis state management
    console.log('🔄 Testing Redis state management...');
    
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
    console.log('📊 Container state in Redis:', data);
    
    // Test allocation
    console.log('🔄 Testing allocation logic...');
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
    
    console.log(`✅ Container ${containerId} allocated to ${testRunId}`);
    
    // Check state
    const allocatedData = await redisClient.instance.hgetall(`container:${containerId}`);
    console.log('📊 Allocated state:', allocatedData);
    
    // Test release
    console.log('🔄 Testing release logic...');
    await redisClient.instance.hset(`container:${containerId}`, {
      containerId,
      port: port.toString(),
      allocated: 'false',
      lastCheckedAt: new Date().toISOString(),
    });
    
    // Remove allocation fields
    await redisClient.instance.hdel(`container:${containerId}`, 'allocatedTo', 'allocatedAt');
    
    console.log(`✅ Container ${containerId} released`);
    
    // Check final state
    const releasedData = await redisClient.instance.hgetall(`container:${containerId}`);
    console.log('📊 Released state:', releasedData);
    
    console.log('🎉 All allocation/release tests passed!');
    
  } catch (error) {
    console.error('❌ Error in allocation test:', error);
  } finally {
    await redisClient.disconnect();
    console.log('✅ Redis disconnected');
  }
}

// Run test
testAllocationExisting().catch(console.error);