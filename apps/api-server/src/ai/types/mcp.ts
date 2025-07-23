/**
 * MCP (Model Context Protocol) 관련 타입 정의
 */

// MCP 도구 정의
export interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: {
    type: string;
    properties?: Record<string, any>;
    required?: string[];
  };
}

// Gemini AI용 도구 형식
export interface GeminiTool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
  };
}

// MCP 도구 호출 요청
export interface MCPToolCall {
  name: string;
  arguments: Record<string, any>;
}

// MCP 도구 호출 응답
export interface MCPToolResponse {
  content: any;
  isError: boolean;
  error?: string;
}

// MCP 연결 상태
export interface MCPConnectionStatus {
  connected: boolean;
  lastPing?: Date;
  toolCount: number;
  containerInfo?: {
    id: string;
    status: string;
    allocatedAt: Date;
  };
}

// MCP 클라이언트 인터페이스 (기존 구현과 호환)
export interface MCPClient {
  request(params: { method: string; params?: any }): Promise<any>;
  callTool(params: MCPToolCall): Promise<MCPToolResponse>;
  disconnect?(): Promise<void>;
}

// MCP 요청/응답 타입들
export interface MCPToolListRequest {
  method: 'tools/list';
  params?: Record<string, any>;
}

export interface MCPToolListResponse {
  tools: MCPTool[];
}

export interface MCPPingRequest {
  method: 'ping';
}

export interface MCPPingResponse {
  status: 'ok';
  timestamp: number;
}