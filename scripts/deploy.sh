# ========================================
# deploy.sh - Deploy to DigitalOcean
# ========================================

#!/bin/bash
# deploy.sh
set -e

echo -e "${GREEN}🚀 Deploying to Production...${NC}"

# Build and push images (if using registry)
echo -e "${BLUE}📦 Building production images...${NC}"
export NODE_ENV=production
export BUILD_TARGET=production

# Load production environment
set -a
source .env.production
set +a

# Run production deployment
docker-compose -f docker-compose.universal.yml pull
docker-compose -f docker-compose.universal.yml up -d --build --remove-orphans

# Run health checks
echo -e "${BLUE}🔍 Running health checks...${NC}"
sleep 30

if curl -f http://localhost:${API_PORT:-3000}/api &> /dev/null; then
    echo -e "${GREEN}✅ API is healthy${NC}"
else
    echo -e "${RED}❌ API health check failed${NC}"
    docker-compose -f docker-compose.universal.yml logs api
    exit 1
fi

echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"