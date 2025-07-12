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
import { createLogger } from '@cinnamon-qa/logger';

const logger = createLogger({ context: 'WorkerSetup' });

async function workerSetupExample() {
  logger.info('Worker Setup Example');
  
  const queueManager = getQueueManager();

  // 1. 테스트 실행 Worker 설정
  logger.info('Setting up test execution worker');
  
  const testWorker = queueManager.createWorker(
    QueueNames.TEST_EXECUTION,
    async (job: Job<TestJobData, TestJobResult>) => {
      logger.info('Processing test job', { jobId: job.id, jobData: job.data });
      
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
        logger.info('Executing step', { stepNumber: i + 1, stepName: steps[i] });
        
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

  logger.info('Test execution worker created');

  // 2. 정리 작업 Worker 설정
  logger.info('Setting up cleanup worker');
  
  const cleanupWorker = queueManager.createWorker(
    QueueNames.CLEANUP,
    async (job: Job<TestJobData, TestJobResult>) => {
      logger.info('Processing cleanup job', { jobId: job.id });
      
      const processor = new CleanupJobProcessor();
      return await processor.process(job);
    },
    {
      concurrency: 1,         // 정리 작업은 하나씩만
      maxStalledCount: 1,
      stalledInterval: 60000, // 1분마다 체크
    }
  );

  logger.info('Cleanup worker created');

  // 3. 적응 학습 Worker 설정
  logger.info('Setting up adaptation learning worker');
  
  const learningWorker = queueManager.createWorker(
    QueueNames.ADAPTATION_LEARNING,
    async (job: Job<TestJobData, TestJobResult>) => {
      logger.info('Processing learning job', { jobId: job.id });
      
      const processor = JobProcessorFactory.createProcessor('adaptation-learning');
      return await processor.process(job);
    },
    {
      concurrency: 1,
      maxStalledCount: 2,
      stalledInterval: 120000, // 2분마다 체크
    }
  );

  logger.info('Adaptation learning worker created');

  // 4. Worker 이벤트 핸들러 설정
  logger.info('Setting up worker event handlers');

  // 공통 이벤트 핸들러 함수
  const setupWorkerEvents = (worker: any, workerName: string) => {
    worker.on('ready', () => {
      logger.info('Worker ready', { workerName });
    });

    worker.on('error', (error: Error) => {
      logger.error('Worker error', { workerName, error: error.message, stack: error.stack });
    });

    worker.on('completed', (job: Job, result: any) => {
      logger.info('Worker job completed', { workerName, jobId: job.id, result });
    });

    worker.on('failed', (job: Job | undefined, error: Error) => {
      logger.error('Worker job failed', { workerName, jobId: job?.id, error: error.message });
    });

    worker.on('progress', (job: Job, progress: any) => {
      logger.info('Worker job progress', { workerName, jobId: job.id, progress });
    });

    worker.on('stalled', (jobId: string) => {
      logger.warn('Worker job stalled', { workerName, jobId });
    });
  };

  // 각 워커에 이벤트 핸들러 적용
  setupWorkerEvents(testWorker, 'TestExecution');
  setupWorkerEvents(cleanupWorker, 'Cleanup');
  setupWorkerEvents(learningWorker, 'Learning');

  logger.info('All worker event handlers set up');

  // 5. 헬스체크 설정
  logger.info('Setting up health monitoring');

  const healthCheck = async () => {
    try {
      const testStats = await queueManager.getQueueStats(QueueNames.TEST_EXECUTION);
      const cleanupStats = await queueManager.getQueueStats(QueueNames.CLEANUP);
      const learningStats = await queueManager.getQueueStats(QueueNames.ADAPTATION_LEARNING);

      logger.info('Health Check - Queue Statistics', {
        testExecution: testStats,
        cleanup: cleanupStats,
        learning: learningStats
      });

      // Worker 상태 확인
      const workers = [
        { name: 'TestExecution', worker: testWorker },
        { name: 'Cleanup', worker: cleanupWorker },
        { name: 'Learning', worker: learningWorker },
      ];

      for (const { name, worker } of workers) {
        const isRunning = !worker.closing;
        logger.info('Worker status', { workerName: name, running: isRunning });
      }

    } catch (error) {
      logger.error('Health check failed', { error: error instanceof Error ? error.message : String(error) });
    }
  };

  // 30초마다 헬스체크 실행
  const healthCheckInterval = setInterval(healthCheck, 30000);

  // 6. 우아한 종료 설정
  logger.info('Setting up graceful shutdown');

  const gracefulShutdown = async (signal: string) => {
    logger.info('Received shutdown signal, shutting down gracefully', { signal });
    
    clearInterval(healthCheckInterval);
    
    logger.info('Closing workers');
    await Promise.all([
      testWorker.close(),
      cleanupWorker.close(), 
      learningWorker.close(),
    ]);
    
    logger.info('Closing queue manager');
    await queueManager.close();
    
    logger.info('Graceful shutdown completed');
    process.exit(0);
  };

  // 시그널 핸들러 등록
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  logger.info('Worker setup completed! Workers are ready to process jobs', {
    availableQueues: {
      'test-execution': { concurrency: 2 },
      'cleanup': { concurrency: 1 },
      'adaptation-learning': { concurrency: 1 }
    }
  });
  logger.info('Waiting for jobs... (Press Ctrl+C to stop)');

  // 초기 헬스체크 실행
  await healthCheck();
}

// 에러 핸들링과 함께 실행
if (require.main === module) {
  workerSetupExample().catch(error => {
    logger.error('Worker setup failed', { error: error instanceof Error ? error.message : String(error) });
    process.exit(1);
  });
}