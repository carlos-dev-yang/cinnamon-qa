import * as dotenv from 'dotenv';
import * as path from 'path';
import { createLogger } from '@cinnamon-qa/logger';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

import { 
  connectRedis, 
  getQueueManager, 
  QueueNames, 
  JobPriority,
  type TestJobData 
} from './src';

const logger = createLogger({ context: 'QueueTest' });

async function testQueueSystem() {
  logger.info('Testing Redis and BullMQ queue system');
  
  try {
    // Test Redis connection
    logger.info('Testing Redis connection');
    const redisClient = await connectRedis();
    const isHealthy = await redisClient.healthCheck();
    logger.info('Redis connection status', { healthy: isHealthy });
    
    if (!isHealthy) {
      throw new Error('Redis connection failed');
    }

    // Test queue manager
    logger.info('Testing queue manager');
    const queueManager = getQueueManager();
    
    // Create test job data
    const testJobData: TestJobData = {
      testCaseId: 'test-case-123',
      testRunId: 'test-run-456',
      userId: 'user-789',
      config: {
        timeout: 30000,
        headless: true,
        viewport: { width: 1920, height: 1080 },
        adaptiveMode: true,
        maxAdaptations: 5,
      },
    };

    // Add a test job
    logger.info('Adding test job to queue');
    const job = await queueManager.addTestJob(testJobData, {
      priority: JobPriority.HIGH,
      attempts: 3,
    });
    logger.info('Test job added', { jobId: job.id });

    // Get queue statistics
    logger.info('Getting queue statistics');
    const stats = await queueManager.getQueueStats(QueueNames.TEST_EXECUTION);
    logger.info('Queue statistics', { stats });

    // Clean up the test job
    logger.info('Cleaning up test job');
    await job.remove();
    logger.info('Test job removed', { jobId: job.id });

    // Close connections
    await queueManager.close();
    await redisClient.disconnect();
    
    logger.info('All queue tests passed! Redis and BullMQ are working correctly.');
    
  } catch (error) {
    logger.error('Queue test failed', { error: error instanceof Error ? error.message : String(error) });
    process.exit(1);
  }
}

// Run the test
testQueueSystem();