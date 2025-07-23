import { z } from 'zod';
import { createLogger } from '@cinnamon-qa/logger';
import { GeminiError } from '../gemini/types';

const logger = createLogger({ context: 'ScenarioParser' });

/**
 * 테스트 스텝 스키마
 */
export const TestStepSchema = z.object({
  id: z.string(),
  action: z.enum(['navigate', 'click', 'type', 'wait', 'scroll', 'hover', 'select', 'verify']),
  description: z.string(),
  selector: z.string(),
  value: z.string().optional(),
  waitCondition: z.string().optional(),
  expectedResult: z.string(),
});

/**
 * 분석 결과 메타데이터 스키마
 */
export const AnalysisMetadataSchema = z.object({
  complexity: z.enum(['simple', 'medium', 'complex']),
  estimatedDuration: z.number().positive(),
  requiredPermissions: z.array(z.string()),
});

/**
 * 시나리오 분석 결과 스키마
 */
export const AnalysisResultSchema = z.object({
  steps: z.array(TestStepSchema),
  confidence: z.number().min(0).max(1),
  suggestions: z.array(z.string()),
  warnings: z.array(z.string()),
  metadata: AnalysisMetadataSchema,
});

export type TestStep = z.infer<typeof TestStepSchema>;
export type AnalysisMetadata = z.infer<typeof AnalysisMetadataSchema>;
export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;

/**
 * Gemini 응답 파서
 */
