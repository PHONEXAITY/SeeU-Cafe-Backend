# ========================================
# Universal Dockerfile for Development & Production (Fixed)
# ========================================

# Base image
FROM node:20-alpine AS base
WORKDIR /app

# Install system dependencies including Python for bcrypt
RUN apk add --no-cache \
    dumb-init \
    netcat-openbsd \
    curl \
    bash \
    postgresql-client \
    redis \
    python3 \
    make \
    g++ \
    && rm -rf /var/cache/apk/*

# ========================================
# Dependencies Stage
# ========================================
FROM base AS dependencies

# Copy package files
COPY package*.json ./
COPY prisma ./prisma

# 🔥 FIX: Install dependencies with proper compilation for Alpine
ENV NODE_ENV=development
RUN npm install && npm cache clean --force

# Generate Prisma client
RUN npx prisma generate

# ========================================
# Development Stage
# ========================================
FROM dependencies AS development

# Copy source code
COPY . .

# Create directories
RUN mkdir -p uploads templates scripts

# Set environment
ENV NODE_ENV=development

# Set non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001 -G nodejs && \
    chown -R nestjs:nodejs /app

USER nestjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/api || exit 1

# Development command
CMD ["npm", "run", "start:dev"]

# ========================================
# Build Stage
# ========================================
FROM dependencies AS build

# Copy source code
COPY . .

# Set environment for build
ENV NODE_ENV=production

# Build application
RUN npm run build

# ========================================
# Production Stage
# ========================================
FROM base AS production

# Set environment
ENV NODE_ENV=production

# Copy package files
COPY package*.json ./
COPY prisma ./prisma

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Generate Prisma client for production
RUN npx prisma generate

# Copy built application from build stage
COPY --from=build /app/dist ./dist
COPY --from=build /app/templates ./templates

# Create necessary directories
RUN mkdir -p uploads

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001 -G nodejs && \
    chown -R nestjs:nodejs /app

USER nestjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/api || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Production command
CMD ["node", "dist/main.js"]