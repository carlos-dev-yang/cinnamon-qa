import { RedisClient } from '@cinnamon-qa/queue';
import { ContainerPoolManager } from './src/container-pool-manager';

async function testCleanupAndReset() {
  console.log('🧹 Testing Container Cleanup and Reset System...\n');

  // Initialize Redis client
  const redisClient = new RedisClient({
    host: 'localhost',
    port: 6379,
    db: 0,
  });

  try {
    await redisClient.connect();
    console.log('✅ Redis connected');

    // Initialize pool manager with cleanup and reset
    const poolManager = new ContainerPoolManager(redisClient);
    console.log('📦 Initializing container pool with cleanup and reset...');
    
    await poolManager.initialize();
    console.log('✅ Container pool initialized\n');

    // Test 1: Basic allocation with automatic reset on allocation
    console.log('🔄 Test 1: Allocation with automatic reset');
    const container1 = await poolManager.allocateContainer('test-run-1');
    console.log(`✅ Allocated container: ${container1?.containerId}`);
    
    // Simulate some work
    console.log('⏰ Simulating test work for 5 seconds...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Test 2: Release with automatic cleanup
    console.log('\n🧹 Test 2: Release with automatic cleanup');
    if (container1) {
      await poolManager.releaseContainer(container1.containerId);
      console.log(`✅ Released container: ${container1.containerId}`);
    }

    // Test 3: Manual cleanup
    console.log('\n🔧 Test 3: Manual cleanup test');
    const container2 = await poolManager.allocateContainer('test-run-2');
    if (container2) {
      console.log(`Allocated container for manual cleanup test: ${container2.containerId}`);
      
      // Perform manual cleanup
      await poolManager.cleanupContainer(container2.containerId);
      console.log(`Manual cleanup completed for ${container2.containerId}`);
      
      await poolManager.releaseContainer(container2.containerId);
    }

    // Test 4: Manual reset with different strategies
    console.log('\n🔄 Test 4: Manual reset strategies test');
    const container3 = await poolManager.allocateContainer('test-run-3');
    if (container3) {
      console.log(`Allocated container for reset test: ${container3.containerId}`);
      
      // Test manual reset
      await poolManager.resetContainer(container3.containerId);
      console.log(`Manual reset completed for ${container3.containerId}`);
      
      await poolManager.releaseContainer(container3.containerId);
    }

    // Test 5: Configuration and statistics
    console.log('\n📊 Test 5: Cleanup and Reset Configuration');
    const stats = poolManager.getCleanupResetStats();
    console.log('Cleanup Configuration:', JSON.stringify(stats.cleanupConfig, null, 2));
    console.log('Reset Configuration:', JSON.stringify(stats.resetConfig, null, 2));
    console.log('Active Resets:', stats.activeResets);

    // Test 6: Cleanup service configuration
    console.log('\n⚙️ Test 6: Cleanup service configuration test');
    const cleanupService = poolManager.getCleanupService();
    const originalConfig = cleanupService.getConfig();
    console.log('Original cleanup config:', originalConfig);
    
    // Update configuration
    cleanupService.updateConfig({
      timeoutMs: 45000,
      maxRetries: 5,
      validateCleanup: true,
    });
    
    const updatedConfig = cleanupService.getConfig();
    console.log('Updated cleanup config:', updatedConfig);

    // Test 7: Reset manager configuration
    console.log('\n🔄 Test 7: Reset manager configuration test');
    const resetManager = poolManager.getResetManager();
    const originalResetConfig = resetManager.getConfig();
    console.log('Original reset config:', originalResetConfig);
    
    // Update reset configuration
    resetManager.updateConfig({
      enableAutoReset: true,
      resetOnAllocation: false, // Disable auto-reset for next test
      resetOnRelease: true,
      maxResetAttempts: 2,
    });
    
    const updatedResetConfig = resetManager.getConfig();
    console.log('Updated reset config:', updatedResetConfig);

    // Test 8: Test without auto-reset on allocation
    console.log('\n🔄 Test 8: Test without auto-reset on allocation');
    const container4 = await poolManager.allocateContainer('test-run-4');
    if (container4) {
      console.log(`Allocated container without auto-reset: ${container4.containerId}`);
      await poolManager.releaseContainer(container4.containerId);
      console.log(`Released container with auto-reset on release: ${container4.containerId}`);
    }

    // Test 9: Reset statistics
    console.log('\n📈 Test 9: Reset statistics');
    const resetStats = resetManager.getResetStats();
    console.log('Reset Statistics:', JSON.stringify(resetStats, null, 2));

    // Test 10: Error handling and validation
    console.log('\n⚠️ Test 10: Error handling test');
    try {
      await poolManager.cleanupContainer('non-existent-container');
    } catch (error) {
      console.log(`✅ Correctly caught error for non-existent container: ${error.message}`);
    }

    try {
      await poolManager.resetContainer('non-existent-container');
    } catch (error) {
      console.log(`✅ Correctly caught error for non-existent reset: ${error.message}`);
    }

    // Test 11: Concurrent operations
    console.log('\n🔄 Test 11: Concurrent cleanup/reset operations');
    const concurrentPromises = [];
    
    // Allocate both containers
    const concurrentContainer1 = await poolManager.allocateContainer('concurrent-1');
    const concurrentContainer2 = await poolManager.allocateContainer('concurrent-2');
    
    if (concurrentContainer1 && concurrentContainer2) {
      // Try concurrent cleanup and reset
      concurrentPromises.push(
        poolManager.cleanupContainer(concurrentContainer1.containerId)
      );
      concurrentPromises.push(
        poolManager.resetContainer(concurrentContainer2.containerId)
      );
      
      await Promise.allSettled(concurrentPromises);
      console.log('✅ Concurrent operations completed');
      
      // Release containers
      await poolManager.releaseContainer(concurrentContainer1.containerId);
      await poolManager.releaseContainer(concurrentContainer2.containerId);
    }

    console.log('\n🎉 All cleanup and reset tests completed successfully!');

    // Final cleanup
    console.log('\n🧹 Shutting down...');
    await poolManager.shutdown();
    console.log('✅ Pool manager shutdown complete');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await redisClient.disconnect();
    console.log('✅ Redis disconnected');
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gracefully...');
  process.exit(0);
});

// Run the test
testCleanupAndReset().catch(console.error);