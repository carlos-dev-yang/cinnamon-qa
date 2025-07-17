import { AdaptiveChatEngine, ChatSession, ChatContext } from './adaptive-chat-engine';
import { getMCPToolManager } from './mcp-tool-manager';
import { loadGeminiConfig } from '../gemini/config';
import { createLogger } from '@cinnamon-qa/logger';

const logger = createLogger({ context: 'ChatSessionManager' });

/**
 * 채팅 세션 생명주기 관리
 */
export class ChatSessionManager {
  private chatEngine: AdaptiveChatEngine | null = null;
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      logger.info('Initializing ChatSessionManager');

      // Gemini 설정 로드
      const config = loadGeminiConfig();
      
      // MCP 도구 관리자 가져오기
      const toolManager = getMCPToolManager();
      
      // 채팅 엔진 초기화
      this.chatEngine = new AdaptiveChatEngine(config.apiKey, toolManager);
      
      this.initialized = true;
      logger.info('ChatSessionManager initialized successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to initialize ChatSessionManager', {
        error: errorMessage
      });
      throw error;
    }
  }

  /**
   * 테스트 실행용 채팅 세션 생성
   */
  async createTestSession(testCaseId: string): Promise<string> {
    await this.ensureInitialized();

    const context: Partial<ChatContext> = {
      testCaseId,
      currentStep: 0,
      previousActions: [],
      adaptationHistory: []
    };

    const session = await this.chatEngine!.createToolEnabledSession(context);
    
    logger.info('Test session created', {
      sessionId: session.id,
      testCaseId
    });

    return session.id;
  }

  /**
   * 시나리오 분석용 채팅 세션 생성
   */
  async createAnalysisSession(): Promise<string> {
    await this.ensureInitialized();

    const session = await this.chatEngine!.createToolEnabledSession();
    
    logger.info('Analysis session created', {
      sessionId: session.id
    });

    return session.id;
  }

  /**
   * 메시지 전송
   */
  async sendMessage(sessionId: string, message: string) {
    await this.ensureInitialized();
    return this.chatEngine!.sendMessage(sessionId, message);
  }

  /**
   * 세션 컨텍스트 업데이트
   */
  async updateContext(sessionId: string, context: Partial<ChatContext>): Promise<void> {
    await this.ensureInitialized();
    return this.chatEngine!.updateSessionContext(sessionId, context);
  }

  /**
   * 세션 상태 조회
   */
  async getSessionStatus(sessionId: string) {
    await this.ensureInitialized();
    return this.chatEngine!.getSessionStatus(sessionId);
  }

  /**
   * 세션 종료
   */
  async terminateSession(sessionId: string): Promise<void> {
    await this.ensureInitialized();
    return this.chatEngine!.terminateSession(sessionId);
  }

  /**
   * 활성 세션 목록 조회
   */
  async getActiveSessions(): Promise<string[]> {
    await this.ensureInitialized();
    return this.chatEngine!.getActiveSessions();
  }

  /**
   * 초기화 확인
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * 리소스 정리
   */
  async dispose(): Promise<void> {
    if (this.chatEngine) {
      await this.chatEngine.dispose();
      this.chatEngine = null;
    }
    this.initialized = false;
    
    logger.info('ChatSessionManager disposed');
  }
}

// 싱글톤 인스턴스
let sessionManagerInstance: ChatSessionManager | null = null;

/**
 * ChatSessionManager 싱글톤 인스턴스 반환
 */
export function getChatSessionManager(): ChatSessionManager {
  if (!sessionManagerInstance) {
    sessionManagerInstance = new ChatSessionManager();
  }
  return sessionManagerInstance;
}

/**
 * 싱글톤 인스턴스 해제 (테스트용)
 */
export function resetChatSessionManager(): void {
  if (sessionManagerInstance) {
    sessionManagerInstance.dispose();
    sessionManagerInstance = null;
    logger.info('ChatSessionManager singleton instance reset');
  }
}