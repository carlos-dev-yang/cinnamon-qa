# Cinnamon-QA Product Requirements Document

## 1. Project Overview

### 1.1 Project Information
- **Project Name**: Cinnamon-QA (QA part subject to change)
- **Version**: 1.0.0 (MVP)
- **Document Date**: 2025-01-06
- **Last Updated**: Added adaptive test execution strategy

### 1.2 Project Purpose
A web-based QA automation tool that analyzes natural language test scenarios through AI and automatically performs adaptive E2E testing with real-time feedback loops.

### 1.3 Target Users
- QA Engineers
- Solo Developers
- Non-technical Staff
- Development teams with rapid deployment cycles who struggle to allocate time for testing

### 1.4 Core Values
- **Accessibility**: Write test scenarios in natural language
- **Intelligence**: AI-based scenario analysis with adaptive execution
- **Real-time**: Live test progress monitoring with feedback loops
- **Reliability**: Isolated container execution with automatic recovery
- **Persistence**: Background test execution support

## 2. Technology Stack

### 2.1 Frontend
- **Framework**: React (No Next.js)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: React Context/Zustand
- **Type Safety**: tRPC client
- **Real-time**: SSE (Server-Sent Events)

### 2.2 Backend
- **Runtime**: Node.js
- **Framework**: Fastify
- **Language**: TypeScript
- **API Layer**: tRPC
- **Queue**: Redis with BullMQ
- **Worker**: Separate Node.js processes

### 2.3 Database & Storage
- **Database**: Supabase (PostgreSQL)
- **File Storage**: Supabase Storage (WebP screenshots)
- **Cache**: Redis
- **Data Access**: Repository pattern package

### 2.4 AI & Testing
- **AI Model**: Google Gemini
- **AI Integration**: Direct API (no LangChain initially)
- **E2E Testing**: Playwright-MCP (Docker Container)
- **Container Management**: Isolated pool with exclusive allocation

### 2.5 Infrastructure
- **Container**: Docker & Docker Compose
- **Container Pool**: Multiple MCP instances
- **CI**: GitHub Actions
- **Monitoring**: Custom metrics dashboard

## 3. System Architecture

### 3.1 Enhanced Architecture
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│  API Server │────▶│   Worker    │────▶│ Container   │
│   (React)   │◀────│  (Fastify)  │◀────│  (Adaptive) │◀────│    Pool     │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
       │                    │                    │                    │
       │                    ▼                    ▼                    ▼
       │              ┌─────────┐         ┌─────────────┐     ┌─────────────┐
       │              │  Redis  │         │   Gemini    │     │MCP Container│
       │              │ BullMQ  │         │     API     │     │  (Isolated) │
       │              └─────────┘         └─────────────┘     └─────────────┘
       │                    │                    │                    │
       │                    ▼                    ▼                    ▼
       │              ┌─────────┐         ┌─────────────┐     ┌─────────────┐
       └─────────────▶│Database │         │  Feedback   │     │   State     │
                      │ Package │         │    Loop     │     │  Capture    │
                      └─────────┘         └─────────────┘     └─────────────┘
