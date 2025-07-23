// 시나리오 분석을 위한 프롬프트 템플릿

/**
 * 시나리오 분석을 위한 프롬프트 템플릿
 */
export const SCENARIO_ANALYSIS_PROMPT = `당신은 웹 테스트 자동화 전문가입니다. 사용자가 제공한 자연어 시나리오를 브라우저에서 실행 가능한 구조화된 테스트 스텝으로 변환해주세요.

## 입력 정보
- **시나리오**: {scenario}
- **대상 URL**: {url}
- **복잡도**: {complexity}

## 출력 요구사항
다음 JSON 스키마에 맞는 형식으로 응답해주세요:

\`\`\`json
{
  "steps": [
    {
      "id": "string",
      "action": "navigate|click|type|wait|scroll|hover|select|verify",
      "description": "string",
      "selector": "string",
      "value": "string (optional)",
      "waitCondition": "string (optional)",
      "expectedResult": "string"
    }
  ],
  "confidence": "number (0-1)",
  "suggestions": ["string"],
  "warnings": ["string"],
  "metadata": {
    "complexity": "simple|medium|complex",
    "estimatedDuration": "number (seconds)",
    "requiredPermissions": ["string"]
  }
}
\`\`\`

## 스텝 액션 가이드라인
- **navigate**: 페이지 이동 (url 필요)
- **click**: 요소 클릭 (selector 필요)
- **type**: 텍스트 입력 (selector, value 필요)
- **wait**: 대기 (waitCondition 필요)
- **scroll**: 스크롤 (선택적으로 selector)
- **hover**: 마우스 오버 (selector 필요)
- **select**: 드롭다운 선택 (selector, value 필요)
- **verify**: 결과 검증 (selector, expectedResult 필요)

## CSS 선택자 가이드라인
- ID 선택자 우선: \`#element-id\`
- 데이터 속성 활용: \`[data-testid="element"]\`
- 클래스 선택자: \`.class-name\`
- 속성 선택자: \`[type="email"]\`, \`[placeholder="이메일"]\`
- 텍스트 기반: \`:has-text("로그인")\`
- 견고한 선택자 조합 사용

## 분석 예시
{examples}

## 주의사항
1. 각 스텝은 명확하고 실행 가능해야 합니다
2. 선택자는 변경에 강한 안정적인 것을 선택하세요
3. 대기 조건을 적절히 활용하여 안정성을 높이세요
4. 예상 결과를 구체적으로 명시하세요
5. 사용자 권한이 필요한 경우 requiredPermissions에 기록하세요

이제 시나리오를 분석해주세요:`;

/**
 * 복잡도별 프롬프트 템플릿
 */
export const COMPLEXITY_PROMPTS = {
  simple: `간단한 시나리오입니다. 3-5개의 기본적인 액션으로 구성해주세요.`,
  medium: `중간 복잡도 시나리오입니다. 5-10개의 액션으로 구성하고, 검증 단계를 포함해주세요.`,
  complex: `복잡한 시나리오입니다. 10-15개의 액션으로 세분화하고, 다양한 검증과 대기 조건을 포함해주세요.`,
};

/**
 * Few-shot learning을 위한 예시
 */
