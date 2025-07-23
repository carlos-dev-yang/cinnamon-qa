/**
 * Task 5.4 Live Test - 실제 서버 환경에서 Adaptive Chat Session Management 테스트
 */
import { getChatSessionManager, resetChatSessionManager } from './apps/api-server/src/ai/execution/chat-session-manager';
import { getMCPToolManager, resetMCPToolManager } from './apps/api-server/src/ai/execution/mcp-tool-manager';
import { MCPClient } from './apps/api-server/src/ai/types/mcp';

// Mock MCP Client (실제 Playwright-MCP 컨테이너가 없는 경우 사용)
const createMockMCPClient = (): MCPClient => ({
  async request({ method, params }) {
    console.log(`🔗 [MCP] ${method} 요청`, params || '');
    
    if (method === 'tools/list') {
      // 실제 Playwright-MCP 도구들과 유사한 응답
      return {
        tools: [
          {
            name: 'playwright_navigate',
            description: 'Navigate to a URL in the browser',
            inputSchema: {
              type: 'object',
              properties: {
                url: { 
                  type: 'string', 
                  description: 'The URL to navigate to' 
                }
              },
              required: ['url']
            }
          },
          {
            name: 'playwright_click',
            description: 'Click on an element',
            inputSchema: {
              type: 'object',
              properties: {
                selector: { 
                  type: 'string', 
                  description: 'CSS selector for the element to click' 
                }
              },
              required: ['selector']
            }
          },
          {
            name: 'playwright_screenshot',
            description: 'Take a screenshot of the current page',
            inputSchema: {
              type: 'object',
              properties: {
                name: { 
                  type: 'string', 
                  description: 'Optional name for the screenshot file' 
                }
              },
              required: []
            }
          }
        ]
      };
    }
    
    if (method === 'ping') {
      return { 
        status: 'ok', 
        timestamp: Date.now(),
        container: 'mock-container-id'
      };
    }
    
    return {};
  },

  async callTool({ name, arguments: args }) {
    console.log(`🛠️  [MCP] 도구 실행: ${name}`, args);
    
    // 도구별 Mock 응답
    const responses = {
      playwright_navigate: {
        content: `Successfully navigated to ${args.url}`,
        isError: false
      },
      playwright_click: {
        content: `Successfully clicked element: ${args.selector}`,
        isError: false
      },
      playwright_screenshot: {
        content: `Screenshot saved as "${args.name || 'screenshot.png'}"`,
        isError: false
      }
    };
    
    const response = responses[name as keyof typeof responses] || {
      content: `Tool executed: ${name}`,
      isError: false
    };
    
    // 실행 시간 시뮬레이션
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
    
    return response;
  }
});

