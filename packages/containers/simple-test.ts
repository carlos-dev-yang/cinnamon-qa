import { RedisClient } from '@cinnamon-qa/queue';
import { SimpleContainerPool } from './src';

async function simpleTest() {
  console.log('🚀 Simple Container Test...');
  
  // Initialize Redis client
  const redisClient = new RedisClient({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    db: 0,
  });
  
  try {
    console.log('📡 Connecting to Redis...');
    await redisClient.connect();
    console.log('✅ Redis connected');

    // Initialize container pool
    console.log('🐳 Initializing Container Pool...');
    const containerPool = new SimpleContainerPool(redisClient);
    
    // Initialize pool with 2 containers
    await containerPool.initialize();
    console.log('✅ Container pool initialized');

    // Check if containers are running
    console.log('🔍 Checking Docker containers...');
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    const { stdout } = await execAsync('docker ps --filter name=cinnamon-qa-mcp --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"');
    console.log('Running containers:');
    console.log(stdout);

    // Check pool status
    console.log('📊 Checking pool status...');
    const status = await containerPool.getPoolStatus();
    console.log('Pool status:', JSON.stringify(status, null, 2));

    console.log('🧹 Shutting down...');
    await containerPool.shutdown();
    console.log('✅ Container pool shutdown complete');
    
  } catch (error) {
    console.error('❌ Error in container pool test:', error);
  } finally {
    await redisClient.disconnect();
    console.log('✅ Redis disconnected');
  }
}

// Run test
simpleTest().catch(console.error);