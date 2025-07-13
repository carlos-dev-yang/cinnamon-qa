import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { createLogger } from '@cinnamon-qa/logger';
import { GeminiConfig, loadGeminiConfig, SAFETY_SETTINGS } from './config';
import {
  GeminiResponse,
  GeminiError,
  GeminiClientState,
  GenerateOptions,
  ConnectionValidationResult,
  PromptHistory,
  PromptCategory,
} from './types';

const logger = createLogger({ context: 'GeminiClient' });

export class GeminiClient {
  private genAI: GoogleGenerativeAI | null = null;
  private model: GenerativeModel | null = null;
  private config: GeminiConfig | null = null;
  private state: GeminiClientState = GeminiClientState.UNINITIALIZED;
  private promptHistory: PromptHistory[] = [];

  constructor() {
    logger.info('GeminiClient instance created');
  }

  /**
   * Initialize the Gemini client with configuration
   */
  async initialize(config?: Partial<GeminiConfig>): Promise<void> {
    try {
      this.state = GeminiClientState.INITIALIZING;
      logger.info('Initializing Gemini client...');

      // Load configuration
      const defaultConfig = loadGeminiConfig();
      this.config = { ...defaultConfig, ...config };

      if (!this.config.apiKey) {
        throw new GeminiError('API key is required', 'MISSING_API_KEY');
      }

      // Initialize Google Generative AI
      this.genAI = new GoogleGenerativeAI(this.config.apiKey);

      // Get the model
      this.model = this.genAI.getGenerativeModel({
        model: this.config.modelName,
        generationConfig: {
          temperature: this.config.temperature,
          topP: this.config.topP,
          topK: this.config.topK,
          maxOutputTokens: this.config.maxOutputTokens,
        },
        safetySettings: SAFETY_SETTINGS as any,
      });

      // Validate connection
      const validation = await this.validateConnection();
      if (!validation.success) {
        throw new GeminiError(
          `Connection validation failed: ${validation.error}`,
          'CONNECTION_FAILED'
        );
      }

      this.state = GeminiClientState.READY;
      logger.info('Gemini client initialized successfully', {
        model: this.config.modelName,
        latency: validation.latency,
      });
    } catch (error) {
      this.state = GeminiClientState.ERROR;
      logger.error('Failed to initialize Gemini client', error);
      throw error;
    }
  }

  /**
   * Validate connection to Gemini API
   */
  async validateConnection(): Promise<ConnectionValidationResult> {
    if (!this.model) {
      return {
        success: false,
        error: 'Client not initialized',
      };
    }

    const startTime = Date.now();
    
    try {
      await this.model.generateContent({
        contents: [{ role: 'user', parts: [{ text: 'Hello' }] }],
      });
      
      return {
        success: true,
        modelName: this.config?.modelName,
        latency: Date.now() - startTime,
      };
    } catch (error) {
      logger.error('Connection validation failed', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        latency: Date.now() - startTime,
      };
    }
  }

  /**
   * Generate text based on prompt
   */
  async generateText(options: GenerateOptions): Promise<GeminiResponse> {
    if (this.state !== GeminiClientState.READY || !this.model) {
      throw new GeminiError('Client is not ready', 'CLIENT_NOT_READY');
    }

    const startTime = Date.now();
    const retryOptions = {
      maxRetries: options.retry?.maxRetries ?? this.config!.maxRetries,
      retryDelay: options.retry?.retryDelay ?? this.config!.retryDelay,
      backoffMultiplier: options.retry?.backoffMultiplier ?? 2,
    };

    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= retryOptions.maxRetries; attempt++) {
      try {
        logger.debug(`Generating text (attempt ${attempt + 1})`, {
          category: options.category,
          promptLength: options.prompt.length,
        });

        // Configure generation settings for this request
        const generationConfig = {
          temperature: options.temperature ?? this.config!.temperature,
          maxOutputTokens: options.maxOutputTokens ?? this.config!.maxOutputTokens,
          stopSequences: options.stopSequences,
        };

        // Generate content
        const result = await this.model.generateContent({
          contents: [{ role: 'user', parts: [{ text: options.prompt }] }],
          generationConfig,
        });

        const response = result.response;
        const text = response.text();
        const usageMetadata = response.usageMetadata;

        // Create response object
        const geminiResponse: GeminiResponse = {
          text,
          finishReason: response.candidates?.[0]?.finishReason,
          safetyRatings: response.candidates?.[0]?.safetyRatings as any,
          usageMetadata: usageMetadata ? {
            promptTokenCount: usageMetadata.promptTokenCount,
            candidatesTokenCount: usageMetadata.candidatesTokenCount,
            totalTokenCount: usageMetadata.totalTokenCount,
          } : undefined,
        };

        // Record in history
        const historyEntry: PromptHistory = {
          id: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
          timestamp: new Date(),
          category: options.category || PromptCategory.SCENARIO_ANALYSIS,
          prompt: options.prompt,
          response: text,
          success: true,
          usageMetadata: geminiResponse.usageMetadata ? {
            promptTokens: geminiResponse.usageMetadata.promptTokenCount,
            responseTokens: geminiResponse.usageMetadata.candidatesTokenCount,
            totalTokens: geminiResponse.usageMetadata.totalTokenCount,
          } : undefined,
          duration: Date.now() - startTime,
        };
        this.promptHistory.push(historyEntry);

        logger.info('Text generation successful', {
          category: options.category,
          duration: historyEntry.duration,
          tokens: geminiResponse.usageMetadata?.totalTokenCount,
        });

        return geminiResponse;
      } catch (error) {
        lastError = error as Error;
        logger.warn(`Generation attempt ${attempt + 1} failed`, {
          error: error instanceof Error ? error.message : 'Unknown error',
          willRetry: attempt < retryOptions.maxRetries,
        });

        if (attempt < retryOptions.maxRetries) {
          const delay = retryOptions.retryDelay * Math.pow(retryOptions.backoffMultiplier, attempt);
          await this.sleep(delay);
        }
      }
    }

