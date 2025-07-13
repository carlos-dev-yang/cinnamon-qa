import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { getGeminiClient } from '../../ai';
import { PromptCategory } from '../../ai/gemini/types';

export const aiRouter = router({
  // Test connection to Gemini API
  testConnection: publicProcedure
    .query(async () => {
      try {
        const client = getGeminiClient();
        
        // Initialize if not already done
        if (client.getState() === 'uninitialized') {
          await client.initialize();
        }
        
        const validation = await client.validateConnection();
        return validation;
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to test connection: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }),

  // Generate text using Gemini
  generateText: publicProcedure
    .input(z.object({
      prompt: z.string().min(1, 'Prompt cannot be empty'),
      category: z.nativeEnum(PromptCategory).optional(),
      temperature: z.number().min(0).max(1).optional(),
      maxOutputTokens: z.number().min(1).max(8192).optional(),
    }))
    .mutation(async ({ input }) => {
      try {
        const client = getGeminiClient();
        
        // Initialize if not ready
        if (client.getState() !== 'ready') {
          await client.initialize();
        }
        
        const response = await client.generateText({
          prompt: input.prompt,
          category: input.category,
          temperature: input.temperature,
          maxOutputTokens: input.maxOutputTokens,
        });
        
        return response;
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to generate text: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }),

  // Get client status and statistics
  getClientStatus: publicProcedure
    .query(async () => {
      const client = getGeminiClient();
      const state = client.getState();
      
      let stats = null;
      if (state === 'ready') {
        stats = client.getUsageStatistics();
      }
      
      return {
        state,
        statistics: stats,
      };
    }),

  // Get prompt history
  getPromptHistory: publicProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(10),
    }))
    .query(async ({ input }) => {
      const client = getGeminiClient();
      const history = client.getPromptHistory(input.limit);
      
      return {
        history,
        total: history.length,
      };
    }),

  // Clear prompt history
  clearHistory: publicProcedure
    .mutation(async () => {
      const client = getGeminiClient();
      client.clearHistory();
      
      return { success: true, message: 'History cleared' };
    }),

  // Initialize client with custom configuration
  initializeClient: publicProcedure
    .input(z.object({
      modelName: z.string().optional(),
      temperature: z.number().min(0).max(1).optional(),
      maxOutputTokens: z.number().min(1).max(8192).optional(),
    }))
    .mutation(async ({ input }) => {
      try {
        const client = getGeminiClient();
        await client.initialize(input);
        
        const validation = await client.validateConnection();
        
        return {
          success: true,
          state: client.getState(),
          validation,
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to initialize client: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }),
});