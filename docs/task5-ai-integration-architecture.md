# Task 5: Google Gemini AI Integration Architecture

## 🎯 개요

Google Gemini API를 통합하여 자연어 테스트 시나리오를 구조화된 테스트 스텝으로 변환하고, MCP(Model Context Protocol)를 통해 적응형 테스트 실행을 수행하는 시스템.

## 🏗️ 전체 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                    Cinnamon QA System                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────┐  │
│  │   Frontend      │◄──►│   API Server    │◄──►│ Gemini AI   │  │
│  │   (React)       │    │   (Fastify)     │    │ Service     │  │
│  └─────────────────┘    └─────────────────┘    └─────────────┘  │
│                                 │                               │
│                                 ▼                               │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────┐  │
│  │   Database      │◄──►│  Container Pool │◄──►│ Playwright  │  │
│  │   (Supabase)    │    │   Management    │    │ Containers  │  │
│  └─────────────────┘    └─────────────────┘    └─────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 📁 디렉토리 구조

```
apps/api-server/src/
├── ai/                          # 🆕 AI 관련 모듈
│   ├── gemini/                  # Google Gemini 클라이언트
│   │   ├── client.ts            # Gemini API 클라이언트
│   │   ├── config.ts            # API 설정 및 인증
│   │   └── types.ts             # Gemini 전용 타입
│   ├── scenarios/               # 시나리오 분석 엔진
│   │   ├── analyzer.ts          # 자연어 → 구조화된 스텝 변환
│   │   ├── prompts.ts           # 프롬프트 템플릿
│   │   └── parser.ts            # AI 응답 파싱
│   ├── validation/              # 신뢰도 & 검증 시스템
│   │   ├── confidence.ts        # 신뢰도 점수 계산
│   │   ├── validator.ts         # 스텝 실행 가능성 검증
│   │   └── thresholds.ts        # 임계값 관리
│   ├── execution/               # 적응형 실행 로직
│   │   ├── pipeline.ts          # 실행 파이프라인
│   │   ├── adapter.ts           # 실시간 적응 로직
│   │   └── rollback.ts          # 실패 시 롤백
│   └── learning/                # 학습 및 피드백 시스템
│       ├── collector.ts         # 피드백 수집
│       ├── patterns.ts          # 패턴 인식
│       └── recommender.ts       # 추천 엔진
├── trpc/routers/
│   └── ai.ts                    # 🆕 AI 기능 tRPC 라우터
└── types/
    └── ai.ts                    # 🆕 AI 관련 타입 정의
```

## 🧩 핵심 컴포넌트

### 1. Gemini Client (5.1)

```typescript
interface GeminiClient {
  // API 클라이언트 초기화
  initialize(apiKey: string): Promise<void>
  
  // MCP 도구 정보와 함께 시나리오 분석
  analyzeScenarioWithTools(prompt: string): Promise<AnalysisResult>
  
  // 스텝 실행 결과 분석
  analyzeStepResult(step: TestStep, mcpResponse: MCPResponse): Promise<StepFeedback>
  
  // 텍스트 검증 분석
  analyzeTextVerification(params: TextVerificationParams): Promise<VerificationResult>
  
  // 적응 제안
  suggestAdaptation(failedStep: TestStep, error: string, pageState: string): Promise<AdaptationSuggestion>
  
  // 최종 결과 종합 분석
  analyzeFinalResults(params: FinalAnalysisParams): Promise<OverallAnalysis>
}
```

### 2. Scenario Analyzer (5.2)

```typescript
interface ScenarioAnalyzer {
  // MCP 도구 목록을 포함한 자연어 분석
  parseScenarioWithTools(naturalLanguage: string, availableTools: MCPTool[]): Promise<ParsedScenario>
  
  // 스텝 세분화 및 최적화
  optimizeSteps(steps: TestStep[]): Promise<TestStep[]>
  
  // 컨텍스트 이해 및 추론
  inferContext(scenario: string): Promise<ScenarioContext>
}
```

### 3. Confidence & Validation System (5.3)

```typescript
interface ConfidenceValidator {
  // 신뢰도 점수 계산
  calculateConfidence(step: TestStep, aiResponse: any): number
  
  // 실행 가능성 검증
  validateExecutability(step: TestStep): ValidationResult
  
  // 임계값 기반 의사결정
  shouldExecute(confidence: number, threshold: number): boolean
  
  // MCP 응답 성공/실패 판단
  analyzeMCPResponse(mcpResponse: MCPResponse, expectedOutcome: string): ResponseAnalysis
}
```

### 4. Adaptive Execution Pipeline (5.4)

```typescript
interface AdaptiveExecutor {
  // MCP 도구 정보 수집
  getMCPTools(connection: MCPConnection): Promise<MCPTool[]>
  
  // AI 기반 사전 검증
  preValidateWithAI(step: TestStep, pageState: string): Promise<ValidationResult>
  
  // 실시간 적응 실행
  executeWithAdaptation(step: TestStep, mcpConnection: MCPConnection): Promise<ExecutionResult>
  
  // 실패 시 AI 기반 롤백
  rollbackWithAI(failedStep: TestStep, mcpConnection: MCPConnection): Promise<void>
}
```

### 5. Learning System (5.5)

```typescript
interface LearningSystem {
  // 적응 기록
  recordAdaptation(adaptation: AdaptationRecord): Promise<void>
  
  // 포괄적 피드백 수집
  collectComprehensiveFeedback(feedback: ComprehensiveFeedback): Promise<void>
  
  // 패턴 인식 및 학습
  learnFromPatterns(): Promise<LearnedPatterns>
  
  // MCP 도구 효과성 분석
  analyzeMCPToolEffectiveness(toolUsage: ToolUsageRecord[]): Promise<ToolEffectivenessReport>
  
  // 추천 엔진
  recommend(scenario: string, siteContext: string): Promise<Recommendation[]>
}
```

