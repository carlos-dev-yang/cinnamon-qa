// Export Gemini client
export { GeminiClient, getGeminiClient } from './gemini/client';
export { loadGeminiConfig, GeminiConfigSchema } from './gemini/config';
export * from './gemini/types';

// Export scenario analysis
export { ScenarioAnalyzer, getScenarioAnalyzer } from './services/scenario-analyzer';
export { ScenarioParser, PartialResultRecovery } from './parsers/scenario-parser';
export * from './prompts/scenario-analysis';

// Export MCP tools integration
export { MCPToolManager, getMCPToolManager, resetMCPToolManager } from './execution/mcp-tool-manager';

// Export adaptive chat session management
export { AdaptiveChatEngine } from './execution/adaptive-chat-engine';
export { ChatSessionManager, getChatSessionManager, resetChatSessionManager } from './execution/chat-session-manager';

// Export feedback loop system
export { FeedbackLoopEngine, getFeedbackLoopEngine, resetFeedbackLoopEngine } from './execution/feedback-loop-engine';
export { ToolExecutionHandler } from './execution/tool-execution-handler';
export { ResultProcessor } from './execution/result-processor';

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
  AnalysisResult,
  AIAnalysisStep,
  StepFeedback,
  VerificationResult,
  AdaptationSuggestion,
  OverallAnalysis,
  PromptContext,
} from './types';

export type {
  TestStep,
  AnalysisMetadata,
  AnalysisResult as ScenarioAnalysisResult,
} from './parsers/scenario-parser';

export type {
  AnalyzeScenarioRequest,
  AnalyzeScenarioResponse,
} from './services/scenario-analyzer';

export type {
  MCPTool,
  GeminiTool,
  MCPToolCall,
  MCPToolResponse,
  MCPConnectionStatus,
  MCPClient,
} from './types/mcp';

export type {
  ChatSession,
  ChatContext,
  AdaptationRecord,
  ToolCallRequest,
} from './execution/adaptive-chat-engine';

export type {
  FeedbackLoopContext,
  ExecutionStep,
  ToolCallExecution,
} from './execution/feedback-loop-engine';

export type {
  ToolExecutionResult,
} from './execution/tool-execution-handler';

export type {
  ProcessedResult,
} from './execution/result-processor';