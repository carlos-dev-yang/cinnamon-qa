# Task 5.3: MCP Tools Integration Foundation

> **태스크**: Task 5.3 - MCP Tools Integration Foundation  
> **시작일**: 2025-07-13  
> **완료일**: 2025-07-14  
> **상태**: ✅ 완료  
> **소요 시간**: 1.5시간

## 📋 개요

AI-MCP 피드백 루프의 첫 번째 단계로, MCP와 AI 간의 기본 연동 인프라를 구축합니다. MCP에서 사용 가능한 도구 목록을 조회하고, 이를 Gemini AI가 이해할 수 있는 형식으로 변환하는 기반 시스템을 구현합니다.

## 🎯 구현 목표

### 1. 핵심 기능
- MCP 도구 목록 조회 (`tools/list` 요청)
- Gemini 형식으로 도구 변환
- 도구 메타데이터 캐싱 및 관리
- 기본적인 MCP 호출 메커니즘

### 2. 성공 기준
- ✅ MCP에서 도구 목록 정상 조회
- ✅ Gemini 형식으로 올바른 변환
- ✅ 단일 도구 호출 테스트 성공
- ✅ 연결 상태 확인 가능

## 🛠️ 구현 계획

### 1. MCPToolManager 클래스
**파일**: `src/ai/execution/mcp-tool-manager.ts`

```typescript
import { MCPClient } from '@mcp/client';
import { createLogger } from '@cinnamon-qa/logger';

const logger = createLogger({ context: 'MCPToolManager' });

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: {
    type: string;
    properties?: Record<string, any>;
    required?: string[];
  };
}

export interface GeminiTool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
  };
}

export class MCPToolManager {
  private mcpClient: MCPClient;
  private toolsCache: Map<string, GeminiTool>;
  private lastFetchTime: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5분

  constructor(mcpClient: MCPClient) {
    this.mcpClient = mcpClient;
    this.toolsCache = new Map();
  }

  /**
   * MCP에서 도구 목록을 가져와 Gemini 형식으로 변환
   */
  async getAvailableTools(): Promise<GeminiTool[]> {
    try {
      // 캐시 확인
      if (this.isCacheValid()) {
        logger.debug('Using cached tools');
        return Array.from(this.toolsCache.values());
      }

      // MCP에서 도구 목록 요청
      const toolsResponse = await this.mcpClient.request({
        method: 'tools/list'
      });

      logger.info('Fetched tools from MCP', { 
        toolCount: toolsResponse.tools?.length || 0 
      });

      // Gemini 형식으로 변환
      const geminiTools = this.convertToGeminiFormat(toolsResponse.tools || []);
      
      // 캐시 업데이트
      this.updateCache(geminiTools);

      return geminiTools;
    } catch (error) {
      logger.error('Failed to fetch MCP tools', { error });
      throw new Error(`MCP 도구 목록 조회 실패: ${error.message}`);
    }
  }

  /**
   * MCP 도구를 Gemini 형식으로 변환
   */
  private convertToGeminiFormat(mcpTools: MCPTool[]): GeminiTool[] {
    return mcpTools.map(tool => ({
      name: tool.name,
      description: tool.description || `MCP 도구: ${tool.name}`,
      parameters: {
        type: 'object' as const,
        properties: tool.inputSchema?.properties || {},
        required: tool.inputSchema?.required || []
      }
    }));
  }

  /**
   * 특정 도구의 상세 정보 조회
   */
  async getToolDetails(toolName: string): Promise<GeminiTool | null> {
    const tools = await this.getAvailableTools();
    return tools.find(tool => tool.name === toolName) || null;
  }

  /**
   * 도구 호출 테스트 (기본 검증용)
   */
  async testToolCall(toolName: string, parameters: Record<string, any>): Promise<any> {
    try {
      const response = await this.mcpClient.callTool({
        name: toolName,
        arguments: parameters
      });

      logger.info('Tool call test successful', { 
        toolName, 
        success: !response.isError 
      });

      return response;
    } catch (error) {
      logger.error('Tool call test failed', { toolName, error });
      throw error;
    }
  }

  /**
   * 캐시 유효성 검사
   */
  private isCacheValid(): boolean {
    return (
      this.toolsCache.size > 0 && 
      Date.now() - this.lastFetchTime < this.CACHE_DURATION
    );
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
  }

  /**
   * 캐시 강제 갱신
   */
  async refreshTools(): Promise<void> {
    this.lastFetchTime = 0; // 캐시 무효화
    await this.getAvailableTools();
  }

  /**
   * 연결 상태 확인
   */
  async checkConnection(): Promise<boolean> {
    try {
      await this.mcpClient.request({ method: 'ping' });
      return true;
    } catch {
      return false;
    }
  }
}
```

### 2. 타입 정의
**파일**: `src/ai/types/mcp.ts`

```typescript
// MCP 관련 타입 정의
export interface MCPToolCall {
  name: string;
  arguments: Record<string, any>;
}

export interface MCPToolResponse {
  content: any;
  isError: boolean;
  error?: string;
}

export interface MCPConnectionStatus {
  connected: boolean;
  lastPing: Date;
  toolCount: number;
}
```

### 3. 싱글톤 인스턴스 관리
**파일**: `src/ai/execution/mcp-tool-manager.ts` (추가)

```typescript
// 싱글톤 인스턴스
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
  }
  return toolManagerInstance;
}
```

## 🧪 테스트 계획

### 1. 유닛 테스트
**파일**: `test/mcp-tool-manager.test.ts`