export class ScenarioParser {
  /**
   * Gemini 응답을 구조화된 분석 결과로 파싱
   */
  static parseGeminiResponse(response: string): AnalysisResult {
    logger.debug('Parsing Gemini response', { responseLength: response.length });
    
    try {
      // JSON 블록 추출
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
      let jsonString = jsonMatch ? jsonMatch[1] : response;
      
      // JSON이 아닌 경우 전체 응답에서 JSON 찾기
      if (!jsonMatch) {
        const jsonStart = response.indexOf('{');
        const jsonEnd = response.lastIndexOf('}');
        if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
          jsonString = response.substring(jsonStart, jsonEnd + 1);
        }
      }
      
      // JSON 파싱
      const parsed = JSON.parse(jsonString.trim());
      
      // 스키마 검증
      const validated = AnalysisResultSchema.parse(parsed);
      
      // 추가 검증
      this.validateSteps(validated.steps);
      
      logger.info('Successfully parsed Gemini response', {
        stepCount: validated.steps.length,
        confidence: validated.confidence,
        complexity: validated.metadata.complexity,
      });
      
      return validated;
      
    } catch (error) {
      logger.error('Failed to parse Gemini response', { error, response });
      
      if (error instanceof z.ZodError) {
        throw new GeminiError(
          `Schema validation failed: ${error.issues.map(i => i.message).join(', ')}`,
          'PARSING_ERROR',
          { zodError: error.issues }
        );
      }
      
      if (error instanceof SyntaxError) {
        throw new GeminiError(
          `JSON parsing failed: ${error.message}`,
          'PARSING_ERROR',
          { originalResponse: response }
        );
      }
      
      throw new GeminiError(
        `Unknown parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'PARSING_ERROR',
        { originalResponse: response }
      );
    }
  }
  
  /**
   * 스텝 유효성 검증
   */
  private static validateSteps(steps: TestStep[]): void {
    if (steps.length === 0) {
      throw new GeminiError('분석 결과에 스텝이 없습니다', 'VALIDATION_ERROR');
    }
    
    if (steps.length > 50) {
      throw new GeminiError('스텝 수가 너무 많습니다 (최대 50개)', 'VALIDATION_ERROR');
    }
    
    // ID 중복 확인
    const ids = steps.map(step => step.id);
    const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
    if (duplicateIds.length > 0) {
      throw new GeminiError(
        `중복된 스텝 ID가 있습니다: ${duplicateIds.join(', ')}`,
        'VALIDATION_ERROR'
      );
    }
    
    // 각 스텝별 유효성 검증
    steps.forEach((step, index) => {
      this.validateStep(step, index);
    });
  }
  
  /**
   * 개별 스텝 유효성 검증
   */
  private static validateStep(step: TestStep, index: number): void {
    const stepContext = `Step ${index + 1} (${step.id})`;
    
    // action별 필수 필드 검증
    switch (step.action) {
      case 'navigate':
        if (!step.value) {
          throw new GeminiError(`${stepContext}: navigate 액션에는 URL이 필요합니다`, 'VALIDATION_ERROR');
        }
        if (!this.isValidUrl(step.value)) {
          throw new GeminiError(`${stepContext}: 유효하지 않은 URL입니다`, 'VALIDATION_ERROR');
        }
        break;
        
      case 'type':
        if (!step.selector) {
          throw new GeminiError(`${stepContext}: type 액션에는 selector가 필요합니다`, 'VALIDATION_ERROR');
        }
        if (!step.value) {
          throw new GeminiError(`${stepContext}: type 액션에는 입력값이 필요합니다`, 'VALIDATION_ERROR');
        }
        break;
        
      case 'click':
      case 'hover':
      case 'verify':
        if (!step.selector) {
          throw new GeminiError(`${stepContext}: ${step.action} 액션에는 selector가 필요합니다`, 'VALIDATION_ERROR');
        }
        break;
        
      case 'select':
        if (!step.selector || !step.value) {
          throw new GeminiError(`${stepContext}: select 액션에는 selector와 value가 필요합니다`, 'VALIDATION_ERROR');
        }
        break;
        
      case 'wait':
        if (!step.waitCondition) {
          throw new GeminiError(`${stepContext}: wait 액션에는 waitCondition이 필요합니다`, 'VALIDATION_ERROR');
        }
        break;
    }
    
    // 선택자 유효성 간단 검증
    if (step.selector && !this.isValidSelector(step.selector)) {
      logger.warn(`${stepContext}: 의심스러운 선택자`, { selector: step.selector });
    }
  }
  
  /**
   * URL 유효성 검증
   */
  private static isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * CSS 선택자 유효성 기본 검증
   */
  private static isValidSelector(selector: string): boolean {
    // 기본적인 선택자 패턴 확인
    const validPatterns = [
      /^#[\w-]+$/,                          // ID: #id
      /^\.[\w-]+$/,                         // Class: .class
      /^[\w-]+$/,                           // Tag: div
      /^\[[\w-]+[\^$*|~]?="?[^"]*"?\]$/,   // Attribute: [attr="value"]
      /^[\w-]+\[[\w-]+[\^$*|~]?="?[^"]*"?\]$/, // Tag with attribute
      /^:has-text\(.+\)$/,                  // Text selector: :has-text("text")
    ];
    
    // 복합 선택자인 경우 개별 부분 검증
    const parts = selector.split(/[\s>+~,]/).filter(part => part.trim());
    
    return parts.every(part => {
      const trimmedPart = part.trim();
      return trimmedPart === '' || validPatterns.some(pattern => pattern.test(trimmedPart));
    });
  }
}

/**
 * 부분 결과 복구 시도
 */
export class PartialResultRecovery {
  /**
   * 부분적으로 파싱 가능한 결과 복구
   */
  static tryRecoverPartialResult(response: string): Partial<AnalysisResult> | null {
    logger.info('Attempting partial result recovery');
    
    try {
      // steps 배열만 추출 시도
      const stepsMatch = response.match(/"steps"\s*:\s*\[([\s\S]*?)\]/);
      if (stepsMatch) {
        const stepsJson = `[${stepsMatch[1]}]`;
        const steps = JSON.parse(stepsJson);
        
        // 기본 구조 생성
        return {
          steps: steps.filter((step: any) => step && step.action),
          confidence: 0.5, // 기본값
          suggestions: ['부분 결과로 복구됨'],
          warnings: ['원본 분석 결과가 불완전했음'],
          metadata: {
            complexity: 'medium',
            estimatedDuration: steps.length * 5,
            requiredPermissions: ['basic-interaction'],
          },
        };
      }
      
      return null;
    } catch (error) {
      logger.warn('Partial recovery failed', { error });
      return null;
    }
  }
  
  /**
   * 최소한의 폴백 결과 생성
   */
  static createFallbackResult(scenario: string, url: string): AnalysisResult {
    logger.info('Creating fallback result', { scenario });
    
    return {
      steps: [
        {
          id: 'fallback-1',
          action: 'navigate',
          description: `페이지 이동: ${url}`,
          selector: '',
          value: url,
          expectedResult: '페이지가 로드됨',
        },
        {
          id: 'fallback-2',
          action: 'verify',
          description: '페이지 로드 확인',
          selector: 'body',
          expectedResult: '페이지 콘텐츠가 표시됨',
        },
      ],
      confidence: 0.1,
      suggestions: [
        '자동 분석이 실패했습니다',
        '시나리오를 더 구체적으로 작성해주세요',
        '수동으로 스텝을 작성하는 것을 고려해주세요',
      ],
      warnings: [
        '이것은 최소한의 폴백 결과입니다',
        '실제 시나리오와 다를 수 있습니다',
      ],
      metadata: {
        complexity: 'simple',
        estimatedDuration: 10,
        requiredPermissions: ['basic-navigation'],
      },
    };
  }
}