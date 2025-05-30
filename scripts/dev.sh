#!/bin/bash
# ========================================
# scripts/dev.sh - Development Environment (Improved)
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
    docker-compose down
    echo -e "${GREEN}✅ Services stopped${NC}"
    exit 0
}

# Handle Ctrl+C
trap cleanup SIGINT SIGTERM

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
            exit 0
            ;;
        *)
            echo -e "${YELLOW}Unknown option: $1${NC}"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Fresh start if requested
if [ "$FRESH" = true ]; then
    echo -e "${PURPLE}🔄 Fresh start - removing volumes...${NC}"
    docker-compose down -v
    echo -e "${GREEN}✅ Volumes removed${NC}"
fi

# Build command
BUILD_CMD="docker-compose --profile development up"

if [ "$REBUILD" = true ]; then
    BUILD_CMD="$BUILD_CMD --build"
    echo -e "${PURPLE}🔨 Rebuilding images...${NC}"
fi

BUILD_CMD="$BUILD_CMD --remove-orphans"

# Start development with profiles
echo -e "${BLUE}📦 Starting development services...${NC}"
echo -e "${CYAN}Command: $BUILD_CMD${NC}"

if [ "$LOGS" = true ]; then
    # Run in background and show logs
    $BUILD_CMD -d
    echo -e "${GREEN}✅ Services started in background${NC}"
    echo -e "${BLUE}📊 Showing logs (Ctrl+C to stop logs, services will continue)...${NC}"
    docker-compose logs -f
else
    # Run in foreground
    $BUILD_CMD
fi