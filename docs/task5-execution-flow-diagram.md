# Task 5: AI Integration Execution Flow Diagrams

## 🎬 전체 시스템 플로우

```mermaid
graph TB
    subgraph "사용자 입력"
        A[자연어 시나리오 입력<br/>'상품페이지에서 PS5 검색하고 장바구니 담기']
    end
    
    subgraph "Phase 0: MCP 준비"
        B[Container 할당]
        C[MCP 연결 설정]
        D[MCP 도구 목록 수집<br/>navigate, click, fill, get_text, etc.]
    end
    
    subgraph "Phase 1: AI 분석"
        E[Gemini에게 도구 정보와<br/>시나리오 전달]
        F[AI가 도구 기반<br/>실행 계획 생성]
        G[각 스텝별 신뢰도<br/>점수 계산]
    end
    
    subgraph "Phase 2: 적응형 실행"
        H[스텝별 순차 실행]
        I{MCP 실행 성공?}
        J[AI가 MCP 응답 분석]
        K[성공: 다음 스텝 진행]
        L[실패: AI 적응 제안]
        M[적응된 스텝 재실행]
        N[적응 패턴 학습 저장]
    end
    
    subgraph "Phase 3: 검증 및 학습"
        O[검증 스텝 실행<br/>상품명, 가격 확인]
        P[AI가 텍스트 내용<br/>의미론적 분석]
        Q[전체 결과 종합 분석]
        R[학습 시스템에<br/>피드백 전달]
    end
    
    A --> B
    B --> C
    C --> D
    D --> E
    E --> F
    F --> G
    G --> H
    H --> I
    I -->|성공| J
    I -->|실패| L
    J --> K
    K --> H
    L --> M
    M --> I
    M --> N
    N --> H
    H --> O
    O --> P
    P --> Q
    Q --> R
```

## 🔄 세부 실행 프로세스

### Phase 0: MCP 도구 준비

```mermaid
sequenceDiagram
    participant User as 사용자
    participant API as API Server
    participant Pool as Container Pool
    participant MCP as MCP Connection
    participant AI as Gemini AI
    
    User->>API: 자연어 시나리오 입력
    API->>Pool: Container 할당 요청
    Pool->>API: Container 정보 반환
    API->>MCP: MCP 연결 설정
    MCP->>API: 연결 성공
    API->>MCP: 사용 가능한 도구 목록 요청
    MCP->>API: 도구 목록 반환<br/>(navigate, click, fill, get_text, etc.)
    API->>AI: 도구 정보와 시나리오 전달
```

### Phase 1: AI 시나리오 분석

```mermaid
flowchart TD
    A[자연어 시나리오<br/>'상품페이지에서 PS5 검색하고 장바구니 담기'] --> B[Gemini AI 분석]
    
    B --> C[구조화된 스텝 생성]
    
    C --> D1[Step 1: navigate<br/>url: 'https://site.com/products'<br/>confidence: 0.95]
    C --> D2[Step 2: wait_for_element<br/>selector: 'input[name=search]'<br/>confidence: 0.90]
    C --> D3[Step 3: fill<br/>selector: 'input[name=search]'<br/>value: 'ps5'<br/>confidence: 0.88]
    C --> D4[Step 4: click<br/>selector: 'button[type=submit]'<br/>confidence: 0.85]
    C --> D5[Step 5: wait_for_element<br/>selector: '.product-list'<br/>confidence: 0.80]
    C --> D6[Step 6: click<br/>selector: '.product:first .add-cart'<br/>confidence: 0.75]
    C --> D7[Step 7: get_text<br/>selector: '.cart .product-name'<br/>confidence: 0.70]
    C --> D8[Step 8: get_text<br/>selector: '.cart .price'<br/>confidence: 0.70]
    
    D1 --> E[신뢰도 검증 및<br/>실행 준비]
    D2 --> E
    D3 --> E
    D4 --> E
    D5 --> E
    D6 --> E
    D7 --> E
    D8 --> E
```

### Phase 2: 적응형 실행 루프

```mermaid
graph TD
    A[스텝 실행 시작] --> B[MCP로 스텝 실행]
    B --> C{MCP 응답 성공?}
    
    C -->|성공| D[AI가 응답 분석]
    D --> E{예상 결과와 일치?}
    E -->|예| F[성공 로깅 및<br/>다음 스텝 진행]
    E -->|아니오| G[AI가 이유 분석<br/>및 개선점 제안]
    
    C -->|실패| H[AI가 실패 원인 분석]
    H --> I[페이지 상태 수집]
    I --> J[AI가 적응 방법 제안]
    J --> K[적응된 스텝 생성]
    K --> L[적응된 스텝 재실행]
    L --> M{재실행 성공?}
    M -->|성공| N[적응 패턴 학습 저장]
    M -->|실패| O[추가 적응 시도<br/>또는 실패 처리]
    
    N --> F
    O --> P[최종 실패 기록]
    F --> Q{마지막 스텝?}
    Q -->|아니오| A
    Q -->|예| R[검증 단계로 이동]
    
    style A fill:#e1f5fe
    style F fill:#c8e6c9
    style P fill:#ffcdd2
    style R fill:#fff3e0
```

### Phase 3: 검증 및 학습