## 🔌 API 통합 포인트

### 새로운 tRPC 라우터: `/trpc/ai`

```typescript
export const aiRouter = router({
  // 도구 기반 시나리오 분석
  analyzeScenarioWithTools: publicProcedure
    .input(z.object({ 
      scenario: z.string(),
      availableTools: z.array(MCPToolSchema)
    }))
    .mutation(async ({ input }) => { /* ... */ }),
  
  // 스텝 실행 결과 분석
  analyzeStepResult: publicProcedure
    .input(z.object({ 
      step: TestStepSchema,
      mcpResponse: MCPResponseSchema,
      expectedOutcome: z.string()
    }))
    .mutation(async ({ input }) => { /* ... */ }),
  
  // 텍스트 검증 분석
  analyzeTextVerification: publicProcedure
    .input(z.object({
      step: TestStepSchema,
      mcpResponse: MCPResponseSchema,
      expectedContent: z.string(),
      verificationType: z.enum(['product-name', 'price', 'text-content'])
    }))
    .mutation(async ({ input }) => { /* ... */ }),
  
  // 적응 제안
  suggestAdaptation: publicProcedure
    .input(z.object({ 
      failedStep: TestStepSchema, 
      error: z.string(),
      pageState: z.string()
    }))
    .mutation(async ({ input }) => { /* ... */ }),
  
  // 최종 결과 분석
  analyzeFinalResults: publicProcedure
    .input(z.object({
      scenario: z.string(),
      executedSteps: z.array(TestStepSchema),
      stepFeedbacks: z.array(StepFeedbackSchema),
      adaptations: z.array(AdaptationRecordSchema)
    }))
    .mutation(async ({ input }) => { /* ... */ }),
  
  // 학습 피드백 제출
  submitComprehensiveFeedback: publicProcedure
    .input(ComprehensiveFeedbackSchema)
    .mutation(async ({ input }) => { /* ... */ })
});
```

## 📊 주요 타입 정의

### MCP 관련 타입

```typescript
interface MCPTool {
  name: string;
  description: string;
  parameters: Record<string, {
    type: string;
    description: string;
    required?: boolean;
  }>;
}

interface MCPResponse {
  success: boolean;
  result?: any;
  error?: {
    type: string;
    message: string;
    timeout?: number;
  };
  pageState?: {
    url: string;
    html: string;
    title: string;
  };
  timestamp: string;
}
```

### AI 분석 관련 타입

```typescript
interface AnalysisResult {
  steps: Array<{
    id: string;
    description: string;
    tool: string;
    parameters: Record<string, any>;
    expectedOutcome: string;
    confidence: number;
  }>;
}

interface StepFeedback {
  stepSuccess: boolean;
  confidence: number;
  analysis: string;
  nextStepRecommendation?: string;
  adaptationNeeded: boolean;
  adaptedStep?: TestStep;
  reasonForAdaptation?: string;
}

interface VerificationResult {
  verificationSuccess: boolean;
  confidence: number;
  analysis: string;
  extractedValue: string;
  expectedValue: string;
  matchingKeywords?: string[];
  verificationPassed: boolean;
  reason?: string;
}
```

### 학습 시스템 타입

```typescript
interface ComprehensiveFeedback {
  scenario: string;
  aiGeneratedPlan: AnalysisResult;
  executionResults: {
    totalSteps: number;
    successfulSteps: number;
    failedSteps: number;
    adaptations: number;
    verificationResults: Record<string, VerificationResult>;
  };
  overallSuccess: boolean;
  failureReason?: string;
  mcpToolEffectiveness: Record<string, {
    successRate: number;
    avgResponseTime: number;
  }>;
}

interface AdaptationRecord {
  originalStep: TestStep;
  adaptedStep: TestStep;
  success: boolean;
  context: {
    url: string;
    sitePattern: string;
    timestamp: string;
  };
}
```

## 🔧 환경 설정

```env
# .env
GOOGLE_GEMINI_API_KEY=your_gemini_api_key
AI_CONFIDENCE_THRESHOLD=0.8
AI_MAX_RETRIES=3
AI_LEARNING_ENABLED=true
MCP_CONNECTION_TIMEOUT=30000
MCP_TOOL_DISCOVERY_ENABLED=true
```

## 🎯 예상 결과물

완성 후에는 다음과 같은 기능을 제공합니다:

1. **자연어 시나리오 입력**: "온라인 쇼핑몰에서 상품을 검색하고 장바구니에 담기"
2. **AI 기반 스텝 생성**: MCP 도구를 활용한 구체적인 실행 계획 수립
3. **실시간 적응**: 실행 중 문제 발생 시 AI가 페이지 상태를 분석하여 즉시 대안 제시
4. **지능형 검증**: 텍스트 추출 결과를 의미론적으로 분석하여 정확한 검증 수행
5. **지속적 학습**: 성공/실패 패턴을 학습하여 향후 테스트의 정확도 향상

## 🔄 다음 단계

1. **Subtask 5.1**: Google Gemini API 클라이언트 설정
2. **Subtask 5.2**: MCP 도구 기반 시나리오 분석 엔진 구현
3. **Subtask 5.3**: 신뢰도 점수 및 검증 시스템 구축
4. **Subtask 5.4**: 적응형 실행 로직 및 피드백 루프 구현
5. **Subtask 5.5**: 학습 시스템 및 패턴 인식 엔진 구현