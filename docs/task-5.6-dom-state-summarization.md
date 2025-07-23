# Task 5.6: DOM State Summarization

> **태스크**: Task 5.6 - DOM State Summarization  
> **시작일**: 2025-07-14  
> **상태**: 📋 계획 단계  
> **예상 시간**: 1.5시간

## 📋 개요

웹 페이지의 DOM 상태를 AI가 이해할 수 있는 형식으로 요약하는 시스템을 구축합니다. Playwright MCP에서 제공하는 DOM/접근성 트리 정보를 파싱하여 상호작용 가능한 요소를 추출하고, AI의 의사결정을 위한 구조화된 페이지 상태 요약을 생성합니다.

## 🎯 구현 목표

### 1. 핵심 기능
- **DOM 데이터 파싱**: MCP에서 받은 원시 DOM/접근성 트리 분석
- **상호작용 요소 추출**: 클릭 가능한 버튼, 링크, 입력 필드 등 식별
- **페이지 구조 분석**: 주요 섹션, 네비게이션, 콘텐츠 영역 파악
- **AI 친화적 요약**: 자연어 형태의 페이지 상태 설명 생성
- **액션 추천**: 현재 페이지에서 수행 가능한 작업 제안

### 2. 성공 기준
- ✅ DOM 정보 파싱 성공
- ✅ 상호작용 요소 정확 추출
- ✅ AI가 이해할 수 있는 요약 생성
- ✅ 페이지 구조 분석
- ✅ 피드백 루프와 통합

## 🛠️ 구현 계획

### 1. DOMSummarizer 클래스
**파일**: `src/ai/execution/dom-summarizer.ts`