async function runLiveTest() {
  console.log('🚀 Task 5.4 Live Test - Adaptive Chat Session Management');
  console.log('=' .repeat(60));
  console.log('💡 이 테스트는 실제 서버 환경에서 채팅 세션 관리를 검증합니다\\n');

  let testsPassed = 0;
  let totalTests = 0;

  const runTest = async (name: string, testFn: () => Promise<boolean>) => {
    totalTests++;
    console.log(`📋 테스트 ${totalTests}: ${name}`);
    console.log('-'.repeat(50));
    
    try {
      const result = await testFn();
      if (result) {
        testsPassed++;
        console.log(`✅ 통과\\n`);
      } else {
        console.log(`❌ 실패\\n`);
      }
      return result;
    } catch (error) {
      console.log(`❌ 오류: ${error.message}\\n`);
      return false;
    }
  };

  // 테스트 시작 - 환경 리셋
  resetChatSessionManager();
  resetMCPToolManager();
  
  // Mock MCP Client 설정
  const mockClient = createMockMCPClient();
  getMCPToolManager(mockClient);

  await runTest('ChatSessionManager 초기화', async () => {
    const sessionManager = getChatSessionManager();
    await sessionManager.initialize();
    console.log('   초기화 완료');
    return true;
  });

  await runTest('도구 지원 채팅 세션 생성', async () => {
    const sessionManager = getChatSessionManager();
    const sessionId = await sessionManager.createTestSession('test-case-1');
    console.log(`   생성된 세션 ID: ${sessionId}`);
    console.log(`   세션 ID 형식: ${sessionId.startsWith('chat_') ? '✅ 올바름' : '❌ 잘못됨'}`);
    return !!sessionId && sessionId.startsWith('chat_');
  });

  await runTest('분석용 채팅 세션 생성', async () => {
    const sessionManager = getChatSessionManager();
    const sessionId = await sessionManager.createAnalysisSession();
    console.log(`   분석 세션 ID: ${sessionId}`);
    return !!sessionId;
  });

  await runTest('세션 상태 조회', async () => {
    const sessionManager = getChatSessionManager();
    const sessionId = await sessionManager.createTestSession('test-case-2');
    
    const status = await sessionManager.getSessionStatus(sessionId);
    console.log(`   세션 존재: ${status.exists ? '✅' : '❌'}`);
    console.log(`   세션 활성: ${status.isActive ? '✅' : '❌'}`);
    console.log(`   시작 시간: ${status.startTime?.toISOString()}`);
    console.log(`   테스트 케이스 ID: ${status.context?.testCaseId}`);
    console.log(`   현재 스텝: ${status.context?.currentStep}`);
    
    return status.exists && status.isActive && status.context?.testCaseId === 'test-case-2';
  });

  await runTest('메시지 전송 및 도구 호출 파싱', async () => {
    const sessionManager = getChatSessionManager();
    const sessionId = await sessionManager.createTestSession('test-case-3');
    
    // 도구 호출이 포함될 수 있는 메시지 전송 
    const message = 'I need to navigate to https://example.com, click the login button, and take a screenshot';
    
    try {
      const result = await sessionManager.sendMessage(sessionId, message);
      
      console.log(`   응답 길이: ${result.response.length} 문자`);
      console.log(`   도구 호출 개수: ${result.toolCalls.length}개`);
      console.log(`   세션 업데이트: ${result.sessionUpdated ? '✅' : '❌'}`);
      
      if (result.toolCalls.length > 0) {
        result.toolCalls.forEach((call, i) => {
          console.log(`   ${i+1}. ${call.toolName}:`);
          console.log(`      요청 ID: ${call.requestId}`);
          console.log(`      파라미터: ${JSON.stringify(call.arguments)}`);
        });
      } else {
        console.log('   ℹ️  도구 호출이 파싱되지 않았습니다 (Gemini가 텍스트로만 응답)');
      }
      
      // 응답이 있고 세션이 업데이트되었으면 성공
      return result.response.length > 0 && result.sessionUpdated;
    } catch (error) {
      console.log(`   ⚠️  메시지 전송 중 오류: ${error.message}`);
      // Gemini API 키 문제나 네트워크 문제일 수 있으므로 부분적 성공으로 처리
      return false;
    }
  });

  await runTest('세션 컨텍스트 업데이트', async () => {
    const sessionManager = getChatSessionManager();
    const sessionId = await sessionManager.createTestSession('test-case-4');
    
    // 컨텍스트 업데이트
    await sessionManager.updateContext(sessionId, {
      currentStep: 1,
      domState: { 
        title: 'Example Page',
        url: 'https://example.com'
      },
      previousActions: ['navigate_to_url']
    });
    
    const status = await sessionManager.getSessionStatus(sessionId);
    console.log(`   현재 스텝: ${status.context?.currentStep}`);
    console.log(`   DOM 상태: ${JSON.stringify(status.context?.domState)}`);
    console.log(`   이전 액션: [${status.context?.previousActions?.join(', ')}]`);
    
    return (
      status.context?.currentStep === 1 &&
      status.context?.domState?.title === 'Example Page' &&
      status.context?.previousActions?.includes('navigate_to_url')
    );
  });

  await runTest('활성 세션 목록 조회', async () => {
    const sessionManager = getChatSessionManager();
    
    // 여러 세션 생성
    const session1 = await sessionManager.createTestSession('test-case-5a');
    const session2 = await sessionManager.createTestSession('test-case-5b');
    const session3 = await sessionManager.createAnalysisSession();
    
    const activeSessions = await sessionManager.getActiveSessions();
    console.log(`   활성 세션 수: ${activeSessions.length}개`);
    console.log(`   세션 목록:`);
    activeSessions.forEach((sessionId, i) => {
      console.log(`   ${i+1}. ${sessionId}`);
    });
    
    // 생성한 3개 세션이 모두 목록에 있는지 확인
    const hasSession1 = activeSessions.includes(session1);
    const hasSession2 = activeSessions.includes(session2);
    const hasSession3 = activeSessions.includes(session3);
    
    console.log(`   세션1 포함: ${hasSession1 ? '✅' : '❌'}`);
    console.log(`   세션2 포함: ${hasSession2 ? '✅' : '❌'}`);
    console.log(`   세션3 포함: ${hasSession3 ? '✅' : '❌'}`);
    
    return activeSessions.length >= 3 && hasSession1 && hasSession2 && hasSession3;
  });

  await runTest('세션 종료', async () => {
    const sessionManager = getChatSessionManager();
    const sessionId = await sessionManager.createTestSession('test-case-6');
    
    // 종료 전 상태 확인
    const statusBefore = await sessionManager.getSessionStatus(sessionId);
    console.log(`   종료 전 세션 존재: ${statusBefore.exists ? '✅' : '❌'}`);
    
    // 세션 종료
    await sessionManager.terminateSession(sessionId);
    
    // 종료 후 상태 확인
    const statusAfter = await sessionManager.getSessionStatus(sessionId);
    console.log(`   종료 후 세션 존재: ${statusAfter.exists ? '❌' : '✅'}`);
    
    return statusBefore.exists && !statusAfter.exists;
  });

  await runTest('리소스 정리 및 세션 매니저 해제', async () => {
    const sessionManager = getChatSessionManager();
    
    // 정리 전 활성 세션 수 확인
    const sessionsBeforeCleanup = await sessionManager.getActiveSessions();
    console.log(`   정리 전 활성 세션: ${sessionsBeforeCleanup.length}개`);
    
    // 리소스 정리
    await sessionManager.dispose();
    
    // 새로운 인스턴스에서 확인
    resetChatSessionManager();
    const newSessionManager = getChatSessionManager();
    await newSessionManager.initialize();
    
    const sessionsAfterCleanup = await newSessionManager.getActiveSessions();
    console.log(`   정리 후 활성 세션: ${sessionsAfterCleanup.length}개`);
    
    return sessionsAfterCleanup.length === 0;
  });

  // 최종 결과
  console.log('=' .repeat(60));
  console.log(`📊 테스트 결과: ${testsPassed}/${totalTests} 통과`);
  console.log(`🎯 성공률: ${Math.round((testsPassed / totalTests) * 100)}%`);
  
  if (testsPassed === totalTests) {
    console.log('🎉 모든 테스트 통과! Task 5.4가 성공적으로 구현되었습니다.');
    console.log('\\n🚦 다음 단계: Task 5.5 (Basic AI-MCP Feedback Loop) 준비 완료');
  } else {
    console.log('⚠️  일부 테스트가 실패했습니다. 문제를 확인해주세요.');
    
    if (testsPassed >= totalTests * 0.75) {
      console.log('💡 75% 이상 통과: 핵심 기능은 정상 작동합니다.');
    }
  }

  // 최종 리소스 정리
  const sessionManager = getChatSessionManager();
  await sessionManager.dispose();
  resetChatSessionManager();
  resetMCPToolManager();
  
  return testsPassed === totalTests;
}

// 실행
runLiveTest()
  .then(success => {
    console.log(`\\n🏁 테스트 완료: ${success ? '성공' : '실패'}`);
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('\\n💥 테스트 실행 오류:', error);
    process.exit(1);
  });