```mermaid
sequenceDiagram
    participant Exec as Execution Engine
    participant MCP as MCP Connection
    participant AI as Gemini AI
    participant Learn as Learning System
    participant DB as Database
    
    Note over Exec,Learn: 검증 단계 시작
    
    Exec->>MCP: get_text('.cart .product-name')
    MCP->>Exec: "PlayStation 5 Digital Edition"
    Exec->>AI: 텍스트 검증 분석<br/>기대값: "PS5"
    AI->>Exec: 검증 성공 (confidence: 0.95)<br/>"PlayStation 5"에 "PS5" 포함됨
    
    Exec->>MCP: get_text('.cart .price')
    MCP->>Exec: "599,000원"
    Exec->>AI: 가격 검증 분석<br/>기대값: "650,000원"
    AI->>Exec: 검증 실패 (confidence: 0.98)<br/>실제 599,000원 vs 예상 650,000원
    
    Note over Exec,Learn: 종합 분석 및 학습
    
    Exec->>AI: 전체 결과 종합 분석
    AI->>Exec: 7/8 스텝 성공, 1회 적응,<br/>가격 검증 실패로 전체 실패
    
    Exec->>Learn: 포괄적 피드백 전달
    Learn->>DB: 실행 결과 저장
    Learn->>DB: 적응 패턴 저장
    Learn->>DB: 도구 효과성 업데이트
```

## 📊 실시간 SSE 업데이트 플로우

```mermaid
graph LR
    subgraph "Backend Execution"
        A[스텝 실행] --> B[MCP 응답]
        B --> C[AI 분석]
        C --> D[결과 생성]
    end
    
    subgraph "SSE Broadcasting"
        D --> E[SSE Event 발송]
        E --> F[step_start]
        E --> G[step_complete]
        E --> H[step_error]
        E --> I[step_adapted]
        E --> J[verification_result]
        E --> K[test_complete]
    end
    
    subgraph "Frontend Updates"
        F --> L[UI 업데이트]
        G --> L
        H --> L
        I --> L
        J --> L
        K --> L
    end
    
    style A fill:#e3f2fd
    style E fill:#f3e5f5
    style L fill:#e8f5e8
```

## 🧠 AI 적응 과정 상세

```mermaid
flowchart TD
    A[스텝 실행 실패] --> B[MCP 에러 정보 수집]
    B --> C[현재 페이지 상태 캡처]
    C --> D[AI에게 컨텍스트 전달]
    
    D --> E[AI 분석 시작]
    E --> F{실패 원인 분석}
    
    F --> G1[셀렉터 문제]
    F --> G2[타이밍 문제]
    F --> G3[페이지 구조 변경]
    F --> G4[네트워크 문제]
    
    G1 --> H1[페이지 HTML 분석하여<br/>대체 셀렉터 찾기]
    G2 --> H2[대기 시간 증가 또는<br/>동적 대기 조건 추가]
    G3 --> H3[새로운 페이지 구조에<br/>맞는 스텝 재설계]
    G4 --> H4[재시도 로직 또는<br/>대체 경로 제안]
    
    H1 --> I[적응된 스텝 생성]
    H2 --> I
    H3 --> I
    H4 --> I
    
    I --> J[신뢰도 점수 계산]
    J --> K{신뢰도 > 임계값?}
    
    K -->|예| L[적응된 스텝 실행]
    K -->|아니오| M[수동 개입 요청 또는<br/>테스트 중단]
    
    L --> N{실행 성공?}
    N -->|성공| O[적응 패턴 학습 저장]
    N -->|실패| P[추가 적응 시도]
    
    style A fill:#ffcdd2
    style E fill:#e1f5fe
    style I fill:#fff9c4
    style O fill:#c8e6c9
```

## 📈 학습 시스템 데이터 플로우

```mermaid
graph TB
    subgraph "Data Collection"
        A[스텝 실행 결과]
        B[적응 기록]
        C[MCP 도구 성능]
        D[검증 결과]
        E[사이트별 패턴]
    end
    
    subgraph "Pattern Recognition"
        F[성공 패턴 인식]
        G[실패 패턴 분석]
        H[셀렉터 매핑]
        I[사이트 특성 학습]
    end
    
    subgraph "Knowledge Base"
        J[적응 룰 DB]
        K[셀렉터 패턴 DB]
        L[사이트 프로파일 DB]
        M[도구 효과성 DB]
    end
    
    subgraph "Recommendation Engine"
        N[시나리오 분석 개선]
        O[셀렉터 추천]
        P[적응 전략 추천]
        Q[도구 선택 최적화]
    end
    
    A --> F
    B --> G
    C --> I
    D --> F
    E --> H
    
    F --> J
    G --> J
    H --> K
    I --> L
    C --> M
    
    J --> P
    K --> O
    L --> N
    M --> Q
    
    style A fill:#e3f2fd
    style F fill:#f3e5f5
    style J fill:#fff3e0
    style N fill:#e8f5e8
```

## 🎯 사용자 시나리오 예시 플로우

```mermaid
journey
    title PS5 검색 및 장바구니 담기 테스트 여정
    section 입력 단계
      자연어 시나리오 입력: 5: 사용자
      AI 분석 및 계획 수립: 4: AI
      신뢰도 검증: 3: System
    section 실행 단계
      상품페이지 접속: 5: MCP
      검색창 찾기 (실패): 1: MCP
      AI 적응 및 재시도: 4: AI
      검색어 입력: 5: MCP
      검색 실행: 5: MCP
      상품 장바구니 담기: 4: MCP
    section 검증 단계
      상품명 확인 (성공): 5: AI
      가격 확인 (실패): 2: AI
      결과 분석: 3: AI
    section 학습 단계
      패턴 저장: 4: Learning
      효과성 업데이트: 4: Learning
      추천 개선: 3: Learning
```

이 다이어그램들은 Task 5의 전체 실행 흐름을 시각적으로 보여주며, 각 단계에서의 AI-MCP 상호작용과 학습 과정을 명확히 나타냅니다.