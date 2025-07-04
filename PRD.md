# Cinnamon-QA Product Requirements Document

## 1. 프로젝트 개요

### 1.1 프로젝트 정보
- **프로젝트명**: Cinnamon-QA (QA 부분은 변경 가능)
- **버전**: 1.0.0 (MVP)
- **작성일**: 2025-01-03

### 1.2 프로젝트 목적
자연어로 작성된 테스트 시나리오를 AI가 분석하여 자동으로 E2E 테스트를 수행하는 웹 기반 QA 자동화 도구

### 1.3 타겟 사용자
- QA 엔지니어
- 1인 개발자
- 비기술직 직원
- 빠른 개발 속도로 인해 테스트에 시간을 할애하기 어려운 개발팀

### 1.4 핵심 가치
- **접근성**: 자연어로 테스트 시나리오 작성 가능
- **자동화**: AI 기반 시나리오 분석 및 테스트 실행
- **실시간성**: 테스트 진행 상황 실시간 모니터링
- **지속성**: 백그라운드 테스트 실행 지원

## 2. 기술 스택

### 2.1 Frontend
- **Framework**: React (Next.js 제외)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: React Context/Zustand
- **Type Safety**: tRPC client

### 2.2 Backend
- **Runtime**: Node.js
- **Framework**: Fastify
- **Language**: TypeScript
- **API Layer**: tRPC
- **Queue**: Redis (Worker 통신용)

### 2.3 Database & Storage
- **Database**: Supabase (PostgreSQL)
- **File Storage**: Supabase Storage (스냅샷 저장)
- **Cache**: Redis

### 2.4 AI & Testing
- **AI Model**: Google Gemini
- **Prompt Engineering**: LangChain (프롬프트 관리)
- **E2E Testing**: Playwright-MCP (Docker Container)

### 2.5 Infrastructure
- **Container**: Docker
- **CI**: GitHub Actions
- **Environment**: Docker Compose (개발환경)

## 3. 시스템 아키텍처

### 3.1 전체 구조
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│  API Server │────▶│   Worker    │
│   (React)   │◀────│  (Fastify)  │◀────│  (Node.js)  │
└─────────────┘     └─────────────┘     └─────────────┘
       │                    │                    │
       │                    ▼                    ▼
       │              ┌─────────┐         ┌─────────────┐
       │              │  Redis  │         │   Gemini    │
       │              └─────────┘         │     API     │
       │                    │             └─────────────┘
       │                    ▼                    │
       │              ┌─────────┐               ▼
       └─────────────▶│Supabase │         ┌─────────────┐
                      │  (DB)   │         │Playwright   │
                      └─────────┘         │MCP Container│
                                          └─────────────┘
