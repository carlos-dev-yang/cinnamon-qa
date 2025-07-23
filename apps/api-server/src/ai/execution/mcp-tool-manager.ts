import { createLogger } from '@cinnamon-qa/logger';
import { 
  MCPClient, 
  MCPTool, 
  GeminiTool, 
  MCPConnectionStatus,
  MCPToolListResponse,
  MCPToolCall,
  MCPToolResponse 
} from '../types/mcp';

const logger = createLogger({ context: 'MCPToolManager' });

/**
 * MCP와 AI 간의 도구 관리를 담당하는 클래스
 * MCP에서 도구 목록을 가져와 Gemini 형식으로 변환하고 캐싱
 */
export class MCPToolManager {
  private mcpClient: MCPClient;
  private toolsCache: Map<string, GeminiTool>;
  private lastFetchTime: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5분

  constructor(mcpClient: MCPClient) {
    this.mcpClient = mcpClient;
    this.toolsCache = new Map();
    
    logger.info('MCPToolManager initialized');
  }

  /**
   * MCP에서 도구 목록을 가져와 Gemini 형식으로 변환
   */
  async getAvailableTools(): Promise<GeminiTool[]> {
    try {
      // 캐시 확인
      if (this.isCacheValid()) {
        logger.debug('Using cached tools', { 
          toolCount: this.toolsCache.size 
        });
        return Array.from(this.toolsCache.values());
      }

      logger.info('Fetching tools from MCP');

      // MCP에서 도구 목록 요청
      const toolsResponse: MCPToolListResponse = await this.mcpClient.request({
        method: 'tools/list'
      });

      const mcpTools = toolsResponse.tools || [];
      
      logger.info('Fetched tools from MCP', { 
        toolCount: mcpTools.length,
        toolNames: mcpTools.map(t => t.name)
      });

      // Gemini 형식으로 변환
      const geminiTools = this.convertToGeminiFormat(mcpTools);
      
      // 캐시 업데이트
      this.updateCache(geminiTools);

      return geminiTools;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to fetch MCP tools', { error: errorMessage });
      throw new Error(`MCP 도구 목록 조회 실패: ${errorMessage}`);
    }
  }

  /**
   * MCP 도구를 Gemini 형식으로 변환
   */
  private convertToGeminiFormat(mcpTools: MCPTool[]): GeminiTool[] {
    logger.debug('Converting MCP tools to Gemini format', { 
      toolCount: mcpTools.length 
    });

    return mcpTools.map(tool => {
      const geminiTool: GeminiTool = {
        name: tool.name,
        description: tool.description || `MCP 도구: ${tool.name}`,
        parameters: {
          type: 'object' as const,
          properties: tool.inputSchema?.properties || {},
          required: tool.inputSchema?.required || []
        }
      };

      logger.debug('Converted tool', {
        original: tool.name,
        converted: geminiTool.name,
        hasProperties: Object.keys(geminiTool.parameters.properties).length > 0,
        requiredCount: geminiTool.parameters.required.length
      });

      return geminiTool;
    });
  }

  /**
   * 특정 도구의 상세 정보 조회
   */
  async getToolDetails(toolName: string): Promise<GeminiTool | null> {
    const tools = await this.getAvailableTools();
    const tool = tools.find(tool => tool.name === toolName) || null;
    
    logger.debug('Tool details requested', { 
      toolName, 
      found: tool !== null 
    });
    
    return tool;
  }

