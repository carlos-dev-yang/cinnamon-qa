/**
 * BullMQ 큐 시스템 테스트 스크립트
 */

const { getQueueManager, QueueNames, JobPriority } = require('./dist/index');

async function testQueue() {
  console.log('🧪 BullMQ 큐 시스템 테스트 시작...');
  
  const queueManager = getQueueManager();
  let worker = null;
  
  try {
    // 1. 큐 생성 테스트
    console.log('\n1️⃣ 큐 생성 테스트...');
    const testQueue = queueManager.getQueue(QueueNames.TEST_EXECUTION);
    console.log('✅ 테스트 실행 큐 생성 성공');
    
    // 2. 큐 통계 확인
    console.log('\n2️⃣ 초기 큐 통계...');
    const initialStats = await queueManager.getQueueStats(QueueNames.TEST_EXECUTION);
    console.log('📊 초기 큐 상태:', initialStats);
    
    // 3. 테스트 Job 생성
    console.log('\n3️⃣ 테스트 Job 추가...');
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
    
    console.log(`✅ Job 추가 성공: ID=${job.id}, 우선순위=${JobPriority.HIGH}`);
    
    // 4. Worker 생성 및 Job 처리 테스트
    console.log('\n4️⃣ Worker 생성 및 Job 처리...');
    
    worker = queueManager.createWorker(
      QueueNames.TEST_EXECUTION,
      async (job) => {
        console.log(`🏃 Job ${job.id} 처리 시작:`, job.data);
        
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
          
          console.log(`📊 Job ${job.id} 진행률: ${Math.round((i / 3) * 100)}%`);
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
    
    console.log('✅ Worker 생성 완료');
    
    // 5. Job 완료 대기
    console.log('\n5️⃣ Job 완료 대기...');
    
    const jobResult = await job.waitUntilFinished(queueManager.createQueueEvents(QueueNames.TEST_EXECUTION));
    console.log('✅ Job 처리 완료:', jobResult);
    
    // 6. 최종 큐 통계 확인
    console.log('\n6️⃣ 최종 큐 통계...');
    const finalStats = await queueManager.getQueueStats(QueueNames.TEST_EXECUTION);
    console.log('📊 최종 큐 상태:', finalStats);
    
    // 7. 큐 정리 테스트
    console.log('\n7️⃣ 큐 정리 테스트...');
    await queueManager.cleanQueue(QueueNames.TEST_EXECUTION, 0, 10); // 즉시 정리
    console.log('🧹 큐 정리 완료');
    
    const cleanedStats = await queueManager.getQueueStats(QueueNames.TEST_EXECUTION);
    console.log('📊 정리 후 큐 상태:', cleanedStats);
    
    console.log('\n🎉 모든 BullMQ 테스트 완료!');
    
  } catch (error) {
    console.error('❌ BullMQ 테스트 실패:', error);
    process.exit(1);
  } finally {
    // 리소스 정리
    console.log('\n🧹 리소스 정리...');
    if (worker) {
      await worker.close();
      console.log('Worker 종료 완료');
    }
    await queueManager.close();
    console.log('QueueManager 종료 완료');
  }
}

// 테스트 실행
testQueue().catch(error => {
  console.error('❌ 테스트 실행 중 오류:', error);
  process.exit(1);
});