```typescript
describe('MCPToolManager', () => {
  let toolManager: MCPToolManager;
  let mockMCPClient: jest.Mocked<MCPClient>;

  beforeEach(() => {
    mockMCPClient = createMockMCPClient();
    toolManager = new MCPToolManager(mockMCPClient);
  });

  describe('getAvailableTools', () => {
    it('should fetch and convert MCP tools to Gemini format', async () => {
      // Mock MCP response
      mockMCPClient.request.mockResolvedValue({
        tools: [
          {
            name: 'playwright_navigate',
            description: 'Navigate to a URL',
            inputSchema: {
              type: 'object',
              properties: { url: { type: 'string' } },
              required: ['url']
            }
          }
        ]
      });

      const tools = await toolManager.getAvailableTools();

      expect(tools).toHaveLength(1);
      expect(tools[0]).toEqual({
        name: 'playwright_navigate',
        description: 'Navigate to a URL',
        parameters: {
          type: 'object',
          properties: { url: { type: 'string' } },
          required: ['url']
        }
      });
    });

    it('should use cache for subsequent calls', async () => {
      await toolManager.getAvailableTools();
      await toolManager.getAvailableTools();

      expect(mockMCPClient.request).toHaveBeenCalledTimes(1);
    });
  });

  describe('testToolCall', () => {
    it('should successfully call MCP tool', async () => {
      mockMCPClient.callTool.mockResolvedValue({
        content: 'Success',
        isError: false
      });

      const result = await toolManager.testToolCall('test_tool', { param: 'value' });

      expect(result.isError).toBe(false);
      expect(mockMCPClient.callTool).toHaveBeenCalledWith({
        name: 'test_tool',
        arguments: { param: 'value' }
      });
    });
  });
});
```

### 2. 통합 테스트
**파일**: `test/integration/mcp-tools-integration.test.ts`

```typescript
// 실제 MCP 컨테이너와 연동 테스트
describe('MCP Tools Integration', () => {
  it('should connect to real MCP container and fetch tools', async () => {
    const container = await containerPool.allocate();
    const toolManager = getMCPToolManager(container.mcpClient);

    const tools = await toolManager.getAvailableTools();
    
    expect(tools.length).toBeGreaterThan(0);
    expect(tools.some(tool => tool.name.includes('playwright'))).toBe(true);
    
    await containerPool.release(container);
  });
});
```

## 📊 검증 스크립트
**파일**: `test-5.3-mcp-tools.ts`

```typescript
import { getMCPToolManager } from './apps/api-server/src/ai/execution/mcp-tool-manager';
import { createLogger } from '@cinnamon-qa/logger';

const logger = createLogger({ context: 'Task5.3Test' });

async function testMCPToolsIntegration() {
  console.log('🔍 Task 5.3 MCP Tools Integration 테스트 시작\n');
  
  try {
    // 1. Mock MCP Client로 테스트
    const mockClient = {
      request: async ({ method }) => {
        if (method === 'tools/list') {
          return {
            tools: [
              { name: 'playwright_navigate', description: 'Navigate to URL' },
              { name: 'playwright_click', description: 'Click element' },
              { name: 'playwright_fill', description: 'Fill input' }
            ]
          };
        }
        return {};
      },
      callTool: async ({ name, arguments: args }) => ({
        content: `Called ${name} with ${JSON.stringify(args)}`,
        isError: false
      })
    };

    const toolManager = getMCPToolManager(mockClient as any);
    
    // 2. 도구 목록 조회
    console.log('1️⃣ MCP 도구 목록 조회 테스트...');
    const tools = await toolManager.getAvailableTools();
    console.log(`✅ ${tools.length}개 도구 발견`);
    tools.forEach(tool => {
      console.log(`   - ${tool.name}: ${tool.description}`);
    });

    // 3. 도구 변환 검증
    console.log('\n2️⃣ Gemini 형식 변환 검증...');
    const navTool = tools.find(t => t.name === 'playwright_navigate');
    console.log(`✅ 변환 결과:`, JSON.stringify(navTool, null, 2));

    // 4. 도구 호출 테스트
    console.log('\n3️⃣ 도구 호출 테스트...');
    const result = await toolManager.testToolCall('playwright_navigate', {
      url: 'https://example.com'
    });
    console.log(`✅ 호출 결과:`, result.content);

    // 5. 캐시 동작 확인
    console.log('\n4️⃣ 캐시 동작 확인...');
    const start = Date.now();
    await toolManager.getAvailableTools(); // 캐시에서 가져옴
    const duration = Date.now() - start;
    console.log(`✅ 캐시 응답 시간: ${duration}ms`);

    console.log('\n🎉 Task 5.3 모든 테스트 통과!');
    return true;

  } catch (error) {
    console.error('\n❌ 테스트 실패:', error);
    return false;
  }
}

// 테스트 실행
testMCPToolsIntegration()
  .then(success => process.exit(success ? 0 : 1))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
```

## 📝 다음 단계

Task 5.3 완료 후 진행할 내용:
- **Task 5.4**: Adaptive Chat Session Management - Gemini 채팅 세션 관리
- **Task 5.5**: Basic AI-MCP Feedback Loop - 피드백 루프 구현

## 💡 주요 고려사항

1. **도구 이름 규칙**: MCP 도구 이름과 Gemini에서 사용할 이름의 일관성
2. **파라미터 검증**: 각 도구의 필수/선택 파라미터 정확한 매핑
3. **에러 처리**: MCP 연결 실패 시 graceful degradation
4. **성능**: 도구 목록 캐싱으로 불필요한 요청 최소화

---

**구현 준비 완료!** 이제 MCP와 AI 간의 기본 연동을 시작할 수 있습니다.