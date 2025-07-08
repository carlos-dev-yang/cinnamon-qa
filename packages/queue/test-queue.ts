import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

import { 
  connectRedis, 
  getQueueManager, 
  QueueNames, 
  JobPriority,
  type TestJobData 
} from './src';

async function testQueueSystem() {
  console.log('🔍 Testing Redis and BullMQ queue system...');
  
  try {
    // Test Redis connection
    console.log('\n📡 Testing Redis connection...');
    const redisClient = await connectRedis();
    const isHealthy = await redisClient.healthCheck();
    console.log('✅ Redis connection:', isHealthy ? 'Healthy' : 'Failed');
    
    if (!isHealthy) {
      throw new Error('Redis connection failed');
    }

    // Test queue manager
    console.log('\n🎯 Testing queue manager...');
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
    console.log('\n📋 Adding test job to queue...');
    const job = await queueManager.addTestJob(testJobData, {
      priority: JobPriority.HIGH,
      attempts: 3,
    });
    console.log(`✅ Test job added with ID: ${job.id}`);

    // Get queue statistics
    console.log('\n📊 Getting queue statistics...');
    const stats = await queueManager.getQueueStats(QueueNames.TEST_EXECUTION);
    console.log('✅ Queue stats:', stats);

    // Clean up the test job
    console.log('\n🧹 Cleaning up...');
    await job.remove();
    console.log('✅ Test job removed');

    // Close connections
    await queueManager.close();
    await redisClient.disconnect();
    
    console.log('\n🎉 All queue tests passed! Redis and BullMQ are working correctly.');
    
  } catch (error) {
    console.error('❌ Queue test failed:', error);
    process.exit(1);
  }
}

// Run the test
testQueueSystem();