export const ANALYSIS_EXAMPLES = `
### 예시 1: 간단한 로그인 시나리오
**입력**: "로그인 페이지에서 이메일과 비밀번호 입력 후 로그인"
**출력**:
\`\`\`json
{
  "steps": [
    {
      "id": "step-1",
      "action": "navigate",
      "description": "로그인 페이지로 이동",
      "selector": "",
      "value": "https://example.com/login",
      "expectedResult": "로그인 페이지가 로드됨"
    },
    {
      "id": "step-2", 
      "action": "type",
      "description": "이메일 주소 입력",
      "selector": "[data-testid='email-input'], #email, input[type='email']",
      "value": "user@example.com",
      "expectedResult": "이메일이 입력필드에 표시됨"
    },
    {
      "id": "step-3",
      "action": "type", 
      "description": "비밀번호 입력",
      "selector": "[data-testid='password-input'], #password, input[type='password']",
      "value": "password123",
      "expectedResult": "비밀번호가 마스킹되어 표시됨"
    },
    {
      "id": "step-4",
      "action": "click",
      "description": "로그인 버튼 클릭",
      "selector": "[data-testid='login-button'], button:has-text('로그인'), .login-btn",
      "expectedResult": "로그인 프로세스 시작"
    },
    {
      "id": "step-5",
      "action": "verify",
      "description": "로그인 성공 확인",
      "selector": "[data-testid='user-menu'], .user-profile, :has-text('환영합니다')",
      "waitCondition": "visible",
      "expectedResult": "사용자 메뉴 또는 환영 메시지 표시"
    }
  ],
  "confidence": 0.95,
  "suggestions": ["이메일과 비밀번호 검증 로직 추가 고려"],
  "warnings": [],
  "metadata": {
    "complexity": "simple",
    "estimatedDuration": 15,
    "requiredPermissions": ["basic-auth"]
  }
}
\`\`\`

### 예시 2: 상품 주문 시나리오  
**입력**: "상품을 검색하고 장바구니에 추가한 후 결제 페이지로 이동"
**출력**:
\`\`\`json
{
  "steps": [
    {
      "id": "step-1",
      "action": "type",
      "description": "검색어 입력",
      "selector": "[data-testid='search-input'], #search, .search-box input",
      "value": "노트북",
      "expectedResult": "검색어가 입력됨"
    },
    {
      "id": "step-2", 
      "action": "click",
      "description": "검색 버튼 클릭",
      "selector": "[data-testid='search-button'], button:has-text('검색'), .search-btn",
      "expectedResult": "검색 결과 페이지로 이동"
    },
    {
      "id": "step-3",
      "action": "wait",
      "description": "검색 결과 로딩 대기",
      "waitCondition": ".product-list:visible, [data-testid='product-grid']:visible",
      "expectedResult": "상품 목록이 표시됨"
    },
    {
      "id": "step-4",
      "action": "click",
      "description": "첫 번째 상품 선택",
      "selector": ".product-item:first-child, [data-testid='product-0']",
      "expectedResult": "상품 상세 페이지로 이동"
    },
    {
      "id": "step-5",
      "action": "click",
      "description": "장바구니 추가",
      "selector": "[data-testid='add-to-cart'], button:has-text('장바구니'), .add-cart-btn",
      "expectedResult": "장바구니에 상품 추가됨"
    },
    {
      "id": "step-6",
      "action": "verify",
      "description": "장바구니 추가 확인",
      "selector": ".cart-count, [data-testid='cart-badge']",
      "expectedResult": "장바구니 개수가 증가함"
    },
    {
      "id": "step-7",
      "action": "click",
      "description": "장바구니 이동",
      "selector": "[data-testid='cart-link'], .cart-icon, :has-text('장바구니')",
      "expectedResult": "장바구니 페이지로 이동"
    },
    {
      "id": "step-8",
      "action": "click",
      "description": "결제하기 버튼 클릭",
      "selector": "[data-testid='checkout-button'], button:has-text('결제'), .checkout-btn",
      "expectedResult": "결제 페이지로 이동"
    }
  ],
  "confidence": 0.85,
  "suggestions": ["상품 수량 선택 단계 추가 고려", "로그인 상태 확인 필요"],
  "warnings": ["결제 진행 시 실제 결제 발생 주의"],
  "metadata": {
    "complexity": "medium", 
    "estimatedDuration": 45,
    "requiredPermissions": ["basic-interaction", "cart-access"]
  }
}
\`\`\`
`;

/**
 * 프롬프트 생성 유틸리티
 */
export function generateScenarioPrompt(params: {
  scenario: string;
  url: string;
  complexity?: 'simple' | 'medium' | 'complex';
}): string {
  const { scenario, url, complexity = 'medium' } = params;
  
  return SCENARIO_ANALYSIS_PROMPT
    .replace('{scenario}', scenario)
    .replace('{url}', url)
    .replace('{complexity}', complexity)
    .replace('{examples}', ANALYSIS_EXAMPLES);
}

/**
 * 복잡도 자동 감지
 */
export function detectComplexity(scenario: string): 'simple' | 'medium' | 'complex' {
  const wordCount = scenario.split(/\s+/).length;
  const sentenceCount = scenario.split(/[.!?]+/).filter(s => s.trim()).length;
  const actionWords = ['클릭', '입력', '선택', '확인', '이동', '검색', '추가', '삭제', '수정', '저장', '로그인', '등록', '결제', '주문'];
  const actionCount = actionWords.reduce((count, word) => 
    count + (scenario.includes(word) ? 1 : 0), 0);

  // 조건문과 복합 액션 키워드
  const complexKeywords = ['후', '다음', '그리고', '또는', '만약', '경우', '때', '완료'];
  const complexCount = complexKeywords.reduce((count, word) => 
    count + (scenario.includes(word) ? 1 : 0), 0);

  if (wordCount <= 5 && actionCount <= 1) {
    return 'simple';
  } else if (wordCount <= 20 && sentenceCount <= 2 && complexCount <= 2) {
    return 'medium';
  } else {
    return 'complex';
  }
}

/**
 * 프롬프트 검증
 */
export function validatePromptParams(params: {
  scenario: string;
  url: string;
}): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!params.scenario || params.scenario.trim().length < 5) {
    errors.push('시나리오는 최소 5자 이상이어야 합니다');
  }
  
  if (!params.url || !isValidUrl(params.url)) {
    errors.push('유효한 URL을 제공해야 합니다');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}