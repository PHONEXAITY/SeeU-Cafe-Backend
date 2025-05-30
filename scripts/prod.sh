# ========================================
# scripts/prod.sh - Production Environment  
# ========================================

#!/bin/bash
set -e

# Colors  
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${GREEN}🚀 Starting Production Environment...${NC}"

# Load production environment
export NODE_ENV=production
export BUILD_TARGET=production

# Load environment variables
if [ -f ".env.production" ]; then
    set -a
    source .env.production
    set +a
    echo -e "${GREEN}✅ Loaded .env.production${NC}"
else
    echo -e "${RED}❌ .env.production not found${NC}"
    exit 1
fi

# Start production services
echo -e "${BLUE}📦 Starting production services...${NC}"
docker-compose up -d --build --remove-orphans

echo -e "${GREEN}✅ Production environment started${NC}"
echo -e "${BLUE}📊 View logs: docker-compose logs -f${NC}"