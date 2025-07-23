
// Gemini API 응답 타입
export interface GeminiResponse {
  text: string;
  finishReason?: string;
  safetyRatings?: Array<{
    category: string;
    probability: string;
  }>;
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

// AI 생성 오류 타입
export class GeminiError extends Error {
  constructor(
    message: string,
    public code?: string,
    public context?: any,
    public details?: unknown
  ) {
    super(message);
    this.name = 'GeminiError';
  }
}

// 프롬프트 카테고리
export enum PromptCategory {
  SCENARIO_ANALYSIS = 'scenario_analysis',
  STEP_VALIDATION = 'step_validation',
  ERROR_ANALYSIS = 'error_analysis',
  ADAPTATION_SUGGESTION = 'adaptation_suggestion',
  VERIFICATION_ANALYSIS = 'verification_analysis',
}

// 프롬프트 템플릿 타입
export interface PromptTemplate {
  category: PromptCategory;
  template: string;
  variables: string[];
}

// Gemini 클라이언트 상태
export enum GeminiClientState {
  UNINITIALIZED = 'uninitialized',
  INITIALIZING = 'initializing',
  READY = 'ready',
  ERROR = 'error',
}

// 재시도 옵션
export interface RetryOptions {
  maxRetries: number;
  retryDelay: number;
  backoffMultiplier?: number;
}

// 생성 요청 옵션
export interface GenerateOptions {
  prompt: string;
  category?: PromptCategory;
  temperature?: number;
  maxOutputTokens?: number;
  stopSequences?: string[];
  retry?: Partial<RetryOptions>;
}

// 연결 검증 결과
export interface ConnectionValidationResult {
  success: boolean;
  modelName?: string;
  error?: string;
  latency?: number;
}

// 프롬프트 히스토리 (학습 시스템용)
export interface PromptHistory {
  id: string;
  timestamp: Date;
  category: PromptCategory;
  prompt: string;
  response: string;
  success: boolean;
  usageMetadata?: {
    promptTokens: number;
    responseTokens: number;
    totalTokens: number;
  };
  duration: number; // milliseconds
}