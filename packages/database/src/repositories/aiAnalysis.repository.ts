import { BaseRepository } from './base.repository';
import type { 
  AIAnalysis, 
  AIAnalysisInsert, 
  AIAnalysisUpdate,
  AnalysisType 
} from '../types/database';

export class AIAnalysisRepository extends BaseRepository {
  private readonly tableName = 'ai_analysis';

  /**
   * Create a new AI analysis record
   */
  async create(data: AIAnalysisInsert): Promise<AIAnalysis> {
    const { data: result, error } = await this.client
      .from(this.tableName)
      .insert(data)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create AI analysis: ${error.message}`);
    }

    return result;
  }

  /**
   * Get AI analysis by ID
   */
  async getById(id: string): Promise<AIAnalysis | null> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to get AI analysis: ${error.message}`);
    }

    return data;
  }

  /**
   * Get AI analyses for a test case
   */
  async getByTestCaseId(testCaseId: string, analysisType?: AnalysisType): Promise<AIAnalysis[]> {
    let query = this.client
      .from(this.tableName)
      .select('*')
      .eq('test_case_id', testCaseId)
      .order('created_at', { ascending: false });

    if (analysisType) {
      query = query.eq('analysis_type', analysisType);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get AI analyses for test case: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get AI analyses for a test run
   */
  async getByTestRunId(testRunId: string, analysisType?: AnalysisType): Promise<AIAnalysis[]> {
    let query = this.client
      .from(this.tableName)
      .select('*')
      .eq('test_run_id', testRunId)
      .order('created_at', { ascending: false });

    if (analysisType) {
      query = query.eq('analysis_type', analysisType);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get AI analyses for test run: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get AI analyses for a test step
   */
  async getByTestStepId(testStepId: string, analysisType?: AnalysisType): Promise<AIAnalysis[]> {
    let query = this.client
      .from(this.tableName)
      .select('*')
      .eq('test_step_id', testStepId)
      .order('created_at', { ascending: false });

    if (analysisType) {
      query = query.eq('analysis_type', analysisType);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get AI analyses for test step: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get latest analysis by type for a test case
   */
  async getLatestByType(
    testCaseId: string, 
    analysisType: AnalysisType
  ): Promise<AIAnalysis | null> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('test_case_id', testCaseId)
      .eq('analysis_type', analysisType)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to get latest analysis: ${error.message}`);
    }

    return data;
  }

  /**
   * Record scenario analysis
   */
  async recordScenarioAnalysis(
    testCaseId: string,
    originalScenario: string,
    refinedScenario: string,
    steps: any[],
    metadata: {
      modelUsed?: string;
      promptTokens?: number;
      completionTokens?: number;
      processingTimeMs?: number;
      confidenceScore?: number;
    } = {}
  ): Promise<AIAnalysis> {
    const analysis: AIAnalysisInsert = {
      test_case_id: testCaseId,
      analysis_type: 'scenario_analysis',
      input_data: {
        original_scenario: originalScenario,
        request_timestamp: new Date().toISOString()
      },
      output_data: {
        refined_scenario: refinedScenario,
        generated_steps: steps,
        response_timestamp: new Date().toISOString()
      },
      model_used: metadata.modelUsed || 'gemini-pro',
      confidence_score: metadata.confidenceScore,
      prompt_tokens: metadata.promptTokens,
      completion_tokens: metadata.completionTokens,
      processing_time_ms: metadata.processingTimeMs
    };

    return this.create(analysis);
  }

  /**
   * Record step adaptation
   */
  async recordStepAdaptation(
    testRunId: string,
    testStepId: string,
    originalStep: any,
    adaptedStep: any,
    reason: string,
    confidence: number,
    metadata: {
      modelUsed?: string;
      promptTokens?: number;
      completionTokens?: number;
      processingTimeMs?: number;
    } = {}
  ): Promise<AIAnalysis> {
    const analysis: AIAnalysisInsert = {
      test_run_id: testRunId,
      test_step_id: testStepId,
      analysis_type: 'adaptation',
      input_data: {
        original_step: originalStep,
        page_state: null, // Should be populated with actual page state
        adaptation_request: reason,
        request_timestamp: new Date().toISOString()
      },
      output_data: {
        adapted_step: adaptedStep,
        reason,
        confidence,
        response_timestamp: new Date().toISOString()
      },
      model_used: metadata.modelUsed || 'gemini-pro',
      confidence_score: confidence,
      prompt_tokens: metadata.promptTokens,
      completion_tokens: metadata.completionTokens,
      processing_time_ms: metadata.processingTimeMs
    };

    return this.create(analysis);
  }

  /**
   * Record step validation
   */
  async recordStepValidation(
    testRunId: string,
    testStepId: string,
    stepData: any,
    pageState: any,
    validationResult: {
      isValid: boolean;
      confidence: number;
      suggestions?: string[];
      issues?: string[];
    },
    metadata: {
      modelUsed?: string;
      promptTokens?: number;
      completionTokens?: number;
      processingTimeMs?: number;
    } = {}
  ): Promise<AIAnalysis> {
    const analysis: AIAnalysisInsert = {
      test_run_id: testRunId,
      test_step_id: testStepId,
      analysis_type: 'validation',
      input_data: {
        step_data: stepData,
        page_state: pageState,
        request_timestamp: new Date().toISOString()
      },
      output_data: {
        validation_result: validationResult,
        response_timestamp: new Date().toISOString()
      },
      model_used: metadata.modelUsed || 'gemini-pro',
      confidence_score: validationResult.confidence,
      prompt_tokens: metadata.promptTokens,
      completion_tokens: metadata.completionTokens,
      processing_time_ms: metadata.processingTimeMs
    };

    return this.create(analysis);
  }

  /**
   * Get token usage statistics
   */
  async getTokenUsageStats(
    startDate?: string,
    endDate?: string
  ): Promise<{
    totalPromptTokens: number;
    totalCompletionTokens: number;
    totalTokens: number;
    averageProcessingTime: number;
    analysisCount: number;
    byType: Record<AnalysisType, {
      count: number;
      promptTokens: number;
      completionTokens: number;
      avgProcessingTime: number;
    }>;
  }> {
    let query = this.client
      .from(this.tableName)
      .select('analysis_type, prompt_tokens, completion_tokens, processing_time_ms');

    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get token usage stats: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return {
        totalPromptTokens: 0,
        totalCompletionTokens: 0,
        totalTokens: 0,
        averageProcessingTime: 0,
        analysisCount: 0,
        byType: {} as any
      };
    }

    const stats = data.reduce(
      (acc, analysis) => {
        const promptTokens = analysis.prompt_tokens || 0;
        const completionTokens = analysis.completion_tokens || 0;
        const processingTime = analysis.processing_time_ms || 0;

        acc.totalPromptTokens += promptTokens;
        acc.totalCompletionTokens += completionTokens;
        acc.totalProcessingTime += processingTime;
        acc.analysisCount += 1;

        // By type stats
        if (!acc.byType[analysis.analysis_type]) {
          acc.byType[analysis.analysis_type] = {
            count: 0,
            promptTokens: 0,
            completionTokens: 0,
            totalProcessingTime: 0
          };
        }

        const typeStats = acc.byType[analysis.analysis_type];
        typeStats.count += 1;
        typeStats.promptTokens += promptTokens;
        typeStats.completionTokens += completionTokens;
        typeStats.totalProcessingTime += processingTime;

        return acc;
      },
      {
        totalPromptTokens: 0,
        totalCompletionTokens: 0,
        totalProcessingTime: 0,
        analysisCount: 0,
        byType: {} as Record<string, any>
      }
    );

    // Calculate averages and finalize by-type stats
    const finalByType: Record<AnalysisType, any> = {};
    Object.entries(stats.byType).forEach(([type, typeStats]: [string, any]) => {
      finalByType[type as AnalysisType] = {
        count: typeStats.count,
        promptTokens: typeStats.promptTokens,
        completionTokens: typeStats.completionTokens,
        avgProcessingTime: typeStats.count > 0 ? 
          typeStats.totalProcessingTime / typeStats.count : 0
      };
    });

    return {
      totalPromptTokens: stats.totalPromptTokens,
      totalCompletionTokens: stats.totalCompletionTokens,
      totalTokens: stats.totalPromptTokens + stats.totalCompletionTokens,
      averageProcessingTime: stats.analysisCount > 0 ? 
        stats.totalProcessingTime / stats.analysisCount : 0,
      analysisCount: stats.analysisCount,
      byType: finalByType
    };
  }

  /**
   * Get confidence score trends
   */
  async getConfidenceTrends(
    analysisType: AnalysisType,
    days: number = 30
  ): Promise<Array<{
    date: string;
    avgConfidence: number;
    count: number;
  }>> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await this.client
      .from(this.tableName)
      .select('created_at, confidence_score')
      .eq('analysis_type', analysisType)
      .gte('created_at', startDate)
      .not('confidence_score', 'is', null)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to get confidence trends: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Group by date and calculate averages
    const grouped = data.reduce((acc, analysis) => {
      const date = analysis.created_at.split('T')[0]; // Get date part
      if (!acc[date]) {
        acc[date] = { total: 0, count: 0 };
      }
      acc[date].total += analysis.confidence_score || 0;
      acc[date].count += 1;
      return acc;
    }, {} as Record<string, { total: number; count: number }>);

    return Object.entries(grouped).map(([date, stats]) => ({
      date,
      avgConfidence: stats.count > 0 ? stats.total / stats.count : 0,
      count: stats.count
    }));
  }

  /**
   * Delete old analysis records
   */
  async deleteOldRecords(olderThanDays: number = 90): Promise<number> {
    const threshold = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString();
    
    const { data, error } = await this.client
      .from(this.tableName)
      .delete()
      .lt('created_at', threshold)
      .select('id');

    if (error) {
      throw new Error(`Failed to delete old analysis records: ${error.message}`);
    }

    return data?.length || 0;
  }
}