```typescript
import { createLogger } from '@cinnamon-qa/logger';

const logger = createLogger({ context: 'DOMSummarizer' });

export interface DOMElement {
  tagName: string;
  id?: string;
  className?: string;
  textContent?: string;
  attributes: Record<string, string>;
  role?: string;
  accessible: boolean;
  interactive: boolean;
  selector: string;
}

export interface PageState {
  url: string;
  title: string;
  description?: string;
  interactiveElements: DOMElement[];
  forms: FormInfo[];
  navigation: NavigationInfo;
  content: ContentSection[];
  metadata: PageMetadata;
}

export interface FormInfo {
  id?: string;
  action?: string;
  method?: string;
  fields: FormField[];
  submitButtons: DOMElement[];
}

export interface FormField {
  name: string;
  type: string;
  label?: string;
  placeholder?: string;
  required: boolean;
  currentValue?: string;
  selector: string;
}

export interface NavigationInfo {
  links: DOMElement[];
  breadcrumbs: DOMElement[];
  menu: DOMElement[];
}

export interface ContentSection {
  type: 'header' | 'main' | 'aside' | 'footer' | 'article' | 'section';
  title?: string;
  content: string;
  elements: DOMElement[];
}

export interface PageMetadata {
  loadTime?: number;
  elementCount: number;
  interactiveCount: number;
  formCount: number;
  hasErrors: boolean;
  errors?: string[];
}

export interface DOMSummary {
  pageState: PageState;
  actionableElements: DOMElement[];
  recommendedActions: string[];
  pageDescription: string;
  context: string;
}

export class DOMSummarizer {
  
  /**
   * Playwright MCP에서 받은 DOM/접근성 트리 데이터를 파싱
   */
  async parseAccessibilityTree(accessibilityData: any): Promise<PageState> {
    logger.debug('Parsing accessibility tree data', {
      hasData: !!accessibilityData,
      dataType: typeof accessibilityData
    });

    try {
      // 접근성 트리 구조 파싱
      const elements = this.extractElementsFromTree(accessibilityData);
      
      // 상호작용 요소 필터링
      const interactiveElements = this.filterInteractiveElements(elements);
      
      // 폼 정보 추출
      const forms = this.extractFormInformation(elements);
      
      // 네비게이션 요소 추출
      const navigation = this.extractNavigationElements(elements);
      
      // 콘텐츠 섹션 분석
      const content = this.analyzeContentSections(elements);
      
      // 페이지 메타데이터 생성
      const metadata = this.generatePageMetadata(elements);

      const pageState: PageState = {
        url: this.extractURL(accessibilityData),
        title: this.extractTitle(accessibilityData),
        description: this.extractDescription(accessibilityData),
        interactiveElements,
        forms,
        navigation,
        content,
        metadata
      };

      logger.info('Page state parsed successfully', {
        url: pageState.url,
        interactiveCount: interactiveElements.length,
        formCount: forms.length,
        contentSections: content.length
      });

      return pageState;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to parse accessibility tree', { error: errorMessage });
      throw new Error(`DOM 파싱 실패: ${errorMessage}`);
    }
  }

  /**
   * 접근성 트리에서 DOM 요소들 추출
   */
  private extractElementsFromTree(treeData: any): DOMElement[] {
    const elements: DOMElement[] = [];
    
    const processNode = (node: any): void => {
      if (!node) return;

      const element: DOMElement = {
        tagName: node.role || node.name || 'unknown',
        id: node.id,
        className: node.className,
        textContent: node.name || node.value || node.description,
        attributes: node.attributes || {},
        role: node.role,
        accessible: node.accessible !== false,
        interactive: this.isInteractiveRole(node.role),
        selector: this.generateSelector(node)
      };

      elements.push(element);

      // 자식 노드들 재귀 처리
      if (node.children && Array.isArray(node.children)) {
        node.children.forEach(processNode);
      }
    };

    if (treeData.children) {
      treeData.children.forEach(processNode);
    } else if (Array.isArray(treeData)) {
      treeData.forEach(processNode);
    }

    return elements;
  }

  /**
   * 상호작용 가능한 요소들 필터링
   */
  private filterInteractiveElements(elements: DOMElement[]): DOMElement[] {
    return elements.filter(element => {
      return element.interactive || 
             this.isInteractiveTag(element.tagName) ||
             this.hasInteractiveAttributes(element.attributes);
    });
  }

  /**
   * 폼 정보 추출
   */
  private extractFormInformation(elements: DOMElement[]): FormInfo[] {
    const forms: FormInfo[] = [];
    const formElements = elements.filter(el => el.tagName.toLowerCase() === 'form');
    
    for (const formElement of formElements) {
      const fields = this.extractFormFields(elements, formElement);
      const submitButtons = this.findSubmitButtons(elements, formElement);
      
      const form: FormInfo = {
        id: formElement.id,
        action: formElement.attributes.action,
        method: formElement.attributes.method || 'GET',
        fields,
        submitButtons
      };
      
      forms.push(form);
    }

    return forms;
  }

  /**
   * 네비게이션 요소 추출
   */
  private extractNavigationElements(elements: DOMElement[]): NavigationInfo {
    const links = elements.filter(el => 
      el.tagName.toLowerCase() === 'link' || 
      el.role === 'link' ||
      el.tagName.toLowerCase() === 'a'
    );

    const breadcrumbs = elements.filter(el => 
      el.role === 'navigation' && 
      (el.attributes['aria-label']?.includes('breadcrumb') || 
       el.className?.includes('breadcrumb'))
    );

    const menu = elements.filter(el => 
      el.role === 'menu' || 
      el.role === 'menubar' ||
      el.tagName.toLowerCase() === 'nav'
    );

    return { links, breadcrumbs, menu };
  }

  /**
   * 콘텐츠 섹션 분석
   */
  private analyzeContentSections(elements: DOMElement[]): ContentSection[] {
    const sections: ContentSection[] = [];
    
    const sectionTypes = ['header', 'main', 'aside', 'footer', 'article', 'section'];
    
    for (const type of sectionTypes) {
      const sectionElements = elements.filter(el => 
        el.tagName.toLowerCase() === type || 
        el.role === type
      );
      
      for (const sectionEl of sectionElements) {
        const section: ContentSection = {
          type: type as any,
          title: this.extractSectionTitle(sectionEl),
          content: this.extractSectionContent(sectionEl),
          elements: this.findChildElements(elements, sectionEl)
        };
        
        sections.push(section);
      }
    }

    return sections;
  }

  /**
   * 페이지 상태를 AI 친화적 요약으로 변환
   */
  async generatePageSummary(pageState: PageState): Promise<DOMSummary> {
    logger.debug('Generating page summary', {
      url: pageState.url,
      elementCount: pageState.metadata.elementCount
    });

    const actionableElements = this.identifyActionableElements(pageState);
    const recommendedActions = this.generateActionRecommendations(pageState);
    const pageDescription = this.createPageDescription(pageState);
    const context = this.buildContextDescription(pageState);

    const summary: DOMSummary = {
      pageState,
      actionableElements,
      recommendedActions,
      pageDescription,
      context
    };

    logger.info('Page summary generated', {
      actionableCount: actionableElements.length,
      recommendationCount: recommendedActions.length
    });

    return summary;
  }

  /**
   * 현재 페이지에서 수행 가능한 액션들 식별
   */
  private identifyActionableElements(pageState: PageState): DOMElement[] {
    const actionable: DOMElement[] = [];
    
    // 버튼과 링크 추가
    actionable.push(...pageState.interactiveElements.filter(el => 
      el.tagName.toLowerCase() === 'button' || 
      el.role === 'button' ||
      el.tagName.toLowerCase() === 'a' ||
      el.role === 'link'
    ));

    // 입력 필드 추가
    pageState.forms.forEach(form => {
      form.fields.forEach(field => {
        if (field.type !== 'hidden') {
          actionable.push({
            tagName: 'input',
            attributes: { type: field.type, name: field.name },
            textContent: field.label || field.placeholder,
            interactive: true,
            accessible: true,
            selector: field.selector
          });
        }
      });
    });

    return actionable;
  }

  /**
   * AI를 위한 액션 추천 생성
   */
  private generateActionRecommendations(pageState: PageState): string[] {
    const recommendations: string[] = [];

    // 폼 기반 추천
    if (pageState.forms.length > 0) {
      pageState.forms.forEach((form, index) => {
        const requiredFields = form.fields.filter(f => f.required && !f.currentValue);
        if (requiredFields.length > 0) {
          recommendations.push(`Fill required form fields: ${requiredFields.map(f => f.name).join(', ')}`);
        }
        
        if (form.submitButtons.length > 0) {
          recommendations.push(`Submit form using: ${form.submitButtons[0].textContent || 'submit button'}`);
        }
      });
    }

    // 네비게이션 기반 추천
    if (pageState.navigation.links.length > 0) {
      const mainLinks = pageState.navigation.links.slice(0, 3);
      recommendations.push(`Navigate to: ${mainLinks.map(l => l.textContent).join(', ')}`);
    }

    // 상호작용 요소 기반 추천
    const buttons = pageState.interactiveElements.filter(el => 
      el.tagName.toLowerCase() === 'button' || el.role === 'button'
    );
    if (buttons.length > 0) {
      const primaryButtons = buttons.slice(0, 2);
      recommendations.push(`Click buttons: ${primaryButtons.map(b => b.textContent).join(', ')}`);
    }

    return recommendations;
  }

  /**
   * 페이지에 대한 자연어 설명 생성
   */
  private createPageDescription(pageState: PageState): string {
    let description = `Page: ${pageState.title || 'Untitled'} (${pageState.url})\\n\\n`;

    // 주요 콘텐츠 설명
    if (pageState.content.length > 0) {
      description += `Content sections: ${pageState.content.length}\\n`;
      pageState.content.forEach(section => {
        if (section.title) {
          description += `- ${section.type}: ${section.title}\\n`;
        }
      });
    }

    // 폼 정보
    if (pageState.forms.length > 0) {
      description += `\\nForms: ${pageState.forms.length}\\n`;
      pageState.forms.forEach((form, index) => {
        description += `- Form ${index + 1}: ${form.fields.length} fields\\n`;
      });
    }

    // 상호작용 요소 요약
    description += `\\nInteractive elements: ${pageState.interactiveElements.length}`;
    const buttonCount = pageState.interactiveElements.filter(el => 
      el.tagName.toLowerCase() === 'button' || el.role === 'button'
    ).length;
    const linkCount = pageState.interactiveElements.filter(el => 
      el.tagName.toLowerCase() === 'a' || el.role === 'link'
    ).length;
    
    if (buttonCount > 0) description += `, ${buttonCount} buttons`;
    if (linkCount > 0) description += `, ${linkCount} links`;

    return description;
  }

  /**
   * AI 의사결정을 위한 컨텍스트 구성
   */
  private buildContextDescription(pageState: PageState): string {
    const context: string[] = [];

    // 현재 상태
    context.push(`Current page: ${pageState.title || pageState.url}`);
    
    // 주요 액션 가능 요소
    const actionableCount = pageState.interactiveElements.length;
    if (actionableCount > 0) {
      context.push(`${actionableCount} interactive elements available`);
    }

    // 폼 상태
    if (pageState.forms.length > 0) {
      const totalFields = pageState.forms.reduce((sum, form) => sum + form.fields.length, 0);
      context.push(`${pageState.forms.length} forms with ${totalFields} total fields`);
    }

    // 에러 상태
    if (pageState.metadata.hasErrors && pageState.metadata.errors) {
      context.push(`Page has errors: ${pageState.metadata.errors.join(', ')}`);
    }

    return context.join('. ');
  }

  /**
   * 헬퍼 메서드들
   */
  private isInteractiveRole(role?: string): boolean {
    const interactiveRoles = [
      'button', 'link', 'textbox', 'checkbox', 'radio', 
      'combobox', 'listbox', 'menu', 'menuitem', 'tab'
    ];
    return role ? interactiveRoles.includes(role.toLowerCase()) : false;
  }

  private isInteractiveTag(tagName: string): boolean {
    const interactiveTags = [
      'button', 'a', 'input', 'select', 'textarea', 'details', 'summary'
    ];
    return interactiveTags.includes(tagName.toLowerCase());
  }

  private hasInteractiveAttributes(attributes: Record<string, string>): boolean {
    return !!(attributes.onclick || attributes.href || attributes.type);
  }

  private generateSelector(node: any): string {
    // 간단한 CSS 셀렉터 생성
    if (node.id) return `#${node.id}`;
    if (node.className) return `.${node.className.split(' ')[0]}`;
    return node.role || node.name || 'unknown';
  }

  private extractURL(data: any): string {
    return data.url || data.baseURL || 'unknown';
  }

  private extractTitle(data: any): string {
    return data.title || data.name || 'Untitled Page';
  }

  private extractDescription(data: any): string | undefined {
    return data.description || data.summary;
  }

  private extractFormFields(elements: DOMElement[], formElement: DOMElement): FormField[] {
    // 폼 내부의 입력 필드들 추출 (단순화된 구현)
    return elements
      .filter(el => el.tagName.toLowerCase() === 'input' || el.tagName.toLowerCase() === 'textarea')
      .map(el => ({
        name: el.attributes.name || el.id || 'unnamed',
        type: el.attributes.type || 'text',
        label: el.textContent,
        placeholder: el.attributes.placeholder,
        required: el.attributes.required === 'true',
        currentValue: el.attributes.value,
        selector: el.selector
      }));
  }

  private findSubmitButtons(elements: DOMElement[], formElement: DOMElement): DOMElement[] {
    return elements.filter(el => 
      (el.tagName.toLowerCase() === 'button' && el.attributes.type !== 'button') ||
      (el.tagName.toLowerCase() === 'input' && el.attributes.type === 'submit')
    );
  }

  private extractSectionTitle(element: DOMElement): string | undefined {
    return element.textContent || element.attributes.title;
  }

  private extractSectionContent(element: DOMElement): string {
    return element.textContent || '';
  }

  private findChildElements(elements: DOMElement[], parent: DOMElement): DOMElement[] {
    // 단순화된 구현 - 실제로는 DOM 트리 구조를 사용해야 함
    return [];
  }

  private generatePageMetadata(elements: DOMElement[]): PageMetadata {
    const interactiveElements = elements.filter(el => el.interactive);
    const forms = elements.filter(el => el.tagName.toLowerCase() === 'form');
    
    return {
      elementCount: elements.length,
      interactiveCount: interactiveElements.length,
      formCount: forms.length,
      hasErrors: false,
      errors: []
    };
  }
}
```

### 2. DOM State Integration
**파일**: `src/ai/execution/dom-state-manager.ts`

```typescript
import { DOMSummarizer, DOMSummary, PageState } from './dom-summarizer';
import { getFeedbackLoopEngine } from './feedback-loop-engine';
import { getMCPToolManager } from './mcp-tool-manager';
import { createLogger } from '@cinnamon-qa/logger';

