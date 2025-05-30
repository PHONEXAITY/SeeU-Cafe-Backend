# ========================================
# cleanup.sh - Clean up Docker resources
# ========================================

#!/bin/bash
# cleanup.sh
set -e

echo -e "${YELLOW}🧹 Cleaning up Docker resources...${NC}"

# Stop all services
docker-compose -f docker-compose.universal.yml down -v

# Clean up unused resources
docker system prune -af
docker volume prune -f
docker network prune -f

echo -e "${GREEN}✅ Cleanup completed${NC}"

# ========================================
# logs.sh - View logs
# ========================================