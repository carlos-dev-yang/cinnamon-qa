# Cinnamon-QA Queue System

Redis와 BullMQ를 사용한 백그라운드 작업 큐 시스템입니다.

## 📋 목차

1. [시스템 구조](#시스템-구조)
2. [Redis 설정](#redis-설정)
3. [큐 구조](#큐-구조)
4. [사용법](#사용법)
5. [로깅](#로깅)
6. [모니터링](#모니터링)
7. [트러블슈팅](#트러블슈팅)

---

## 🏗️ 시스템 구조

### 전체 아키텍처

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   API Server    │    │      Redis      │    │     Worker      │
│                 │    │                 │    │                 │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │Queue Manager│ │◄──►│ │    Queues   │ │◄──►│ │Job Processor│ │
│ └─────────────┘ │    │ │             │ │    │ └─────────────┘ │
│                 │    │ │ • test-exec │ │    │                 │
│ ┌─────────────┐ │    │ │ • cleanup   │ │    │ ┌─────────────┐ │
│ │Job Producer │ │    │ │ • learning  │ │    │ │Job Consumer │ │
│ └─────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### 패키지 구조

```
packages/queue/
├── src/
│   ├── index.ts          # 메인 export
│   ├── types.ts          # 타입 정의
│   ├── redis.ts          # Redis 클라이언트
│   ├── queue.ts          # BullMQ 큐 관리
│   └── jobs.ts           # Job 프로세서
├── test-queue.ts         # 테스트 파일
└── README.md            # 이 문서
```

---

## ⚙️ Redis 설정

### 환경 변수

`.env` 파일에 다음 설정을 추가하세요:

```env
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=          # 비어있으면 인증 없음
REDIS_DB=0              # 사용할 데이터베이스 번호 (0-15)
```

### Docker Compose 설정

Redis 컨테이너를 시작하려면:

```bash
# Redis 컨테이너 시작
docker-compose up redis -d

# Redis Commander UI도 함께 시작 (포트 8081)
docker-compose up redis redis-commander -d
```

### Redis 연결 설정

```typescript
import { connectRedis } from '@cinnamon-qa/queue';

// 기본 설정으로 연결
const redisClient = await connectRedis();

// 커스텀 설정으로 연결
const redisClient = await connectRedis({
  host: 'custom-host',
  port: 6380,
  password: 'secret',
  db: 1,
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  lazyConnect: true,
});
```

---

## 🎯 큐 구조

### 큐 종류

1. **test-execution**: 테스트 실행 작업
2. **cleanup**: 정리 작업 (오래된 데이터 삭제)
3. **adaptation-learning**: 적응 학습 작업

### Job 데이터 구조

#### TestJobData (입력)
```typescript
interface TestJobData {
  testCaseId: string;        // 테스트 케이스 ID
  testRunId: string;         // 테스트 실행 ID
  userId?: string;           // 사용자 ID
  config?: {
    timeout?: number;        // 타임아웃 (밀리초)
    headless?: boolean;      // 헤드리스 모드 여부
    viewport?: {
      width: number;
      height: number;
    };
    adaptiveMode?: boolean;  // 적응 모드 활성화
    maxAdaptations?: number; // 최대 적응 횟수
  };
}
```

#### TestJobResult (출력)
```typescript
interface TestJobResult {
  testRunId: string;
  status: 'completed' | 'failed' | 'adapted';
  totalSteps: number;
  completedSteps: number;
  failedSteps: number;
  adaptedSteps: number;
  duration: number;
  error?: string;
  adaptations?: Array<{
    stepNumber: number;
    adaptationType: string;
    reason: string;
    successful: boolean;
  }>;
}
```

### Job 우선순위

```typescript
enum JobPriority {
  LOW = 1,      // 낮은 우선순위
  NORMAL = 5,   // 일반 우선순위
  HIGH = 10,    // 높은 우선순위  
  URGENT = 20   // 긴급 우선순위
}
```

---

## 🚀 사용법

### API Server에서 Job 추가

```typescript
import { getQueueManager, QueueNames, JobPriority } from '@cinnamon-qa/queue';

const queueManager = getQueueManager();

// 테스트 실행 작업 추가
const job = await queueManager.addTestJob({
  testCaseId: 'test-123',
  testRunId: 'run-456',
  userId: 'user-789',
  config: {
    timeout: 30000,
    headless: true,
    viewport: { width: 1920, height: 1080 },
    adaptiveMode: true,
    maxAdaptations: 5,
  }
}, {
  priority: JobPriority.HIGH,  // 높은 우선순위
  delay: 1000,                 // 1초 후 실행
  attempts: 3,                 // 최대 3회 재시도
});

console.log(`Job added with ID: ${job.id}`);
```

### Worker에서 Job 처리

```typescript
import { WorkerRedisClient } from '../lib/redis';

const workerRedis = new WorkerRedisClient();

// Redis 연결
await workerRedis.connect();

// 테스트 프로세서 시작
await workerRedis.startTestProcessor();

// 정리 프로세서 시작  
await workerRedis.startCleanupProcessor();

console.log('Worker started and ready to process jobs');
```

### Job 진행률 업데이트

```typescript
import { Job } from 'bullmq';
import { TestJobData, TestJobResult, JobProgress } from '@cinnamon-qa/queue';

class CustomTestProcessor extends BaseJobProcessor {
  async process(job: Job<TestJobData, TestJobResult>): Promise<TestJobResult> {
    const { testRunId } = job.data;
    
    // 진행률 업데이트
    await this.updateProgress(job, {
      testRunId,
      currentStep: 1,
      totalSteps: 5,
      percentage: 20,
      message: 'Initializing browser...',
      stepData: {
        action: 'navigate',
        status: 'running',
      }
    });
    
    // ... 실제 작업 수행
    
    return {
      testRunId,
      status: 'completed',
      totalSteps: 5,
      completedSteps: 5,
      failedSteps: 0,
      adaptedSteps: 0,
      duration: 5000,
    };
  }
}
```

---

## 📋 로깅

이 패키지는 `@cinnamon-qa/logger`를 사용하여 구조화된 로깅을 제공합니다.

### 로깅 구성

각 모듈은 고유한 컨텍스트를 가진 로거를 사용합니다:

```typescript
import { createLogger } from '@cinnamon-qa/logger';

// Redis 클라이언트 로거
const logger = createLogger({ context: 'RedisClient' });

// Queue 관리자 로거  
const logger = createLogger({ context: 'QueueManager' });

// Job 프로세서 로거
const logger = createLogger({ context: 'JobProcessor' });
```

### 로그 이벤트

#### Redis 연결 로그
```typescript
// 연결 성공
logger.info('Redis connected');

// 연결 실패
logger.error('Redis connection error', { 
  error: error.message, 
  stack: error.stack 
});

// 헬스체크 결과
logger.info('Redis health check', { healthy: true });
```

#### Queue 이벤트 로그
```typescript
// Job 추가
logger.info('Job added to queue', { 
  jobId: job.id, 
  queueName: 'test-execution',
  priority: JobPriority.HIGH 
});

// Worker 이벤트
logger.info('Job processing started', { 
  jobId: job.id,
  testCaseId: job.data.testCaseId 
});

logger.info('Job completed', { 
  jobId: job.id,
  duration: 5000,
  result: 'success' 
});
```

#### Job 진행률 로그
```typescript
// 진행률 업데이트
logger.info('Job progress updated', {
  jobId: job.id,
  progress: 50,
  currentStep: 3,
  totalSteps: 6,
  message: 'Processing data...'
});
```

#### 에러 로그
```typescript
// Job 실패
logger.error('Job processing failed', {
  jobId: job.id,
  testCaseId: job.data.testCaseId,
  error: error.message,
  stack: error.stack,
  attemptsMade: job.attemptsMade
});

// Worker 에러
logger.error('Worker error', {
  workerName: 'test-execution-worker',
  error: error.message,
  jobId: job?.id
});
```

### 구조화된 로그 데이터

모든 로그는 구조화된 데이터와 함께 기록됩니다:

```typescript
// 큐 통계 로그
logger.info('Queue statistics', {
  queueName: 'test-execution',
  waiting: 5,
  active: 2,
  completed: 100,
  failed: 3,
  delayed: 1
});

// Redis 서버 정보
logger.info('Redis server info', {
  version: '7.0.0',
  memory: '2.5M',
  connectedClients: 3,
  uptime: 86400
});
```

### 테스트 파일에서의 로깅

JavaScript 테스트 파일에서도 동일한 로거를 사용합니다:

```javascript
const { createLogger } = require('@cinnamon-qa/logger');

const logger = createLogger({ context: 'QueueTestJS' });

// 테스트 진행 상황
logger.info('Queue test started');
logger.info('Job added successfully', { jobId: job.id });
logger.info('All tests completed successfully');
```

---

## 📊 모니터링

### 큐 통계 확인

```typescript
const queueManager = getQueueManager();

// 특정 큐의 통계
const stats = await queueManager.getQueueStats(QueueNames.TEST_EXECUTION);
console.log('Queue Statistics:', {
  waiting: stats.waiting,      // 대기 중인 작업
  active: stats.active,        // 실행 중인 작업  
  completed: stats.completed,  // 완료된 작업
  failed: stats.failed,        // 실패한 작업
  delayed: stats.delayed,      // 지연된 작업
  paused: stats.paused,        // 일시정지 상태
});
```

### Redis Commander UI

브라우저에서 `http://localhost:8081`로 접속하여 Redis 데이터를 시각적으로 확인할 수 있습니다.

### Job 이벤트 모니터링

```typescript
const queueEvents = queueManager.createQueueEvents(QueueNames.TEST_EXECUTION);

queueEvents.on('waiting', ({ jobId }) => {
  logger.info('Job waiting', { jobId });
});

queueEvents.on('active', ({ jobId }) => {
  logger.info('Job started', { jobId });
});

queueEvents.on('completed', ({ jobId, returnvalue }) => {
  logger.info('Job completed', { jobId, result: returnvalue });
});

queueEvents.on('failed', ({ jobId, failedReason }) => {
  logger.error('Job failed', { jobId, reason: failedReason });
});
```

---

## 🔧 고급 설정

### 큐 관리

```typescript
const queueManager = getQueueManager();

// 큐 일시정지
await queueManager.pauseQueue(QueueNames.TEST_EXECUTION);

// 큐 재개
await queueManager.resumeQueue(QueueNames.TEST_EXECUTION);

// 오래된 작업 정리 (24시간 이상된 완료/실패 작업 100개까지)
await queueManager.cleanQueue(QueueNames.TEST_EXECUTION, 24 * 60 * 60 * 1000, 100);
```

### Worker 동시성 설정

```typescript
// 동시에 3개 작업 처리
const worker = queueManager.createWorker(
  QueueNames.TEST_EXECUTION,
  jobProcessor,
  {
    concurrency: 3,           // 동시 처리 수
    maxStalledCount: 1,       // 최대 중단 허용 횟수
    stalledInterval: 30000,   // 중단 체크 간격 (30초)
  }
);
```

### 커스텀 Job 프로세서

```typescript
import { BaseJobProcessor } from '@cinnamon-qa/queue';

class CustomJobProcessor extends BaseJobProcessor {
  async process(job: Job<TestJobData, TestJobResult>): Promise<TestJobResult> {
    try {
      // 커스텀 로직 구현
      
      return {
        testRunId: job.data.testRunId,
        status: 'completed',
        // ... 결과 데이터
      };
    } catch (error) {
      return this.handleError(error, 'custom processing');
    }
  }
}
```

---

## 🔧 트러블슈팅

### 일반적인 문제

#### 1. Redis 연결 실패
```bash
# Redis 컨테이너 상태 확인
docker ps | grep redis

# Redis 로그 확인
docker logs cinnamon-qa-redis

# Redis 연결 테스트
redis-cli ping
```

#### 2. 작업이 처리되지 않음
- Worker가 실행 중인지 확인
- 큐가 일시정지 상태가 아닌지 확인
- Redis 연결 상태 확인

#### 3. 메모리 부족
```typescript
// 큐 정리 설정
const queueManager = getQueueManager({
  defaultJobOptions: {
    removeOnComplete: 10,  // 완료된 작업 10개만 유지
    removeOnFail: 5,       // 실패한 작업 5개만 유지
  }
});
```

### 디버깅

```typescript
// Redis 연결 상태 확인
const redisClient = getRedisClient();
const isHealthy = await redisClient.healthCheck();
logger.info('Redis health check', { healthy: isHealthy });

// Redis 정보 확인
const info = await redisClient.info();
logger.info('Redis server info', { info });

// 큐 통계 확인
const stats = await queueManager.getQueueStats(QueueNames.TEST_EXECUTION);
logger.info('Queue statistics', { queueName: QueueNames.TEST_EXECUTION, stats });
```

### 로그 설정

환경 변수로 디버그 로그 활성화:
```bash
DEBUG=bull* npm run dev
```

---

## 📚 추가 자료

- [BullMQ Documentation](https://docs.bullmq.io/)
- [Redis Documentation](https://redis.io/documentation)
- [ioredis Documentation](https://github.com/redis/ioredis)

---

## 🔄 업데이트 로그

- **v1.0.0**: 초기 구현 (Redis + BullMQ)
- **v1.1.0**: 구조화된 로깅 시스템 추가 (@cinnamon-qa/logger 통합)
- 향후 계획: 메트릭 수집, 대시보드, 클러스터링 지원