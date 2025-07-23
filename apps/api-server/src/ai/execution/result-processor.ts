import { ToolExecutionResult } from './tool-execution-handler';
import { createLogger } from '@cinnamon-qa/logger';

const logger = createLogger({ context: 'ResultProcessor' });

export interface ProcessedResult {
  summary: string;
  success: boolean;
  actionTaken: string;
  nextSuggestions: string[];
  rawData?: any;
}

export class ResultProcessor {

  /**
   * MCP 도구 실행 결과를 AI가 이해할 수 있는 형식으로 처리
   */
  async processResult(result: ToolExecutionResult): Promise<ProcessedResult> {
    logger.debug('Processing tool execution result', {
      success: result.success,
      hasContent: !!result.content,
      executionTime: result.metadata?.executionTime
    });

    if (!result.success) {
      return this.processFailureResult(result);
    }

    return this.processSuccessResult(result);
  }

  /**
   * 성공 결과 처리
   */
  private async processSuccessResult(result: ToolExecutionResult): Promise<ProcessedResult> {
    const content = result.content;
    
    // 도구별 결과 처리 로직
    let summary: string;
    let actionTaken: string;
    let nextSuggestions: string[] = [];

    if (typeof content === 'string') {
      summary = this.extractSummaryFromString(content);
      actionTaken = content;
    } else if (content && typeof content === 'object') {
      summary = this.extractSummaryFromObject(content);
      actionTaken = JSON.stringify(content);
    } else {
      summary = 'Tool executed successfully';
      actionTaken = 'Unknown action completed';
    }

    // 일반적인 다음 단계 제안
    nextSuggestions = this.generateNextSuggestions(summary, actionTaken);

    logger.debug('Success result processed', {
      summaryLength: summary.length,
      suggestionsCount: nextSuggestions.length
    });

    return {
      summary,
      success: true,
      actionTaken,
      nextSuggestions,
      rawData: content
    };
  }

  /**
   * 실패 결과 처리
   */
  private async processFailureResult(result: ToolExecutionResult): ProcessedResult {
    const error = result.error || 'Unknown error occurred';
    
    const summary = `Tool execution failed: ${error}`;
    const actionTaken = 'Failed to execute requested action';
    const nextSuggestions = this.generateFailureRecoveryOptions(error);

    logger.debug('Failure result processed', {
      error,
      suggestionsCount: nextSuggestions.length
    });

    return {
      summary,
      success: false,
      actionTaken,
      nextSuggestions,
      rawData: { error, executionTime: result.metadata?.executionTime }
    };
  }

  /**
   * 문자열에서 요약 추출
   */
  private extractSummaryFromString(content: string): string {
    // 일반적인 성공 패턴 매칭
    if (content.includes('navigated to') || content.includes('Navigate')) {
      return 'Successfully navigated to the specified URL';
    }
    
    if (content.includes('clicked') || content.includes('Click')) {
      return 'Successfully clicked the specified element';
    }
    
    if (content.includes('filled') || content.includes('Fill')) {
      return 'Successfully filled the input field';
    }
    
    if (content.includes('screenshot') || content.includes('Screenshot')) {
      return 'Successfully captured screenshot';
    }
    
    if (content.includes('waited') || content.includes('Wait')) {
      return 'Successfully waited for element to appear';
    }

    // 기본 요약 (첫 100자)
    return content.length > 100 ? content.substring(0, 100) + '...' : content;
  }

  /**
   * 객체에서 요약 추출
   */
  private extractSummaryFromObject(content: any): string {
    if (content.status === 'success' || content.success === true) {
      return content.message || 'Operation completed successfully';
    }
    
    if (content.url) {
      return `Action performed on: ${content.url}`;
    }
    
    if (content.element) {
      return `Action performed on element: ${content.element}`;
    }
    
    if (content.screenshot) {
      return 'Screenshot captured and saved';
    }

    return 'Tool execution completed with structured data';
  }

