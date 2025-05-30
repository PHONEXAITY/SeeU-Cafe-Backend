#!/bin/bash
# ========================================
# dev.sh - Development Environment
# ========================================

#!/bin/bash
set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${GREEN}🚀 Starting Development Environment...${NC}"

# Load development environment
export NODE_ENV=development
export BUILD_TARGET=development

# Check prerequisites
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker not found${NC}"
    exit 1
fi

if ! docker info &> /dev/null; then
    echo -e "${RED}❌ Docker not running${NC}"
    exit 1
fi

# Load environment variables
if [ -f ".env.development" ]; then
    set -a
    source .env.development
    set +a
    echo -e "${GREEN}✅ Loaded .env.development${NC}"
else
    echo -e "${YELLOW}⚠️  .env.development not found, using .env.example${NC}"
    cp .env.example .env.development
fi

# Start development with profiles
echo -e "${BLUE}📦 Starting development services...${NC}"
docker-compose -f docker-compose.universal.yml --profile development up --build --remove-orphans