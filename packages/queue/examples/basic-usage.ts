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

async function basicUsageExample() {
  console.log('🚀 Basic Queue Usage Example');
  
  // 1. Redis 연결
  console.log('\n1️⃣ Connecting to Redis...');
  const redisClient = await connectRedis();
  console.log('✅ Redis connected');

  // 2. 큐 매니저 가져오기
  console.log('\n2️⃣ Getting queue manager...');
  const queueManager = getQueueManager();
  console.log('✅ Queue manager ready');

  // 3. 테스트 작업 추가
  console.log('\n3️⃣ Adding test jobs...');
  
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
    console.log(`✅ Added job ${job.id} for test case: ${jobData.testCaseId}`);
  }

  // 4. 큐 통계 확인
  console.log('\n4️⃣ Checking queue statistics...');
  const stats = await queueManager.getQueueStats(QueueNames.TEST_EXECUTION);
  console.log('📊 Queue stats:', {
    waiting: stats.waiting,
    active: stats.active,
    completed: stats.completed,
    failed: stats.failed,
  });

  // 5. 작업 상태 모니터링
  console.log('\n5️⃣ Setting up job monitoring...');
  const queueEvents = queueManager.createQueueEvents(QueueNames.TEST_EXECUTION);
  
  queueEvents.on('waiting', ({ jobId }) => {
    console.log(`⏳ Job ${jobId} is waiting in queue`);
  });

  queueEvents.on('active', ({ jobId }) => {
    console.log(`🏃 Job ${jobId} started processing`);
  });

  queueEvents.on('progress', ({ jobId, data }) => {
    console.log(`📊 Job ${jobId} progress:`, data);
  });

  queueEvents.on('completed', ({ jobId, returnvalue }) => {
    console.log(`✅ Job ${jobId} completed:`, returnvalue);
  });

  queueEvents.on('failed', ({ jobId, failedReason }) => {
    console.error(`❌ Job ${jobId} failed:`, failedReason);
  });

  // 6. 정리 (실제 사용에서는 이 부분을 제거하고 계속 실행)
  console.log('\n6️⃣ Cleaning up for demo...');
  
  // 잠깐 대기 (실제 처리를 보기 위해)
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // 추가된 작업들 제거
  for (const job of jobs) {
    await job.remove();
    console.log(`🗑️ Removed job ${job.id}`);
  }

  // 연결 종료
  await queueManager.close();
  await redisClient.disconnect();
  
  console.log('\n🎉 Basic usage example completed!');
}

// 에러 핸들링과 함께 실행
if (require.main === module) {
  basicUsageExample().catch(error => {
    console.error('❌ Example failed:', error);
    process.exit(1);
  });
}