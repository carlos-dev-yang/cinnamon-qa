// Export Gemini client
export { GeminiClient, getGeminiClient } from './gemini/client';
export { loadGeminiConfig, GeminiConfigSchema } from './gemini/config';
export * from './gemini/types';

// Export AI types
export * from './types';

// Re-export commonly used types for convenience
export type {
  GeminiResponse,
  GeminiError,
  PromptCategory,
  GenerateOptions,
  ConnectionValidationResult,
  PromptHistory,
} from './gemini/types';

export type { GeminiConfig } from './gemini/config';

export type {
  MCPTool,
  MCPResponse,
  AnalysisResult,
  AIAnalysisStep,
  StepFeedback,
  VerificationResult,
  AdaptationSuggestion,
  OverallAnalysis,
  PromptContext,
} from './types';