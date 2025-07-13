import Fastify from 'fastify';
import { createLogger } from '@cinnamon-qa/logger';
import { app } from './app/app';

const host = process.env.HOST ?? 'localhost';
const port = process.env.PORT ? Number(process.env.PORT) : 3000;

const logger = createLogger({ context: 'ApiServer' });

// Instantiate Fastify with some config
const server = Fastify({
  logger: true,
});

// Register your application as a normal plugin.
server.register(app);

// Start listening.
server.listen({ port, host }, (err) => {
  if (err) {
    server.log.error(err);
    process.exit(1);
  } else {
    logger.info(`Server ready at http://${host}:${port}`);
  }
});
