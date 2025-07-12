# Container Test Strategy

컨테이너 풀 시스템의 테스트 방법론과 검증 결과를 정리한 문서입니다.

## 📋 테스트 목적

1. **컨테이너 생성/삭제 검증**: 2개 고정 컨테이너가 정상적으로 생성되고 종료되는지 확인
2. **Redis 상태 관리 검증**: 컨테이너 상태가 Redis에 정확히 저장/조회되는지 확인
3. **Docker 환경 설정 검증**: Docker Inspector가 환경을 올바르게 설정하는지 확인
4. **네트워킹 검증**: 컨테이너가 올바른 포트로 접근 가능한지 확인

## 🧪 테스트 시나리오

### 1. 기본 초기화 테스트 (`simple-test.ts`)

```typescript
// 핵심 검증 항목
1. Redis 연결 성공
2. Docker 환경 초기화 (이미지 확인, 네트워크 설정)
3. 2개 컨테이너 생성 (container-1: 3001, container-2: 3002)
4. Redis 상태 저장 확인
5. Pool 상태 조회 (total: 2, available: 2, allocated: 0)
6. 정상 Shutdown 및 정리
```

**실행 방법:**
```bash
npx tsx simple-test.ts
```

### 2. 전체 기능 테스트 (`test-containers.ts`)

```typescript
// 확장된 검증 항목 (헬스체크 이슈로 현재 중단)
1. 컨테이너 할당/해제 로직
2. SSE 헬스체크 기능
3. 재부팅 로직
4. 2개 컨테이너 동시 할당 시나리오
```

**현재 상태**: 헬스체크 로직에서 무한루프 문제 발견, 추후 개선 예정

## ✅ 검증 완료된 기능

### 1. Docker Inspector
- **Docker 설치 확인**: `docker --version` 명령어로 설치 상태 확인
- **Docker 데몬 확인**: `docker info` 명령어로 서비스 실행 상태 확인
- **이미지 관리**: `mcr.microsoft.com/playwright/mcp:latest` 이미지 존재 확인
- **네트워크 설정**: `cinnamon-qa-network` 네트워크 생성/확인 (중복 생성 에러 처리)

### 2. Container Pool 관리
- **고정 2개 컨테이너**: `cinnamon-qa-mcp-1`, `cinnamon-qa-mcp-2` 생성
- **포트 매핑**: 호스트 3001, 3002 → 컨테이너 3000 매핑
- **리소스 제한**: 메모리 512MB, CPU 0.5 코어 제한
- **환경 변수**: `CONTAINER_POOL_ID` 설정으로 컨테이너 식별

### 3. Redis 상태 관리
- **상태 저장**: 컨테이너별 상태가 Redis `container:{id}` 키에 저장
- **상태 구조**:
  ```json
  {
    "containerId": "container-1",
    "port": 3001,
    "allocated": false,
    "lastCheckedAt": "2025-07-12T03:34:57.909Z"
  }
  ```
- **Pool 상태 조회**: 전체/가용/할당 컨테이너 수 집계

### 4. 생명주기 관리
- **시작**: Docker 컨테이너 생성 및 시작
- **대기**: 컨테이너 준비 상태까지 대기 (최대 30초)
- **종료**: Graceful shutdown 및 컨테이너 삭제
- **정리**: Redis 상태 정리

## ⚠️ 현재 이슈 및 해결책

### 1. SSE 헬스체크 이슈
**문제**: EventSource를 통한 헬스체크에서 연결 지연 발생
**원인**: playwright-mcp SSE 엔드포인트 응답 시간 불일치
**해결 방향**: 
- TCP 포트 체크로 대체
- 또는 헬스체크 타임아웃 조정

### 2. 재귀 호출 무한루프
**문제**: 할당 실패 시 재귀 호출로 인한 무한루프
**해결**: 재귀 대신 직접적인 대안 컨테이너 검색으로 수정 완료

## 🔧 테스트 환경 설정

### 필수 조건
```bash
# Docker 설치 및 실행 중
docker --version
docker info

# Redis 실행 중 (port 6379)
docker ps | grep redis

# Node.js 의존성 설치
npm install --workspace=@cinnamon-qa/containers
```

### 환경 변수
```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0
```

## 📊 테스트 결과

### 성공 시나리오
```
🚀 Simple Container Test...
📡 Connecting to Redis...
✅ Redis connected
🐳 Initializing Container Pool...
✅ Container pool initialized
🔍 Checking Docker containers...
Running containers:
NAMES               STATUS                  PORTS
cinnamon-qa-mcp-2   Up Less than a second   0.0.0.0:3002->3000/tcp
cinnamon-qa-mcp-1   Up Less than a second   0.0.0.0:3001->3000/tcp

📊 Pool status: {
  "total": 2,
  "available": 2,
  "allocated": 0,
  "containers": [...]
}
🧹 Shutting down...
✅ Container pool shutdown complete
```

## 🚀 다음 단계

### 1. 헬스체크 개선
- SSE 대신 TCP 포트 체크 구현
- 또는 더 안정적인 MCP 상태 확인 방법 개발

### 2. 할당/해제 로직 완성
- 컨테이너 할당 테스트 완료
- 동시 할당 시나리오 검증
- 자동 해제 로직 테스트

### 3. 모니터링 강화
- 컨테이너 상태 실시간 추적
- 에러 상황 대응 로직 테스트
- 성능 메트릭 수집

## 🔍 수동 검증 방법

### 컨테이너 상태 확인
```bash
# 실행 중인 컨테이너 확인
docker ps --filter name=cinnamon-qa-mcp

# 컨테이너 로그 확인
docker logs cinnamon-qa-mcp-1
docker logs cinnamon-qa-mcp-2

# SSE 엔드포인트 테스트
curl -N http://localhost:3001/sse
curl -N http://localhost:3002/sse
```

### Redis 상태 확인
```bash
# Redis CLI 접속
redis-cli

# 컨테이너 상태 조회
HGETALL container:container-1
HGETALL container:container-2

# 모든 컨테이너 키 조회
KEYS container:*
```

## 📝 결론

Task 6.1 "Create Playwright-MCP Docker Container Image"는 성공적으로 완료되었습니다.

- ✅ **2개 고정 컨테이너 풀** 구현 완료
- ✅ **Redis 상태 관리** 정상 동작
- ✅ **Docker 환경 자동 설정** 완료
- ✅ **생명주기 관리** (생성/종료) 검증 완료

다음 Task 6.2에서는 할당/해제 로직과 헬스체크 기능을 완성할 예정입니다.