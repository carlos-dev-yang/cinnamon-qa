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
import { createLogger } from '@cinnamon-qa/logger';

const logger = createLogger({ context: 'QueueMonitoring' });

async function monitoringExample() {
  logger.info('Queue Monitoring Example');
  
  const redisClient = await connectRedis();
  const queueManager = getQueueManager();

  // 1. 큐 이벤트 모니터링 설정
  logger.info('Setting up queue event monitoring');

  const queueNames = [
    QueueNames.TEST_EXECUTION,
    QueueNames.CLEANUP,
    QueueNames.ADAPTATION_LEARNING
  ];

  const queueEventListeners: any[] = [];

  for (const queueName of queueNames) {
    const queueEvents = queueManager.createQueueEvents(queueName);
    queueEventListeners.push(queueEvents);

    logger.info('Monitoring queue', { queueName });

    // 작업 상태 변화 이벤트
    queueEvents.on('waiting', ({ jobId }) => {
      logger.info('Job waiting', { queueName, jobId });
    });

    queueEvents.on('active', ({ jobId }) => {
      logger.info('Job active', { queueName, jobId });
    });

    queueEvents.on('completed', ({ jobId, returnvalue }) => {
      logger.info('Job completed', { queueName, jobId, returnvalue });
    });

    queueEvents.on('failed', ({ jobId, failedReason }) => {
      logger.error('Job failed', { queueName, jobId, failedReason });
    });

    queueEvents.on('progress', ({ jobId, data }) => {
      logger.info('Job progress', { queueName, jobId, data });
    });

    queueEvents.on('stalled', ({ jobId }) => {
      logger.warn('Job stalled', { queueName, jobId });
    });

    queueEvents.on('removed', ({ jobId }) => {
      logger.info('Job removed', { queueName, jobId });
    });
  }

  logger.info('Queue event monitoring set up');

  // 2. 실시간 통계 모니터링
  logger.info('Setting up real-time statistics monitoring');

  const statsMonitor = async () => {
    logger.info('=== Queue Statistics ===', { timestamp: new Date().toISOString() });
    
    for (const queueName of queueNames) {
      try {
        const stats = await queueManager.getQueueStats(queueName);
        
        // 전체 처리량 계산
        const total = stats.waiting + stats.active + stats.completed + stats.failed;
        const successRate = total > 0 ? ((stats.completed / total) * 100).toFixed(1) : '0';
        
        logger.info('Queue statistics', {
          queueName,
          waiting: stats.waiting,
          active: stats.active,
          completed: stats.completed,
          failed: stats.failed,
          delayed: stats.delayed,
          paused: stats.paused,
          successRate: `${successRate}%`
        });
        
      } catch (error) {
        logger.error('Failed to get queue stats', { queueName, error: error instanceof Error ? error.message : String(error) });
      }
    }
  };

  // 10초마다 통계 출력
  const statsInterval = setInterval(statsMonitor, 10000);

  // 3. Redis 메모리 사용량 모니터링
  logger.info('Setting up Redis memory monitoring');

  const memoryMonitor = async () => {
    try {
      const info = await redisClient.info();
      const memorySection = info.split('\r\n').filter(line => 
        line.startsWith('used_memory_human:') || 
        line.startsWith('used_memory_peak_human:') ||
        line.startsWith('connected_clients:')
      );
      
      if (memorySection.length > 0) {
        const memoryInfo: Record<string, string> = {};
        memorySection.forEach(line => {
          const [key, value] = line.split(':');
          memoryInfo[key.replace(/_/g, ' ')] = value;
        });
        logger.info('Redis Memory Info', { memoryInfo });
      }
    } catch (error) {
      logger.error('Failed to get Redis memory info', { error: error instanceof Error ? error.message : String(error) });
    }
  };

  // 60초마다 메모리 정보 출력
  const memoryInterval = setInterval(memoryMonitor, 60000);

  // 4. 큐 건강 상태 체크
  logger.info('Setting up queue health checks');

  const healthCheck = async () => {
    logger.info('=== Health Check ===');
    
    // Redis 연결 상태
    const redisHealthy = await redisClient.healthCheck();
    logger.info('Redis Connection Status', { healthy: redisHealthy });
    
    // 각 큐의 건강 상태
    for (const queueName of queueNames) {
      try {
        const queue = queueManager.getQueue(queueName);
        const isPaused = await queue.isPaused();
        const waiting = await queue.getWaiting();
        const active = await queue.getActive();
        
        const queueHealth = {
          queueName,
          status: isPaused ? 'paused' : 'active',
          processing: active.length,
          queueLength: waiting.length,
          warnings: [] as string[]
        };
        
        // 대기 시간이 너무 긴 작업 경고
        if (waiting.length > 0) {
          const oldestJob = waiting[0];
          const waitTime = Date.now() - oldestJob.timestamp;
          if (waitTime > 300000) { // 5분 이상 대기
            queueHealth.warnings.push(`Oldest job waiting for ${Math.round(waitTime / 1000)}s`);
          }
        }
        
        // 너무 오래 실행되는 작업 경고
        if (active.length > 0) {
          for (const job of active) {
            const runTime = Date.now() - job.processedOn!;
            if (runTime > 600000) { // 10분 이상 실행
              queueHealth.warnings.push(`Job ${job.id} running for ${Math.round(runTime / 1000)}s`);
            }
          }
        }
        
        if (queueHealth.warnings.length > 0) {
          logger.warn('Queue health check warnings', queueHealth);
        } else {
          logger.info('Queue health check', queueHealth);
        }
        
      } catch (error) {
        logger.error('Health check failed for queue', { queueName, error: error instanceof Error ? error.message : String(error) });
      }
    }
  };

  // 30초마다 건강 상태 체크
  const healthInterval = setInterval(healthCheck, 30000);

  // 5. 데모용 작업 추가 (모니터링 테스트용)
  logger.info('Adding demo jobs for monitoring');

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
      logger.info('Added demo job', { testCaseId: jobData.testCaseId });
    }
  };

  // 2분마다 데모 작업 추가
  const demoJobInterval = setInterval(addDemoJobs, 120000);

  // 초기 데모 작업 추가
  await addDemoJobs();

  // 6. 우아한 종료 설정
  logger.info('Setting up graceful shutdown');

  const gracefulShutdown = async (signal: string) => {
    logger.info('Received signal, shutting down monitoring', { signal });
    
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
    
    logger.info('Monitoring shutdown completed');
    process.exit(0);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  logger.info('Monitoring setup completed', {
    monitoring: {
      'queue-statistics': '10 seconds',
      'health-checks': '30 seconds',
      'memory-monitoring': '60 seconds',
      'demo-jobs': '2 minutes'
    },
    message: 'Press Ctrl+C to stop monitoring'
  });

  // 초기 통계 및 건강 상태 확인
  await statsMonitor();
  await healthCheck();
  await memoryMonitor();
}

// 에러 핸들링과 함께 실행
if (require.main === module) {
  monitoringExample().catch(error => {
    logger.error('Monitoring example failed', { error: error instanceof Error ? error.message : String(error) });
    process.exit(1);
  });
}