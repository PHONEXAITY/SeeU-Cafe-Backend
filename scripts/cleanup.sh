# ========================================
# scripts/cleanup.sh - Clean up Docker resources
# ========================================

#!/bin/bash
set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}🧹 Cleaning up Docker resources...${NC}"

# Stop all services
docker-compose down -v || true

# Clean up unused resources
docker system prune -af || true
docker volume prune -f || true
docker network prune -f || true

echo -e "${GREEN}✅ Cleanup completed${NC}"