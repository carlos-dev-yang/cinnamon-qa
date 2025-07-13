import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';

// Mock data
const testSteps = new Map<string, any[]>();

export const testStepRouter = router({
  list: publicProcedure
    .input(z.object({
      testRunId: z.string(),
    }))
    .query(async ({ input }) => {
      const steps = testSteps.get(input.testRunId) || [];
      
      // TODO: Fetch from database
      
      return {
        steps,
        totalSteps: steps.length,
        completedSteps: steps.filter((s: any) => s.status === 'completed').length,
        failedSteps: steps.filter((s: any) => s.status === 'failed').length,
        adaptedSteps: steps.filter((s: any) => s.status === 'adapted').length,
      };
    }),

  getPageState: publicProcedure
    .input(z.object({
      testRunId: z.string(),
      stepIndex: z.number(),
    }))
    .query(async ({ input }) => {
      const steps = testSteps.get(input.testRunId) || [];
      const step = steps[input.stepIndex];
      
      if (!step) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Test step not found',
        });
      }
      
      // TODO: Fetch actual page state from database
      
      return {
        pageState: step.pageState || {
          url: 'https://example.com',
          title: 'Example Page',
          html: '<html>...</html>',
        },
        screenshot: step.screenshot || null,
        capturedAt: step.executedAt || new Date(),
      };
    }),

  getAdaptations: publicProcedure
    .input(z.object({
      testRunId: z.string(),
      stepIndex: z.number(),
    }))
    .query(async ({ input }) => {
      const steps = testSteps.get(input.testRunId) || [];
      const step = steps[input.stepIndex];
      
      if (!step) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Test step not found',
        });
      }
      
      // TODO: Fetch adaptation details from database
      
      return {
        adapted: !!step.adaptation,
        adaptation: step.adaptation || null,
        alternativeSelectors: [
          {
            selector: 'button[type="submit"]',
            confidence: 0.9,
            reason: 'Similar element with matching text',
          },
          {
            selector: '#submit-form-btn',
            confidence: 0.7,
            reason: 'ID contains submit keyword',
          },
        ],
      };
    }),

  retry: publicProcedure
    .input(z.object({
      testRunId: z.string(),
      stepIndex: z.number(),
    }))
    .mutation(async ({ input }) => {
      const steps = testSteps.get(input.testRunId) || [];
      const step = steps[input.stepIndex];
      
      if (!step) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Test step not found',
        });
      }
      
      if (step.status !== 'failed') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Can only retry failed steps',
        });
      }
      
      // Reset step status
      step.status = 'pending';
      step.error = null;
      
      // TODO: Update database
      // TODO: Queue retry job
      
      return {
        success: true,
        message: 'Step queued for retry',
      };
    }),
});