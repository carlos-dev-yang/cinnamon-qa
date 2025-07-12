import { RedisClient } from '@cinnamon-qa/queue';
import { SimpleContainerPool } from './src';

async function testContainers() {
  console.log('🚀 Testing Container Pool...');
  
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

    // Initialize container pool
    console.log('🐳 Initializing Container Pool...');
    const containerPool = new SimpleContainerPool(redisClient);
    
    // Initialize pool with 2 containers
    await containerPool.initialize();
    console.log('✅ Container pool initialized');

    // Check pool status
    console.log('📊 Checking pool status...');
    const status = await containerPool.getPoolStatus();
    console.log('Pool status:', JSON.stringify(status, null, 2));

    // Test allocation
    console.log('🔄 Testing container allocation...');
    const testRunId = 'test-run-' + Date.now();
    const container = await containerPool.allocateContainer(testRunId);
    
    if (container) {
      console.log(`✅ Allocated container: ${container.id} on port ${container.port}`);
      console.log(`🌐 SSE URL: ${container.sseUrl}`);

      // Check status after allocation
      const statusAfterAllocation = await containerPool.getPoolStatus();
      console.log('Status after allocation:', JSON.stringify(statusAfterAllocation, null, 2));

      // Test second allocation
      console.log('🔄 Testing second allocation...');
      const container2 = await containerPool.allocateContainer('test-run-2');
      if (container2) {
        console.log(`✅ Allocated second container: ${container2.id} on port ${container2.port}`);
        
        // Check status with both allocated
        const statusBothAllocated = await containerPool.getPoolStatus();
        console.log('Status with both allocated:', JSON.stringify(statusBothAllocated, null, 2));

        // Release second container
        await containerPool.releaseContainer(container2.id);
        console.log('✅ Released second container');
      }

      // Release first container
      await containerPool.releaseContainer(container.id);
      console.log('✅ Released first container');
    } else {
      console.log('❌ No containers available');
    }

    // Final status check
    const finalStatus = await containerPool.getPoolStatus();
    console.log('📊 Final pool status:', JSON.stringify(finalStatus, null, 2));
    
    console.log('🧹 Shutting down...');
    await containerPool.shutdown();
    console.log('✅ Container pool shutdown complete');
    
  } catch (error) {
    console.error('❌ Error in container pool test:', error);
  } finally {
    await redisClient.disconnect();
    console.log('✅ Redis disconnected');
  }
}

// Run test
testContainers().catch(console.error);