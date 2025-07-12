import { RedisClient } from '@cinnamon-qa/queue';
import { ContainerPoolManager } from './src/container-pool-manager';

async function testCleanupSimple() {
  console.log('🧹 Simple Cleanup Test...\n');

  // Initialize Redis client
  const redisClient = new RedisClient({
    host: 'localhost',
    port: 6379,
    db: 0,
  });

  try {
    await redisClient.connect();
    console.log('✅ Redis connected');

    // Initialize pool manager
    const poolManager = new ContainerPoolManager(redisClient);
    
    // Disable auto-reset for simpler testing
    const resetManager = poolManager.getResetManager();
    resetManager.updateConfig({
      enableAutoReset: false,
      resetOnAllocation: false,
      resetOnRelease: false,
    });
    
    console.log('📦 Initializing container pool...');
    await poolManager.initialize();
    console.log('✅ Container pool initialized\n');

    // Simple allocation test
    console.log('🔄 Test: Simple allocation');
    const container1 = await poolManager.allocateContainer('test-run-1');
    console.log(`✅ Allocated container:`, container1);
    
    if (container1) {
      // Test manual cleanup
      console.log('\n🧹 Test: Manual cleanup');
      await poolManager.cleanupContainer(container1.containerId);
      console.log('✅ Manual cleanup completed');
      
      // Test manual reset
      console.log('\n🔄 Test: Manual reset');
      await poolManager.resetContainer(container1.containerId);
      console.log('✅ Manual reset completed');
      
      // Release container
      console.log('\n📤 Test: Release container');
      await poolManager.releaseContainer(container1.containerId);
      console.log('✅ Container released');
    }

    // Configuration test
    console.log('\n⚙️ Test: Configuration');
    const stats = poolManager.getCleanupResetStats();
    console.log('✅ Configuration retrieved:', {
      activeResets: stats.activeResets.length,
      resetEnabled: stats.resetConfig.enableAutoReset,
      cleanupTimeout: stats.cleanupConfig.timeoutMs,
    });

    console.log('\n🎉 Simple cleanup tests completed!');

    // Shutdown
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
testCleanupSimple().catch(console.error);