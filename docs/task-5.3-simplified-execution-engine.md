# Task 5.3: Adaptive AI-MCP Execution Engine with Feedback Loop

> **태스크**: Task 5.3 - Build Adaptive AI-MCP Execution Engine  
> **시작일**: 2025-07-13  
> **상태**: 📋 계획 단계  

## 📋 계획 개요

사용자의 고수준 목표를 **AI ↔ MCP 피드백 루프**를 통해 점진적으로 실행하는 적응형 실행 엔진을 구현합니다. AI가 한번에 모든 시나리오를 생성하는 것이 아니라, MCP 실행 결과를 보고 다음 단계를 동적으로 결정하는 방식입니다.

## 🎯 구현 목표

### 1. 핵심 원칙
- **점진적 실행**: AI가 단계별로 다음 액션 결정
- **실시간 피드백**: MCP 실행 결과를 AI에게 전달
- **적응형 계획**: DOM 상태에 따라 시나리오 동적 조정
- **연속성 유지**: Gemini chats를 통한 대화 컨텍스트 관리
- **도구 인식**: MCP tools/list를 AI에게 실시간 전달

### 2. 적응형 실행 흐름
```typescript
interface AdaptiveExecutionFlow {
  // 1. 사용자 목표 설정
  userGoal: string; // "로그인 후 상품을 장바구니에 담기"
  startUrl: string;
  
  // 2. AI-MCP 세션 시작
  const chat = await ai.startChat({
    tools: await mcp.getAvailableTools(),
    context: { goal: userGoal, currentUrl: startUrl }
  });
  
  // 3. 점진적 목표 달성
  while (!isGoalAchieved()) {
    // AI가 현재 상황 기반으로 다음 액션 결정
    const nextAction = await chat.planNextStep(currentContext);
    
    // MCP 도구 실행
    const mcpResult = await mcp.executeAction(nextAction);
    
    // AI에게 결과 피드백 및 다음 단계 요청
    currentContext = await chat.processResult(mcpResult);
    
    // 오류 시 AI가 대안 탐색
    if (mcpResult.isError) {
      const recovery = await chat.handleError(mcpResult);
      if (recovery) continue;
      else break;
    }
  }
}
```

## 🛠️ 구현 계획

### Phase 1: MCP 도구 인식 시스템
**파일**: `src/ai/execution/mcp-tool-manager.ts`
- MCP에서 `tools/list` 요청하여 도구 목록 획득
- MCP 도구를 Gemini 형식으로 변환
- 도구 메타데이터 캐싱 및 관리
- 도구 가용성 실시간 체크

### Phase 2: 적응형 AI 채팅 엔진
**파일**: `src/ai/execution/adaptive-chat-engine.ts`
- Gemini chats 기반 연속 대화 관리
- 실행 컨텍스트 상태 추적
- 목표 달성 여부 판단 로직
- AI 응답에서 도구 호출 추출

### Phase 3: AI-MCP 피드백 루프
**파일**: `src/ai/execution/feedback-loop-executor.ts`
- AI 계획 → MCP 실행 → 결과 피드백 사이클
- 실행 중 오류 처리 및 복구
- DOM 상태 변화 감지 및 AI 전달
- 무한 루프 방지 메커니즘

### Phase 4: 실행 컨텍스트 관리
**파일**: `src/ai/execution/execution-context-manager.ts`
- 현재 페이지 상태 추적
- 실행 히스토리 관리
- 사용자 목표 vs 현재 진행 상황 비교
- DOM 요약 및 AI 전달용 데이터 가공

### Phase 5: DOM 상태 요약기
**파일**: `src/ai/execution/dom-summarizer.ts`
- MCP에서 받은 DOM 정보 요약
- 불필요한 정보 필터링
- AI가 이해하기 쉬운 형태로 변환
- 상호작용 가능한 요소 식별

### Phase 6: tRPC API 확장
**파일**: `src/trpc/routers/ai.ts` 업데이트
- `startAdaptiveExecution` 프로시저 추가
- 실행 진행 상황 스트리밍
- 중간 결과 조회 및 중단 기능

## 📝 구현 상세

### 1. MCP 도구 목록 획득 및 변환
```typescript
class MCPToolManager {
  async getAvailableTools(): Promise<AITool[]> {
    // MCP에서 도구 목록 요청
    const toolsResponse = await mcpClient.request({
      method: 'tools/list'
    });
    
    // Gemini 형식으로 변환
    const aiTools: AITool[] = toolsResponse.tools.map((tool: any) => ({
      name: tool.name,
      description: tool.description || `MCP 도구: ${tool.name}`,
      parameters: {
        type: 'object' as const,
        properties: tool.inputSchema?.properties || {},
        required: tool.inputSchema?.required || []
      }
    }));
    
    return aiTools;
  }
}
```

