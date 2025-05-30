FROM node:20.19.2-alpine AS development

WORKDIR /app

# Copy package files
COPY package*.json ./

# Copy prisma schema first
COPY prisma ./prisma

# Install all dependencies (including devDependencies for building)
RUN npm install

# Copy all source files
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the application
RUN npm run build

# Verify build output exists
RUN ls -la dist/


FROM node:20.19.2-alpine AS production

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

# Add security updates
RUN apk update && apk upgrade

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

WORKDIR /app

# Copy package files
COPY package*.json ./

# Copy prisma schema
COPY prisma ./prisma

# Install only production dependencies
RUN npm install --only=production && npm cache clean --force

# Generate Prisma client for production
RUN npx prisma generate

# Copy build output from development stage
COPY --from=development /app/dist ./dist/

# Create necessary directories and set permissions
RUN mkdir -p uploads templates && \
    chown -R nestjs:nodejs /app

# Verify that main.js exists
RUN ls -la dist/ && test -f dist/main.js

# Switch to non-root user
USER nestjs

EXPOSE 3000

CMD ["node", "dist/main.js"]