import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { ContainerStatusSchema } from '../../types';
import { TRPCError } from '@trpc/server';

// Mock data
const containers = new Map<string, any>();

export const containerRouter = router({
  list: publicProcedure
    .input(z.object({
      status: ContainerStatusSchema.optional(),
    }).optional())
    .query(async ({ input }) => {
      let allContainers = Array.from(containers.values());
      
      if (input?.status) {
        allContainers = allContainers.filter(c => c.status === input.status);
      }
      
      // TODO: Fetch from database/Docker
      
      return {
        containers: allContainers,
        total: allContainers.length,
        healthy: allContainers.filter(c => c.status === 'ready').length,
        busy: allContainers.filter(c => c.status === 'busy').length,
        unhealthy: allContainers.filter(c => c.status === 'unhealthy').length,
      };
    }),

  get: publicProcedure
    .input(z.object({
      id: z.string(),
    }))
    .query(async ({ input }) => {
      const container = containers.get(input.id);
      
      if (!container) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Container not found',
        });
      }
      
      return container;
    }),

  start: publicProcedure
    .input(z.object({
      id: z.string(),
    }))
    .mutation(async ({ input }) => {
      const container = containers.get(input.id);
      
      if (!container) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Container not found',
        });
      }
      
      if (container.status !== 'stopped') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Container is not in stopped state',
        });
      }
      
      // TODO: Actually start Docker container
      container.status = 'ready';
      
      return {
        success: true,
        container,
      };
    }),

  stop: publicProcedure
    .input(z.object({
      id: z.string(),
    }))
    .mutation(async ({ input }) => {
      const container = containers.get(input.id);
      
      if (!container) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Container not found',
        });
      }
      
      if (container.status === 'stopped') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Container is already stopped',
        });
      }
      
      if (container.status === 'busy') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot stop container while test is running',
        });
      }
      
      // TODO: Actually stop Docker container
      container.status = 'stopped';
      
      return {
        success: true,
        container,
      };
    }),

  restart: publicProcedure
    .input(z.object({
      id: z.string(),
    }))
    .mutation(async ({ input }) => {
      const container = containers.get(input.id);
      
      if (!container) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Container not found',
        });
      }
      
      if (container.status === 'busy') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot restart container while test is running',
        });
      }
      
      // TODO: Actually restart Docker container
      container.status = 'ready';
      container.lastHealthCheck = new Date();
      
      return {
        success: true,
        container,
      };
    }),

  logs: publicProcedure
    .input(z.object({
      id: z.string(),
      tail: z.number().min(1).max(1000).default(100),
    }))
    .query(async ({ input }) => {
      const container = containers.get(input.id);
      
      if (!container) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Container not found',
        });
      }
      
      // TODO: Fetch actual Docker logs
      
      return {
        logs: [
          {
            timestamp: new Date(),
            level: 'info',
            message: 'Container started successfully',
          },
          {
            timestamp: new Date(),
            level: 'info',
            message: 'Playwright browser initialized',
          },
        ],
        containerId: container.dockerId,
      };
    }),

  status: publicProcedure
    .input(z.object({
      id: z.string(),
    }))
    .query(async ({ input }) => {
      const container = containers.get(input.id);
      
      if (!container) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Container not found',
        });
      }
      
      // TODO: Get actual metrics from Docker
      
      return {
        status: container.status,
        metrics: container.metrics || {
          cpu: 10.5,
          memory: 256,
        },
        uptime: Date.now() - container.createdAt.getTime(),
        lastHealthCheck: container.lastHealthCheck,
        allocatedTo: container.allocatedTo || null,
      };
    }),
});