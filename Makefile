# ========================================
# Makefile for SeeU Cafe (Complete with n8n)
# ========================================

.PHONY: help dev prod deploy clean logs debug shell db redis migrate seed reset n8n-logs n8n-shell stop

# Default target
help:
	@echo "🍵 SeeU Cafe Docker Commands"
	@echo "=============================="
	@echo "dev        - Start development environment (includes n8n)"
	@echo "prod       - Start production environment" 
	@echo "deploy     - Deploy to production server"
	@echo "stop       - Stop all services"
	@echo "clean      - Clean up Docker resources"
	@echo "logs       - View API logs"
	@echo "debug      - Debug environment"
	@echo "shell      - Access API container shell"
	@echo "db         - Access database shell"
	@echo "redis      - Access Redis CLI"
	@echo "migrate    - Run database migrations"
	@echo "seed       - Seed database with sample data"
	@echo "reset      - Reset database (WARNING: deletes all data)"
	@echo "n8n-logs   - View n8n logs"
	@echo "n8n-shell  - Access n8n container shell"

# Development (รวม n8n แล้ว)
dev:
	@echo "🚀 Starting development environment with n8n..."
	@chmod +x scripts/dev.sh && ./scripts/dev.sh --logs

# Production
prod:
	@echo "🚀 Starting production environment..."
	@chmod +x scripts/prod.sh && ./scripts/prod.sh

# Deploy
deploy:
	@echo "🚀 Deploying to production..."
	@chmod +x scripts/deploy.sh && ./scripts/deploy.sh

# Stop services
stop:
	@echo "⏹️  Stopping all services..."
	@docker-compose --profile development down

# Clean up
clean:
	@echo "🧹 Cleaning up..."
	@chmod +x scripts/cleanup.sh && ./scripts/cleanup.sh

# View logs
logs:
	@echo "📋 Viewing API logs..."
	@docker-compose logs -f api

# n8n logs
n8n-logs:
	@echo "📋 Viewing n8n logs..."
	@docker-compose logs -f n8n

# Debug
debug:
	@echo "🔍 Running debug..."
	@chmod +x scripts/debug.sh && ./scripts/debug.sh

# Access shells
shell:
	@echo "🐚 Accessing API container..."
	@docker-compose exec api sh

# n8n shell
n8n-shell:
	@echo "🐚 Accessing n8n container..."
	@docker-compose exec n8n sh

db:
	@echo "🗄️  Accessing database..."
	@docker-compose exec postgres psql -U postgres -d seeu_cafe

redis:
	@echo "📊 Accessing Redis..."
	@docker-compose exec redis redis-cli

# Database operations
migrate:
	@echo "🔄 Running migrations..."
	@docker-compose exec api npx prisma migrate deploy

seed:
	@echo "🌱 Seeding database..."
	@docker-compose exec api npm run seed

reset:
	@echo "🔄 Resetting database..."
	@docker-compose exec api npx prisma migrate reset --force