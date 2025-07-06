## 13. 모니터링 및 관찰성

### 13.1 주요 메트릭
- 컨테이너 풀 활용도
- 테스트 실행 시간
- 적응 빈도
- AI API 사용량 및 비용
- 스토리지 소비량 및 비용
- 파일 접근 패턴
- 정리 효과성

### 13.2 대시보드
- 실시간 테스트 실행 모니터
- 컨테이너 상태 대시보드
- 적응 효과성 리포트
- 스토리지 사용 분석
- 비용 분석 대시보드

## 14. 스토리지 전략

### 14.1 데이터 분류
1. **구조화된 데이터** (PostgreSQL)
   - 테스트 케이스, 실행, 기본 스텝 정보
   
2. **반구조화된 데이터** (JSONB)
   - 테스트 설정, 선택자, 오류 세부사항
   - DOM 스냅샷, 콘솔/네트워크 로그
   
3. **바이너리 데이터** (Supabase Storage)
   - WebP 스크린샷 (기본 포맷)
   - 비디오, HAR 파일, 리포트

### 14.2 스토리지 최적화
- **WebP 포맷**: PNG보다 30-50% 작음
- **품질 설정**: QA 용도에 최적화된 80%
- **해상도 제한**: 최대 1920x1080
- **자동 압축**: DOM 스냅샷
- **로그 필터링**: 오류 및 경고만# Cinnamon-QA 제품 요구사항 문서

## 1. 프로젝트 개요

### 1.1 프로젝트 정보
- **프로젝트명**: Cinnamon-QA (QA 부분은 변경 가능)
- **버전**: 1.0.0 (MVP)
- **문서 작성일**: 2025-01-06
- **최종 수정**: 적응형 테스트 실행 전략 추가

### 1.2 프로젝트 목적
자연어로 작성된 테스트 시나리오를 AI가 분석하여 실시간 피드백 루프를 통해 적응형 E2E 테스트를 자동으로 수행하는 웹 기반 QA 자동화 도구

### 1.3 타겟 사용자
- QA 엔지니어
- 1인 개발자
- 비기술직 직원
- 빠른 개발 속도로 인해 테스트에 시간을 할애하기 어려운 개발팀

### 1.4 핵심 가치
- **접근성**: 자연어로 테스트 시나리오 작성 가능
- **지능화**: AI 기반 시나리오 분석 및 적응형 실행
- **실시간성**: 피드백 루프를 통한 실시간 테스트 진행 모니터링
- **신뢰성**: 격리된 컨테이너 실행과 자동 복구
- **지속성**: 백그라운드 테스트 실행 지원

## 2. 기술 스택

### 2.1 Frontend
- **Framework**: React (Next.js 제외)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: React Context/Zustand
- **Type Safety**: tRPC client
- **Real-time**: SSE (Server-Sent Events)

### 2.2 Backend
- **Runtime**: Node.js
- **Framework**: Fastify
- **Language**: TypeScript
- **API Layer**: tRPC
- **Queue**: Redis with BullMQ
- **Worker**: 별도 Node.js 프로세스

### 2.3 Database & Storage
- **Database**: Supabase (PostgreSQL with JSONB)
- **File Storage**: Supabase Storage
  - 스크린샷: WebP 포맷 (80% 품질)
  - 아티팩트: 비디오, HAR 파일, 리포트
- **Cache**: Redis
- **Data Access**: Repository 패턴 패키지
- **Storage Management**: 만료를 통한 자동화된 수명주기 관리

### 2.4 AI & Testing
- **AI Model**: Google Gemini
- **AI Integration**: Direct API (초기에는 LangChain 미사용)
- **E2E Testing**: Playwright-MCP (Docker Container)
- **Container Management**: 독점 할당을 통한 격리된 풀

### 2.5 Infrastructure
- **Container**: Docker & Docker Compose
- **Container Pool**: 다중 MCP 인스턴스
- **CI**: GitHub Actions
- **Monitoring**: 커스텀 메트릭 대시보드

## 3. 시스템 아키텍처

