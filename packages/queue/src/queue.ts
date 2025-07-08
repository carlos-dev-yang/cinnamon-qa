/**
 * BullMQ Queue Management
 */

import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import type { 
  QueueConfig, 
  TestJobData, 
  TestJobResult, 
  JobProgress
} from './types';
import { QueueNames, JobPriority } from './types';
import { getRedisClient } from './redis';

export class QueueManager {
  private queues: Map<string, Queue> = new Map();
  private workers: Map<string, Worker> = new Map();
  private queueEvents: Map<string, QueueEvents> = new Map();
  private config: QueueConfig;

  constructor(config?: QueueConfig) {
    this.config = config || this.getDefaultConfig();
  }

  private getDefaultConfig(): QueueConfig {
    return {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '0', 10),
      },
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    };
  }

  /**
   * Create or get a queue
   */
  getQueue(name: string): Queue {
    if (!this.queues.has(name)) {
      const queue = new Queue(name, {
        connection: this.config.redis,
        defaultJobOptions: this.config.defaultJobOptions,
      });
      this.queues.set(name, queue);
    }
    return this.queues.get(name)!;
  }

  /**
   * Add a test execution job
   */
  async addTestJob(
    data: TestJobData,
    options?: {
      priority?: JobPriority;
      delay?: number;
      attempts?: number;
    }
  ): Promise<Job<TestJobData, TestJobResult>> {
    const queue = this.getQueue(QueueNames.TEST_EXECUTION);
    
    return await queue.add('execute-test', data, {
      priority: options?.priority || JobPriority.NORMAL,
      delay: options?.delay,
      attempts: options?.attempts || 3,
      removeOnComplete: 100,
      removeOnFail: 50,
    });
  }

  /**
   * Create a worker for processing jobs
   */
  createWorker(
    queueName: string,
    processor: (job: Job<TestJobData, TestJobResult>) => Promise<TestJobResult>,
    options?: {
      concurrency?: number;
      maxStalledCount?: number;
      stalledInterval?: number;
    }
  ): Worker<TestJobData, TestJobResult> {
    if (this.workers.has(queueName)) {
      throw new Error(`Worker for queue ${queueName} already exists`);
    }

    const worker = new Worker<TestJobData, TestJobResult>(
      queueName,
      processor,
      {
        connection: this.config.redis,
        concurrency: options?.concurrency || 1,
        maxStalledCount: options?.maxStalledCount || 1,
        stalledInterval: options?.stalledInterval || 30000,
      }
    );

    // Worker event handlers
    worker.on('completed', (job, result) => {
      console.log(`✅ Job ${job.id} completed:`, result);
    });

    worker.on('failed', (job, err) => {
      console.error(`❌ Job ${job?.id} failed:`, err);
    });

    worker.on('progress', (job, progress) => {
      console.log(`📊 Job ${job.id} progress:`, progress);
    });

    worker.on('stalled', (jobId) => {
      console.warn(`⚠️ Job ${jobId} stalled`);
    });

    this.workers.set(queueName, worker);
    return worker;
  }

  /**
   * Create queue events listener for monitoring
   */
  createQueueEvents(queueName: string): QueueEvents {
    if (this.queueEvents.has(queueName)) {
      return this.queueEvents.get(queueName)!;
    }

    const queueEvents = new QueueEvents(queueName, {
      connection: this.config.redis,
    });

    // Queue event handlers
    queueEvents.on('waiting', ({ jobId }) => {
      console.log(`⏳ Job ${jobId} is waiting`);
    });

    queueEvents.on('active', ({ jobId }) => {
      console.log(`🏃 Job ${jobId} is active`);
    });

    queueEvents.on('completed', ({ jobId, returnvalue }) => {
      console.log(`✅ Job ${jobId} completed with result:`, returnvalue);
    });

    queueEvents.on('failed', ({ jobId, failedReason }) => {
      console.error(`❌ Job ${jobId} failed:`, failedReason);
    });

    this.queueEvents.set(queueName, queueEvents);
    return queueEvents;
  }

  /**
   * Update job progress
   */
  async updateJobProgress(job: Job, progress: JobProgress): Promise<void> {
    await job.updateProgress(progress);
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(queueName: string): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: number;
  }> {
    const queue = this.getQueue(queueName);
    
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaiting(),
      queue.getActive(),
      queue.getCompleted(),
      queue.getFailed(),
      queue.getDelayed(),
    ]);

    const isPaused = await queue.isPaused();

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length,
      paused: isPaused ? 1 : 0,
    };
  }

  /**
   * Clean up old jobs
   */
  async cleanQueue(
    queueName: string,
    grace = 24 * 60 * 60 * 1000, // 24 hours
    limit = 100
  ): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.clean(grace, limit, 'completed');
    await queue.clean(grace, limit, 'failed');
  }

  /**
   * Pause a queue
   */
  async pauseQueue(queueName: string): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.pause();
  }

  /**
   * Resume a queue
   */
  async resumeQueue(queueName: string): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.resume();
  }

  /**
   * Close all queues and workers
   */
  async close(): Promise<void> {
    // Close all workers
    for (const worker of this.workers.values()) {
      await worker.close();
    }

    // Close all queue events
    for (const queueEvents of this.queueEvents.values()) {
      await queueEvents.close();
    }

    // Close all queues
    for (const queue of this.queues.values()) {
      await queue.close();
    }

    this.workers.clear();
    this.queueEvents.clear();
    this.queues.clear();
  }
}

// Default queue manager instance
let defaultQueueManager: QueueManager | null = null;

export function getQueueManager(config?: QueueConfig): QueueManager {
  if (!defaultQueueManager) {
    defaultQueueManager = new QueueManager(config);
  }
  return defaultQueueManager;
}