  /**
   * 다음 단계 제안 생성
   */
  private generateNextSuggestions(summary: string, actionTaken: string): string[] {
    const suggestions: string[] = [];

    if (summary.includes('navigated')) {
      suggestions.push('Take a screenshot to verify the page loaded correctly');
      suggestions.push('Look for specific elements on the page');
      suggestions.push('Check if the page title matches expectations');
    }
    
    if (summary.includes('clicked')) {
      suggestions.push('Wait for any loading or transition to complete');
      suggestions.push('Verify the click had the expected effect');
      suggestions.push('Take a screenshot to document the state change');
    }
    
    if (summary.includes('filled')) {
      suggestions.push('Submit the form or click next button');
      suggestions.push('Verify the input was accepted');
      suggestions.push('Check for any validation messages');
    }
    
    if (summary.includes('screenshot')) {
      suggestions.push('Analyze the screenshot for the next action');
      suggestions.push('Continue with the next test step');
    }

    // 기본 제안
    if (suggestions.length === 0) {
      suggestions.push('Continue to the next step in the test scenario');
      suggestions.push('Verify the current state meets expectations');
    }

    return suggestions;
  }

  /**
   * 실패 복구 옵션 생성
   */
  private generateFailureRecoveryOptions(error: string): string[] {
    const options: string[] = [];

    if (error.includes('timeout') || error.includes('not found')) {
      options.push('Wait longer for the element to appear');
      options.push('Try a different selector for the element');
      options.push('Check if the page is fully loaded');
      options.push('Take a screenshot to debug the current state');
    }
    
    if (error.includes('navigation') || error.includes('network')) {
      options.push('Retry the navigation with the same URL');
      options.push('Check if the URL is correct and accessible');
      options.push('Wait for network connectivity to stabilize');
    }
    
    if (error.includes('permission') || error.includes('access')) {
      options.push('Check if the container has proper permissions');
      options.push('Retry the operation with adjusted parameters');
    }

    // 기본 복구 옵션
    if (options.length === 0) {
      options.push('Retry the same operation');
      options.push('Try an alternative approach to achieve the same goal');
      options.push('Skip this step and continue with the next action');
    }

    return options;
  }

  /**
   * 결과 요약 통계
   */
  generateExecutionSummary(results: ToolExecutionResult[]): {
    totalExecutions: number;
    successRate: number;
    averageExecutionTime: number;
    commonErrors: string[];
  } {
    const total = results.length;
    const successful = results.filter(r => r.success).length;
    const successRate = total > 0 ? (successful / total) * 100 : 0;
    
    const executionTimes = results
      .map(r => r.metadata?.executionTime || 0)
      .filter(t => t > 0);
    const averageExecutionTime = executionTimes.length > 0 ? 
      executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length : 0;

    const errors = results
      .filter(r => !r.success && r.error)
      .map(r => r.error!)
      .reduce((acc, error) => {
        acc[error] = (acc[error] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    const commonErrors = Object.entries(errors)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([error]) => error);

    return {
      totalExecutions: total,
      successRate: Math.round(successRate * 100) / 100,
      averageExecutionTime: Math.round(averageExecutionTime),
      commonErrors
    };
  }

  /**
   * 결과를 AI 피드백 형식으로 변환
   */
  formatForAIFeedback(processedResult: ProcessedResult): string {
    if (processedResult.success) {
      return `✅ SUCCESS: ${processedResult.summary}

Action completed: ${processedResult.actionTaken}

Suggested next steps:
${processedResult.nextSuggestions.map((s, i) => `${i + 1}. ${s}`).join('\n')}

What would you like to do next?`;
    } else {
      return `❌ FAILED: ${processedResult.summary}

Failed action: ${processedResult.actionTaken}

Recovery options:
${processedResult.nextSuggestions.map((s, i) => `${i + 1}. ${s}`).join('\n')}

Please choose a recovery option or provide an alternative approach.`;
    }
  }

  /**
   * 여러 결과를 종합하여 AI 피드백 생성
   */
  formatBatchResultsForAI(results: ProcessedResult[]): string {
    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;
    
    let feedback = `📊 BATCH EXECUTION SUMMARY: ${successCount}/${totalCount} operations succeeded\n\n`;
    
    results.forEach((result, index) => {
      const status = result.success ? '✅' : '❌';
      feedback += `${status} Operation ${index + 1}: ${result.summary}\n`;
    });

    feedback += '\nRECOMMENDATIONS:\n';
    
    if (successCount === totalCount) {
      feedback += 'All operations completed successfully. Ready for next phase.';
    } else if (successCount > 0) {
      feedback += 'Some operations succeeded. Consider retrying failed operations or adjusting the approach.';
    } else {
      feedback += 'All operations failed. Please review the strategy and try alternative approaches.';
    }

    return feedback;
  }
}