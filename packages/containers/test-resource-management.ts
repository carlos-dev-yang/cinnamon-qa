import { RedisClient } from '@cinnamon-qa/queue';
import { ContainerPoolManager } from './src/container-pool-manager';
import { TestPriority, ResourceRequest } from './src/resource-manager';

async function testResourceManagement() {
  console.log('🔧 Testing Advanced Resource Management System...\n');

  // Initialize Redis client
  const redisClient = new RedisClient({
    host: 'localhost',
    port: 6379,
    db: 0,
  });

  try {
    await redisClient.connect();
    console.log('✅ Redis connected');

    // Initialize pool manager with advanced resource management
    const poolManager = new ContainerPoolManager(redisClient);
    console.log('📦 Initializing container pool with advanced resource management...');
    
    await poolManager.initialize();
    console.log('✅ Container pool initialized\n');

    // Test 1: Basic advanced allocation
    console.log('🔄 Test 1: Basic advanced allocation with priority');
    const request1: ResourceRequest = {
      testRunId: 'test-high-priority-1',
      priority: TestPriority.HIGH,
      requestedAt: new Date(),
      timeoutMs: 60000, // 1 minute
      maxRetries: 3,
      requiredResources: {
        minMemoryMB: 256,
        maxCpuPercent: 50,
      },
    };

    const container1 = await poolManager.allocateContainerAdvanced(request1);
    console.log(`✅ High priority allocation result:`, container1 ? {
      id: container1.id,
      name: container1.name,
      port: container1.port,
    } : 'No container available');

    // Test 2: Multiple concurrent requests with different priorities
    console.log('\n🔄 Test 2: Concurrent requests with different priorities');
    const concurrentRequests = [
      {
        testRunId: 'test-critical-1',
        priority: TestPriority.CRITICAL,
        requestedAt: new Date(),
        timeoutMs: 30000,
        maxRetries: 2,
      },
      {
        testRunId: 'test-normal-1',
        priority: TestPriority.NORMAL,
        requestedAt: new Date(),
        timeoutMs: 90000,
        maxRetries: 3,
      },
      {
        testRunId: 'test-low-1',
        priority: TestPriority.LOW,
        requestedAt: new Date(),
        timeoutMs: 120000,
        maxRetries: 1,
      },
    ];

    const concurrentResults = await Promise.allSettled(
      concurrentRequests.map(req => poolManager.allocateContainerAdvanced(req))
    );

    concurrentResults.forEach((result, index) => {
      const request = concurrentRequests[index];
      if (result.status === 'fulfilled' && result.value) {
        console.log(`✅ ${request.priority} priority (${request.testRunId}): allocated ${result.value.id}`);
      } else {
        console.log(`⚠️ ${request.priority} priority (${request.testRunId}): allocation failed`);
      }
    });

    // Test 3: Timeout management
    console.log('\n⏰ Test 3: Timeout management and extension');
    const timeoutManager = poolManager.getTimeoutManager();
    
    const timeoutSessionId = timeoutManager.startSession('test-timeout-demo', 10000); // 10 seconds
    console.log(`Started timeout session: ${timeoutSessionId}`);

    // Wait 5 seconds, then request extension
    await new Promise(resolve => setTimeout(resolve, 5000));
    console.log('⏱️ Requesting timeout extension after 5 seconds...');
    
    const extensionGranted = await poolManager.requestTimeoutExtension('test-timeout-demo', 'Test requires more time');
    console.log(`Extension ${extensionGranted ? 'granted' : 'denied'}`);

    // Complete the session
    await new Promise(resolve => setTimeout(resolve, 2000));
    timeoutManager.completeSession(timeoutSessionId);
    console.log('✅ Timeout session completed');

    // Test 4: Resource analytics and optimization
    console.log('\n📊 Test 4: Resource analytics and optimization');
    const resourceManager = poolManager.getResourceManager();
    const metrics = resourceManager.getMetrics();
    const analytics = resourceManager.getResourceAnalytics();
    const recommendations = await resourceManager.getOptimizationRecommendations();

    console.log('Resource Metrics:', {
      totalRequests: metrics.totalRequests,
      successfulAllocations: metrics.successfulAllocations,
      failedAllocations: metrics.failedAllocations,
      averageWaitTime: `${metrics.averageWaitTime.toFixed(1)}ms`,
    });

    console.log('\nPriority Distribution:', analytics.priorityDistribution);

    if (recommendations.length > 0) {
      console.log('\nOptimization Recommendations:');
      recommendations.forEach((rec, index) => {
        console.log(`  ${index + 1}. [${rec.severity.toUpperCase()}] ${rec.title}`);
        console.log(`     ${rec.description}`);
        console.log(`     Action: ${rec.suggestedAction}`);
        console.log(`     Impact: ${rec.expectedImpact}`);
      });
    } else {
      console.log('\n✅ No optimization recommendations at this time');
    }

    // Test 5: System analytics
    console.log('\n📈 Test 5: Comprehensive system analytics');
    const systemAnalytics = await poolManager.getSystemAnalytics();
    
    console.log('System Overview:', {
      totalContainers: systemAnalytics.poolMetrics.totalContainers,
      availableContainers: systemAnalytics.poolMetrics.availableContainers,
      queueSize: systemAnalytics.poolMetrics.queueSize,
      resourceEfficiency: `${(systemAnalytics.resourceMetrics.performanceMetrics.resourceEfficiency * 100).toFixed(1)}%`,
      averageExecutionTime: `${(systemAnalytics.timeoutMetrics.averageExecutionTime / 1000).toFixed(1)}s`,
    });

    // Test 6: Configuration updates
    console.log('\n⚙️ Test 6: Dynamic configuration updates');
    
    // Update resource management configuration
    poolManager.updateResourceConfig({
      enablePriorityQueue: true,
      enableGracefulDegradation: true,
      maxWaitTimeMs: 300000, // 5 minutes
    });

    // Update timeout configuration
    poolManager.updateTimeoutConfig({
      defaultTimeoutMs: 120000, // 2 minutes
      enableAdaptiveTimeout: true,
      maxExtensions: 3,
    });

    console.log('✅ Configuration updates applied');

    // Test 7: Test execution status tracking
    console.log('\n🔍 Test 7: Test execution status tracking');
    
    if (container1) {
      const executionStatus = poolManager.getTestExecutionStatus(request1.testRunId);
      console.log('Execution Status:', {
        containerAllocated: executionStatus.containerAllocated,
        containerId: executionStatus.containerId,
        hasTimeoutSession: !!executionStatus.timeoutSession,
      });
    }

    // Test 8: Load testing with multiple rapid requests
    console.log('\n⚡ Test 8: Load testing with rapid requests');
    const rapidRequests = Array.from({ length: 5 }, (_, i) => ({
      testRunId: `load-test-${i + 1}`,
      priority: i % 2 === 0 ? TestPriority.HIGH : TestPriority.NORMAL,
      requestedAt: new Date(),
      timeoutMs: 30000,
      maxRetries: 2,
    }));

    const startTime = Date.now();
    const loadTestResults = await Promise.allSettled(
      rapidRequests.map(req => poolManager.allocateContainerAdvanced(req))
    );
    const endTime = Date.now();

    const successCount = loadTestResults.filter(r => r.status === 'fulfilled' && r.value).length;
    console.log(`Load test completed: ${successCount}/${rapidRequests.length} successful in ${endTime - startTime}ms`);

    // Release allocated containers
    console.log('\n🔄 Test 9: Releasing allocated containers');
    const allocatedContainers = loadTestResults
      .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled' && r.value)
      .map(r => r.value);

    for (const container of allocatedContainers) {
      if (container) {
        await poolManager.releaseContainer(container.id);
        console.log(`✅ Released container: ${container.id}`);
      }
    }

    // Release the first container if still allocated
    if (container1) {
      await poolManager.releaseContainer(container1.id);
      console.log(`✅ Released container: ${container1.id}`);
    }

    // Final analytics
    console.log('\n📊 Final System State:');
    const finalAnalytics = await poolManager.getSystemAnalytics();
    const finalRecommendations = finalAnalytics.optimizationRecommendations;
    
    console.log('Final Metrics:', {
      totalRequests: finalAnalytics.resourceMetrics.totalRequests,
      successRate: `${((finalAnalytics.resourceMetrics.successfulAllocations / finalAnalytics.resourceMetrics.totalRequests) * 100).toFixed(1)}%`,
      averageWaitTime: `${finalAnalytics.resourceMetrics.averageWaitTime.toFixed(1)}ms`,
      timeoutSessions: finalAnalytics.timeoutMetrics.totalSessions,
    });

    if (finalRecommendations.length > 0) {
      console.log('\nFinal Optimization Recommendations:');
      finalRecommendations.slice(0, 3).forEach((rec, index) => {
        console.log(`  ${index + 1}. [${rec.severity}] ${rec.title}`);
      });
    }

    console.log('\n🎉 All resource management tests completed successfully!');

    // Cleanup
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
testResourceManagement().catch(console.error);