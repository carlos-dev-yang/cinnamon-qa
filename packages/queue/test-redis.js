/**
 * Redis 연결 테스트 스크립트
 */

const { RedisClient } = require('./dist/redis');

async function testRedis() {
  console.log('🧪 Redis 연결 테스트 시작...');
  
  const redisClient = new RedisClient();
  
  try {
    // 1. Redis 연결 테스트
    console.log('\n1️⃣ Redis 연결 중...');
    await redisClient.connect();
    console.log('✅ Redis 연결 성공');
    
    // 2. 헬스체크 테스트
    console.log('\n2️⃣ 헬스체크 실행...');
    const isHealthy = await redisClient.healthCheck();
    console.log(`✅ 헬스체크 결과: ${isHealthy ? '정상' : '비정상'}`);
    
    // 3. 기본 데이터 읽기/쓰기 테스트
    console.log('\n3️⃣ 기본 읽기/쓰기 테스트...');
    const testKey = 'test:connection';
    const testValue = 'Hello Cinnamon-QA!';
    
    await redisClient.instance.set(testKey, testValue);
    console.log(`📝 키 설정: ${testKey} = ${testValue}`);
    
    const retrievedValue = await redisClient.instance.get(testKey);
    console.log(`📖 키 조회: ${testKey} = ${retrievedValue}`);
    
    if (retrievedValue === testValue) {
      console.log('✅ 읽기/쓰기 테스트 성공');
    } else {
      console.log('❌ 읽기/쓰기 테스트 실패');
    }
    
    // 4. Redis 정보 조회
    console.log('\n4️⃣ Redis 서버 정보...');
    const info = await redisClient.info();
    const lines = info.split('\n');
    const version = lines.find(line => line.startsWith('redis_version:'));
    const memory = lines.find(line => line.startsWith('used_memory_human:'));
    const clients = lines.find(line => line.startsWith('connected_clients:'));
    
    console.log(`📊 ${version}`);
    console.log(`📊 ${memory}`);
    console.log(`📊 ${clients}`);
    
    // 5. 테스트 데이터 정리
    console.log('\n5️⃣ 테스트 데이터 정리...');
    await redisClient.instance.del(testKey);
    console.log('🧹 테스트 키 삭제 완료');
    
    console.log('\n🎉 모든 Redis 테스트 완료!');
    
  } catch (error) {
    console.error('❌ Redis 테스트 실패:', error);
    process.exit(1);
  } finally {
    await redisClient.disconnect();
    console.log('🔌 Redis 연결 종료');
  }
}

// 테스트 실행
testRedis().catch(error => {
  console.error('❌ 테스트 실행 중 오류:', error);
  process.exit(1);
});