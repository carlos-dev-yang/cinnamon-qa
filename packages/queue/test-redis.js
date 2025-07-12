/**
 * Redis 연결 테스트 스크립트
 */

const { createLogger } = require('@cinnamon-qa/logger');
const { RedisClient } = require('./dist/redis');

const logger = createLogger({ context: 'RedisTestJS' });

async function testRedis() {
  logger.info('Redis connection test started');
  
  const redisClient = new RedisClient();
  
  try {
    // 1. Redis 연결 테스트
    logger.info('Connecting to Redis');
    await redisClient.connect();
    logger.info('Redis connection successful');
    
    // 2. 헬스체크 테스트
    logger.info('Running health check');
    const isHealthy = await redisClient.healthCheck();
    logger.info('Health check result', { healthy: isHealthy, status: isHealthy ? 'normal' : 'abnormal' });
    
    // 3. 기본 데이터 읽기/쓰기 테스트
    logger.info('Running basic read/write test');
    const testKey = 'test:connection';
    const testValue = 'Hello Cinnamon-QA!';
    
    await redisClient.instance.set(testKey, testValue);
    logger.info('Key set', { key: testKey, value: testValue });
    
    const retrievedValue = await redisClient.instance.get(testKey);
    logger.info('Key retrieved', { key: testKey, value: retrievedValue });
    
    if (retrievedValue === testValue) {
      logger.info('Read/write test successful');
    } else {
      logger.error('Read/write test failed', { expected: testValue, received: retrievedValue });
    }
    
    // 4. Redis 정보 조회
    logger.info('Getting Redis server info');
    const info = await redisClient.info();
    const lines = info.split('\n');
    const version = lines.find(line => line.startsWith('redis_version:'));
    const memory = lines.find(line => line.startsWith('used_memory_human:'));
    const clients = lines.find(line => line.startsWith('connected_clients:'));
    
    logger.info('Redis server info', { version: version?.split(':')[1] });
    logger.info('Redis memory usage', { memory: memory?.split(':')[1] });
    logger.info('Redis connected clients', { clients: clients?.split(':')[1] });
    
    // 5. 테스트 데이터 정리
    logger.info('Cleaning up test data');
    await redisClient.instance.del(testKey);
    logger.info('Test key deleted', { key: testKey });
    
    logger.info('All Redis tests completed successfully');
    
  } catch (error) {
    logger.error('Redis test failed', { error: error.message, stack: error.stack });
    process.exit(1);
  } finally {
    await redisClient.disconnect();
    logger.info('Redis connection closed');
  }
}

// 테스트 실행
testRedis().catch(error => {
  logger.error('Test execution failed', { error: error.message, stack: error.stack });
  process.exit(1);
});