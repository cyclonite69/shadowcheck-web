#!/bin/bash
# Deploy Redis 7 cache on AWS for the host-network ShadowCheck runtime.

set -euo pipefail

echo "=== ShadowCheck Redis Deployment ==="
echo ""

if [ "$EUID" -ne 0 ]; then
  echo "ERROR: Run with sudo"
  exit 1
fi

echo "[1/4] Preparing persistent data directory..."
REDIS_DATA_DIR="/var/lib/redis"
mkdir -p "$REDIS_DATA_DIR"
chmod 700 "$REDIS_DATA_DIR"
echo "  Data dir: $REDIS_DATA_DIR"

echo ""
echo "[2/4] Removing stale container if present..."
docker stop shadowcheck_redis 2>/dev/null || true
docker rm shadowcheck_redis 2>/dev/null || true
echo "  Cleared old container state"

echo ""
echo "[3/4] Starting Redis 7..."
docker run -d \
  --name shadowcheck_redis \
  --network host \
  --restart unless-stopped \
  --health-cmd "redis-cli -h 127.0.0.1 ping || exit 1" \
  --health-interval 10s \
  --health-timeout 5s \
  --health-retries 5 \
  --health-start-period 10s \
  -v "$REDIS_DATA_DIR:/data" \
  --log-driver json-file \
  --log-opt max-size=10m \
  --log-opt max-file=3 \
  redis:7-alpine \
  redis-server \
    --appendonly yes \
    --dir /data \
    --bind 127.0.0.1 \
    --port 6379 \
    --maxmemory 512mb \
    --maxmemory-policy allkeys-lru

echo "  Waiting for Redis..."
for i in $(seq 1 15); do
  if docker exec shadowcheck_redis redis-cli -h 127.0.0.1 ping >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! docker exec shadowcheck_redis redis-cli -h 127.0.0.1 ping >/dev/null 2>&1; then
  echo "ERROR: Redis failed to start within 15s"
  echo ""
  docker logs --tail 30 shadowcheck_redis
  exit 1
fi

echo ""
echo "[4/4] Redis is ready"
docker exec shadowcheck_redis redis-cli -h 127.0.0.1 ping

echo ""
echo "=== Redis deployed successfully ==="
echo "  Container: shadowcheck_redis (--network host)"
echo "  Listening: 127.0.0.1:6379"
echo "  Data:      $REDIS_DATA_DIR"
