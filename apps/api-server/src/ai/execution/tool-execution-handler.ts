import { getMCPToolManager } from './mcp-tool-manager';
import { ToolCallRequest } from './adaptive-chat-engine';
import { createLogger } from '@cinnamon-qa/logger';

const logger = createLogger({ context: 'ToolExecutionHandler' });

export interface ToolExecutionResult {
  success: boolean;
  content: any;
  error?: string;
  metadata?: {
    executionTime: number;
    toolResponse: any;
  };
}

export class ToolExecutionHandler {
  
  /**
   * MCP 도구 호출 실행
   */
  async executeToolCall(toolCall: ToolCallRequest): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    
    logger.info('Executing tool call', {
      toolName: toolCall.toolName,
      requestId: toolCall.requestId,
      parametersCount: Object.keys(toolCall.arguments).length
    });

    try {
      const toolManager = getMCPToolManager();
      
      // MCP 도구 실행
      const mcpResponse = await toolManager.callTool({
        name: toolCall.toolName,
        arguments: toolCall.arguments
      });

      const executionTime = Date.now() - startTime;

      const result: ToolExecutionResult = {
        success: !mcpResponse.isError,
        content: mcpResponse.content,
        error: mcpResponse.error,
        metadata: {
          executionTime,
          toolResponse: mcpResponse
        }
      };

      logger.info('Tool call completed', {
        toolName: toolCall.toolName,
        requestId: toolCall.requestId,
        success: result.success,
        executionTime
      });

      return result;

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      logger.error('Tool call failed', {
        toolName: toolCall.toolName,
        requestId: toolCall.requestId,
        error: errorMessage,
        executionTime
      });

      return {
        success: false,
        content: null,
        error: errorMessage,
        metadata: {
          executionTime,
          toolResponse: null
        }
      };
    }
  }

  /**
   * 도구 실행 전 검증
   */
  async validateToolCall(toolCall: ToolCallRequest): Promise<{
    valid: boolean;
    error?: string;
  }> {
    try {
      const toolManager = getMCPToolManager();
      
      // 도구 존재 여부 확인
      const toolExists = await toolManager.hasToolAvailable(toolCall.toolName);
      if (!toolExists) {
        return {
          valid: false,
          error: `Tool '${toolCall.toolName}' is not available`
        };
      }

      // 도구 세부 정보 확인
      const toolDetails = await toolManager.getToolDetails(toolCall.toolName);
      if (!toolDetails) {
        return {
          valid: false,
          error: `Unable to get details for tool '${toolCall.toolName}'`
        };
      }

      // 필수 파라미터 검증
      const requiredParams = toolDetails.parameters.required || [];
      const providedParams = Object.keys(toolCall.arguments);
      
      for (const param of requiredParams) {
        if (!providedParams.includes(param)) {
          return {
            valid: false,
            error: `Missing required parameter: ${param}`
          };
        }
      }

      return { valid: true };

    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Validation failed'
      };
    }
  }

  /**
   * 도구 실행 재시도 로직
   */
  async executeWithRetry(
    toolCall: ToolCallRequest, 
    maxRetries: number = 2
  ): Promise<ToolExecutionResult> {
    let lastResult: ToolExecutionResult;
    
    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      logger.debug('Tool execution attempt', {
        toolName: toolCall.toolName,
        attempt,
        maxRetries: maxRetries + 1
      });

      lastResult = await this.executeToolCall(toolCall);
      
      if (lastResult.success) {
        return lastResult;
      }

      if (attempt <= maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Exponential backoff
        logger.info('Retrying tool execution', {
          toolName: toolCall.toolName,
          attempt,
          delay,
          lastError: lastResult.error
        });
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    logger.warn('Tool execution failed after retries', {
      toolName: toolCall.toolName,
      totalAttempts: maxRetries + 1,
      finalError: lastResult!.error
    });

    return lastResult!;
  }

  /**
   * 일괄 도구 실행 (순차 실행)
   */
  async executeBatch(toolCalls: ToolCallRequest[]): Promise<ToolExecutionResult[]> {
    logger.info('Executing tool batch', {
      batchSize: toolCalls.length,
      tools: toolCalls.map(t => t.toolName)
    });

    const results: ToolExecutionResult[] = [];
    
    for (const toolCall of toolCalls) {
      const result = await this.executeToolCall(toolCall);
      results.push(result);
      
      // 실패 시 짧은 대기 후 계속 진행
      if (!result.success) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    const successCount = results.filter(r => r.success).length;
    logger.info('Tool batch completed', {
      batchSize: toolCalls.length,
      successCount,
      failureCount: toolCalls.length - successCount
    });

    return results;
  }

  /**
   * 도구 실행 상태 확인
   */
  async checkToolAvailability(toolName: string): Promise<{
    available: boolean;
    details?: any;
    error?: string;
  }> {
    try {
      const toolManager = getMCPToolManager();
      
      const available = await toolManager.hasToolAvailable(toolName);
      if (!available) {
        return { available: false, error: `Tool '${toolName}' not found` };
      }

      const details = await toolManager.getToolDetails(toolName);
      return { available: true, details };

    } catch (error) {
      return {
        available: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}