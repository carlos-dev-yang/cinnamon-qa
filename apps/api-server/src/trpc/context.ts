import { inferAsyncReturnType } from '@trpc/server';
import { FastifyRequest, FastifyReply } from 'fastify';

export interface CreateContextOptions {
  req: FastifyRequest;
  res: FastifyReply;
}

export function createContext({ req, res }: CreateContextOptions) {
  return {
    req,
    res,
  };
}

export type Context = inferAsyncReturnType<typeof createContext>;