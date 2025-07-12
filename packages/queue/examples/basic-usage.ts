/**
 * 기본 큐 시스템 사용 예제
 */

import { 
  connectRedis, 
  getQueueManager, 
  QueueNames, 
  JobPriority,
  type TestJobData 
} from '../src';
import { createLogger } from '@cinnamon-qa/logger';

const logger = createLogger({ context: 'BasicUsage' });

async function basicUsageExample() {
  logger.info('Basic Queue Usage Example');
  
  // 1. Redis 연결
  logger.info('Connecting to Redis');
  const redisClient = await connectRedis();
  logger.info('Redis connected');

  // 2. 큐 매니저 가져오기
  logger.info('Getting queue manager');
  const queueManager = getQueueManager();
  logger.info('Queue manager ready');

  // 3. 테스트 작업 추가
  logger.info('Adding test jobs');
  
  const testJobs: TestJobData[] = [
    {
      testCaseId: 'login-test',
      testRunId: 'run-001',
      userId: 'user-123',
      config: {
        timeout: 30000,
        headless: true,
        viewport: { width: 1920, height: 1080 },
        adaptiveMode: true,
        maxAdaptations: 3,
      }
    },
    {
      testCaseId: 'checkout-test', 
      testRunId: 'run-002',
      userId: 'user-123',
      config: {
        timeout: 60000,
        headless: false,
        viewport: { width: 1280, height: 720 },
        adaptiveMode: true,
        maxAdaptations: 5,
      }
    }
  ];

  const jobs = [];
  for (const jobData of testJobs) {
    const job = await queueManager.addTestJob(jobData, {
      priority: JobPriority.NORMAL,
      attempts: 3,
    });
    jobs.push(job);
    logger.info('Added test job', { jobId: job.id, testCaseId: jobData.testCaseId });
  }

  // 4. 큐 통계 확인
  logger.info('Checking queue statistics');
  const stats = await queueManager.getQueueStats(QueueNames.TEST_EXECUTION);
  logger.info('Queue statistics', {
    waiting: stats.waiting,
    active: stats.active,
    completed: stats.completed,
    failed: stats.failed,
  });

  // 5. 작업 상태 모니터링
  logger.info('Setting up job monitoring');
  const queueEvents = queueManager.createQueueEvents(QueueNames.TEST_EXECUTION);
  
  queueEvents.on('waiting', ({ jobId }) => {
    logger.info('Job waiting in queue', { jobId });
  });

  queueEvents.on('active', ({ jobId }) => {
    logger.info('Job started processing', { jobId });
  });

  queueEvents.on('progress', ({ jobId, data }) => {
    logger.info('Job progress', { jobId, data });
  });

  queueEvents.on('completed', ({ jobId, returnvalue }) => {
    logger.info('Job completed', { jobId, returnvalue });
  });

  queueEvents.on('failed', ({ jobId, failedReason }) => {
    logger.error('Job failed', { jobId, failedReason });
  });

  // 6. 정리 (실제 사용에서는 이 부분을 제거하고 계속 실행)
  logger.info('Cleaning up for demo');
  
  // 잠깐 대기 (실제 처리를 보기 위해)
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // 추가된 작업들 제거
  for (const job of jobs) {
    await job.remove();
    logger.info('Removed job', { jobId: job.id });
  }

  // 연결 종료
  await queueManager.close();
  await redisClient.disconnect();
  
  logger.info('Basic usage example completed!');
}

// 에러 핸들링과 함께 실행
if (require.main === module) {
  basicUsageExample().catch(error => {
    logger.error('Example failed', { error: error instanceof Error ? error.message : String(error) });
    process.exit(1);
  });
}