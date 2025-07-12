import { RedisClient } from '@cinnamon-qa/queue';
import { SimpleContainerPool } from './src';

async function testImprovedAllocation() {
  console.log('🚀 Testing Improved Container Allocation...');
  
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

    // Wait for containers to be fully ready
    console.log('⏳ Waiting for containers to be ready...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Test 1: Single allocation
    console.log('🔄 Test 1: Single allocation...');
    const testRunId1 = 'test-run-' + Date.now();
    const container1 = await containerPool.allocateContainer(testRunId1);
    
    if (container1) {
      console.log(`✅ Test 1 Success: Allocated container ${container1.id} on port ${container1.port}`);
      
      // Check pool status after first allocation
      const status1 = await containerPool.getPoolStatus();
      console.log('📊 Status after first allocation:', {
        total: status1.total,
        available: status1.available,
        allocated: status1.allocated
      });
      
      // Test 2: Second allocation
      console.log('🔄 Test 2: Second allocation...');
      const testRunId2 = 'test-run-' + (Date.now() + 1);
      const container2 = await containerPool.allocateContainer(testRunId2);
      
      if (container2) {
        console.log(`✅ Test 2 Success: Allocated container ${container2.id} on port ${container2.port}`);
        
        // Check pool status with both allocated
        const status2 = await containerPool.getPoolStatus();
        console.log('📊 Status with both allocated:', {
          total: status2.total,
          available: status2.available,
          allocated: status2.allocated
        });
        
        // Test 3: Third allocation (should fail or wait)
        console.log('🔄 Test 3: Third allocation (should fail)...');
        const testRunId3 = 'test-run-' + (Date.now() + 2);
        const container3 = await containerPool.allocateContainer(testRunId3);
        
        if (container3) {
          console.log(`⚠️ Test 3 Unexpected: Got container ${container3.id} (pool management issue?)`);
        } else {
          console.log('✅ Test 3 Success: No container available (as expected)');
        }
        
        // Test 4: Release first container
        console.log('🔄 Test 4: Release first container...');
        await containerPool.releaseContainer(container1.id);
        console.log('✅ Released first container');
        
        // Test 5: Allocate after release
        console.log('🔄 Test 5: Allocate after release...');
        const testRunId4 = 'test-run-' + (Date.now() + 3);
        const container4 = await containerPool.allocateContainer(testRunId4);
        
        if (container4) {
          console.log(`✅ Test 5 Success: Re-allocated container ${container4.id} on port ${container4.port}`);
          
          // Clean up
          await containerPool.releaseContainer(container4.id);
        } else {
          console.log('❌ Test 5 Failed: Could not allocate after release');
        }
        
        // Clean up second container
        await containerPool.releaseContainer(container2.id);
        console.log('✅ Released second container');
        
      } else {
        console.log('❌ Test 2 Failed: Could not allocate second container');
      }
    } else {
      console.log('❌ Test 1 Failed: Could not allocate first container');
    }

    // Final status check
    const finalStatus = await containerPool.getPoolStatus();
    console.log('📊 Final pool status:', finalStatus);
    
    console.log('🧹 Shutting down...');
    await containerPool.shutdown();
    console.log('✅ Container pool shutdown complete');
    
  } catch (error) {
    console.error('❌ Error in allocation test:', error);
  } finally {
    await redisClient.disconnect();
    console.log('✅ Redis disconnected');
  }
}

// Run test
testImprovedAllocation().catch(console.error);