  /**
   * 도구 호출 테스트 (기본 검증용)
   */
  async testToolCall(toolName: string, parameters: Record<string, any>): Promise<MCPToolResponse> {
    logger.info('Testing tool call', { toolName, parameters });
    
    try {
      const response = await this.mcpClient.callTool({
        name: toolName,
        arguments: parameters
      });

      logger.info('Tool call test completed', { 
        toolName, 
        success: !response.isError,
        hasContent: !!response.content
      });

      return response;
    } catch (error) {
      logger.error('Tool call test failed', { 
        toolName, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  /**
   * 실제 도구 호출 (피드백 루프에서 사용)
   */
  async callTool(toolCall: MCPToolCall): Promise<MCPToolResponse> {
    logger.debug('Executing tool call', {
      toolName: toolCall.name,
      argumentsCount: Object.keys(toolCall.arguments).length
    });

    try {
      const response = await this.mcpClient.callTool(toolCall);
      
      logger.debug('Tool call completed', {
        toolName: toolCall.name,
        success: !response.isError,
        hasContent: !!response.content
      });

      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Tool call failed', {
        toolName: toolCall.name,
        error: errorMessage
      });
      
      // 에러를 MCPToolResponse 형식으로 반환
      return {
        content: null,
        isError: true,
        error: errorMessage
      };
    }
  }

  /**
   * 연결 상태 확인
   */
  async checkConnection(): Promise<MCPConnectionStatus> {
    try {
      await this.mcpClient.request({ method: 'ping' });
      
      const status: MCPConnectionStatus = {
        connected: true,
        lastPing: new Date(),
        toolCount: this.toolsCache.size
      };

      logger.debug('Connection check successful', status);
      return status;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.warn('Connection check failed', { error: errorMessage });
      
      return {
        connected: false,
        toolCount: 0
      };
    }
  }

  /**
   * 캐시 유효성 검사
   */
  private isCacheValid(): boolean {
    const isValid = (
      this.toolsCache.size > 0 && 
      Date.now() - this.lastFetchTime < this.CACHE_DURATION
    );

    if (!isValid && this.toolsCache.size > 0) {
      logger.debug('Tool cache expired', {
        cacheAge: Date.now() - this.lastFetchTime,
        maxAge: this.CACHE_DURATION
      });
    }

    return isValid;
  }

  /**
   * 캐시 업데이트
   */
  private updateCache(tools: GeminiTool[]): void {
    this.toolsCache.clear();
    tools.forEach(tool => {
      this.toolsCache.set(tool.name, tool);
    });
    this.lastFetchTime = Date.now();

    logger.debug('Tool cache updated', {
      toolCount: tools.length,
      toolNames: tools.map(t => t.name)
    });
  }

  /**
   * 캐시 강제 갱신
   */
  async refreshTools(): Promise<void> {
    logger.info('Forcing tool cache refresh');
    this.lastFetchTime = 0; // 캐시 무효화
    await this.getAvailableTools();
  }

  /**
   * 도구 이름 목록 반환 (빠른 조회용)
   */
  async getToolNames(): Promise<string[]> {
    const tools = await this.getAvailableTools();
    return tools.map(tool => tool.name);
  }

  /**
   * 특정 도구가 존재하는지 확인
   */
  async hasToolAvailable(toolName: string): Promise<boolean> {
    const toolNames = await this.getToolNames();
    return toolNames.includes(toolName);
  }

  /**
   * 리소스 정리
   */
  async dispose(): Promise<void> {
    logger.info('Disposing MCPToolManager');
    this.toolsCache.clear();
    
    if (this.mcpClient.disconnect) {
      await this.mcpClient.disconnect();
    }
  }
}

// 싱글톤 인스턴스 관리
let toolManagerInstance: MCPToolManager | null = null;

/**
 * MCPToolManager 싱글톤 인스턴스 반환
 */
export function getMCPToolManager(mcpClient?: MCPClient): MCPToolManager {
  if (!toolManagerInstance) {
    if (!mcpClient) {
      throw new Error('MCPClient is required for initial setup');
    }
    toolManagerInstance = new MCPToolManager(mcpClient);
    logger.info('MCPToolManager singleton instance created');
  }
  return toolManagerInstance;
}

/**
 * 싱글톤 인스턴스 해제 (테스트용)
 */
export function resetMCPToolManager(): void {
  if (toolManagerInstance) {
    toolManagerInstance.dispose();
    toolManagerInstance = null;
    logger.info('MCPToolManager singleton instance reset');
  }
}