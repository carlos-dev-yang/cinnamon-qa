import { RedisClient } from '@cinnamon-qa/queue';
import { createLogger } from '@cinnamon-qa/logger';
import { SimpleContainerPool } from './src';

const logger = createLogger({ context: 'SimpleTest' });

async function simpleTest() {
  logger.info('Simple Container Test');
  
  // Initialize Redis client
  const redisClient = new RedisClient({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    db: 0,
  });
  
  try {
    logger.info('Connecting to Redis');
    await redisClient.connect();
    logger.info('Redis connected');

    // Initialize container pool
    logger.info('Initializing Container Pool');
    const containerPool = new SimpleContainerPool(redisClient);
    
    // Initialize pool with 2 containers
    await containerPool.initialize();
    logger.info('Container pool initialized');

    // Check if containers are running
    logger.info('Checking Docker containers');
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    const { stdout } = await execAsync('docker ps --filter name=cinnamon-qa-mcp --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"');
    logger.info('Running containers', { containers: stdout });

    // Check pool status
    logger.info('Checking pool status');
    const status = await containerPool.getPoolStatus();
    logger.info('Pool status', { status });

    logger.info('Shutting down');
    await containerPool.shutdown();
    logger.info('Container pool shutdown complete');
    
  } catch (error) {
    logger.error('Error in container pool test', { error });
  } finally {
    await redisClient.disconnect();
    logger.info('Redis disconnected');
  }
}

// Run test
simpleTest().catch(error => logger.error('Simple test failed', { error }));