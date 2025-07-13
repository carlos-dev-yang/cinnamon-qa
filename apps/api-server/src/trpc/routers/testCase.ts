import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';

// Mock data for development
const testCases = new Map<string, any>();

export const testCaseRouter = router({
  create: publicProcedure
    .input(z.object({
      name: z.string().min(1),
      url: z.string().url(),
      scenario: z.string().min(1),
    }))
    .mutation(async ({ input, ctx }) => {
      const id = Date.now().toString();
      const testCase = {
        id,
        ...input,
        reliabilityScore: 100,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      testCases.set(id, testCase);
      
      // TODO: Save to database
      // TODO: Trigger AI analysis for scenario parsing
      
      return testCase;
    }),

  list: publicProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
    }).optional())
    .query(async ({ input }) => {
      const limit = input?.limit ?? 20;
      const offset = input?.offset ?? 0;
      
      // TODO: Fetch from database with pagination
      const allTestCases = Array.from(testCases.values());
      
      return {
        items: allTestCases.slice(offset, offset + limit),
        total: allTestCases.length,
        hasMore: offset + limit < allTestCases.length,
      };
    }),

  get: publicProcedure
    .input(z.object({
      id: z.string(),
    }))
    .query(async ({ input }) => {
      const testCase = testCases.get(input.id);
      
      if (!testCase) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Test case not found',
        });
      }
      
      return testCase;
    }),

  duplicate: publicProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      const original = testCases.get(input.id);
      
      if (!original) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Original test case not found',
        });
      }
      
      const newId = Date.now().toString();
      const duplicated = {
        ...original,
        id: newId,
        name: input.name,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      testCases.set(newId, duplicated);
      
      return duplicated;
    }),

  getAdaptationPatterns: publicProcedure
    .input(z.object({
      id: z.string(),
    }))
    .query(async ({ input }) => {
      // TODO: Fetch adaptation patterns from database
      // This would analyze historical adaptations for this test case
      
      return {
        patterns: [
          {
            selector: '.submit-button',
            adaptations: 5,
            successRate: 0.8,
            commonReplacements: ['button[type="submit"]', '#submit-btn'],
          },
        ],
        totalAdaptations: 5,
        learningInsights: [
          'Button selectors frequently change between deployments',
          'Form structure remains stable',
        ],
      };
    }),

  delete: publicProcedure
    .input(z.object({
      id: z.string(),
    }))
    .mutation(async ({ input }) => {
      if (!testCases.has(input.id)) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Test case not found',
        });
      }
      
      testCases.delete(input.id);
      
      // TODO: Delete from database
      // TODO: Clean up related test runs
      
      return { success: true };
    }),
});