```

### 3.2 Communication Flow
1. **Client ↔ API Server**: tRPC (HTTP) + SSE (Real-time updates)
2. **API Server ↔ Worker**: Redis Queue (BullMQ)
3. **Worker ↔ AI**: Adaptive communication with validation
4. **Worker ↔ MCP**: Exclusive container per test
5. **Data Storage**: Via database package abstraction

## 4. Core Features

### 4.1 Adaptive Test Scenario Analysis
#### Feature Description
- Natural language test scenario input
- AI analyzes and structures test cases
- Real-time validation against actual page state
- Dynamic test plan adaptation

#### Detailed Flow
1. User inputs test URL and scenario
2. AI (Gemini) analyzes and refines scenario
3. Initial test steps generation
4. Page state validation before execution
5. Adaptive step modification based on actual UI

### 4.2 Intelligent E2E Test Execution
#### Feature Description
- Isolated container per test execution
- Adaptive step execution with AI guidance
- Automatic failure recovery mechanisms
- Background execution with state persistence

#### Technical Implementation
- Container pool management for isolation
- State capture at each step
- AI validation before step execution
- Recovery strategies for common failures

### 4.3 Real-time Progress Monitoring
#### Feature Description
- SSE-based live test progress
- Step-by-step success/failure status
- Adaptive changes notification
- Visual feedback with screenshots

#### Event Types
```typescript
interface TestProgressEvent {
  type: 'step_start' | 'step_complete' | 'step_error' | 
        'step_adapted' | 'recovery_attempted' | 'test_complete';
  stepId: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'adapted';
  adaptation?: {
    reason: string;
    originalStep: TestStep;
    newStep: TestStep;
  };
  message?: string;
  screenshot?: string;
  pageState?: PageStateSummary;
  timestamp: Date;
}
```

### 4.4 Enhanced Test Result Storage
#### Stored Data
- Complete test execution history
- Step-by-step execution results with adaptations
- WebP screenshots (90% quality)
- Page state snapshots (JSONB)
- Console logs and network activity
- Adaptation and recovery history

#### Report Format
- Interactive HTML report
- Adaptation timeline view
- Screenshot gallery with annotations
- Performance metrics dashboard

### 4.5 Test Case Management
#### Features
- Save and reuse test cases
- Clone and modify existing tests
- Execution history with adaptations
- Learning from successful patterns

## 5. Data Model

### 5.1 Core Entities

#### TestCase (Enhanced)
```typescript
interface TestCase {
  id: string;
  name: string;
  url: string;
  originalScenario: string;
  refinedScenario: string;
  testSteps: TestStep[];
  adaptationPatterns: AdaptationPattern[]; // New
  reliabilityScore: number;                // New
  createdAt: Date;
  updatedAt: Date;
}
```

#### TestRun (Enhanced)
```typescript
interface TestRun {
  id: string;
  testCaseId: string;
  containerId?: string;                    // New
  status: 'pending' | 'running' | 'completed' | 'failed' | 'adapted';
  adaptationCount: number;                 // New
  recoveryAttempts: number;                // New
  startedAt: Date;
  completedAt?: Date;
  totalSteps: number;
  completedSteps: number;
  failedSteps: number;
  adaptedSteps: number;                    // New
}
```

#### TestStep (Enhanced)
```typescript
interface TestStep {
  id: string;
  testRunId: string;
  stepNumber: number;
  action: string;
  selector?: string;
  value?: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'adapted';
  pageStateBefore?: PageState;            // New
  pageStateAfter?: PageState;             // New
  adaptations?: StepAdaptation[];         // New
  recoveryAttempts?: RecoveryAttempt[];   // New
  errorMessage?: string;
  snapshotUrl?: string;
  domState?: object;
  consoleLogs?: string[];
  executedAt?: Date;
  duration?: number;
}
```

#### New Entities
```typescript
interface PageState {
  url: string;
  title: string;
  readyState: string;
  visibleElements: ElementInfo[];
  interactableElements: ElementInfo[];
  screenshot?: string;
  capturedAt: Date;
}

interface StepAdaptation {
  reason: string;
  originalAction: string;
  adaptedAction: string;
  confidence: number;
  timestamp: Date;
}

interface ContainerAllocation {
  id: string;
  containerId: string;
  testRunId: string;
  allocatedAt: Date;
  releasedAt?: Date;
  status: 'active' | 'released';
}
```

## 6. API Design

### 6.1 Enhanced tRPC Router
```typescript
// Test Case Routes
- testCase.create
- testCase.list
- testCase.get
- testCase.duplicate
- testCase.getAdaptationPatterns    // New

// Test Run Routes
- testRun.create
- testRun.get
- testRun.subscribe (SSE)
- testRun.getAdaptationHistory      // New
- testRun.getContainerStatus        // New

// Test Step Routes
- testStep.list
- testStep.getPageState             // New
- testStep.getAdaptations           // New

