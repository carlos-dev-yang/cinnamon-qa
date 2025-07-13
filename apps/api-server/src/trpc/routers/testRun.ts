import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { EventEmitter } from 'events';
import { FastifyReply } from 'fastify';

// Event emitter for SSE
export const testRunEvents = new EventEmitter();

// Mock data
const testRuns = new Map<string, any>();

export const testRunRouter = router({
  create: publicProcedure
    .input(z.object({
      testCaseId: z.string(),
    }))
    .mutation(async ({ input }) => {
      const id = Date.now().toString();
      const testRun = {
        id,
        testCaseId: input.testCaseId,
        status: 'pending',
        progress: 0,
        createdAt: new Date(),
      };
      
      testRuns.set(id, testRun);
      
      // TODO: Save to database
      // TODO: Queue job for test execution
      
      return testRun;
    }),

  get: publicProcedure
    .input(z.object({
      id: z.string(),
    }))
    .query(async ({ input }) => {
      const testRun = testRuns.get(input.id);
      
      if (!testRun) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Test run not found',
        });
      }
      
      return testRun;
    }),

  // SSE endpoint for real-time updates
  subscribe: publicProcedure
    .input(z.object({
      id: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const reply = ctx.res as FastifyReply;
      
      // Verify test run exists
      if (!testRuns.has(input.id)) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Test run not found',
        });
      }
      
      // Set up SSE headers
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      
      // Send initial connection message
      reply.raw.write('event: connected\ndata: {"connected": true}\n\n');
      
      // Set up event listener for this test run
      const eventHandler = (event: any) => {
        if (event.testRunId === input.id) {
          reply.raw.write(`event: progress\ndata: ${JSON.stringify(event)}\n\n`);
        }
      };
      
      testRunEvents.on('progress', eventHandler);
      
      // Clean up on disconnect
      ctx.req.raw.on('close', () => {
        testRunEvents.off('progress', eventHandler);
        reply.raw.end();
      });
      
      // Keep connection alive
      const keepAlive = setInterval(() => {
        reply.raw.write(':keep-alive\n\n');
      }, 30000);
      
      ctx.req.raw.on('close', () => {
        clearInterval(keepAlive);
      });
      
      return { subscribed: true };
    }),

  getAdaptationHistory: publicProcedure
    .input(z.object({
      id: z.string(),
    }))
    .query(async ({ input }) => {
      // TODO: Fetch from database
      
      return {
        adaptations: [
          {
            stepIndex: 2,
            timestamp: new Date(),
            original: {
              selector: '.submit-btn',
              action: 'click',
            },
            adapted: {
              selector: 'button[type="submit"]',
              action: 'click',
            },
            reason: 'Original selector not found, found similar button element',
            confidence: 0.85,
          },
        ],
        totalAdaptations: 1,
        successRate: 1.0,
      };
    }),

  getContainerStatus: publicProcedure
    .input(z.object({
      id: z.string(),
    }))
    .query(async ({ input }) => {
      const testRun = testRuns.get(input.id);
      
      if (!testRun) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Test run not found',
        });
      }
      
      // TODO: Get actual container status
      
      return {
        containerId: testRun.containerId || null,
        status: 'ready',
        metrics: {
          cpu: 15.5,
          memory: 256,
        },
        lastHealthCheck: new Date(),
      };
    }),

  cancel: publicProcedure
    .input(z.object({
      id: z.string(),
    }))
    .mutation(async ({ input }) => {
      const testRun = testRuns.get(input.id);
      
      if (!testRun) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Test run not found',
        });
      }
      
      if (testRun.status === 'completed' || testRun.status === 'failed') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot cancel completed test run',
        });
      }
      
      testRun.status = 'cancelled';
      testRun.completedAt = new Date();
      
      // TODO: Update database
      // TODO: Stop container and clean up resources
      
      return testRun;
    }),
});