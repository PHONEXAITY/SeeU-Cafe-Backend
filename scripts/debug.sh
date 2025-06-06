#!/bin/bash
# ========================================
# scripts/debug.sh - Debug Environment (Complete with n8n)
# ========================================

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BLUE}🔍 SeeU Cafe Development Environment Debug${NC}"
echo "=============================================="

# Load environment variables
if [ -f ".env.development" ]; then
    set -a
    source .env.development
    set +a
fi

echo -e "\n${YELLOW}📋 System Information:${NC}"
echo -e "  OS: $(uname -s) $(uname -r)"
echo -e "  Architecture: $(uname -m)"
echo -e "  Date: $(date)"
echo -e "  User: $(whoami)"

echo -e "\n${YELLOW}🐳 Docker Status:${NC}"
if command -v docker &> /dev/null; then
    echo -e "  Docker Version: $(docker --version)"
    if command -v docker-compose &> /dev/null; then
        echo -e "  Docker Compose: $(docker-compose --version)"
    else
        echo -e "  ${RED}❌ Docker Compose not found${NC}"
    fi
    
    # Docker info
    if docker info &> /dev/null; then
        echo -e "  ${GREEN}✅ Docker daemon is running${NC}"
        docker info | grep -E "(Server Version|Storage Driver|Logging Driver|Operating System)" | sed 's/^/    /'
    else
        echo -e "  ${RED}❌ Docker daemon not running${NC}"
    fi
else
    echo -e "  ${RED}❌ Docker not found${NC}"
fi

echo -e "\n${YELLOW}📦 Running Containers:${NC}"
if docker-compose --profile development ps &> /dev/null; then
    docker-compose --profile development ps --format "table {{.Name}}\t{{.State}}\t{{.Ports}}"
else
    echo -e "  ${RED}❌ No containers running or docker-compose failed${NC}"
fi

echo -e "\n${YELLOW}🔍 Service Health Checks:${NC}"

# PostgreSQL
echo -n "  🗄️  PostgreSQL: "
if docker-compose exec -T postgres pg_isready -U postgres &> /dev/null; then
    echo -e "${GREEN}✅ Ready${NC}"
    # Show DB info
    DB_INFO=$(docker-compose exec -T postgres psql -U postgres -d seeu_cafe -c "SELECT version();" 2>/dev/null | grep PostgreSQL || echo "Connection failed")
    echo -e "      Version: ${DB_INFO}"
else
    echo -e "${RED}❌ Not ready${NC}"
fi

# Redis
echo -n "  📊 Redis: "
if docker-compose exec -T redis redis-cli ping &> /dev/null; then
    echo -e "${GREEN}✅ Ready${NC}"
    # Show Redis info
    REDIS_INFO=$(docker-compose exec -T redis redis-cli info server | grep redis_version | cut -d: -f2 | tr -d '\r' || echo "Unknown")
    echo -e "      Version: ${REDIS_INFO}"
else
    echo -e "${RED}❌ Not ready${NC}"
fi

# API
echo -n "  📱 API: "
API_PORT=${API_PORT:-3000}
if curl -f -s http://localhost:${API_PORT}/api &> /dev/null; then
    echo -e "${GREEN}✅ Ready${NC}"
    # Try to get API info
    API_RESPONSE=$(curl -s http://localhost:${API_PORT}/api 2>/dev/null || echo "No response")
    echo -e "      Response: ${API_RESPONSE}"
else
    echo -e "${RED}❌ Not ready${NC}"
fi

# PGAdmin
echo -n "  🔧 PGAdmin: "
PGADMIN_PORT=${PGADMIN_PORT:-5050}
if curl -f -s http://localhost:${PGADMIN_PORT} &> /dev/null; then
    echo -e "${GREEN}✅ Ready${NC}"
else
    echo -e "${RED}❌ Not ready${NC}"
fi

# n8n
echo -n "  🤖 n8n: "
N8N_PORT=${N8N_PORT:-5678}
if curl -f -s http://localhost:${N8N_PORT} &> /dev/null; then
    echo -e "${GREEN}✅ Ready${NC}"
else
    echo -e "${RED}❌ Not ready${NC}"
fi

echo -e "\n${YELLOW}🌐 Service URLs:${NC}"
echo -e "  📱 API: http://localhost:${API_PORT:-3000}"
echo -e "  🗄️  PGAdmin: http://localhost:${PGADMIN_PORT:-5050}"
echo -e "      Email: ${PGADMIN_EMAIL:-admin@example.com}"
echo -e "      Password: ${PGADMIN_PASSWORD:-admin123}"
echo -e "  🤖 n8n: http://localhost:${N8N_PORT:-5678}"
echo -e "      User: ${N8N_AUTH_USER:-admin}"
echo -e "      Password: ${N8N_AUTH_PASSWORD:-password123}"

echo -e "\n${YELLOW}⚙️  Environment Variables:${NC}"
if docker-compose exec -T api env &> /dev/null; then
    echo -e "  Key Environment Variables:"
    docker-compose exec -T api env | grep -E "(NODE_ENV|DATABASE_URL|REDIS_HOST|N8N_|CLOUDINARY_|EMAIL_)" | head -15 | sed 's/^/    /' | while read line; do
        # Hide sensitive values
        if echo "$line" | grep -qE "(PASSWORD|SECRET|KEY)"; then
            echo "$line" | sed 's/=.*/=***hidden***/'
        else
            echo "$line"
        fi
    done
else
    echo -e "  ${RED}❌ Cannot access API container environment${NC}"
fi

echo -e "\n${YELLOW}💾 Volumes:${NC}"
echo -e "  Docker Volumes:"
docker volume ls | grep -E "(postgres|redis|n8n|uploads)" | sed 's/^/    /' || echo "    No volumes found"

echo -e "\n${YELLOW}🌐 Networks:${NC}"
echo -e "  Docker Networks:"
docker network ls | grep -E "(app-network|seeu)" | sed 's/^/    /' || echo "    No custom networks found"

echo -e "\n${YELLOW}📊 Recent Logs (Last 10 lines):${NC}"

echo -e "\n  ${CYAN}📱 API Logs:${NC}"
if docker-compose logs --tail=5 api 2>/dev/null; then
    echo ""
else
    echo -e "    ${RED}❌ Cannot access API logs${NC}"
fi

echo -e "\n  ${CYAN}🤖 n8n Logs:${NC}"
if docker-compose logs --tail=5 n8n 2>/dev/null; then
    echo ""
else
    echo -e "    ${RED}❌ Cannot access n8n logs${NC}"
fi

echo -e "\n${YELLOW}🔧 Troubleshooting Tips:${NC}"
echo -e "  • If services are not ready, wait a few more seconds and try again"
echo -e "  • Use 'make logs' to see detailed API logs"
echo -e "  • Use 'make n8n-logs' to see n8n-specific logs"
echo -e "  • Use 'make clean && make dev' for a fresh start"
echo -e "  • Check .env.development file for correct configuration"

echo -e "\n${YELLOW}📋 Quick Commands:${NC}"
echo -e "  make logs      - View API logs"
echo -e "  make n8n-logs  - View n8n logs"
echo -e "  make shell     - Access API container"
echo -e "  make n8n-shell - Access n8n container"
echo -e "  make db        - Access database"
echo -e "  make clean     - Clean up and restart"

echo -e "\n${GREEN}✅ Debug information complete!${NC}"