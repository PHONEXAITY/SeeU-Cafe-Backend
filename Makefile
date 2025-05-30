# ========================================
# Makefile for SeeU Cafe
# ========================================

.PHONY: help dev prod deploy clean logs debug shell db redis migrate seed reset

# Default target
help:
	@echo "🍵 SeeU Cafe Docker Commands"
	@echo "=============================="
	@echo "dev      - Start development environment"
	@echo "prod     - Start production environment" 
	@echo "deploy   - Deploy to production server"
	@echo "stop     - Stop all services"
	@echo "clean    - Clean up Docker resources"
	@echo "logs     - View API logs"
	@echo "debug    - Debug environment"
	@echo "shell    - Access API container shell"
	@echo "db       - Access database shell"
	@echo "redis    - Access Redis CLI"
	@echo "migrate  - Run database migrations"
	@echo "seed     - Seed database with sample data"
	@echo "reset    - Reset database (WARNING: deletes all data)"

# Development
dev:
	@echo "🚀 Starting development environment..."
	@chmod +x scripts/dev.sh && ./scripts/dev.sh

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
	@docker-compose down

# Clean up
clean:
	@echo "🧹 Cleaning up..."
	@chmod +x scripts/cleanup.sh && ./scripts/cleanup.sh

# View logs
logs:
	@echo "📋 Viewing API logs..."
	@docker-compose logs -f api

# Debug
debug:
	@echo "🔍 Running debug..."
	@chmod +x scripts/debug.sh && ./scripts/debug.sh

# Access shells
shell:
	@echo "🐚 Accessing API container..."
	@docker-compose exec api sh

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