### 3.1 개선된 아키텍처
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│  API Server │────▶│   Worker    │────▶│ Container   │
│   (React)   │◀────│  (Fastify)  │◀────│  (적응형)   │◀────│    Pool     │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
       │                    │                    │                    │
       │                    ▼                    ▼                    ▼
       │              ┌─────────┐         ┌─────────────┐     ┌─────────────┐
       │              │  Redis  │         │   Gemini    │     │MCP Container│
       │              │ BullMQ  │         │     API     │     │   (격리됨)  │
       │              └─────────┘         └─────────────┘     └─────────────┘
       │                    │                    │                    │
       │                    ▼                    ▼                    ▼
       │              ┌─────────┐         ┌─────────────┐     ┌─────────────┐
       └─────────────▶│Database │         │  Feedback   │     │   State     │
                      │ Package │         │    Loop     │     │  Capture    │
                      └─────────┘         └─────────────┘     └─────────────┘
```

### 3.2 통신 플로우
1. **Client ↔ API Server**: tRPC (HTTP) + SSE (실시간 업데이트)
2. **API Server ↔ Worker**: Redis Queue (BullMQ)
3. **Worker ↔ AI**: 검증을 통한 적응형 통신
4. **Worker ↔ MCP**: 테스트당 독점 컨테이너
5. **데이터 저장**: 데이터베이스 패키지 추상화를 통한 저장

## 4. 핵심 기능

### 4.1 적응형 테스트 시나리오 분석
#### 기능 설명
- 자연어 테스트 시나리오 입력
- AI가 테스트 케이스 구조화 및 분석
- 실제 페이지 상태와 실시간 검증
- 동적 테스트 계획 적응

#### 상세 플로우
1. 사용자가 테스트 URL과 시나리오 입력
2. AI (Gemini)가 시나리오 분석 및 정제
3. 초기 테스트 스텝 생성
4. 실행 전 페이지 상태 검증
5. 실제 UI 기반 적응형 스텝 수정

### 4.2 지능형 E2E 테스트 실행
#### 기능 설명
- 테스트 실행당 격리된 컨테이너
- AI 가이드를 통한 적응형 스텝 실행
- 자동 실패 복구 메커니즘
- 상태 지속성을 갖춘 백그라운드 실행

#### 기술 구현
- 격리를 위한 컨테이너 풀 관리
- 각 스텝에서 상태 캡처
- 스텝 실행 전 AI 검증
- 일반적인 실패에 대한 복구 전략

### 4.3 실시간 진행 상황 모니터링
#### 기능 설명
- SSE 기반 실시간 테스트 진행
- 단계별 성공/실패 상태
- 적응 변경사항 알림
- 스크린샷과 함께 시각적 피드백

#### 이벤트 타입
```typescript
interface TestProgressEvent {
  type: 'step_start' | 'step_complete' | 'step_error' | 
        'step_adapted' | 'recovery_attempted' | 'test_complete';
  stepId: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'adapted';
  adaptation?: {
    reason: string;
    originalStep: TestStep;
    newStep: TestStep;
  };
  message?: string;
  screenshot?: string;
  pageState?: PageStateSummary;
  timestamp: Date;
}
```

### 4.4 향상된 테스트 결과 저장
#### 저장 데이터
- 적응 사항을 포함한 완전한 테스트 실행 이력
- 페이지 상태를 포함한 단계별 실행 결과
- WebP 스크린샷 (80% 품질, 최대 1920x1080)
- 페이지 상태 스냅샷 (JSONB)
- 콘솔 로그 및 네트워크 활동 (필터링됨)
- 적응 및 복구 이력
- 자동 만료를 포함한 스토리지 참조

#### 스토리지 구성
```
screenshots/{year}/{month}/{day}/{test_run_id}/{step_number}_{timestamp}.webp
test-artifacts/videos/{test_run_id}/recording_{timestamp}.mp4
test-artifacts/har/{test_run_id}/network_{timestamp}.har
reports/{year}/{month}/{test_run_id}/report_{timestamp}.html
```

#### 수명주기 관리
- 스크린샷: 30일 보존 (실패 테스트는 90일)
- 비디오: 7일 보존 (프리미엄 기능)
- HAR 파일: 30일 보존
- 리포트: 90일 보존
- 자동 아카이빙 및 정리

#### 리포트 형식
- 대화형 HTML 리포트
- 적응 타임라인 뷰
- 주석이 달린 스크린샷 갤러리
- 성능 메트릭 대시보드
- 네트워크 활동 분석

### 4.5 테스트케이스 관리
#### 기능
- 테스트케이스 저장 및 재사용
- 기존 테스트 복제 및 수정
- 적응 사항을 포함한 실행 이력
- 성공 패턴으로부터 학습

## 5. 데이터 모델

### 5.1 핵심 엔티티

#### TestCase (향상됨)
```typescript
interface TestCase {
  id: string;
  name: string;
  url: string;
  originalScenario: string;
  refinedScenario: string;
  testSteps: TestStep[];
  adaptationPatterns: AdaptationPattern[]; // 신규
  reliabilityScore: number;                // 신규
  createdAt: Date;
  updatedAt: Date;
}
```

#### TestRun (향상됨)
```typescript
interface TestRun {
  id: string;
  testCaseId: string;
  containerId?: string;                    // 신규
  status: 'pending' | 'running' | 'completed' | 'failed' | 'adapted';
  adaptationCount: number;                 // 신규
  recoveryAttempts: number;                // 신규
  startedAt: Date;
  completedAt?: Date;
  totalSteps: number;
  completedSteps: number;
  failedSteps: number;
  adaptedSteps: number;                    // 신규
}
```

#### TestStep (향상됨)
```typescript
interface TestStep {
  id: string;
  testRunId: string;
  stepNumber: number;
  action: string;
  selector?: string;
  value?: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'adapted';
  pageStateBefore?: PageState;            // 신규
  pageStateAfter?: PageState;             // 신규
  adaptations?: StepAdaptation[];         // 신규
  recoveryAttempts?: RecoveryAttempt[];   // 신규
  errorMessage?: string;
  snapshotUrl?: string;
  domState?: object;
  consoleLogs?: string[];
  executedAt?: Date;
  duration?: number;
}
```

#### 신규 엔티티
```typescript
interface PageState {
  url: string;
  title: string;
  readyState: string;
  visibleElements: ElementInfo[];
  interactableElements: ElementInfo[];
  screenshot?: string;
  capturedAt: Date;
}

