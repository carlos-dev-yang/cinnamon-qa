import { createLogger } from '@cinnamon-qa/logger';
import { getGeminiClient } from '../gemini/client';
import { GeminiError, PromptCategory } from '../gemini/types';
import { generateScenarioPrompt, detectComplexity, validatePromptParams } from '../prompts/scenario-analysis';
import { ScenarioParser, PartialResultRecovery, AnalysisResult } from '../parsers/scenario-parser';

const logger = createLogger({ context: 'ScenarioAnalyzer' });

/**
 * 시나리오 분석 요청 인터페이스
 */
export interface AnalyzeScenarioRequest {
  scenario: string;
  url: string;
  complexity?: 'simple' | 'medium' | 'complex';
  retryOnFailure?: boolean;
  fallbackOnError?: boolean;
}

/**
 * 시나리오 분석 결과 인터페이스
 */
export interface AnalyzeScenarioResponse extends AnalysisResult {
  processingTime: number;
  retryCount: number;
  originalScenario: string;
  detectedComplexity: string;
}

/**
 * 시나리오 분석 서비스
 */
export class ScenarioAnalyzer {
  private readonly geminiClient = getGeminiClient();
  
  /**
   * 메인 시나리오 분석 메서드
   */
  async analyzeScenario(request: AnalyzeScenarioRequest): Promise<AnalyzeScenarioResponse> {
    const startTime = Date.now();
    let retryCount = 0;
    const maxRetries = request.retryOnFailure ? 2 : 0;
    
    logger.info('Starting scenario analysis', {
      scenario: request.scenario.substring(0, 100),
      url: request.url,
      complexity: request.complexity,
    });
    
    // 입력 검증
    const validation = validatePromptParams({
      scenario: request.scenario,
      url: request.url,
    });
    
    if (!validation.isValid) {
      throw new GeminiError(
        `입력 검증 실패: ${validation.errors.join(', ')}`,
        'VALIDATION_ERROR'
      );
    }
    
    // 복잡도 자동 감지
    const detectedComplexity = request.complexity || detectComplexity(request.scenario);
    
    // Gemini 클라이언트 초기화 확인
    await this.ensureGeminiReady();
    
    let lastError: Error | null = null;
    
    // 재시도 로직
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        retryCount = attempt;
        
        logger.debug(`Analysis attempt ${attempt + 1}`, {
          detectedComplexity,
          retryCount,
        });
        
        // 분석 실행
        const result = await this.performAnalysis({
          scenario: request.scenario,
          url: request.url,
          complexity: detectedComplexity,
        });
        
        // 결과 후처리
        const processedResult = this.postProcessResult(result, request.scenario);
        
        const processingTime = Date.now() - startTime;
        
        logger.info('Scenario analysis completed successfully', {
          stepCount: result.steps.length,
          confidence: result.confidence,
          processingTime,
          retryCount,
        });
        
        return {
          ...processedResult,
          processingTime,
          retryCount,
          originalScenario: request.scenario,
          detectedComplexity,
        };
        
      } catch (error) {
        lastError = error as Error;
        
        logger.warn(`Analysis attempt ${attempt + 1} failed`, {
          error: error instanceof Error ? error.message : 'Unknown error',
          willRetry: attempt < maxRetries,
        });
        
        // 부분 결과 복구 시도 (마지막 시도에서)
        if (attempt === maxRetries && request.fallbackOnError) {
          const partialResult = await this.tryPartialRecovery(lastError, request);
          if (partialResult) {
            const processingTime = Date.now() - startTime;
            return {
              ...partialResult,
              processingTime,
              retryCount,
              originalScenario: request.scenario,
              detectedComplexity,
            };
          }
        }
        
        // 재시도 간격
        if (attempt < maxRetries) {
          await this.sleep(1000 * (attempt + 1));
        }
      }
    }
    
    // 모든 시도 실패
    const processingTime = Date.now() - startTime;
    
    if (request.fallbackOnError) {
      logger.warn('All attempts failed, creating fallback result');
      const fallbackResult = PartialResultRecovery.createFallbackResult(
        request.scenario,
        request.url
      );
      
      return {
        ...fallbackResult,
        processingTime,
        retryCount,
        originalScenario: request.scenario,
        detectedComplexity,
      };
    }
    
    throw new GeminiError(
      `시나리오 분석 실패 (${retryCount + 1}번 시도): ${lastError?.message || 'Unknown error'}`,
      'ANALYSIS_FAILED',
      { originalError: lastError, retryCount }
    );
  }
  
  /**
   * 실제 분석 수행
   */
  private async performAnalysis(params: {
    scenario: string;
    url: string;
    complexity: 'simple' | 'medium' | 'complex';
  }): Promise<AnalysisResult> {
    const prompt = generateScenarioPrompt(params);
    
    logger.debug('Generating analysis with Gemini', {
      promptLength: prompt.length,
      complexity: params.complexity,
    });
    
    const response = await this.geminiClient.generateText({
      prompt,
      category: PromptCategory.SCENARIO_ANALYSIS,
      temperature: 0.3, // 일관성을 위해 낮은 temperature
      maxOutputTokens: 2048,
    });
    
    // 응답 파싱
    return ScenarioParser.parseGeminiResponse(response.text);
  }
  
  /**
   * 결과 후처리
   */
  private postProcessResult(result: AnalysisResult, originalScenario: string): AnalysisResult {
    // ID 자동 생성 (필요한 경우)
    result.steps.forEach((step, index) => {
      if (!step.id || step.id.trim() === '') {
        step.id = `step-${index + 1}`;
      }
    });
    
    // 신뢰도 조정
    let adjustedConfidence = result.confidence;
    
    // 스텝 수에 따른 신뢰도 조정
    if (result.steps.length > 20) {
      adjustedConfidence *= 0.9; // 너무 많은 스텝은 신뢰도 감소
    } else if (result.steps.length < 2) {
      adjustedConfidence *= 0.8; // 너무 적은 스텝도 의심스러움
    }
    
    // 복잡도 재검증
    const actualComplexity = this.determineActualComplexity(result.steps.length);
    if (actualComplexity !== result.metadata.complexity) {
      logger.info('Complexity mismatch detected, adjusting', {
        original: result.metadata.complexity,
        adjusted: actualComplexity,
      });
      result.metadata.complexity = actualComplexity;
    }
    
    // 예상 소요 시간 재계산
    result.metadata.estimatedDuration = this.calculateEstimatedDuration(result.steps);
    
    // 추가 제안사항 생성
    const additionalSuggestions = this.generateAdditionalSuggestions(result, originalScenario);
    result.suggestions.push(...additionalSuggestions);
    
    return {
      ...result,
      confidence: Math.max(0, Math.min(1, adjustedConfidence)),
    };
  }
  
  /**
   * 부분 결과 복구 시도
   */
  private async tryPartialRecovery(
    error: Error,
    request: AnalyzeScenarioRequest
  ): Promise<AnalyzeScenarioResponse | null> {
    logger.info('Attempting partial result recovery');
    
    try {
      // Gemini 응답이 있는 경우 부분 복구 시도
      if (error instanceof GeminiError && error.context?.originalResponse) {
        const partialResult = PartialResultRecovery.tryRecoverPartialResult(
          error.context.originalResponse
        );
        
        if (partialResult && partialResult.steps && partialResult.steps.length > 0) {
          logger.info('Partial recovery successful', {
            recoveredSteps: partialResult.steps.length,
          });
          
          return partialResult as AnalyzeScenarioResponse;
        }
      }
      
      return null;
    } catch (recoveryError) {
      logger.warn('Partial recovery failed', { recoveryError });
      return null;
    }
  }
  
  /**
   * Gemini 클라이언트 준비 상태 확인
   */
  private async ensureGeminiReady(): Promise<void> {
    if (this.geminiClient.getState() === 'uninitialized') {
      logger.info('Initializing Gemini client for scenario analysis');
      await this.geminiClient.initialize();
    }
    
    if (this.geminiClient.getState() !== 'ready') {
      throw new GeminiError(
        `Gemini 클라이언트가 준비되지 않았습니다: ${this.geminiClient.getState()}`,
        'CLIENT_NOT_READY'
      );
    }
  }
  
  /**
   * 실제 복잡도 결정
   */
  private determineActualComplexity(stepCount: number): 'simple' | 'medium' | 'complex' {
    if (stepCount <= 5) return 'simple';
    if (stepCount <= 12) return 'medium';
    return 'complex';
  }
  
  /**
   * 예상 소요 시간 계산
   */
  private calculateEstimatedDuration(steps: any[]): number {
    const baseTime = {
      navigate: 3,
      click: 1,
      type: 2,
      wait: 2,
      scroll: 1,
      hover: 1,
      select: 2,
      verify: 2,
    };
    
    return steps.reduce((total, step) => {
      return total + (baseTime[step.action as keyof typeof baseTime] || 2);
    }, 0);
  }
  
  /**
   * 추가 제안사항 생성
   */
  private generateAdditionalSuggestions(result: AnalysisResult, scenario: string): string[] {
    const suggestions: string[] = [];
    
    // 복잡도 기반 제안
    if (result.metadata.complexity === 'complex') {
      suggestions.push('복잡한 시나리오입니다. 단계별로 나누어 테스트하는 것을 고려해보세요');
    }
    
    // 신뢰도 기반 제안
    if (result.confidence < 0.7) {
      suggestions.push('시나리오를 더 구체적으로 작성하면 분석 정확도가 향상됩니다');
    }
    
    // 스텝 수 기반 제안
    if (result.steps.length > 15) {
      suggestions.push('많은 단계가 포함되어 있습니다. 중간 점검 포인트를 추가하는 것을 고려해보세요');
    }
    
    return suggestions;
  }
  
  /**
   * 유틸리티: 대기
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 싱글톤 인스턴스
let scenarioAnalyzerInstance: ScenarioAnalyzer | null = null;

/**
 * 시나리오 분석기 인스턴스 반환
 */
export function getScenarioAnalyzer(): ScenarioAnalyzer {
  if (!scenarioAnalyzerInstance) {
    scenarioAnalyzerInstance = new ScenarioAnalyzer();
  }
  return scenarioAnalyzerInstance;
}