/**
 * BullMQ 큐 시스템 테스트 스크립트
 */

const { createLogger } = require('@cinnamon-qa/logger');
const { getQueueManager, QueueNames, JobPriority } = require('./dist/index');

const logger = createLogger({ context: 'QueueTestJS' });

async function testQueue() {
  logger.info('BullMQ queue system test started');
  
  const queueManager = getQueueManager();
  let worker = null;
  
  try {
    // 1. 큐 생성 테스트
    logger.info('Queue creation test starting');
    const testQueue = queueManager.getQueue(QueueNames.TEST_EXECUTION);
    logger.info('Test execution queue created successfully');
    
    // 2. 큐 통계 확인
    logger.info('Checking initial queue statistics');
    const initialStats = await queueManager.getQueueStats(QueueNames.TEST_EXECUTION);
    logger.info('Initial queue stats', { stats: initialStats });
    
    // 3. 테스트 Job 생성
    logger.info('Adding test job');
    const testJobData = {
      testCaseId: 'test-case-001',
      testRunId: 'test-run-001',
      userId: 'user-001',
      config: {
        timeout: 30000,
        headless: true,
        viewport: { width: 1280, height: 720 },
        adaptiveMode: true,
        maxAdaptations: 3
      }
    };
    
    const job = await queueManager.addTestJob(testJobData, {
      priority: JobPriority.HIGH,
      attempts: 2
    });
    
    logger.info('Job added successfully', { jobId: job.id, priority: JobPriority.HIGH });
    
    // 4. Worker 생성 및 Job 처리 테스트
    logger.info('Creating worker and processing job');
    
    worker = queueManager.createWorker(
      QueueNames.TEST_EXECUTION,
      async (job) => {
        logger.info('Job processing started', { jobId: job.id, data: job.data });
        
        // 진행률 업데이트 시뮬레이션
        for (let i = 1; i <= 3; i++) {
          await queueManager.updateJobProgress(job, {
            testRunId: job.data.testRunId,
            currentStep: i,
            totalSteps: 3,
            percentage: Math.round((i / 3) * 100),
            message: `Step ${i}/3 진행 중...`,
            stepData: {
              action: `step_${i}`,
              status: 'running'
            }
          });
          
          logger.info('Job progress updated', { jobId: job.id, progress: Math.round((i / 3) * 100) });
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // 결과 반환
        return {
          testRunId: job.data.testRunId,
          status: 'completed',
          totalSteps: 3,
          completedSteps: 3,
          failedSteps: 0,
          adaptedSteps: 0,
          duration: 1500
        };
      },
      { concurrency: 1 }
    );
    
    logger.info('Worker created successfully');
    
    // 5. Job 완료 대기
    logger.info('Waiting for job completion');
    
    const jobResult = await job.waitUntilFinished(queueManager.createQueueEvents(QueueNames.TEST_EXECUTION));
    logger.info('Job processing completed', { result: jobResult });
    
    // 6. 최종 큐 통계 확인
    logger.info('Checking final queue statistics');
    const finalStats = await queueManager.getQueueStats(QueueNames.TEST_EXECUTION);
    logger.info('Final queue stats', { stats: finalStats });
    
    // 7. 큐 정리 테스트
    logger.info('Queue cleanup test starting');
    await queueManager.cleanQueue(QueueNames.TEST_EXECUTION, 0, 10); // 즉시 정리
    logger.info('Queue cleanup completed');
    
    const cleanedStats = await queueManager.getQueueStats(QueueNames.TEST_EXECUTION);
    logger.info('Cleaned queue stats', { stats: cleanedStats });
    
    logger.info('All BullMQ tests completed successfully');
    
  } catch (error) {
    logger.error('BullMQ test failed', { error: error.message, stack: error.stack });
    process.exit(1);
  } finally {
    // 리소스 정리
    logger.info('Cleaning up resources');
    if (worker) {
      await worker.close();
      logger.info('Worker closed successfully');
    }
    await queueManager.close();
    logger.info('QueueManager closed successfully');
  }
}

// 테스트 실행
testQueue().catch(error => {
  logger.error('Test execution failed', { error: error.message, stack: error.stack });
  process.exit(1);
});