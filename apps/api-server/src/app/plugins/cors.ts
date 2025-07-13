import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';

const corsPlugin: FastifyPluginAsync = async (fastify) => {
  // Add CORS headers
  const cors = await import('@fastify/cors');
  await fastify.register(cors.default, {
    origin: true,
    credentials: true,
  });
};

export default fp(corsPlugin);