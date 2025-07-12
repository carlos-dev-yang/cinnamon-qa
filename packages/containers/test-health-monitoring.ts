import { RedisClient } from '@cinnamon-qa/queue';
import { ContainerPoolManager } from './src/container-pool-manager';
import { HealthDashboard } from './src/health-dashboard';

async function testHealthMonitoring() {
  console.log('🏥 Testing Container Health Monitoring System...\n');

  // Initialize Redis client
  const redisClient = new RedisClient({
    host: 'localhost',
    port: 6379,
    db: 0,
  });

  try {
    await redisClient.connect();
    console.log('✅ Redis connected');

    // Initialize pool manager with health monitoring
    const poolManager = new ContainerPoolManager(redisClient);
    console.log('📦 Initializing container pool with health monitoring...');
    
    await poolManager.initialize();
    console.log('✅ Container pool initialized with health monitoring\n');

    // Create health dashboard
    const dashboard = new HealthDashboard(poolManager, (poolManager as any).healthMonitor);

    // Show initial dashboard
    console.log('📊 Initial Dashboard:');
    await dashboard.printDashboard();

    // Test allocation and release
    console.log('\n🔄 Testing allocation and release...');
    const container1 = await poolManager.allocateContainer('test-run-1');
    console.log(`✅ Allocated container: ${container1?.containerId}`);

    // Show dashboard after allocation
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('\n📊 Dashboard after allocation:');
    await dashboard.printDashboard();

    // Release container
    if (container1) {
      await poolManager.releaseContainer(container1.containerId);
      console.log(`✅ Released container: ${container1.containerId}`);
    }

    // Show dashboard after release
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('\n📊 Dashboard after release:');
    await dashboard.printDashboard();

    // Test system status
    console.log('\n🔍 System Status Check:');
    const systemStatus = await dashboard.getSystemStatus();
    console.log(`Overall Status: ${systemStatus.overall}`);
    console.log(`Monitoring: ${systemStatus.monitoring ? 'Active' : 'Inactive'}`);
    console.log(`Containers: ${systemStatus.containersUp}/${systemStatus.containersTotal} up`);
    if (systemStatus.issues.length > 0) {
      console.log('Issues:');
      systemStatus.issues.forEach(issue => console.log(`  - ${issue}`));
    }

    // Run periodic monitoring for a bit
    console.log('\n⏰ Running periodic monitoring for 30 seconds...');
    const periodicInterval = dashboard.startPeriodicDashboard(10000); // Every 10 seconds

    // Wait for 30 seconds
    await new Promise(resolve => setTimeout(resolve, 30000));

    // Stop periodic monitoring
    clearInterval(periodicInterval);
    console.log('✅ Stopped periodic monitoring');

    // Final dashboard
    console.log('\n📊 Final Dashboard:');
    await dashboard.printDashboard();

    // Test JSON output
    console.log('\n📄 JSON Dashboard Data:');
    const jsonData = await dashboard.getDashboardJson();
    console.log(jsonData);

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
testHealthMonitoring().catch(console.error);