const logger = createLogger({ context: 'DOMStateManager' });

export interface DOMStateContext {
  sessionId: string;
  currentPageState?: PageState;
  lastSummary?: DOMSummary;
  stateHistory: PageStateSnapshot[];
  lastUpdated: Date;
}

export interface PageStateSnapshot {
  timestamp: Date;
  url: string;
  title: string;
  elementCount: number;
  summary: string;
}

export class DOMStateManager {
  private domSummarizer: DOMSummarizer;
  private stateContexts: Map<string, DOMStateContext>;

  constructor() {
    this.domSummarizer = new DOMSummarizer();
    this.stateContexts = new Map();
    
    logger.info('DOMStateManager initialized');
  }

  /**
   * 세션에 대한 DOM 상태 컨텍스트 초기화
   */
  async initializeStateContext(sessionId: string): Promise<void> {
    const context: DOMStateContext = {
      sessionId,
      stateHistory: [],
      lastUpdated: new Date()
    };

    this.stateContexts.set(sessionId, context);
    
    logger.info('DOM state context initialized', { sessionId });
  }

  /**
   * 현재 페이지 상태 캡처 및 분석
   */
  async capturePageState(sessionId: string): Promise<DOMSummary> {
    const context = this.stateContexts.get(sessionId);
    if (!context) {
      throw new Error(`DOM state context not found for session: ${sessionId}`);
    }

    try {
      logger.info('Capturing page state', { sessionId });

      // MCP에서 페이지 상태 데이터 가져오기
      const pageData = await this.fetchPageStateFromMCP();
      
      // DOM 상태 파싱
      const pageState = await this.domSummarizer.parseAccessibilityTree(pageData);
      
      // 페이지 요약 생성
      const summary = await this.domSummarizer.generatePageSummary(pageState);

      // 컨텍스트 업데이트
      context.currentPageState = pageState;
      context.lastSummary = summary;
      context.lastUpdated = new Date();

      // 히스토리 추가
      const snapshot: PageStateSnapshot = {
        timestamp: new Date(),
        url: pageState.url,
        title: pageState.title,
        elementCount: pageState.metadata.elementCount,
        summary: summary.pageDescription
      };
      context.stateHistory.push(snapshot);

      logger.info('Page state captured successfully', {
        sessionId,
        url: pageState.url,
        elementCount: pageState.metadata.elementCount,
        actionableCount: summary.actionableElements.length
      });

      return summary;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to capture page state', {
        sessionId,
        error: errorMessage
      });
      throw error;
    }
  }

  /**
   * AI를 위한 페이지 상태 컨텍스트 생성
   */
  generateAIContext(sessionId: string): string {
    const context = this.stateContexts.get(sessionId);
    if (!context || !context.lastSummary) {
      return 'No page state information available.';
    }

    const summary = context.lastSummary;
    
    let aiContext = `CURRENT PAGE STATE:\\n`;
    aiContext += `${summary.pageDescription}\\n\\n`;
    
    aiContext += `ACTIONABLE ELEMENTS (${summary.actionableElements.length}):\\n`;
    summary.actionableElements.slice(0, 10).forEach((element, index) => {
      const desc = element.textContent || element.id || element.selector;
      aiContext += `${index + 1}. ${element.tagName}: ${desc}\\n`;
    });
    
    if (summary.recommendedActions.length > 0) {
      aiContext += `\\nRECOMMENDED ACTIONS:\\n`;
      summary.recommendedActions.forEach((action, index) => {
        aiContext += `${index + 1}. ${action}\\n`;
      });
    }

    return aiContext;
  }

  /**
   * MCP에서 페이지 상태 데이터 가져오기
   */
  private async fetchPageStateFromMCP(): Promise<any> {
    const toolManager = getMCPToolManager();
    
    // 페이지 상태를 가져올 수 있는 도구 시도
    const tools = await toolManager.getAvailableTools();
    const pageStateTool = tools.find(tool => 
      tool.name.includes('page_state') || 
      tool.name.includes('accessibility') ||
      tool.name.includes('get_elements')
    );

    if (pageStateTool) {
      const response = await toolManager.callTool({
        name: pageStateTool.name,
        arguments: {}
      });
      
      return response.content;
    } else {
      // 페이지 상태 도구가 없는 경우 스크린샷으로 대체
      const screenshotResponse = await toolManager.callTool({
        name: 'playwright_screenshot',
        arguments: { name: 'state_capture.png' }
      });
      
      // 모조 데이터 반환 (실제로는 스크린샷 분석 필요)
      return {
        url: 'current_page',
        title: 'Current Page',
        children: []
      };
    }
  }

  /**
   * DOM 상태 컨텍스트 조회
   */
  getStateContext(sessionId: string): DOMStateContext | null {
    return this.stateContexts.get(sessionId) || null;
  }

  /**
   * 세션 정리
   */
  async cleanupSession(sessionId: string): Promise<void> {
    this.stateContexts.delete(sessionId);
    logger.info('DOM state context cleaned up', { sessionId });
  }

  /**
   * 리소스 정리
   */
  async dispose(): Promise<void> {
    logger.info('Disposing DOMStateManager', {
      activeContexts: this.stateContexts.size
    });

    this.stateContexts.clear();
  }
}

