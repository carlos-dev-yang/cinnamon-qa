import { GoogleGenerativeAI } from '@google/generative-ai';
import { MCPToolManager } from './mcp-tool-manager';
import { createLogger } from '@cinnamon-qa/logger';

const logger = createLogger({ context: 'AdaptiveChatEngine' });

export interface ChatSession {
  id: string;
  geminiSession: any; // Gemini ChatSession
  context: ChatContext;
  startTime: Date;
  lastActivity: Date;
}

export interface ChatContext {
  testCaseId?: string;
  currentStep?: number;
  domState?: any;
  previousActions: string[];
  adaptationHistory: AdaptationRecord[];
}

export interface AdaptationRecord {
  step: number;
  originalAction: string;
  adaptedAction: string;
  reason: string;
  timestamp: Date;
}

export interface ToolCallRequest {
  toolName: string;
  arguments: Record<string, any>;
  requestId: string;
}

export class AdaptiveChatEngine {
  private genAI: GoogleGenerativeAI;
  private toolManager: MCPToolManager;
  private activeSessions: Map<string, ChatSession>;
  private readonly SESSION_TIMEOUT = 30 * 60 * 1000; // 30분
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(apiKey: string, toolManager: MCPToolManager) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.toolManager = toolManager;
    this.activeSessions = new Map();
    
    // 세션 정리 타이머 설정
    this.startSessionCleanup();
    
    logger.info('AdaptiveChatEngine initialized');
  }

  /**
   * 새로운 도구 지원 채팅 세션 생성
   */
  async createToolEnabledSession(context: Partial<ChatContext> = {}): Promise<ChatSession> {
    const sessionId = this.generateSessionId();
    
    try {
      // MCP 도구 목록 가져오기
      const availableTools = await this.toolManager.getAvailableTools();
      
      logger.info('Creating tool-enabled chat session', {
        sessionId,
        toolCount: availableTools.length,
        context
      });

      // Gemini 모델 및 채팅 세션 생성
      const model = this.genAI.getGenerativeModel({
        model: 'gemini-1.5-pro',
        tools: [{ functionDeclarations: availableTools }]
      });

      const geminiSession = model.startChat({
        history: [],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2048,
        }
      });

      const chatSession: ChatSession = {
        id: sessionId,
        geminiSession,
        context: {
          previousActions: [],
          adaptationHistory: [],
          ...context
        },
        startTime: new Date(),
        lastActivity: new Date()
      };

      this.activeSessions.set(sessionId, chatSession);
      
      logger.info('Chat session created successfully', {
        sessionId,
        toolsEnabled: availableTools.length > 0
      });

      return chatSession;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to create chat session', {
        sessionId,
        error: errorMessage
      });
      throw new Error(`채팅 세션 생성 실패: ${errorMessage}`);
    }
  }

  /**
   * 채팅 세션에 메시지 전송 및 응답 처리
   */
  async sendMessage(sessionId: string, message: string): Promise<{
    response: string;
    toolCalls: ToolCallRequest[];
    sessionUpdated: boolean;
  }> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`세션을 찾을 수 없습니다: ${sessionId}`);
    }

    try {
      logger.info('Sending message to chat session', {
        sessionId,
        messageLength: message.length
      });

      // 세션 활동 시간 업데이트
      session.lastActivity = new Date();

      // Gemini에 메시지 전송
      const result = await session.geminiSession.sendMessage(message);
      const response = result.response;

      // 응답에서 도구 호출 파싱
      const toolCalls = this.parseToolCalls(response);
      
      logger.info('Message processed', {
        sessionId,
        responseLength: response.text()?.length || 0,
        toolCallCount: toolCalls.length
      });

      return {
        response: response.text() || '',
        toolCalls,
        sessionUpdated: true
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to send message', {
        sessionId,
        error: errorMessage
      });
      throw error;
    }
  }

  /**
   * AI 응답에서 도구 호출 추출
   */
  private parseToolCalls(response: any): ToolCallRequest[] {
    const toolCalls: ToolCallRequest[] = [];

    try {
      const candidates = response.candidates || [];
      
      for (const candidate of candidates) {
        const content = candidate.content;
        if (!content?.parts) continue;

        for (const part of content.parts) {
          if (part.functionCall) {
            const toolCall: ToolCallRequest = {
              toolName: part.functionCall.name,
              arguments: part.functionCall.args || {},
              requestId: this.generateRequestId()
            };
            toolCalls.push(toolCall);
            
            logger.debug('Tool call parsed', {
              toolName: toolCall.toolName,
              requestId: toolCall.requestId,
              argumentCount: Object.keys(toolCall.arguments).length
            });
          }
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.warn('Failed to parse tool calls', {
        error: errorMessage
      });
    }

    return toolCalls;
  }

  /**
   * 세션 컨텍스트 업데이트
   */
  async updateSessionContext(sessionId: string, contextUpdate: Partial<ChatContext>): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`세션을 찾을 수 없습니다: ${sessionId}`);
    }

    session.context = {
      ...session.context,
      ...contextUpdate
    };
    session.lastActivity = new Date();

    logger.debug('Session context updated', {
      sessionId,
      updateKeys: Object.keys(contextUpdate)
    });
  }

  /**
   * 세션 상태 조회
   */
  getSessionStatus(sessionId: string): {
    exists: boolean;
    context?: ChatContext;
    startTime?: Date;
    lastActivity?: Date;
    isActive: boolean;
  } {
    const session = this.activeSessions.get(sessionId);
    
    if (!session) {
      return { exists: false, isActive: false };
    }

    const isActive = Date.now() - session.lastActivity.getTime() < this.SESSION_TIMEOUT;

    return {
      exists: true,
      context: session.context,
      startTime: session.startTime,
      lastActivity: session.lastActivity,
      isActive
    };
  }

  /**
   * 세션 종료
   */
  async terminateSession(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      logger.warn('Attempted to terminate non-existent session', { sessionId });
      return;
    }

    this.activeSessions.delete(sessionId);
    
    logger.info('Session terminated', {
      sessionId,
      duration: Date.now() - session.startTime.getTime()
    });
  }

  /**
   * 활성 세션 목록 조회
   */
  getActiveSessions(): string[] {
    return Array.from(this.activeSessions.keys());
  }

  /**
   * 유니크 세션 ID 생성
   */
  private generateSessionId(): string {
    return `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 유니크 요청 ID 생성
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  /**
   * 만료된 세션 정리
   */
  private startSessionCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const expiredSessions: string[] = [];

      for (const [sessionId, session] of this.activeSessions.entries()) {
        if (now - session.lastActivity.getTime() > this.SESSION_TIMEOUT) {
          expiredSessions.push(sessionId);
        }
      }

      for (const sessionId of expiredSessions) {
        this.terminateSession(sessionId);
        logger.info('Expired session cleaned up', { sessionId });
      }

      if (expiredSessions.length > 0) {
        logger.info('Session cleanup completed', {
          cleanedCount: expiredSessions.length,
          remainingCount: this.activeSessions.size
        });
      }
    }, 5 * 60 * 1000); // 5분마다 정리
  }

  /**
   * 리소스 정리
   */
  async dispose(): Promise<void> {
    logger.info('Disposing AdaptiveChatEngine', {
      activeSessions: this.activeSessions.size
    });

    // 정리 타이머 해제
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // 모든 활성 세션 종료
    const sessionIds = Array.from(this.activeSessions.keys());
    for (const sessionId of sessionIds) {
      await this.terminateSession(sessionId);
    }

    this.activeSessions.clear();
  }
}