interface StepAdaptation {
  reason: string;
  originalAction: string;
  adaptedAction: string;
  confidence: number;
  timestamp: Date;
}

interface ContainerAllocation {
  id: string;
  containerId: string;
  testRunId: string;
  allocatedAt: Date;
  releasedAt?: Date;
  status: 'active' | 'released';
}

interface StorageReference {
  id: string;
  bucketName: string;
  filePath: string;
  fileType: 'screenshot' | 'video' | 'har' | 'report';
  fileSizeBytes: number;
  mimeType: string;
  testRunId?: string;
  testStepId?: string;
  metadata: Record<string, any>;
  expiresAt: Date;
  isArchived: boolean;
  accessCount: number;
  storageUrl: string;
  createdAt: Date;
}
```

## 6. API 설계

### 6.1 향상된 tRPC 라우터
```typescript
// 테스트 케이스 라우트
- testCase.create
- testCase.list
- testCase.get
- testCase.duplicate
- testCase.getAdaptationPatterns    // 신규

// 테스트 실행 라우트
- testRun.create
- testRun.get
- testRun.subscribe (SSE)
- testRun.getAdaptationHistory      // 신규
- testRun.getContainerStatus        // 신규

// 테스트 스텝 라우트
- testStep.list
- testStep.getPageState             // 신규
- testStep.getAdaptations           // 신규

