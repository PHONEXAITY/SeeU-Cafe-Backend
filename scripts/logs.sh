#!/bin/bash
# logs.sh

SERVICE=${1:-api}
TAIL=${2:-100}

echo -e "${BLUE}📋 Viewing logs for $SERVICE (last $TAIL lines)...${NC}"

docker-compose -f docker-compose.universal.yml logs -f --tail=$TAIL $SERVICE