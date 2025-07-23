import { z } from 'zod';

// MCP 도구 타입
export const MCPToolSchema = z.object({
  name: z.string(),
  description: z.string(),
  parameters: z.record(z.string(), z.object({
    type: z.string(),
    description: z.string(),
    required: z.boolean().optional(),
    default: z.any().optional(),
  })),
});

export type MCPTool = z.infer<typeof MCPToolSchema>;

// MCP 응답 타입
export const MCPResponseSchema = z.object({
  success: z.boolean(),
  result: z.any().optional(),
  error: z.object({
    type: z.string(),
    message: z.string(),
    timeout: z.number().optional(),
  }).optional(),
  pageState: z.object({
    url: z.string(),
    html: z.string(),
    title: z.string(),
  }).optional(),
  timestamp: z.string(),
});

export type MCPResponse = z.infer<typeof MCPResponseSchema>;

// AI 분석 결과 타입
export const AIAnalysisStepSchema = z.object({
  id: z.string(),
  description: z.string(),
  tool: z.string(),
  parameters: z.record(z.string(), z.any()),
  expectedOutcome: z.string(),
  confidence: z.number().min(0).max(1),
});

export const AnalysisResultSchema = z.object({
  steps: z.array(AIAnalysisStepSchema),
  overallConfidence: z.number().min(0).max(1).optional(),
  warnings: z.array(z.string()).optional(),
});

export type AIAnalysisStep = z.infer<typeof AIAnalysisStepSchema>;
export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;

// 스텝 피드백 타입
export const StepFeedbackSchema = z.object({
  stepSuccess: z.boolean(),
  confidence: z.number().min(0).max(1),
  analysis: z.string(),
  nextStepRecommendation: z.string().optional(),
  adaptationNeeded: z.boolean(),
  adaptedStep: AIAnalysisStepSchema.optional(),
  reasonForAdaptation: z.string().optional(),
});

export type StepFeedback = z.infer<typeof StepFeedbackSchema>;

// 텍스트 검증 타입
export const TextVerificationParamsSchema = z.object({
  step: AIAnalysisStepSchema,
  mcpResponse: MCPResponseSchema,
  expectedContent: z.string(),
  verificationType: z.enum(['product-name', 'price', 'text-content', 'custom']),
});

export const VerificationResultSchema = z.object({
  verificationSuccess: z.boolean(),
  confidence: z.number().min(0).max(1),
  analysis: z.string(),
  extractedValue: z.string(),
  expectedValue: z.string(),
  matchingKeywords: z.array(z.string()).optional(),
  verificationPassed: z.boolean(),
  reason: z.string().optional(),
});

export type TextVerificationParams = z.infer<typeof TextVerificationParamsSchema>;
export type VerificationResult = z.infer<typeof VerificationResultSchema>;

// 적응 제안 타입
export const AdaptationSuggestionSchema = z.object({
  originalStep: AIAnalysisStepSchema,
  suggestedStep: AIAnalysisStepSchema,
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  alternativeApproaches: z.array(z.object({
    approach: z.string(),
    confidence: z.number().min(0).max(1),
  })).optional(),
});

export type AdaptationSuggestion = z.infer<typeof AdaptationSuggestionSchema>;

// 전체 실행 분석 타입
export const FinalAnalysisParamsSchema = z.object({
  scenario: z.string(),
  executedSteps: z.array(AIAnalysisStepSchema),
  stepFeedbacks: z.array(StepFeedbackSchema),
  adaptations: z.array(z.object({
    originalStep: AIAnalysisStepSchema,
    adaptedStep: AIAnalysisStepSchema,
    success: z.boolean(),
  })),
});

export const OverallAnalysisSchema = z.object({
  overallSuccess: z.boolean(),
  successRate: z.number().min(0).max(1),
  totalSteps: z.number(),
  successfulSteps: z.number(),
  failedSteps: z.number(),
  adaptationCount: z.number(),
  adaptationSuccessRate: z.number().min(0).max(1),
  keyInsights: z.array(z.string()),
  recommendations: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

export type FinalAnalysisParams = z.infer<typeof FinalAnalysisParamsSchema>;
export type OverallAnalysis = z.infer<typeof OverallAnalysisSchema>;

// 프롬프트 컨텍스트 타입
export interface PromptContext {
  availableTools?: MCPTool[];
  pageState?: string;
  previousSteps?: AIAnalysisStep[];
  executionHistory?: StepFeedback[];
  siteContext?: {
    url: string;
    domain: string;
    pageType?: string;
  };
}