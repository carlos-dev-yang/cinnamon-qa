import { z } from 'zod';

// Gemini API 설정 스키마
export const GeminiConfigSchema = z.object({
  apiKey: z.string().min(1, 'Gemini API key is required'),
  modelName: z.string().default('gemini-1.5-flash'),
  maxOutputTokens: z.number().default(4096),
  temperature: z.number().min(0).max(1).default(0.1),
  topP: z.number().min(0).max(1).default(0.8),
  topK: z.number().min(1).default(40),
  maxRetries: z.number().default(3),
  retryDelay: z.number().default(1000), // milliseconds
});

export type GeminiConfig = z.infer<typeof GeminiConfigSchema>;

// 환경 변수에서 설정 로드
export function loadGeminiConfig(): GeminiConfig {
  const config = {
    apiKey: process.env.GOOGLE_GEMINI_API_KEY || '',
    modelName: process.env.AI_MODEL_NAME || 'gemini-1.5-flash',
    maxOutputTokens: Number(process.env.AI_MAX_TOKENS) || 4096,
    temperature: Number(process.env.AI_TEMPERATURE) || 0.1,
    topP: Number(process.env.AI_TOP_P) || 0.8,
    topK: Number(process.env.AI_TOP_K) || 40,
    maxRetries: Number(process.env.AI_MAX_RETRIES) || 3,
    retryDelay: Number(process.env.AI_RETRY_DELAY) || 1000,
  };

  try {
    return GeminiConfigSchema.parse(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Invalid Gemini configuration: ${error.message}`);
    }
    throw error;
  }
}

// Safety settings for content generation
export const SAFETY_SETTINGS = [
  {
    category: 'HARM_CATEGORY_HARASSMENT',
    threshold: 'BLOCK_ONLY_HIGH',
  },
  {
    category: 'HARM_CATEGORY_HATE_SPEECH',
    threshold: 'BLOCK_ONLY_HIGH',
  },
  {
    category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
    threshold: 'BLOCK_ONLY_HIGH',
  },
  {
    category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
    threshold: 'BLOCK_ONLY_HIGH',
  },
];

// Generation config defaults
export const GENERATION_CONFIG = {
  temperature: 0.1,
  topP: 0.8,
  topK: 40,
  maxOutputTokens: 4096,
};