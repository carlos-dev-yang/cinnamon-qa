import { RedisClient } from '@cinnamon-qa/queue';
import { ContainerPoolManager } from './src';

async function testPoolManager() {
  console.log('🚀 Testing Advanced Container Pool Manager...');
  
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
    console.log('🐳 Initializing Container Pool Manager...');
    const poolManager = new ContainerPoolManager(redisClient);
    
    // This might fail due to container startup issues, but let's see metrics
    try {
      await poolManager.initialize();
      console.log('✅ Container pool manager initialized');
    } catch (error) {
      console.log('⚠️ Pool initialization had issues:', error.message);
    }

    // Check initial status
    console.log('📊 Initial pool status...');
    const initialStatus = await poolManager.getPoolStatus();
    console.log('Metrics:', initialStatus.metrics);
    console.log('Containers:', initialStatus.containers.length);
    console.log('Queue size:', initialStatus.queue.size);

    // Test allocation without waiting (should fail if no containers)
    console.log('🔄 Test 1: Immediate allocation (no wait)...');
    const testRunId1 = 'test-run-immediate-' + Date.now();
    const container1 = await poolManager.allocateContainer(testRunId1, false);
    
    if (container1) {
      console.log(`✅ Immediate allocation success: ${container1.id}`);
      
      // Test second immediate allocation
      console.log('🔄 Test 2: Second immediate allocation...');
      const testRunId2 = 'test-run-immediate2-' + Date.now();
      const container2 = await poolManager.allocateContainer(testRunId2, false);
      
      if (container2) {
        console.log(`✅ Second allocation success: ${container2.id}`);
        
        // Test third allocation (should fail)
        console.log('🔄 Test 3: Third immediate allocation (should fail)...');
        const testRunId3 = 'test-run-immediate3-' + Date.now();
        const container3 = await poolManager.allocateContainer(testRunId3, false);
        
        if (container3) {
          console.log(`⚠️ Unexpected: Third allocation succeeded: ${container3.id}`);
        } else {
          console.log('✅ Third allocation correctly failed (pool full)');
        }
        
        // Test release
        console.log('🔄 Test 4: Release first container...');
        await poolManager.releaseContainer(container1.id);
        console.log('✅ First container released');
        
        // Test allocation after release
        console.log('🔄 Test 5: Allocation after release...');
        const testRunId4 = 'test-run-after-release-' + Date.now();
        const container4 = await poolManager.allocateContainer(testRunId4, false);
        
        if (container4) {
          console.log(`✅ Allocation after release success: ${container4.id}`);
          await poolManager.releaseContainer(container4.id);
        } else {
          console.log('❌ Allocation after release failed');
        }
        
        // Clean up
        await poolManager.releaseContainer(container2.id);
        console.log('✅ Second container released');
        
      } else {
        console.log('❌ Second allocation failed');
      }
    } else {
      console.log('ℹ️ No containers available for immediate allocation');
    }

    // Test queue functionality (simulate with fake containers in Redis)
    console.log('🔄 Test 6: Queue functionality simulation...');
    
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
    console.log('🔄 Test 7: Queue allocation with timeout...');
    const testRunIdQueue = 'test-run-queue-' + Date.now();
    
    const startTime = Date.now();
    const queuedContainer = await poolManager.allocateContainer(testRunIdQueue, true, 5000); // 5 second timeout
    const endTime = Date.now();
    
    if (queuedContainer) {
      console.log(`⚠️ Unexpected: Queued allocation succeeded: ${queuedContainer.id}`);
    } else {
      console.log(`✅ Queued allocation correctly timed out after ${endTime - startTime}ms`);
    }

    // Final status
    console.log('📊 Final pool status...');
    const finalStatus = await poolManager.getPoolStatus();
    console.log('Final metrics:', finalStatus.metrics);
    console.log('Queue status:', finalStatus.queue);
    
    console.log('🧹 Shutting down...');
    await poolManager.shutdown();
    console.log('✅ Container pool manager shutdown complete');
    
  } catch (error) {
    console.error('❌ Error in pool manager test:', error);
  } finally {
    await redisClient.disconnect();
    console.log('✅ Redis disconnected');
  }
}

// Run test
testPoolManager().catch(console.error);