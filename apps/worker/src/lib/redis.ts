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
import { createLogger } from '@cinnamon-qa/logger';

export class WorkerRedisClient {
  private queueManager = getQueueManager();
  private redisClient = getRedisClient();
  private logger = createLogger({ context: 'WorkerRedis' });

  async connect(): Promise<void> {
    this.logger.info('Connecting Worker to Redis');
    await this.redisClient.connect();
    this.logger.info('Worker Redis connection established');
  }

  async disconnect(): Promise<void> {
    this.logger.info('Disconnecting Worker from Redis');
    await this.queueManager.close();
    await this.redisClient.disconnect();
  }

  /**
   * Start processing test execution jobs
   */
  async startTestProcessor(): Promise<void> {
    this.logger.info('Starting test execution processor');
    
    const processor = new TestExecutionProcessor();
    
    const worker = this.queueManager.createWorker(
      QueueNames.TEST_EXECUTION,
      async (job) => {
        this.logger.info('Processing test job', { jobId: job.id, jobData: job.data });
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
    
    this.logger.info('Test execution processor started');
  }

  /**
   * Start processing cleanup jobs
   */
  async startCleanupProcessor(): Promise<void> {
    this.logger.info('Starting cleanup processor');
    
    const processor = JobProcessorFactory.createProcessor('cleanup');
    
    const worker = this.queueManager.createWorker(
      QueueNames.CLEANUP,
      async (job) => {
        this.logger.info('Processing cleanup job', { jobId: job.id });
        return await processor.process(job);
      },
      {
        concurrency: 1,
        maxStalledCount: 1,
        stalledInterval: 60000,
      }
    );

    this.logger.info('Cleanup processor started');
  }

  /**
   * Health check for Redis connection
   */
  async healthCheck(): Promise<boolean> {
    try {
      return await this.redisClient.healthCheck();
    } catch (error) {
      this.logger.error('Worker Redis health check failed', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
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