### 2. 적응형 채팅 세션 관리
```typescript
class AdaptiveChatEngine {
  async startExecutionSession(userGoal: string, startUrl: string) {
    // MCP 도구 목록 획득
    const availableTools = await this.toolManager.getAvailableTools();
    
    // Gemini 채팅 세션 시작
    const chat = this.geminiClient.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        tools: [{
          functionDeclarations: availableTools
        }],
      }
    });
    
    // 초기 컨텍스트 설정
    const initialPrompt = `
사용자 목표: ${userGoal}
시작 URL: ${startUrl}

당신은 E2E 테스트 실행 전문가입니다. 
주어진 목표를 달성하기 위해 단계별로 액션을 계획하고 실행하세요.
각 단계에서 MCP 도구를 사용하여 브라우저를 제어하고, 결과를 확인한 후 다음 단계를 결정하세요.

먼저 ${startUrl}로 이동하여 페이지 상태를 확인해주세요.
    `;
    
    return { chat, context: { goal: userGoal, url: startUrl } };
  }
}
```

### 3. AI-MCP 피드백 루프 실행
```typescript
class FeedbackLoopExecutor {
  async executeAdaptively(userGoal: string, startUrl: string) {
    const session = await this.chatEngine.startExecutionSession(userGoal, startUrl);
    let context = { goal: userGoal, currentUrl: startUrl, steps: [] };
    let maxIterations = 20; // 무한 루프 방지
    
    while (!this.isGoalAchieved(context) && maxIterations > 0) {
      try {
        // AI에게 다음 액션 요청
        const response = await session.chat.sendMessage({
          message: this.buildContextPrompt(context)
        });
        
        // AI 응답에서 도구 호출 추출
        const toolCalls = this.extractToolCalls(response);
        
        if (toolCalls.length > 0) {
          // MCP 도구 실행
          for (const toolCall of toolCalls) {
            const mcpResult = await this.executeMCPTool(toolCall);
            
            // 결과를 컨텍스트에 추가
            context.steps.push({
              tool: toolCall.name,
              parameters: toolCall.parameters,
              result: mcpResult,
              timestamp: new Date()
            });
            
            // AI에게 결과 피드백
            await session.chat.sendMessage({
              message: `실행 결과: ${JSON.stringify(mcpResult)}`
            });
          }
        } else {
          // AI가 완료 신호를 보냈거나 더 이상 액션이 없음
          break;
        }
        
        maxIterations--;
      } catch (error) {
        // 오류 발생 시 AI에게 문제 상황 전달
        await session.chat.sendMessage({
          message: `오류 발생: ${error.message}. 대안을 제시해주세요.`
        });
        maxIterations--;
      }
    }
    
    return this.generateExecutionReport(context);
  }
  
  private buildContextPrompt(context: ExecutionContext): string {
    return `
현재 상황:
- 목표: ${context.goal}
- 현재 URL: ${context.currentUrl}
- 지금까지 실행된 단계: ${context.steps.length}개

최근 실행 결과:
${context.steps.slice(-3).map(step => 
  `- ${step.tool}: ${step.result.success ? '성공' : '실패'}`
).join('\n')}

다음에 실행할 액션을 MCP 도구를 사용하여 제시해주세요.
목표 달성을 위해 필요한 단계가 더 있다면 계속 진행하고, 
완료되었다면 "목표 달성 완료"라고 응답해주세요.
    `;
  }
}
```

### 4. DOM 상태 요약 시스템
```typescript
class DOMSummarizer {
  summarizeForAI(domData: any): string {
    // MCP에서 받은 원시 DOM 데이터를 AI가 이해하기 쉽게 요약
    const interactiveElements = this.extractInteractiveElements(domData);
    const pageStructure = this.analyzePageStructure(domData);
    
    return `
페이지 구조:
- 제목: ${pageStructure.title}
- URL: ${pageStructure.url}
- 상태: ${pageStructure.loadingState}

상호작용 가능한 요소들:
${interactiveElements.map(el => 
  `- ${el.type}: ${el.selector} (${el.text || el.placeholder || '텍스트 없음'})`
).join('\n')}

주요 정보:
- 폼 개수: ${pageStructure.forms}개
- 버튼 개수: ${pageStructure.buttons}개
- 입력 필드 개수: ${pageStructure.inputs}개
    `;
  }
  
  private extractInteractiveElements(domData: any) {
    // 클릭 가능한 요소들 추출
    const buttons = domData.querySelectorAll('button, [role="button"], input[type="submit"]');
    const inputs = domData.querySelectorAll('input, textarea, select');
    const links = domData.querySelectorAll('a[href]');
    
    return [...buttons, ...inputs, ...links].map(el => ({
      type: this.getElementType(el),
      selector: this.generateSelector(el),
      text: el.textContent?.trim(),
      placeholder: el.placeholder,
      href: el.href
    }));
  }
}
```

