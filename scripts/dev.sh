#!/bin/bash
# ========================================
# scripts/dev.sh - Development Environment
# ========================================

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
elif [ -f ".env" ]; then
    set -a
    source .env
    set +a
    echo -e "${YELLOW}⚠️  Using .env file (consider creating .env.development)${NC}"
else
    echo -e "${RED}❌ No environment file found${NC}"
    exit 1
fi

# Cleanup function
cleanup() {
    echo -e "\n${YELLOW}🧹 Stopping services...${NC}"
    docker-compose down
    exit 0
}

# Handle Ctrl+C
trap cleanup SIGINT SIGTERM

# Start development with profiles
echo -e "${BLUE}📦 Starting development services...${NC}"
docker-compose --profile development up --build --remove-orphans