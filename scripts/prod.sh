# ========================================
# prod.sh - Production Environment
# ========================================

#!/bin/bash
# prod.sh
set -e

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
docker-compose -f docker-compose.universal.yml up -d --build --remove-orphans

echo -e "${GREEN}✅ Production environment started${NC}"
echo -e "${BLUE}📊 View logs: docker-compose -f docker-compose.universal.yml logs -f${NC}"