### 5. 실행 리포트
```typescript
interface AdaptiveExecutionReport {
  executionId: string;
  userGoal: string;
  startTime: Date;
  endTime: Date;
  totalDuration: number;
  
  goalAchievement: {
    achieved: boolean;
    confidence: number;
    finalState: string;
  };
  
  aiInteractions: {
    totalMessages: number;
    toolCallsRequested: number;
    toolCallsExecuted: number;
    adaptations: number; // AI가 계획을 수정한 횟수
  };
  
  executionFlow: {
    step: number;
    aiMessage: string;
    toolCalls: ToolCall[];
    mcpResults: MCPResult[];
    duration: number;
  }[];
  
  insights: {
    mostUsedTool: string;
    averageStepTime: number;
    errorRecoveryCount: number;
    domChangesDetected: number;
  };
}
```

## 🧪 테스트 계획

### 1. 적응형 실행 테스트
```typescript
// 고수준 목표 기반 테스트
const adaptiveTest = {
  userGoal: "example.com에 로그인하고 프로필 페이지로 이동",
  startUrl: "https://example.com"
};

// 적응형 실행 및 검증
const report = await adaptiveExecutor.executeAdaptively(
  adaptiveTest.userGoal, 
  adaptiveTest.startUrl
);

expect(report.goalAchievement.achieved).toBe(true);
expect(report.aiInteractions.toolCallsExecuted).toBeGreaterThan(2);
expect(report.executionFlow.length).toBeGreaterThan(0);
```

### 2. AI-MCP 피드백 루프 테스트
- AI가 도구 목록을 올바르게 받는지 확인
- MCP 실행 결과가 AI에게 정확히 전달되는지 검증
- AI가 오류 상황에서 대안을 제시하는지 테스트
- 무한 루프 방지 메커니즘 동작 확인

### 3. DOM 요약 시스템 테스트
- 복잡한 DOM을 AI가 이해할 수 있는 형태로 요약
- 상호작용 가능한 요소 정확한 식별
- 페이지 변화 감지 및 업데이트

## 📂 파일 구조

```
src/ai/execution/
├── mcp-tool-manager.ts           # MCP 도구 목록 관리
├── adaptive-chat-engine.ts       # Gemini 채팅 세션 관리
├── feedback-loop-executor.ts     # AI-MCP 피드백 루프
├── execution-context-manager.ts  # 실행 컨텍스트 관리
├── dom-summarizer.ts             # DOM 상태 요약
└── execution-reporter.ts         # 적응형 실행 리포트

src/ai/types/
├── execution.ts                  # 적응형 실행 관련 타입
└── mcp.ts                       # MCP 연동 타입
```

## ⏱️ 예상 소요 시간

- **Phase 1**: MCP 도구 인식 시스템 (45분)
- **Phase 2**: 적응형 AI 채팅 엔진 (60분)
- **Phase 3**: AI-MCP 피드백 루프 (90분)
- **Phase 4**: 실행 컨텍스트 관리 (45분)
- **Phase 5**: DOM 상태 요약기 (60분)
- **Phase 6**: tRPC API 확장 (30분)
- **테스트**: (60분)

**총 예상 시간**: 약 6시간

## 🚀 성공 기준

1. ✅ MCP에서 도구 목록을 받아 Gemini에 전달
2. ✅ AI가 도구를 사용하여 목표 달성 계획 수립
3. ✅ MCP 실행 결과를 AI에게 피드백하여 다음 단계 결정
4. ✅ DOM 상태 변화를 AI가 인식하고 적응
5. ✅ 오류 발생 시 AI가 대안 제시
6. ✅ 목표 달성 여부를 정확히 판단
7. ✅ 무한 루프 없이 안정적 실행

## 💡 핵심 혁신 포인트

### 1. **진정한 AI-E2E 협업**
- AI가 단순 스크립트 생성자가 아닌 능동적 실행 파트너
- 실시간 상황 인식 및 계획 수정
- DOM 변화에 따른 동적 적응

### 2. **실용적 피드백 루프**
- 한번에 완벽한 계획 수립 ❌ → 단계별 검증 후 진행 ✅
- 이론적 시나리오 ❌ → 실제 페이지 상태 기반 실행 ✅
- 고정된 스크립트 ❌ → 적응형 목표 달성 ✅

### 3. **확장 가능한 아키텍처**
- 새로운 MCP 도구 추가 시 자동 인식
- 다양한 AI 모델 (Gemini 외) 지원 가능
- DOM 요약 로직 개선으로 더 정확한 인식

---

**검토 요청**: 이 AI-MCP 피드백 루프 기반 접근 방식이 적절한가요? 실제 E2E 테스트의 핵심을 잘 다루고 있는지 확인 부탁드립니다!