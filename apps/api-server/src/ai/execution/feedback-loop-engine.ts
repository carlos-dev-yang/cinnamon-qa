import { getChatSessionManager } from './chat-session-manager';
import { ToolExecutionHandler, ToolExecutionResult } from './tool-execution-handler';
import { ResultProcessor, ProcessedResult } from './result-processor';
import { ToolCallRequest } from './adaptive-chat-engine';
import { createLogger } from '@cinnamon-qa/logger';

const logger = createLogger({ context: 'FeedbackLoopEngine' });

export interface FeedbackLoopContext {
  sessionId: string;
  testCaseId: string;
  currentObjective: string;
  executionHistory: ExecutionStep[];
  maxSteps: number;
  currentStep: number;
}

export interface ExecutionStep {
  stepNumber: number;
  aiDecision: string;
  toolCall?: ToolCallExecution;
  result?: ToolExecutionResult;
  processedResult?: ProcessedResult;
  aiResponse: string;
  timestamp: Date;
  success: boolean;
}

export interface ToolCallExecution {
  toolName: string;
  parameters: Record<string, any>;
  requestId: string;
}

export class FeedbackLoopEngine {
  private toolExecutionHandler: ToolExecutionHandler;
  private resultProcessor: ResultProcessor;
  private activeLoops: Map<string, FeedbackLoopContext>;

  constructor() {
    this.toolExecutionHandler = new ToolExecutionHandler();
    this.resultProcessor = new ResultProcessor();
    this.activeLoops = new Map();
    
    logger.info('FeedbackLoopEngine initialized');
  }

  /**
   * 새로운 피드백 루프 시작
   */
  async startFeedbackLoop(params: {
    testCaseId: string;
    objective: string;
    maxSteps?: number;
  }): Promise<string> {
    const sessionManager = getChatSessionManager();
    
    // 새로운 채팅 세션 생성
    const sessionId = await sessionManager.createTestSession(params.testCaseId);
    
    const context: FeedbackLoopContext = {
      sessionId,
      testCaseId: params.testCaseId,
      currentObjective: params.objective,
      executionHistory: [],
      maxSteps: params.maxSteps || 10,
      currentStep: 0
    };

    this.activeLoops.set(sessionId, context);
    
    logger.info('Feedback loop started', {
      sessionId,
      testCaseId: params.testCaseId,
      objective: params.objective
    });

    return sessionId;
  }