// 싱글톤 인스턴스
let domStateManagerInstance: DOMStateManager | null = null;

export function getDOMStateManager(): DOMStateManager {
  if (!domStateManagerInstance) {
    domStateManagerInstance = new DOMStateManager();
  }
  return domStateManagerInstance;
}

export function resetDOMStateManager(): void {
  if (domStateManagerInstance) {
    domStateManagerInstance.dispose();
    domStateManagerInstance = null;
    logger.info('DOMStateManager singleton instance reset');
  }
}
```

### 3. 피드백 루프 통합
**파일**: 기존 `feedback-loop-engine.ts` 수정

```typescript
// FeedbackLoopEngine에 DOM 상태 통합 추가

import { getDOMStateManager } from './dom-state-manager';

// 기존 FeedbackLoopEngine 클래스에 메서드 추가:

/**
 * DOM 상태 정보를 포함한 AI 프롬프트 구성
 */
private buildEnhancedDecisionPrompt(context: FeedbackLoopContext): string {
  const domStateManager = getDOMStateManager();
  const domContext = domStateManager.generateAIContext(context.sessionId);
  
  const basePrompt = this.buildDecisionPrompt(context);
  
  return `${basePrompt}

${domContext}

Based on the current page state and available interactive elements, what is the most appropriate next action?`;
}

