# 5.2 Natural Language Scenario Analysis Engine

> **태스크**: Task 5.2 - Implement Natural Language Scenario Analysis Engine  
> **시작일**: 2025-07-13  
> **상태**: 📋 계획 단계  

## 📋 계획 개요

자연어로 작성된 테스트 시나리오를 구조화된 테스트 스텝으로 변환하는 AI 분석 엔진을 구현합니다. Google Gemini API를 활용하여 사용자 입력을 파싱하고, 실행 가능한 브라우저 액션으로 변환합니다.

## 🎯 구현 목표

### 1. 핵심 기능
- **자연어 파싱**: 사용자 시나리오를 분석하여 의도 파악
- **구조화된 변환**: 브라우저 액션으로 매핑 가능한 스텝 생성
- **검증 및 보완**: 불완전한 시나리오 감지 및 개선 제안
- **다양한 입력 처리**: 다양한 표현 방식과 복잡도 지원

### 2. 출력 형식
```typescript
interface AnalysisResult {
  steps: TestStep[];
  confidence: number;
  suggestions: string[];
  warnings: string[];
  metadata: {
    complexity: 'simple' | 'medium' | 'complex';
    estimatedDuration: number;
    requiredPermissions: string[];
  };
}
```

## 🛠️ 구현 계획

### Phase 1: 프롬프트 템플릿 시스템
**파일**: `src/ai/prompts/scenario-analysis.ts`
- 시나리오 분석용 프롬프트 템플릿 정의
- 다양한 복잡도별 템플릿 구성
- 예시 입출력 포함한 few-shot learning 프롬프트

### Phase 2: 파서 및 검증 엔진
**파일**: `src/ai/parsers/scenario-parser.ts`
- Gemini 응답을 구조화된 데이터로 변환
- JSON 스키마 검증 및 에러 핸들링
- 불완전한 응답에 대한 재시도 로직

### Phase 3: 시나리오 분석 서비스
**파일**: `src/ai/services/scenario-analyzer.ts`
- 메인 분석 로직 통합
- 다단계 분석 워크플로우 구현
- 결과 검증 및 품질 보장

### Phase 4: tRPC 엔드포인트 구현
**파일**: `src/trpc/routers/ai.ts` 업데이트
- `analyzeScenario` 프로시저 완성
- 입력 검증 및 에러 처리
- 실시간 진행 상황 피드백

## 📝 구현 상세 계획

### 1. 프롬프트 설계 전략
```typescript
// 기본 프롬프트 구조
const SCENARIO_ANALYSIS_PROMPT = `
당신은 웹 테스트 시나리오 분석 전문가입니다.
사용자가 제공한 자연어 시나리오를 구조화된 테스트 스텝으로 변환해주세요.

입력 시나리오: {scenario}
대상 URL: {url}

출력 형식은 다음 JSON 스키마를 따라주세요:
{schema}

주의사항:
- 각 스텝은 구체적이고 실행 가능해야 합니다
- 선택자는 가능한 한 견고하게 작성해주세요
- 예상되는 결과를 명확히 정의해주세요
`;
```

### 2. 분석 파이프라인
```
자연어 입력 → 전처리 → Gemini 분석 → 파싱 → 검증 → 후처리 → 결과 반환
```

### 3. 에러 처리 시나리오
- **파싱 실패**: 재시도 또는 부분 결과 반환
- **불완전한 시나리오**: 사용자에게 추가 정보 요청
- **복잡도 초과**: 단계별 분해 제안

## 🧪 테스트 계획

### 1. 단위 테스트
- 프롬프트 템플릿 생성 테스트
- 파서 정확성 검증
- 각 서비스 함수별 테스트

### 2. 통합 테스트
- 실제 Gemini API와 연동 테스트
- 다양한 시나리오 복잡도 테스트
- 에러 상황 시뮬레이션

### 3. 테스트 시나리오 예시
```
간단: "로그인 페이지에서 이메일과 비밀번호 입력 후 로그인"
중간: "상품을 장바구니에 추가하고 결제 페이지까지 진행"
복잡: "사용자 계정 생성 후 프로필 설정 완료하고 첫 주문 진행"
```

## 📂 예상 파일 구조

```
src/ai/
├── prompts/
│   ├── scenario-analysis.ts     # 프롬프트 템플릿
│   ├── examples.ts              # Few-shot 예시
│   └── templates.ts             # 동적 템플릿 생성
├── parsers/
│   ├── scenario-parser.ts       # Gemini 응답 파싱
│   ├── validation.ts            # 스키마 검증
│   └── recovery.ts              # 에러 복구 로직
├── services/
│   ├── scenario-analyzer.ts     # 메인 분석 서비스
│   ├── preprocessing.ts         # 입력 전처리
│   └── postprocessing.ts        # 결과 후처리
└── types/
    └── scenario.ts              # 시나리오 관련 타입
```

## 🔗 의존성

### 기존 컴포넌트 활용
- **GeminiClient**: 5.1에서 구현된 API 클라이언트 활용
- **타입 시스템**: 기존 TestStep, TestCase 타입 확장
- **에러 처리**: 기존 GeminiError 시스템 확장

### 새로운 의존성
- 추가 Zod 스키마 정의
- 프롬프트 템플릿 관리 시스템

## ⏱️ 예상 소요 시간

- **Phase 1**: 프롬프트 템플릿 (30분)
- **Phase 2**: 파서 구현 (45분)  
- **Phase 3**: 분석 서비스 (45분)
- **Phase 4**: tRPC 통합 (30분)
- **테스트 및 검증**: (30분)

**총 예상 시간**: 약 3시간

## 🚀 성공 기준

1. ✅ 간단한 시나리오 (5-10단어) 95% 정확도
2. ✅ 중간 복잡도 시나리오 (1-2문장) 85% 정확도  
3. ✅ 복잡한 시나리오 (3-5문장) 70% 정확도
4. ✅ tRPC 엔드포인트 정상 동작
5. ✅ 에러 처리 및 복구 메커니즘 작동
6. ✅ 종합 테스트 통과

---

**다음 단계**: Phase 1부터 순차적으로 구현 시작