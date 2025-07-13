import { RedisClient } from '@cinnamon-qa/queue';
import { ContainerPoolManager } from './src/container-pool-manager';
import { TestPriority, ResourceRequest } from './src/resource-manager';
import { createLogger } from '@cinnamon-qa/logger';

async function testResourceManagement() {
  const logger = createLogger({ context: 'ResourceManagementTest' });
  logger.info('Testing Advanced Resource Management System');

  // Initialize Redis client
  const redisClient = new RedisClient({
    host: 'localhost',
    port: 6379,
    db: 0,
  });

  try {
    await redisClient.connect();
    logger.info('Redis connected successfully');

    // Initialize pool manager with advanced resource management
    const poolManager = new ContainerPoolManager(redisClient);
    logger.info('Initializing container pool with advanced resource management');
    
    await poolManager.initialize();
    logger.info('Container pool initialized successfully');

    // Test 1: Basic advanced allocation
    logger.info('Starting Test 1: Basic advanced allocation with priority');
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
    if (container1) {
      logger.info('High priority allocation successful', {
        id: container1.id,
        name: container1.name,
        port: container1.port
      });
    } else {
      logger.warn('High priority allocation failed - no container available');
    }

    // Test 2: Multiple concurrent requests with different priorities
    logger.info('Starting Test 2: Concurrent requests with different priorities');
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
        logger.info('Concurrent allocation successful', {
          priority: request.priority,
          testRunId: request.testRunId,
          containerId: result.value.id
        });
      } else {
        logger.warn('Concurrent allocation failed', {
          priority: request.priority,
          testRunId: request.testRunId
        });
      }
    });

    // Test 3: Timeout management
    logger.info('Starting Test 3: Timeout management and extension');
    const timeoutManager = poolManager.getTimeoutManager();
    
    const timeoutSessionId = timeoutManager.startSession('test-timeout-demo', 10000); // 10 seconds
    logger.info('Started timeout session', { sessionId: timeoutSessionId });

    // Wait 5 seconds, then request extension
    await new Promise(resolve => setTimeout(resolve, 5000));
    logger.info('Requesting timeout extension after 5 seconds');
    
    const extensionGranted = await poolManager.requestTimeoutExtension('test-timeout-demo', 'Test requires more time');
    logger.info('Timeout extension request processed', { granted: extensionGranted });

    // Complete the session
    await new Promise(resolve => setTimeout(resolve, 2000));
    timeoutManager.completeSession(timeoutSessionId);
    logger.info('Timeout session completed successfully');

    // Test 4: Resource analytics and optimization
    logger.info('Starting Test 4: Resource analytics and optimization');
    const resourceManager = poolManager.getResourceManager();
    const metrics = resourceManager.getMetrics();
    const analytics = resourceManager.getResourceAnalytics();
    const recommendations = await resourceManager.getOptimizationRecommendations();

    logger.info('Resource metrics collected', {
      totalRequests: metrics.totalRequests,
      successfulAllocations: metrics.successfulAllocations,
      failedAllocations: metrics.failedAllocations,
      averageWaitTimeMs: metrics.averageWaitTime
    });

    logger.info('Priority distribution analysis', { priorityDistribution: analytics.priorityDistribution });

    if (recommendations.length > 0) {
      logger.info('Optimization recommendations available');
      recommendations.forEach((rec, index) => {
        logger.info('Optimization recommendation', {
          index: index + 1,
          severity: rec.severity,
          title: rec.title,
          description: rec.description,
          suggestedAction: rec.suggestedAction,
          expectedImpact: rec.expectedImpact
        });
      });
    } else {
      logger.info('No optimization recommendations at this time');
    }

    // Test 5: System analytics
    logger.info('Starting Test 5: Comprehensive system analytics');
    const systemAnalytics = await poolManager.getSystemAnalytics();
    
    logger.info('System overview analytics', {
      totalContainers: systemAnalytics.poolMetrics.totalContainers,
      availableContainers: systemAnalytics.poolMetrics.availableContainers,
      queueSize: systemAnalytics.poolMetrics.queueSize,
      resourceEfficiencyPercent: (systemAnalytics.resourceMetrics.performanceMetrics.resourceEfficiency * 100),
      averageExecutionTimeSeconds: (systemAnalytics.timeoutMetrics.averageExecutionTime / 1000)
    });

    // Test 6: Configuration updates
    logger.info('Starting Test 6: Dynamic configuration updates');
    
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

    logger.info('Configuration updates applied successfully');

    // Test 7: Test execution status tracking
    logger.info('Starting Test 7: Test execution status tracking');
    
    if (container1) {
      const executionStatus = poolManager.getTestExecutionStatus(request1.testRunId);
      logger.info('Test execution status retrieved', {
        containerAllocated: executionStatus.containerAllocated,
        containerId: executionStatus.containerId,
        hasTimeoutSession: !!executionStatus.timeoutSession
      });
    }

    // Test 8: Load testing with multiple rapid requests
    logger.info('Starting Test 8: Load testing with rapid requests');
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
    logger.info('Load test completed', {
      successCount,
      totalRequests: rapidRequests.length,
      durationMs: endTime - startTime
    });

    // Release allocated containers
    logger.info('Starting Test 9: Releasing allocated containers');
    const allocatedContainers = loadTestResults
      .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled' && r.value)
      .map(r => r.value);

    for (const container of allocatedContainers) {
      if (container) {
        await poolManager.releaseContainer(container.id);
        logger.info('Container released successfully', { containerId: container.id });
      }
    }

    // Release the first container if still allocated
    if (container1) {
      await poolManager.releaseContainer(container1.id);
      logger.info('Primary container released successfully', { containerId: container1.id });
    }

    // Final analytics
    logger.info('Collecting final system state analytics');
    const finalAnalytics = await poolManager.getSystemAnalytics();
    const finalRecommendations = finalAnalytics.optimizationRecommendations;
    
    logger.info('Final system metrics', {
      totalRequests: finalAnalytics.resourceMetrics.totalRequests,
      successRatePercent: ((finalAnalytics.resourceMetrics.successfulAllocations / finalAnalytics.resourceMetrics.totalRequests) * 100),
      averageWaitTimeMs: finalAnalytics.resourceMetrics.averageWaitTime,
      timeoutSessions: finalAnalytics.timeoutMetrics.totalSessions
    });

    if (finalRecommendations.length > 0) {
      logger.info('Final optimization recommendations available');
      finalRecommendations.slice(0, 3).forEach((rec, index) => {
        logger.info('Final optimization recommendation', {
          index: index + 1,
          severity: rec.severity,
          title: rec.title
        });
      });
    }

    logger.info('All resource management tests completed successfully');

    // Cleanup
    logger.info('Initiating shutdown process');
    await poolManager.shutdown();
    logger.info('Pool manager shutdown completed successfully');

  } catch (error) {
    logger.error('Resource management test failed', { error: error.message, stack: error.stack });
  } finally {
    await redisClient.disconnect();
    logger.info('Redis disconnected successfully');
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  const logger = createLogger({ context: 'ResourceManagementTest' });
  logger.info('Received SIGINT - shutting down gracefully');
  process.exit(0);
});

// Run the test
testResourceManagement().catch((error) => {
  const logger = createLogger({ context: 'ResourceManagementTest' });
  logger.error('Resource management test execution failed', { error: error.message, stack: error.stack });
});