```

### 3.2 통신 플로우
1. **Client ↔ API Server**: tRPC (HTTP/SSE)
2. **API Server ↔ Worker**: Redis Queue
3. **Worker ↔ AI/MCP**: Direct API calls
4. **데이터 저장**: Supabase DB/Storage

## 4. 핵심 기능

### 4.1 테스트 시나리오 작성 및 분석
#### 기능 설명
- 사용자가 자연어로 테스트 시나리오 입력
- AI가 시나리오를 분석하여 구조화된 테스트 케이스로 변환
- 변환된 테스트 케이스를 사용자에게 제시하여 확인

#### 상세 플로우
1. 사용자가 테스트할 URL과 시나리오 입력
2. AI (Gemini)가 시나리오 분석 및 정제
3. 구조화된 테스트 스텝으로 변환
4. 사용자에게 검토용 프리뷰 제공
5. 확인 후 테스트 실행

### 4.2 자동 E2E 테스트 실행
#### 기능 설명
- Playwright-MCP를 통한 자동화된 브라우저 테스트
- 백그라운드 실행 지원 (사용자가 페이지를 떠나도 계속 실행)
- 각 스텝별 상세 로깅

#### 기술 구현
- Worker 프로세스에서 테스트 실행
- Redis Queue를 통한 작업 관리
- MCP Container와의 통신

### 4.3 실시간 진행 상황 모니터링
#### 기능 설명
- SSE를 통한 실시간 테스트 진행 상황 전달
- 각 스텝별 성공/실패 상태 표시
- 진행률 표시

#### 구현 방식
```typescript
// SSE 이벤트 타입
interface TestProgressEvent {
  type: 'step_start' | 'step_complete' | 'step_error' | 'test_complete';
  stepId: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  message?: string;
  snapshot?: string;
  timestamp: Date;
}
```

### 4.4 테스트 결과 저장 및 리포팅
#### 저장 데이터
- 테스트 실행 이력
- 각 스텝별 실행 결과
- 화면 스냅샷 (페이지 이동 시)
- DOM 상태 (선택적)
- 콘솔 로그 (선택적)

#### 리포트 형식
- HTML 형식의 상세 리포트
- 스텝별 성공/실패 요약
- 스냅샷 이미지 포함

### 4.5 테스트케이스 관리
#### 기능 설명
- 테스트케이스 저장 및 재사용
- 테스트케이스 복제 및 수정
- 실행 이력 관리

## 5. 데이터 모델

### 5.1 주요 엔티티

#### TestCase
```typescript
interface TestCase {
  id: string;
  name: string;
  url: string;
  originalScenario: string;    // 사용자 입력 원본
  refinedScenario: string;     // AI가 정제한 시나리오
  testSteps: TestStep[];       // 구조화된 테스트 스텝
  createdAt: Date;
  updatedAt: Date;
}
```

#### TestRun
```typescript
interface TestRun {
  id: string;
  testCaseId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  totalSteps: number;
  completedSteps: number;
  failedSteps: number;
}
```

#### TestStep
```typescript
interface TestStep {
  id: string;
  testRunId: string;
  stepNumber: number;
  action: string;
  selector?: string;
  value?: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  errorMessage?: string;
  snapshotUrl?: string;
  domState?: object;
  consoleLogs?: string[];
  executedAt?: Date;
  duration?: number;
}
```

## 6. API 설계

### 6.1 tRPC Router 구조
```typescript
// 주요 라우터
- testCase.create
- testCase.list
- testCase.get
- testCase.duplicate
- testRun.create
- testRun.get
- testRun.subscribe (SSE)
- testStep.list
```

### 6.2 Worker 작업 큐
```typescript
interface TestJob {
  id: string;
  testRunId: string;
  testCaseId: string;
  priority: number;
  createdAt: Date;
}
```

## 7. UI/UX 요구사항

### 7.1 주요 화면
1. **테스트 생성 화면**
   - URL 입력 필드
   - 시나리오 텍스트 영역
   - AI 분석 결과 프리뷰

2. **테스트 실행 화면**
   - 실시간 진행 상황 표시
   - 각 스텝별 상태 인디케이터
   - 스냅샷 미리보기

3. **테스트 이력 화면**
   - 테스트케이스 목록
   - 실행 이력
   - 상세 결과 보기

### 7.2 디자인 원칙
- 최소한의 UI (Tailwind CSS 활용)
- 기능 중심의 인터페이스
- 실시간 피드백 제공

## 8. 개발 로드맵

### Phase 1: MVP (현재)
- [x] 프로젝트 구조 설정
- [ ] 기본 API 서버 구현
- [ ] Worker 프로세스 구현
- [ ] Gemini API 연동
- [ ] MCP Container 연동
- [ ] 기본 UI 구현
- [ ] SSE 실시간 통신
- [ ] 데이터베이스 스키마 구현

### Phase 2: 안정화
- [ ] 에러 처리 및 재시도 로직
- [ ] 테스트 타임아웃 처리
- [ ] 스냅샷 최적화
- [ ] 성능 모니터링

### Phase 3: 확장
- [ ] Google SSO 인증
- [ ] 다중 테스트 동시 실행
- [ ] 테스트 스케줄링
- [ ] 웹훅 알림
- [ ] Safari 지원

## 9. 제약사항 및 가정

### 9.1 기술적 제약
- Chrome 브라우저만 지원 (초기)
- 단일 테스트 실행 (동시 실행 미지원)
- 인증이 필요 없는 공개 웹사이트만 테스트 가능

### 9.2 운영 가정
- 초기에는 스케일링 고려하지 않음
- 데이터 보존 정책 없음 (수동 정리)
- 비용 모니터링 수동 관리

## 10. 성공 지표

### 10.1 기능적 성공 지표
- 자연어 시나리오의 90% 이상 정확한 해석
- 테스트 실행 성공률 95% 이상
- 실시간 상태 업데이트 지연 시간 1초 미만

### 10.2 사용성 지표
- 테스트 작성 시간 기존 대비 70% 단축
- 비기술직 사용자의 테스트 작성 성공률 80% 이상

## 11. 보안 고려사항

### 11.1 현재 단계 (MVP)
- 환경 변수를 통한 API 키 관리
- 내부 네트워크 통신 (MCP Container)
- 공개 접근 (인증 없음)

### 11.2 향후 계획
- Google SSO 도입
- API Rate Limiting
- GitHub Secrets 활용
- 사용자별 리소스 격리

## 12. 부록

### 12.1 용어 정의
- **MCP**: Model Context Protocol
- **E2E**: End-to-End Testing
- **SSE**: Server-Sent Events
- **Worker**: 백그라운드 작업 처리 프로세스

### 12.2 참고 자료
- Playwright MCP Documentation
- Google Gemini API Reference
- Supabase Documentation
- tRPC Documentation