/**
 * 도구 실행 후 페이지 상태 업데이트
 */
private async updatePageStateAfterExecution(sessionId: string): Promise<void> {
  try {
    const domStateManager = getDOMStateManager();
    await domStateManager.capturePageState(sessionId);
  } catch (error) {
    logger.warn('Failed to update page state after execution', {
      sessionId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
```

## 🧪 테스트 계획

### 1. 유닛 테스트
**파일**: `test/dom-summarizer.test.ts`

```typescript
describe('DOMSummarizer', () => {
  let domSummarizer: DOMSummarizer;

  beforeEach(() => {
    domSummarizer = new DOMSummarizer();
  });

  describe('parseAccessibilityTree', () => {
    it('should parse basic accessibility tree structure', async () => {
      const mockData = {
        url: 'https://example.com',
        title: 'Test Page',
        children: [
          {
            role: 'button',
            name: 'Submit',
            id: 'submit-btn'
          },
          {
            role: 'textbox',
            name: 'Email',
            attributes: { type: 'email', required: 'true' }
          }
        ]
      };

      const pageState = await domSummarizer.parseAccessibilityTree(mockData);

      expect(pageState.url).toBe('https://example.com');
      expect(pageState.title).toBe('Test Page');
      expect(pageState.interactiveElements.length).toBeGreaterThan(0);
    });
  });

  describe('generatePageSummary', () => {
    it('should generate comprehensive page summary', async () => {
      const mockPageState = createMockPageState();
      
      const summary = await domSummarizer.generatePageSummary(mockPageState);

      expect(summary.pageDescription).toBeTruthy();
      expect(summary.actionableElements.length).toBeGreaterThan(0);
      expect(summary.recommendedActions.length).toBeGreaterThan(0);
    });
  });
});
```

### 2. 통합 테스트
**파일**: `test/integration/dom-state-integration.test.ts`

```typescript
describe('DOM State Integration', () => {
  it('should integrate DOM state with feedback loop', async () => {
    const feedbackEngine = getFeedbackLoopEngine();
    const domStateManager = getDOMStateManager();
    
    const sessionId = await feedbackEngine.startFeedbackLoop({
      testCaseId: 'dom-integration-test',
      objective: 'Navigate and analyze page state'
    });

    await domStateManager.initializeStateContext(sessionId);
    
    // 페이지 상태 캡처 테스트
    const summary = await domStateManager.capturePageState(sessionId);
    expect(summary.actionableElements.length).toBeGreaterThan(0);
    
    // AI 컨텍스트 생성 테스트
    const aiContext = domStateManager.generateAIContext(sessionId);
    expect(aiContext).toContain('CURRENT PAGE STATE');
    expect(aiContext).toContain('ACTIONABLE ELEMENTS');
  });
});
```

## 📊 검증 스크립트
**파일**: `test-task-5.6-live.ts`

```typescript
// Task 5.6 DOM State Summarization 라이브 테스트
// 1. DOMSummarizer 파싱 테스트
// 2. 페이지 상태 요약 생성 테스트
// 3. AI 컨텍스트 생성 테스트
// 4. 피드백 루프와 통합 테스트
// 5. 실제 페이지 데이터로 종합 검증
```

## 📝 다음 단계

Task 5.6 완료 후 진행할 내용:
- **Task 5.7**: Multi-Step Execution Engine - 다단계 실행 엔진
- **Task 5.8**: Error Recovery and Adaptation - 오류 복구 및 적응

## 💡 주요 고려사항

1. **데이터 형식**: Playwright MCP의 정확한 접근성 트리 형식 파악
2. **성능 최적화**: 대용량 DOM 트리 처리 시 메모리 효율성
3. **정확성**: 상호작용 요소 식별의 정확도
4. **AI 친화성**: AI가 이해하기 쉬운 요약 형식 설계
5. **확장성**: 다양한 페이지 타입에 대한 유연한 처리

---

**구현 준비 완료!** 이제 DOM 상태를 AI가 이해할 수 있는 형식으로 요약하는 시스템을 구축할 수 있습니다.