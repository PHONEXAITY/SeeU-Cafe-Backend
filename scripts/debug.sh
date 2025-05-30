# ========================================
# debug.sh - Debug environment
# ========================================

#!/bin/bash
# debug.sh

echo -e "${BLUE}🔍 Environment Debug Information${NC}"
echo "=================================="

echo -e "\n${YELLOW}Docker Status:${NC}"
docker --version
docker-compose --version
docker info | grep -E "(Server Version|Storage Driver|Logging Driver)"

echo -e "\n${YELLOW}Running Containers:${NC}"
docker-compose -f docker-compose.universal.yml ps

echo -e "\n${YELLOW}Service Health:${NC}"
docker-compose -f docker-compose.universal.yml exec postgres pg_isready -U postgres || echo "PostgreSQL not ready"
docker-compose -f docker-compose.universal.yml exec redis redis-cli ping || echo "Redis not ready"

echo -e "\n${YELLOW}Environment Variables:${NC}"
docker-compose -f docker-compose.universal.yml exec api env | grep -E "(NODE_ENV|DATABASE_URL|REDIS_HOST)" | head -10

echo -e "\n${YELLOW}Recent API Logs:${NC}"
docker-compose -f docker-compose.universal.yml logs --tail=20 api