    // All retries failed
    const errorMessage = lastError?.message || 'Unknown error';
    const historyEntry: PromptHistory = {
      id: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
      timestamp: new Date(),
      category: options.category || PromptCategory.SCENARIO_ANALYSIS,
      prompt: options.prompt,
      response: '',
      success: false,
      duration: Date.now() - startTime,
    };
    this.promptHistory.push(historyEntry);

    throw new GeminiError(
      `Failed to generate text after ${retryOptions.maxRetries + 1} attempts: ${errorMessage}`,
      'GENERATION_FAILED',
      undefined,
      lastError
    );
  }

  /**
   * Get client state
   */
  getState(): GeminiClientState {
    return this.state;
  }

  /**
   * Get prompt history
   */
  getPromptHistory(limit?: number): PromptHistory[] {
    if (limit) {
      return this.promptHistory.slice(-limit);
    }
    return [...this.promptHistory];
  }

  /**
   * Clear prompt history
   */
  clearHistory(): void {
    this.promptHistory = [];
    logger.info('Prompt history cleared');
  }

  /**
   * Get usage statistics
   */
  getUsageStatistics() {
    const totalPrompts = this.promptHistory.length;
    const successfulPrompts = this.promptHistory.filter(h => h.success).length;
    const totalTokens = this.promptHistory.reduce((sum, h) => 
      sum + (h.usageMetadata?.totalTokens || 0), 0
    );
    const avgDuration = this.promptHistory.reduce((sum, h) => 
      sum + h.duration, 0
    ) / (totalPrompts || 1);

    return {
      totalPrompts,
      successfulPrompts,
      failureRate: totalPrompts > 0 ? (totalPrompts - successfulPrompts) / totalPrompts : 0,
      totalTokens,
      avgDuration: Math.round(avgDuration),
      byCategory: this.getUsageByCategory(),
    };
  }

  /**
   * Get usage statistics by category
   */
  private getUsageByCategory() {
    const categories = Object.values(PromptCategory);
    const stats: Record<string, any> = {};

    for (const category of categories) {
      const categoryHistory = this.promptHistory.filter(h => h.category === category);
      stats[category] = {
        count: categoryHistory.length,
        successRate: categoryHistory.length > 0
          ? categoryHistory.filter(h => h.success).length / categoryHistory.length
          : 0,
        avgDuration: categoryHistory.length > 0
          ? categoryHistory.reduce((sum, h) => sum + h.duration, 0) / categoryHistory.length
          : 0,
      };
    }

    return stats;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    this.genAI = null;
    this.model = null;
    this.state = GeminiClientState.UNINITIALIZED;
    logger.info('Gemini client cleaned up');
  }
}

// Singleton instance
let geminiClientInstance: GeminiClient | null = null;

/**
 * Get or create Gemini client instance
 */
export function getGeminiClient(): GeminiClient {
  if (!geminiClientInstance) {
    geminiClientInstance = new GeminiClient();
  }
  return geminiClientInstance;
}