  /**
   * 단일 피드백 사이클 실행
   */
  async executeSingleCycle(sessionId: string): Promise<{
    step: ExecutionStep;
    completed: boolean;
    shouldContinue: boolean;
  }> {
    const context = this.activeLoops.get(sessionId);
    if (!context) {
      throw new Error(`Active feedback loop not found: ${sessionId}`);
    }

    const sessionManager = getChatSessionManager();
    context.currentStep++;

    logger.info('Executing feedback cycle', {
      sessionId,
      step: context.currentStep,
      objective: context.currentObjective
    });

    try {
      // 1. AI 의사결정 단계
      const aiDecision = await this.requestAIDecision(sessionId, context);
      
      // 2. 도구 실행 단계 (AI가 도구 호출을 요청한 경우)
      let toolExecution: ToolCallExecution | undefined;
      let executionResult: ToolExecutionResult | undefined;
      let processedResult: ProcessedResult | undefined;
      
      if (aiDecision.toolCalls && aiDecision.toolCalls.length > 0) {
        const toolCall = aiDecision.toolCalls[0]; // 첫 번째 도구 호출만 처리
        toolExecution = {
          toolName: toolCall.toolName,
          parameters: toolCall.arguments,
          requestId: toolCall.requestId
        };
        
        // 도구 실행
        executionResult = await this.toolExecutionHandler.executeToolCall(toolCall);
        
        // 결과 처리
        processedResult = await this.resultProcessor.processResult(executionResult);
      }

      // 3. 결과 피드백을 AI에게 전달
      const aiResponse = await this.provideFeedbackToAI(
        sessionId, 
        toolExecution, 
        processedResult
      );

      // 4. 실행 단계 기록
      const step: ExecutionStep = {
        stepNumber: context.currentStep,
        aiDecision: aiDecision.response,
        toolCall: toolExecution,
        result: executionResult,
        processedResult,
        aiResponse: aiResponse.response,
        timestamp: new Date(),
        success: !executionResult || executionResult.success
      };

      context.executionHistory.push(step);

      // 5. 완료 조건 확인
      const completed = this.checkCompletionConditions(context, step);
      const shouldContinue = !completed && context.currentStep < context.maxSteps;

      logger.info('Feedback cycle completed', {
        sessionId,
        step: context.currentStep,
        success: step.success,
        completed,
        shouldContinue
      });

      return { step, completed, shouldContinue };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Feedback cycle failed', {
        sessionId,
        step: context.currentStep,
        error: errorMessage
      });
      throw error;
    }
  }

  /**
   * 완전한 피드백 루프 실행 (여러 사이클)
   */
  async executeCompleteFeedbackLoop(sessionId: string): Promise<{
    totalSteps: number;
    success: boolean;
    finalResult: string;
    executionHistory: ExecutionStep[];
  }> {
    const context = this.activeLoops.get(sessionId);
    if (!context) {
      throw new Error(`Active feedback loop not found: ${sessionId}`);
    }

    logger.info('Starting complete feedback loop execution', {
      sessionId,
      objective: context.currentObjective,
      maxSteps: context.maxSteps
    });

    let shouldContinue = true;
    let completed = false;

    while (shouldContinue) {
      const cycleResult = await this.executeSingleCycle(sessionId);
      completed = cycleResult.completed;
      shouldContinue = cycleResult.shouldContinue;

      if (!shouldContinue) {
        logger.info('Feedback loop stopping', {
          sessionId,
          reason: completed ? 'objective completed' : 'max steps reached',
          totalSteps: context.currentStep
        });
        break;
      }

      // 짧은 대기 시간 (도구 실행 간격)
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const finalResult = completed ? 
      'Objective successfully completed' : 
      'Maximum steps reached without completion';

    return {
      totalSteps: context.currentStep,
      success: completed,
      finalResult,
      executionHistory: context.executionHistory
    };
  }

  /**
   * AI에게 의사결정 요청
   */
  private async requestAIDecision(sessionId: string, context: FeedbackLoopContext) {
    const sessionManager = getChatSessionManager();
    
    const prompt = this.buildDecisionPrompt(context);
    return await sessionManager.sendMessage(sessionId, prompt);
  }

  /**
   * AI에게 실행 결과 피드백 제공
   */
  private async provideFeedbackToAI(
    sessionId: string,
    toolExecution?: ToolCallExecution,
    processedResult?: ProcessedResult
  ) {
    const sessionManager = getChatSessionManager();
    
    if (!toolExecution || !processedResult) {
      return await sessionManager.sendMessage(sessionId, 
        'Please continue with the next step based on your previous decision.');
    }

    const feedbackPrompt = this.resultProcessor.formatForAIFeedback(processedResult);
    return await sessionManager.sendMessage(sessionId, feedbackPrompt);
  }

  /**
   * 의사결정 프롬프트 구성
   */
  private buildDecisionPrompt(context: FeedbackLoopContext): string {
    const historyText = context.executionHistory.length > 0 ? 
      context.executionHistory.map(step => {
        const status = step.success ? 'SUCCESS' : 'FAILED';
        const toolInfo = step.toolCall ? ` (${step.toolCall.toolName})` : '';
        return `Step ${step.stepNumber}: ${step.aiDecision}${toolInfo} -> ${status}`;
      }).join('\n') : 'No previous steps.';

    return `
Current Objective: ${context.currentObjective}

Previous Execution History:
${historyText}

Current Step: ${context.currentStep + 1} / ${context.maxSteps}

Based on the objective and execution history, what is the next action you should take?
If you need to use a tool, please specify which tool and with what parameters.
If the objective is already achieved, please state "OBJECTIVE_COMPLETED".

Important: Be specific and actionable in your response.
`;
  }

  /**
   * 완료 조건 확인
   */
  private checkCompletionConditions(context: FeedbackLoopContext, step: ExecutionStep): boolean {
    // AI가 명시적으로 완료를 선언한 경우
    if (step.aiResponse.includes('OBJECTIVE_COMPLETED') || 
        step.aiDecision.includes('OBJECTIVE_COMPLETED')) {
      return true;
    }

    // 연속 실패가 많은 경우 (최근 3스텝이 모두 실패)
    if (context.executionHistory.length >= 3) {
      const recentSteps = context.executionHistory.slice(-3);
      if (recentSteps.every(s => !s.success)) {
        logger.warn('Multiple consecutive failures detected', {
          sessionId: context.sessionId,
          recentFailures: recentSteps.length
        });
        return true;
      }
    }

    return false;
  }

  /**
   * 피드백 루프 상태 조회
   */
  getFeedbackLoopStatus(sessionId: string): FeedbackLoopContext | null {
    return this.activeLoops.get(sessionId) || null;
  }

  /**
   * 피드백 루프 종료
   */
  async terminateFeedbackLoop(sessionId: string): Promise<void> {
    const context = this.activeLoops.get(sessionId);
    if (!context) return;

    const sessionManager = getChatSessionManager();
    await sessionManager.terminateSession(sessionId);
    
    this.activeLoops.delete(sessionId);
    
    logger.info('Feedback loop terminated', {
      sessionId,
      totalSteps: context.currentStep,
      testCaseId: context.testCaseId
    });
  }

  /**
   * 모든 활성 피드백 루프 조회
   */
  getActiveLoops(): string[] {
    return Array.from(this.activeLoops.keys());
  }

  /**
   * 실행 통계 생성
   */
  generateExecutionStats(sessionId: string): {
    totalSteps: number;
    successRate: number;
    averageExecutionTime: number;
    toolUsage: Record<string, number>;
  } | null {
    const context = this.activeLoops.get(sessionId);
    if (!context) return null;

    const totalSteps = context.executionHistory.length;
    const successfulSteps = context.executionHistory.filter(s => s.success).length;
    const successRate = totalSteps > 0 ? (successfulSteps / totalSteps) * 100 : 0;

    const executionTimes = context.executionHistory
      .filter(s => s.result?.metadata?.executionTime)
      .map(s => s.result!.metadata!.executionTime);
    const averageExecutionTime = executionTimes.length > 0 ? 
      executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length : 0;

    const toolUsage = context.executionHistory
      .filter(s => s.toolCall)
      .reduce((acc, step) => {
        const toolName = step.toolCall!.toolName;
        acc[toolName] = (acc[toolName] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    return {
      totalSteps,
      successRate: Math.round(successRate * 100) / 100,
      averageExecutionTime: Math.round(averageExecutionTime),
      toolUsage
    };
  }

  /**
   * 리소스 정리
   */
  async dispose(): Promise<void> {
    logger.info('Disposing FeedbackLoopEngine', {
      activeLoops: this.activeLoops.size
    });

    const sessionIds = Array.from(this.activeLoops.keys());
    for (const sessionId of sessionIds) {
      await this.terminateFeedbackLoop(sessionId);
    }

    this.activeLoops.clear();
  }
}

// 싱글톤 인스턴스 관리
let feedbackLoopEngineInstance: FeedbackLoopEngine | null = null;

/**
 * FeedbackLoopEngine 싱글톤 인스턴스 반환
 */
export function getFeedbackLoopEngine(): FeedbackLoopEngine {
  if (!feedbackLoopEngineInstance) {
    feedbackLoopEngineInstance = new FeedbackLoopEngine();
  }
  return feedbackLoopEngineInstance;
}

/**
 * 싱글톤 인스턴스 해제 (테스트용)
 */
export function resetFeedbackLoopEngine(): void {
  if (feedbackLoopEngineInstance) {
    feedbackLoopEngineInstance.dispose();
    feedbackLoopEngineInstance = null;
    logger.info('FeedbackLoopEngine singleton instance reset');
  }
}