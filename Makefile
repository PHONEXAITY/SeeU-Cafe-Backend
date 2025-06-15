# ========================================
# Makefile for SeeU Cafe (Fixed Data Persistence)
# ========================================

.PHONY: help dev dev-fresh dev-skip-seed prod deploy clean logs debug shell db redis migrate seed reset n8n-logs n8n-shell stop status volumes

# Default target
help:
	@echo "🍵 SeeU Cafe Docker Commands"
	@echo "=============================="
	@echo "dev            - Start development environment (preserves data)"
	@echo "dev-fresh      - Start with fresh database (⚠️ DELETES ALL DATA)"
	@echo "dev-skip-seed  - Start development without seeding"
	@echo "prod           - Start production environment" 
	@echo "deploy         - Deploy to production server"
	@echo "stop           - Stop all services (preserves data)"
	@echo "clean          - Clean up Docker resources (⚠️ DELETES DATA)"
	@echo "status         - Show service status"
	@echo "volumes        - Show volume information"
	@echo "logs           - View API logs"
	@echo "debug          - Debug environment"
	@echo "shell          - Access API container shell"
	@echo "db             - Access database shell"
	@echo "redis          - Access Redis CLI"
	@echo "migrate        - Run database migrations"
	@echo "seed           - Seed database with sample data"
	@echo "reset          - Reset database (⚠️ DELETES ALL DATA)"
	@echo "n8n-logs       - View n8n logs"
	@echo "n8n-shell      - Access n8n container shell"
	@echo ""
	@echo "🔍 Data Persistence:"
	@echo "• Database data is preserved between 'make dev' runs"
	@echo "• Use 'dev-fresh' only when you want to reset everything"
	@echo "• Use 'stop' to stop services without losing data"
	@echo "• Use 'clean' to remove everything including data"

# Development (preserves data by default)
dev:
	@echo "🚀 Starting development environment (preserving data)..."
	@chmod +x scripts/dev.sh && ./scripts/dev.sh --logs

# Development with fresh start (deletes all data)
dev-fresh:
	@echo "⚠️  Starting development environment with fresh database..."
	@chmod +x scripts/dev.sh && ./scripts/dev.sh --fresh --logs

# Development without seeding
dev-skip-seed:
	@echo "🚀 Starting development environment (no seeding)..."
	@chmod +x scripts/dev.sh && ./scripts/dev.sh --skip-seed --logs

# Development with rebuild
dev-rebuild:
	@echo "🔨 Starting development environment (rebuilding images)..."
	@chmod +x scripts/dev.sh && ./scripts/dev.sh --rebuild --logs

# Production
prod:
	@echo "🚀 Starting production environment..."
	@chmod +x scripts/prod.sh && ./scripts/prod.sh

# Deploy
deploy:
	@echo "🚀 Deploying to production..."
	@chmod +x scripts/deploy.sh && ./scripts/deploy.sh

# Stop services (preserves data)
stop:
	@echo "⏹️  Stopping all services (data preserved)..."
	@docker-compose --profile development down

# Show service status
status:
	@echo "📊 Service Status:"
	@docker-compose --profile development ps --format "table {{.Name}}\t{{.State}}\t{{.Ports}}"

# Show volume information
volumes:
	@echo "💾 Docker Volumes:"
	@docker volume ls | grep -E "(postgres|redis|n8n|uploads|pgadmin)" || echo "No project volumes found"
	@echo ""
	@echo "📊 Volume Details:"
	@docker system df -v | grep -A 20 "Local Volumes:" || echo "Cannot get volume details"

# Clean up (DELETES ALL DATA)
clean:
	@echo "🧹 Cleaning up (THIS WILL DELETE ALL DATA)..."
	@read -p "Are you sure? This will delete ALL database data! (y/N): " confirm && \
	if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then \
		chmod +x scripts/cleanup.sh && ./scripts/cleanup.sh; \
	else \
		echo "Cancelled by user"; \
	fi

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
	@echo "🔄 Resetting database (THIS WILL DELETE ALL DATA)..."
	@read -p "Are you sure? This will delete ALL database data! (y/N): " confirm && \
	if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then \
		docker-compose exec api npx prisma migrate reset --force; \
	else \
		echo "Cancelled by user"; \
	fi

# Quick development commands
quick-start:
	@echo "⚡ Quick start (background mode)..."
	@docker-compose --profile development up -d

quick-stop:
	@echo "⚡ Quick stop..."
	@docker-compose --profile development down

# Health checks
health:
	@echo "🏥 Health Check:"
	@echo "API:" && curl -f http://localhost:3000/api &> /dev/null && echo "✅ OK" || echo "❌ FAIL"
	@echo "PGAdmin:" && curl -f http://localhost:5050 &> /dev/null && echo "✅ OK" || echo "❌ FAIL"
	@echo "n8n:" && curl -f http://localhost:5678 &> /dev/null && echo "✅ OK" || echo "❌ FAIL"