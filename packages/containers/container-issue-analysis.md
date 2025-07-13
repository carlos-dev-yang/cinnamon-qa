# Container 중단 문제 분석 보고서

## 🔍 문제 현상
- 컨테이너 풀 테스트 중 `cinnamon-qa-mcp-1`, `cinnamon-qa-mcp-2` 컨테이너가 예상보다 빨리 종료됨
- `docker ps`로 확인 시 컨테이너가 실행되지 않는 상태
- 수동으로 생성한 컨테이너는 정상 실행

## 🧪 분석 테스트 결과

### 1. 수동 컨테이너 테스트
```bash
# 수동 실행 컨테이너들이 정상 작동
docker ps --filter name=persistent-debug  # ✅ Up About a minute
docker ps --filter name=monitored-mcp     # ✅ Up 34 seconds
```

### 2. 우리 코드로 생성한 컨테이너 테스트
```typescript
// PlaywrightMcpContainer.start() 메서드로 생성한 컨테이너들도 정상 실행
debug-test-mcp-1      # ✅ Up 2 seconds
manual-test-mcp       # ✅ Up 2 seconds  
debug-test-examine    # ✅ Up 3 seconds
```

### 3. Docker 명령어 비교
**우리 코드가 생성하는 명령어:**
```bash
docker run -d --name cinnamon-qa-mcp-1 -p 3001:3000 --network cinnamon-qa-network --memory=512m --cpus=0.5 --env CONTAINER_POOL_ID=container-1 mcr.microsoft.com/playwright/mcp:latest --headless --host 0.0.0.0 --port 3000 --isolated
```

**수동 테스트 명령어:**
```bash
docker run -d --name persistent-debug --network cinnamon-qa-network -p 3005:3000 mcr.microsoft.com/playwright/mcp:latest --headless --host 0.0.0.0 --port 3000 --isolated
```

## 🎯 핵심 발견사항

### ✅ 문제가 아닌 것들
1. **Docker 명령어**: 우리 코드의 docker run 명령어는 정상
2. **컨테이너 이미지**: `mcr.microsoft.com/playwright/mcp:latest` 이미지 자체는 안정적
3. **네트워크 설정**: `cinnamon-qa-network` 네트워크 문제 없음
4. **리소스 제한**: `--memory=512m --cpus=0.5` 제한도 문제없음
5. **즉시 종료**: 컨테이너가 생성 즉시 종료되는 것은 아님

### ❓ 의심되는 원인들

#### 1. 테스트 코드에서의 강제 종료
- 우리 테스트들이 `containerPool.shutdown()`을 호출
- shutdown 시 `docker rm -f` 명령어로 컨테이너 강제 삭제

#### 2. Redis 연결 문제로 인한 재시작 루프
- 헬스체크 실패 → 재시작 → 재시작 중 다시 헬스체크 → 무한 루프 가능성
- 컨테이너가 시작되자마자 헬스체크에서 unhealthy 판정

#### 3. 포트 충돌
- 동일한 포트(3001, 3002)로 여러 번 컨테이너 생성 시도
- 이전 컨테이너가 완전히 정리되지 않은 상태에서 새 컨테이너 생성

#### 4. Docker 데몬 정리 메커니즘
- Docker가 사용되지 않는 컨테이너를 자동으로 정리
- 특별한 라벨이나 설정 없이 생성된 컨테이너 대상

## 🔧 실제 원인 추정

### 가장 가능성 높은 원인: **테스트 코드의 shutdown() 호출**

```typescript
// test-pool-manager.ts의 마지막 부분
console.log('🧹 Shutting down...');
await poolManager.shutdown();  // ← 여기서 모든 컨테이너 삭제
```

```typescript
// container-pool-manager.ts의 shutdown 메서드
async shutdown(): Promise<void> {
  for (const container of this.containers.values()) {
    await container.stop();
    await container.remove();  // ← docker rm -f 실행
  }
}
```

### 확인 방법
1. **테스트 없이 컨테이너 풀 초기화만 실행**
2. **shutdown() 호출 없이 장시간 실행**
3. **Docker 이벤트 로그 모니터링**

## 📋 해결 방안

### 1. 즉시 해결책
```typescript
// 테스트에서 shutdown을 선택적으로 호출
if (process.env.KEEP_CONTAINERS !== 'true') {
  await poolManager.shutdown();
}
```

### 2. 운영 환경에서의 해결책
```typescript
// 컨테이너에 restart policy 추가
const createCommand = [
  'docker run -d',
  '--restart=unless-stopped',  // ← 추가
  `--name ${this.container.name}`,
  // ... 나머지 옵션
];
```

### 3. 모니터링 개선
```typescript
// 컨테이너 상태 주기적 확인
setInterval(async () => {
  const status = await this.checkContainerStatus();
  if (!status.running) {
    console.warn(`Container ${this.name} stopped unexpectedly`);
    await this.restart();
  }
}, 30000); // 30초마다 확인
```

## 🎉 결론

**컨테이너 자체는 안정적으로 실행됨**. 문제는 주로 **테스트 환경에서 발생하는 강제 종료**가 원인으로 추정됩니다.

### 실제 운영에서 필요한 개선사항:
1. **Restart Policy 추가**: `--restart=unless-stopped`
2. **상태 모니터링 강화**: 주기적 헬스체크 및 자동 재시작
3. **로그 수집**: 컨테이너 종료 원인 추적
4. **Graceful Shutdown**: 테스트 환경과 운영 환경 분리

이 분석을 바탕으로 다음 Task에서 더 안정적인 컨테이너 관리 시스템을 구현할 수 있습니다.