// 컨테이너 관리 라우트              // 신규
- container.getPoolStatus
- container.allocate
- container.release
```

### 6.2 Worker 작업 큐
```typescript
interface TestJob {
  id: string;
  testRunId: string;
  testCaseId: string;
  priority: number;
  containerId?: string;              // 신규
  adaptiveMode: boolean;             // 신규
  maxAdaptations: number;            // 신규
  createdAt: Date;
}
```

## 7. 적응형 실행 전략

### 7.1 컨테이너 격리
- 테스트당 독점 컨테이너 할당
- 자동 정리 및 초기화
- 상태 모니터링 및 복구
- 확장성을 위한 풀 관리

### 7.2 AI 기반 적응
- 실행 전 검증
- 동적 스텝 수정
- 실패 분석 및 복구
- 패턴으로부터 학습

### 7.3 피드백 루프
- 성공/실패 패턴 기록
- 선택자 신뢰도 점수
- 적응 효과성 추적
- 지속적 개선

## 8. UI/UX 요구사항

### 8.1 주요 화면
1. **테스트 생성 화면**
   - URL 입력 필드
   - 예제가 포함된 시나리오 텍스트 영역
   - 신뢰도 점수가 표시된 AI 분석 프리뷰
   - 적응 설정 토글

2. **테스트 실행 화면**
   - 적응 지표가 포함된 실시간 진행 상황
   - 실시간 스크린샷 프리뷰
   - 상태 변경 알림
   - 복구 시도 시각화

3. **테스트 이력 화면**
   - 신뢰도 점수가 포함된 테스트케이스 목록
   - 적응 타임라인이 포함된 실행 이력
   - 학습 인사이트가 포함된 상세 결과
   - 패턴 분석 대시보드

### 8.2 디자인 원칙
- Tailwind CSS를 활용한 최소한의 UI
- 기능 중심의 인터페이스
- 실시간 피드백 강조
- 적응 변경사항 하이라이트

## 9. 개발 로드맵

### 1단계: MVP 기반 (1-4주차)
- [x] 프로젝트 구조 설정
- [x] 데이터베이스 스키마 설계
- [x] 스토리지 전략 정의
- [ ] 기본 API 서버 구현
- [ ] Worker 프로세스 설정
- [ ] 데이터베이스 패키지 생성
- [ ] Redis/BullMQ 통합

### 2단계: 핵심 기능 (5-8주차)
- [ ] Gemini API 통합
- [ ] 기본 MCP 컨테이너 통합
- [ ] 컨테이너 풀 관리
- [ ] 기본 UI 구현
- [ ] SSE 실시간 통신
- [ ] WebP 스크린샷 캡처

### 3단계: 적응형 실행 (9-12주차)
- [ ] 페이지 상태 캡처 구현
- [ ] AI 검증 통합
- [ ] 적응형 스텝 실행
- [ ] 실패 복구 메커니즘
- [ ] 피드백 루프 구현

### 4단계: 안정화 (13-16주차)
- [ ] 에러 처리 개선
- [ ] 성능 최적화
- [ ] 모니터링 대시보드
- [ ] 문서 완성

### 5단계: 향후 개선사항
- [ ] Google SSO 인증
- [ ] 다중 테스트 동시 실행
- [ ] 테스트 스케줄링
- [ ] 웹훅 알림
- [ ] 비디오 녹화 (프리미엄)
- [ ] Safari 지원

## 10. 제약사항 및 가정

### 10.1 기술적 제약
- Chrome 브라우저만 지원 (초기)
- 컨테이너당 단일 테스트 실행
- 공개 웹사이트만 (초기에는 인증 미지원)
- 최대 테스트 시간: 30분

### 10.2 운영 가정
- 초기 스케일링 미고려
- 수동 데이터 보존 관리
- 직접 비용 모니터링
- 영어 UI만 제공 (초기)

## 11. 성공 지표

### 11.1 기능적 성공 지표
- 자연어 해석 정확도: >90%
- 테스트 실행 성공률: >95%
- 성공적인 적응률: >80%
- 실시간 업데이트 지연: <1초
- 컨테이너 격리: 100%

### 11.2 사용성 지표
- 테스트 작성 시간: 70% 단축
- 비기술직 사용자 성공률: >80%
- 적응 효과성: >75%
- 복구 성공률: >60%

## 12. 보안 고려사항

### 12.1 현재 단계 (MVP)
- 환경 변수 API 키 관리
- 내부 네트워크 통신
- 보안을 위한 컨테이너 격리
- 사용자 인증 없음

### 12.2 향후 계획
- Google SSO 구현
- API 속도 제한
- GitHub Secrets 통합
- 사용자 리소스 격리
- RBAC 구현

## 13. 모니터링 및 관찰성

### 13.1 주요 메트릭
- 컨테이너 풀 활용도
- 테스트 실행 시간
- 적응 빈도
- AI API 사용량 및 비용
- 스토리지 소비량

### 13.2 대시보드
- 실시간 테스트 실행 모니터
- 컨테이너 상태 대시보드
- 적응 효과성 리포트
- 비용 분석 대시보드

## 14. 부록

### 14.1 용어 정의
- **MCP**: Model Context Protocol
- **E2E**: End-to-End Testing (종단간 테스트)
- **SSE**: Server-Sent Events (서버 발송 이벤트)
- **Worker**: 백그라운드 작업 처리기
- **적응형 실행**: 실시간 피드백을 기반으로 한 동적 테스트 조정
- **컨테이너 풀**: 격리된 테스트 환경의 관리된 컬렉션

### 14.2 참고 자료
- Playwright MCP Documentation
- Google Gemini API Reference
- Supabase Documentation
- tRPC Documentation
- BullMQ Documentation
- 적응형 테스트 실행 전략 문서