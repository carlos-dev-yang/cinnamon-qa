/**
 * Redis connection and queue management for Worker
 * 
 * This module uses the shared @cinnamon-qa/queue package
 * and provides worker-specific functionality.
 */

import { 
  getQueueManager, 
  getRedisClient, 
  QueueNames, 
  TestExecutionProcessor,
  JobProcessorFactory,
  type TestJobData, 
  type TestJobResult 
} from '@cinnamon-qa/queue';

export class WorkerRedisClient {
  private queueManager = getQueueManager();
  private redisClient = getRedisClient();

  async connect(): Promise<void> {
    console.log('🔗 Connecting Worker to Redis...');
    await this.redisClient.connect();
    console.log('✅ Worker Redis connection established');
  }

  async disconnect(): Promise<void> {
    console.log('🔌 Disconnecting Worker from Redis...');
    await this.queueManager.close();
    await this.redisClient.disconnect();
  }

  /**
   * Start processing test execution jobs
   */
  async startTestProcessor(): Promise<void> {
    console.log('🚀 Starting test execution processor...');
    
    const processor = new TestExecutionProcessor();
    
    const worker = this.queueManager.createWorker(
      QueueNames.TEST_EXECUTION,
      async (job) => {
        console.log(`📋 Processing test job ${job.id}:`, job.data);
        return await processor.process(job);
      },
      {
        concurrency: 1, // Process one test at a time
        maxStalledCount: 1,
        stalledInterval: 30000,
      }
    );

    // Setup queue events monitoring
    const queueEvents = this.queueManager.createQueueEvents(QueueNames.TEST_EXECUTION);
    
    console.log('✅ Test execution processor started');
  }

  /**
   * Start processing cleanup jobs
   */
  async startCleanupProcessor(): Promise<void> {
    console.log('🧹 Starting cleanup processor...');
    
    const processor = JobProcessorFactory.createProcessor('cleanup');
    
    const worker = this.queueManager.createWorker(
      QueueNames.CLEANUP,
      async (job) => {
        console.log(`🗑️ Processing cleanup job ${job.id}`);
        return await processor.process(job);
      },
      {
        concurrency: 1,
        maxStalledCount: 1,
        stalledInterval: 60000,
      }
    );

    console.log('✅ Cleanup processor started');
  }

  /**
   * Health check for Redis connection
   */
  async healthCheck(): Promise<boolean> {
    try {
      return await this.redisClient.healthCheck();
    } catch (error) {
      console.error('Worker Redis health check failed:', error);
      return false;
    }
  }

  /**
   * Get queue statistics for monitoring
   */
  async getQueueStats() {
    const testStats = await this.queueManager.getQueueStats(QueueNames.TEST_EXECUTION);
    const cleanupStats = await this.queueManager.getQueueStats(QueueNames.CLEANUP);
    
    return {
      testExecution: testStats,
      cleanup: cleanupStats,
    };
  }
}