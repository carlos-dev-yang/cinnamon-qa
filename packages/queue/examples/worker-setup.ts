/**
 * Worker 설정 및 Job 처리 예제
 */

import { 
  getQueueManager, 
  QueueNames,
  TestExecutionProcessor,
  CleanupJobProcessor,
  JobProcessorFactory,
  type TestJobData,
  type TestJobResult 
} from '../src';
import { Job } from 'bullmq';

async function workerSetupExample() {
  console.log('👷 Worker Setup Example');
  
  const queueManager = getQueueManager();

  // 1. 테스트 실행 Worker 설정
  console.log('\n1️⃣ Setting up test execution worker...');
  
  const testWorker = queueManager.createWorker(
    QueueNames.TEST_EXECUTION,
    async (job: Job<TestJobData, TestJobResult>) => {
      console.log(`🏃 Processing test job ${job.id}:`, job.data);
      
      // 커스텀 프로세서 사용
      const processor = new TestExecutionProcessor();
      
      // 진행률 업데이트 예제
      await job.updateProgress({
        testRunId: job.data.testRunId,
        currentStep: 0,
        totalSteps: 5,
        percentage: 0,
        message: 'Starting test execution...',
      });

      // 실제 처리 (여기서는 시뮬레이션)
      const steps = [
        'Initializing browser',
        'Loading test case',
        'Executing test steps', 
        'Capturing results',
        'Cleaning up'
      ];

      for (let i = 0; i < steps.length; i++) {
        console.log(`  📋 Step ${i + 1}: ${steps[i]}`);
        
        await job.updateProgress({
          testRunId: job.data.testRunId,
          currentStep: i + 1,
          totalSteps: steps.length,
          percentage: Math.round(((i + 1) / steps.length) * 100),
          message: steps[i],
          stepData: {
            action: steps[i].toLowerCase().replace(/\s+/g, '_'),
            status: 'running',
          }
        });

        // 각 단계에 시간 소요 시뮬레이션
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // 결과 반환
      return await processor.process(job);
    },
    {
      concurrency: 2,        // 동시에 2개 작업 처리
      maxStalledCount: 1,    // 최대 1회 중단 허용
      stalledInterval: 30000, // 30초마다 중단 체크
    }
  );

  console.log('✅ Test execution worker created');

  // 2. 정리 작업 Worker 설정
  console.log('\n2️⃣ Setting up cleanup worker...');
  
  const cleanupWorker = queueManager.createWorker(
    QueueNames.CLEANUP,
    async (job: Job<TestJobData, TestJobResult>) => {
      console.log(`🧹 Processing cleanup job ${job.id}`);
      
      const processor = new CleanupJobProcessor();
      return await processor.process(job);
    },
    {
      concurrency: 1,         // 정리 작업은 하나씩만
      maxStalledCount: 1,
      stalledInterval: 60000, // 1분마다 체크
    }
  );

  console.log('✅ Cleanup worker created');

  // 3. 적응 학습 Worker 설정
  console.log('\n3️⃣ Setting up adaptation learning worker...');
  
  const learningWorker = queueManager.createWorker(
    QueueNames.ADAPTATION_LEARNING,
    async (job: Job<TestJobData, TestJobResult>) => {
      console.log(`🧠 Processing learning job ${job.id}`);
      
      const processor = JobProcessorFactory.createProcessor('adaptation-learning');
      return await processor.process(job);
    },
    {
      concurrency: 1,
      maxStalledCount: 2,
      stalledInterval: 120000, // 2분마다 체크
    }
  );

  console.log('✅ Adaptation learning worker created');

  // 4. Worker 이벤트 핸들러 설정
  console.log('\n4️⃣ Setting up worker event handlers...');

  // 공통 이벤트 핸들러 함수
  const setupWorkerEvents = (worker: any, workerName: string) => {
    worker.on('ready', () => {
      console.log(`🟢 ${workerName} worker ready`);
    });

    worker.on('error', (error: Error) => {
      console.error(`🔴 ${workerName} worker error:`, error);
    });

    worker.on('completed', (job: Job, result: any) => {
      console.log(`✅ ${workerName} job ${job.id} completed:`, result);
    });

    worker.on('failed', (job: Job | undefined, error: Error) => {
      console.error(`❌ ${workerName} job ${job?.id} failed:`, error);
    });

    worker.on('progress', (job: Job, progress: any) => {
      console.log(`📊 ${workerName} job ${job.id} progress:`, progress);
    });

    worker.on('stalled', (jobId: string) => {
      console.warn(`⚠️ ${workerName} job ${jobId} stalled`);
    });
  };

  // 각 워커에 이벤트 핸들러 적용
  setupWorkerEvents(testWorker, 'TestExecution');
  setupWorkerEvents(cleanupWorker, 'Cleanup');
  setupWorkerEvents(learningWorker, 'Learning');

  console.log('✅ All worker event handlers set up');

  // 5. 헬스체크 설정
  console.log('\n5️⃣ Setting up health monitoring...');

  const healthCheck = async () => {
    try {
      const testStats = await queueManager.getQueueStats(QueueNames.TEST_EXECUTION);
      const cleanupStats = await queueManager.getQueueStats(QueueNames.CLEANUP);
      const learningStats = await queueManager.getQueueStats(QueueNames.ADAPTATION_LEARNING);

      console.log('📊 Health Check - Queue Statistics:');
      console.log('  Test Execution:', testStats);
      console.log('  Cleanup:', cleanupStats);
      console.log('  Learning:', learningStats);

      // Worker 상태 확인
      const workers = [
        { name: 'TestExecution', worker: testWorker },
        { name: 'Cleanup', worker: cleanupWorker },
        { name: 'Learning', worker: learningWorker },
      ];

      for (const { name, worker } of workers) {
        const isRunning = !worker.closing;
        console.log(`  ${name} Worker: ${isRunning ? '🟢 Running' : '🔴 Stopped'}`);
      }

    } catch (error) {
      console.error('❌ Health check failed:', error);
    }
  };

  // 30초마다 헬스체크 실행
  const healthCheckInterval = setInterval(healthCheck, 30000);

  // 6. 우아한 종료 설정
  console.log('\n6️⃣ Setting up graceful shutdown...');

  const gracefulShutdown = async (signal: string) => {
    console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
    
    clearInterval(healthCheckInterval);
    
    console.log('Closing workers...');
    await Promise.all([
      testWorker.close(),
      cleanupWorker.close(), 
      learningWorker.close(),
    ]);
    
    console.log('Closing queue manager...');
    await queueManager.close();
    
    console.log('✅ Graceful shutdown completed');
    process.exit(0);
  };

  // 시그널 핸들러 등록
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  console.log('\n🎉 Worker setup completed! Workers are ready to process jobs.');
  console.log('📋 Available queues:');
  console.log('  - test-execution (concurrency: 2)');
  console.log('  - cleanup (concurrency: 1)');
  console.log('  - adaptation-learning (concurrency: 1)');
  console.log('\n⏳ Waiting for jobs... (Press Ctrl+C to stop)');

  // 초기 헬스체크 실행
  await healthCheck();
}

// 에러 핸들링과 함께 실행
if (require.main === module) {
  workerSetupExample().catch(error => {
    console.error('❌ Worker setup failed:', error);
    process.exit(1);
  });
}