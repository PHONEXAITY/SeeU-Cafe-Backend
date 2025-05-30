# ========================================
# scripts/debug.sh - Debug Environment
# ========================================

#!/bin/bash

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔍 Environment Debug Information${NC}"
echo "=================================="

echo -e "\n${YELLOW}Docker Status:${NC}"
docker --version
docker-compose --version
docker info | grep -E "(Server Version|Storage Driver|Logging Driver)" || true

echo -e "\n${YELLOW}Running Containers:${NC}"
docker-compose ps || true

echo -e "\n${YELLOW}Service Health:${NC}"
docker-compose exec postgres pg_isready -U postgres || echo "PostgreSQL not ready"
docker-compose exec redis redis-cli ping || echo "Redis not ready"

echo -e "\n${YELLOW}Environment Variables:${NC}"
docker-compose exec api env | grep -E "(NODE_ENV|DATABASE_URL|REDIS_HOST)" | head -10 || true

echo -e "\n${YELLOW}Recent API Logs:${NC}"
docker-compose logs --tail=20 api || true