#!/bin/bash
# ========================================
# scripts/dev.sh - Development Environment (Complete with n8n)
# ========================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${GREEN}🚀 Starting SeeU Cafe Development Environment...${NC}"

# Load development environment
export NODE_ENV=development
export BUILD_TARGET=development

# Parse command line arguments
REBUILD=false
FRESH=false
LOGS=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --rebuild)
            REBUILD=true
            shift
            ;;
        --fresh)
            FRESH=true
            shift
            ;;
        --logs)
            LOGS=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --rebuild     Force rebuild images"
            echo "  --fresh       Fresh start (remove volumes)"
            echo "  --logs        Show logs after startup"
            echo "  --help, -h    Show this help"
            echo ""
            echo "Services included:"
            echo "  📱 API (NestJS)        - http://localhost:3000"
            echo "  🗄️  Database (PostgreSQL) - localhost:5432"
            echo "  📊 Cache (Redis)       - localhost:6379"
            echo "  🔧 PGAdmin             - http://localhost:5050"
            echo "  🤖 n8n Automation     - http://localhost:5678"
            exit 0
            ;;
        *)
            echo -e "${YELLOW}Unknown option: $1${NC}"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Check prerequisites
echo -e "${BLUE}🔍 Checking prerequisites...${NC}"

if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker not found${NC}"
    echo -e "${YELLOW}Please install Docker: https://docs.docker.com/get-docker/${NC}"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose not found${NC}"
    echo -e "${YELLOW}Please install Docker Compose${NC}"
    exit 1
fi

if ! docker info &> /dev/null; then
    echo -e "${RED}❌ Docker not running${NC}"
    echo -e "${YELLOW}Please start Docker Desktop or Docker daemon${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Docker is ready${NC}"

# Load environment variables
echo -e "${BLUE}📋 Loading environment variables...${NC}"

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
    echo -e "${YELLOW}Please create .env.development or .env file${NC}"
    exit 1
fi

# Create necessary directories
echo -e "${BLUE}📁 Creating necessary directories...${NC}"
mkdir -p scripts uploads templates
echo -e "${GREEN}✅ Directories created${NC}"

# Cleanup function
cleanup() {
    echo -e "\n${YELLOW}🧹 Stopping services...${NC}"
    docker-compose --profile development down
    echo -e "${GREEN}✅ Services stopped${NC}"
    exit 0
}

# Handle Ctrl+C
trap cleanup SIGINT SIGTERM

# Fresh start if requested
if [ "$FRESH" = true ]; then
    echo -e "${PURPLE}🔄 Fresh start - removing volumes...${NC}"
    docker-compose --profile development down -v
    echo -e "${GREEN}✅ Volumes removed${NC}"
fi

# Build profiles command - ใช้ development profile (รวม n8n แล้ว)
PROFILES="--profile development"

# Build command
BUILD_CMD="docker-compose $PROFILES up"

if [ "$REBUILD" = true ]; then
    BUILD_CMD="$BUILD_CMD --build"
    echo -e "${PURPLE}🔨 Rebuilding images...${NC}"
fi

BUILD_CMD="$BUILD_CMD --remove-orphans"

# Start development
echo -e "${BLUE}📦 Starting development services...${NC}"
echo -e "${CYAN}Command: $BUILD_CMD${NC}"

if [ "$LOGS" = true ]; then
    # Run in background and show logs
    $BUILD_CMD -d
    echo -e "${GREEN}✅ Services started in background${NC}"
    
    # Wait for services to be ready
    echo -e "${BLUE}⏳ Waiting for services to be ready...${NC}"
    sleep 5
    
    # Show service URLs
    echo -e "\n${BLUE}🌐 Service URLs:${NC}"
    echo -e "  📱 API: http://localhost:${API_PORT:-3000}"
    echo -e "  🗄️  PGAdmin: http://localhost:${PGADMIN_PORT:-5050}"
    echo -e "  🔧 n8n: http://localhost:${N8N_PORT:-5678}"
    echo -e "     User: ${N8N_AUTH_USER:-admin}"
    echo -e "     Pass: ${N8N_AUTH_PASSWORD:-password123}"
    echo ""
    
    # Show service status
    echo -e "${BLUE}🔍 Service Status:${NC}"
    
    # Check API
    if curl -f http://localhost:${API_PORT:-3000}/api &> /dev/null; then
        echo -e "  📱 API: ${GREEN}✅ Ready${NC}"
    else
        echo -e "  📱 API: ${YELLOW}⏳ Starting...${NC}"
    fi
    
    # Check PGAdmin
    if curl -f http://localhost:${PGADMIN_PORT:-5050} &> /dev/null; then
        echo -e "  🗄️  PGAdmin: ${GREEN}✅ Ready${NC}"
    else
        echo -e "  🗄️  PGAdmin: ${YELLOW}⏳ Starting...${NC}"
    fi
    
    # Check n8n
    if curl -f http://localhost:${N8N_PORT:-5678} &> /dev/null; then
        echo -e "  🔧 n8n: ${GREEN}✅ Ready${NC}"
    else
        echo -e "  🔧 n8n: ${YELLOW}⏳ Starting...${NC}"
    fi
    
    echo ""
    echo -e "${BLUE}📊 Showing logs (Ctrl+C to stop logs, services will continue)...${NC}"
    echo -e "${YELLOW}Tip: Use 'make logs' or 'make n8n-logs' to view specific service logs${NC}"
    echo ""
    
    docker-compose $PROFILES logs -f
else
    # Run in foreground
    $BUILD_CMD
fi