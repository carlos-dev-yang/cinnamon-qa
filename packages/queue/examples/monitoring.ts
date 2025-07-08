/**
 * 큐 시스템 모니터링 예제
 */

import { 
  connectRedis,
  getQueueManager, 
  QueueNames,
  JobPriority,
  type TestJobData 
} from '../src';

async function monitoringExample() {
  console.log('📊 Queue Monitoring Example');
  
  const redisClient = await connectRedis();
  const queueManager = getQueueManager();

  // 1. 큐 이벤트 모니터링 설정
  console.log('\n1️⃣ Setting up queue event monitoring...');

  const queueNames = [
    QueueNames.TEST_EXECUTION,
    QueueNames.CLEANUP,
    QueueNames.ADAPTATION_LEARNING
  ];

  const queueEventListeners: any[] = [];

  for (const queueName of queueNames) {
    const queueEvents = queueManager.createQueueEvents(queueName);
    queueEventListeners.push(queueEvents);

    console.log(`📡 Monitoring queue: ${queueName}`);

    // 작업 상태 변화 이벤트
    queueEvents.on('waiting', ({ jobId }) => {
      console.log(`[${queueName}] ⏳ Job ${jobId} waiting`);
    });

    queueEvents.on('active', ({ jobId }) => {
      console.log(`[${queueName}] 🏃 Job ${jobId} active`);
    });

    queueEvents.on('completed', ({ jobId, returnvalue }) => {
      console.log(`[${queueName}] ✅ Job ${jobId} completed`);
      if (returnvalue) {
        console.log(`    Result:`, JSON.stringify(returnvalue, null, 2));
      }
    });

    queueEvents.on('failed', ({ jobId, failedReason }) => {
      console.error(`[${queueName}] ❌ Job ${jobId} failed: ${failedReason}`);
    });

    queueEvents.on('progress', ({ jobId, data }) => {
      console.log(`[${queueName}] 📊 Job ${jobId} progress: ${JSON.stringify(data)}`);
    });

    queueEvents.on('stalled', ({ jobId }) => {
      console.warn(`[${queueName}] ⚠️ Job ${jobId} stalled`);
    });

    queueEvents.on('removed', ({ jobId }) => {
      console.log(`[${queueName}] 🗑️ Job ${jobId} removed`);
    });
  }

  console.log('✅ Queue event monitoring set up');

  // 2. 실시간 통계 모니터링
  console.log('\n2️⃣ Setting up real-time statistics monitoring...');

  const statsMonitor = async () => {
    console.log('\n📊 === Queue Statistics ===');
    console.log(`Timestamp: ${new Date().toISOString()}`);
    
    for (const queueName of queueNames) {
      try {
        const stats = await queueManager.getQueueStats(queueName);
        
        console.log(`\n🎯 ${queueName}:`);
        console.log(`  Waiting: ${stats.waiting}`);
        console.log(`  Active: ${stats.active}`);
        console.log(`  Completed: ${stats.completed}`);
        console.log(`  Failed: ${stats.failed}`);
        console.log(`  Delayed: ${stats.delayed}`);
        console.log(`  Paused: ${stats.paused ? 'Yes' : 'No'}`);
        
        // 전체 처리량 계산
        const total = stats.waiting + stats.active + stats.completed + stats.failed;
        if (total > 0) {
          const successRate = ((stats.completed / total) * 100).toFixed(1);
          console.log(`  Success Rate: ${successRate}%`);
        }
        
      } catch (error) {
        console.error(`❌ Failed to get stats for ${queueName}:`, error);
      }
    }
    
    console.log('=====================================');
  };

  // 10초마다 통계 출력
  const statsInterval = setInterval(statsMonitor, 10000);

  // 3. Redis 메모리 사용량 모니터링
  console.log('\n3️⃣ Setting up Redis memory monitoring...');

  const memoryMonitor = async () => {
    try {
      const info = await redisClient.info();
      const memorySection = info.split('\r\n').filter(line => 
        line.startsWith('used_memory_human:') || 
        line.startsWith('used_memory_peak_human:') ||
        line.startsWith('connected_clients:')
      );
      
      if (memorySection.length > 0) {
        console.log('\n💾 Redis Memory Info:');
        memorySection.forEach(line => {
          const [key, value] = line.split(':');
          console.log(`  ${key.replace(/_/g, ' ')}: ${value}`);
        });
      }
    } catch (error) {
      console.error('❌ Failed to get Redis memory info:', error);
    }
  };

  // 60초마다 메모리 정보 출력
  const memoryInterval = setInterval(memoryMonitor, 60000);

  // 4. 큐 건강 상태 체크
  console.log('\n4️⃣ Setting up queue health checks...');

  const healthCheck = async () => {
    console.log('\n🏥 === Health Check ===');
    
    // Redis 연결 상태
    const redisHealthy = await redisClient.healthCheck();
    console.log(`Redis Connection: ${redisHealthy ? '✅ Healthy' : '❌ Unhealthy'}`);
    
    // 각 큐의 건강 상태
    for (const queueName of queueNames) {
      try {
        const queue = queueManager.getQueue(queueName);
        const isPaused = await queue.isPaused();
        const waiting = await queue.getWaiting();
        const active = await queue.getActive();
        
        console.log(`\n${queueName}:`);
        console.log(`  Status: ${isPaused ? '⏸️ Paused' : '▶️ Active'}`);
        console.log(`  Processing: ${active.length} jobs`);
        console.log(`  Queue Length: ${waiting.length} jobs`);
        
        // 대기 시간이 너무 긴 작업 경고
        if (waiting.length > 0) {
          const oldestJob = waiting[0];
          const waitTime = Date.now() - oldestJob.timestamp;
          if (waitTime > 300000) { // 5분 이상 대기
            console.warn(`  ⚠️ Oldest job waiting for ${Math.round(waitTime / 1000)}s`);
          }
        }
        
        // 너무 오래 실행되는 작업 경고
        if (active.length > 0) {
          for (const job of active) {
            const runTime = Date.now() - job.processedOn!;
            if (runTime > 600000) { // 10분 이상 실행
              console.warn(`  ⚠️ Job ${job.id} running for ${Math.round(runTime / 1000)}s`);
            }
          }
        }
        
      } catch (error) {
        console.error(`❌ Health check failed for ${queueName}:`, error);
      }
    }
    
    console.log('===========================');
  };

  // 30초마다 건강 상태 체크
  const healthInterval = setInterval(healthCheck, 30000);

  // 5. 데모용 작업 추가 (모니터링 테스트용)
  console.log('\n5️⃣ Adding demo jobs for monitoring...');

  const addDemoJobs = async () => {
    const demoJobs: TestJobData[] = [
      {
        testCaseId: 'demo-login',
        testRunId: `demo-run-${Date.now()}`,
        config: { timeout: 30000, headless: true }
      },
      {
        testCaseId: 'demo-search',
        testRunId: `demo-run-${Date.now() + 1}`,
        config: { timeout: 45000, headless: true }
      }
    ];

    for (const jobData of demoJobs) {
      await queueManager.addTestJob(jobData, {
        priority: JobPriority.NORMAL,
        attempts: 2,
      });
      console.log(`📋 Added demo job: ${jobData.testCaseId}`);
    }
  };

  // 2분마다 데모 작업 추가
  const demoJobInterval = setInterval(addDemoJobs, 120000);

  // 초기 데모 작업 추가
  await addDemoJobs();

  // 6. 우아한 종료 설정
  console.log('\n6️⃣ Setting up graceful shutdown...');

  const gracefulShutdown = async (signal: string) => {
    console.log(`\n🛑 Received ${signal}, shutting down monitoring...`);
    
    // 모든 인터벌 클리어
    clearInterval(statsInterval);
    clearInterval(memoryInterval);
    clearInterval(healthInterval);
    clearInterval(demoJobInterval);
    
    // 큐 이벤트 리스너 정리
    for (const queueEvents of queueEventListeners) {
      await queueEvents.close();
    }
    
    // 연결 종료
    await queueManager.close();
    await redisClient.disconnect();
    
    console.log('✅ Monitoring shutdown completed');
    process.exit(0);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  console.log('\n🎉 Monitoring setup completed!');
  console.log('📊 Real-time monitoring active:');
  console.log('  - Queue statistics every 10 seconds');
  console.log('  - Health checks every 30 seconds');
  console.log('  - Memory monitoring every 60 seconds');
  console.log('  - Demo jobs every 2 minutes');
  console.log('\n⏳ Press Ctrl+C to stop monitoring...');

  // 초기 통계 및 건강 상태 확인
  await statsMonitor();
  await healthCheck();
  await memoryMonitor();
}

// 에러 핸들링과 함께 실행
if (require.main === module) {
  monitoringExample().catch(error => {
    console.error('❌ Monitoring example failed:', error);
    process.exit(1);
  });
}