// Container Management Routes      // New
- container.getPoolStatus
- container.allocate
- container.release
```

### 6.2 Worker Job Queue
```typescript
interface TestJob {
  id: string;
  testRunId: string;
  testCaseId: string;
  priority: number;
  containerId?: string;              // New
  adaptiveMode: boolean;             // New
  maxAdaptations: number;            // New
  createdAt: Date;
}
```

## 7. Adaptive Execution Strategy

### 7.1 Container Isolation
- Exclusive container allocation per test
- Automatic cleanup and reset
- Health monitoring and recovery
- Pool management for scalability

### 7.2 AI-Driven Adaptation
- Pre-execution validation
- Dynamic step modification
- Failure analysis and recovery
- Learning from patterns

### 7.3 Feedback Loop
- Success/failure pattern recording
- Selector reliability scoring
- Adaptation effectiveness tracking
- Continuous improvement

## 8. UI/UX Requirements

### 8.1 Main Screens
1. **Test Creation Screen**
   - URL input field
   - Scenario textarea with examples
   - AI analysis preview with confidence score
   - Adaptation settings toggle

2. **Test Execution Screen**
   - Real-time progress with adaptation indicators
   - Live screenshot preview
   - State change notifications
   - Recovery attempt visualization

3. **Test History Screen**
   - Test case list with reliability scores
   - Execution history with adaptation timeline
   - Detailed results with learning insights
   - Pattern analysis dashboard

### 8.2 Design Principles
- Minimal UI with Tailwind CSS
- Function-focused interface
- Real-time feedback emphasis
- Adaptive change highlighting

## 9. Development Roadmap

### Phase 1: MVP Foundation (Weeks 1-4)
- [x] Project structure setup
- [x] Database schema design
- [x] Storage strategy definition
- [ ] Basic API server implementation
- [ ] Worker process setup
- [ ] Database package creation
- [ ] Redis/BullMQ integration

### Phase 2: Core Features (Weeks 5-8)
- [ ] Gemini API integration
- [ ] Basic MCP container integration
- [ ] Container pool management
- [ ] Basic UI implementation
- [ ] SSE real-time communication
- [ ] WebP screenshot capture

### Phase 3: Adaptive Execution (Weeks 9-12)
- [ ] Page state capture implementation
- [ ] AI validation integration
- [ ] Adaptive step execution
- [ ] Failure recovery mechanisms
- [ ] Feedback loop implementation

### Phase 4: Stabilization (Weeks 13-16)
- [ ] Error handling refinement
- [ ] Performance optimization
- [ ] Monitoring dashboard
- [ ] Documentation completion

### Phase 5: Future Enhancements
- [ ] Google SSO authentication
- [ ] Multi-test concurrent execution
- [ ] Test scheduling
- [ ] Webhook notifications
- [ ] Video recording (Premium)
- [ ] Safari support

## 10. Constraints and Assumptions

### 10.1 Technical Constraints
- Chrome browser only (initially)
- Single test execution per container
- Public websites only (no auth initially)
- Maximum test duration: 30 minutes

### 10.2 Operational Assumptions
- No initial scaling considerations
- Manual data retention management
- Direct cost monitoring
- English UI only (initially)

## 11. Success Metrics

### 11.1 Functional Success Metrics
- Natural language interpretation accuracy: >90%
- Test execution success rate: >95%
- Successful adaptation rate: >80%
- Real-time update latency: <1 second
- Container isolation: 100%

### 11.2 Usability Metrics
- Test creation time: 70% reduction
- Non-technical user success rate: >80%
- Adaptation effectiveness: >75%
- Recovery success rate: >60%

## 12. Security Considerations

### 12.1 Current Phase (MVP)
- Environment variable API key management
- Internal network communication
- Container isolation for security
- No user authentication

### 12.2 Future Plans
- Google SSO implementation
- API rate limiting
- GitHub Secrets integration
- User resource isolation
- RBAC implementation

## 13. Monitoring and Observability

### 13.1 Key Metrics
- Container pool utilization
- Test execution duration
- Adaptation frequency
- AI API usage and costs
- Storage consumption

### 13.2 Dashboards
- Real-time test execution monitor
- Container health dashboard
- Adaptation effectiveness report
- Cost analysis dashboard

## 14. Appendix

### 14.1 Glossary
- **MCP**: Model Context Protocol
- **E2E**: End-to-End Testing
- **SSE**: Server-Sent Events
- **Worker**: Background job processor
- **Adaptive Execution**: Dynamic test adjustment based on real-time feedback
- **Container Pool**: Managed collection of isolated test environments

### 14.2 References
- Playwright MCP Documentation
- Google Gemini API Reference
- Supabase Documentation
- tRPC Documentation
- BullMQ Documentation
- Adaptive Test Execution Strategy Document