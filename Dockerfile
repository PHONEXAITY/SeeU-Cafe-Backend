FROM node:20-alpine AS development

WORKDIR /app

# Copy package files
COPY package*.json ./

# Copy prisma schema first
COPY prisma ./prisma

# Install all dependencies (including devDependencies for building)
RUN npm ci

# Copy all source files
COPY . .

# Generate Prisma client before build
RUN npx prisma generate

# Build the application
RUN npm run build

# Debug: List what's in dist directory
RUN echo "Contents of dist directory:" && ls -la dist/ && echo "Checking main.js exists:" && test -f dist/main.js && echo "main.js found!"


FROM node:20-alpine AS production

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

WORKDIR /app

# Copy package files
COPY package*.json ./

# Copy prisma schema
COPY prisma ./prisma

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Generate Prisma client for production
RUN npx prisma generate

# Copy build output from development stage
COPY --from=development /app/dist/ ./dist/

# Debug: Verify files copied correctly
RUN echo "Production stage - Contents of dist directory:" && ls -la dist/ && echo "Checking main.js exists:" && test -f dist/main.js && echo "main.js found in production!"

# Create uploads directory if it doesn't exist
RUN mkdir -p uploads templates

EXPOSE 3000

# Alternative CMD options - try one at a time
CMD ["node", "dist/main.js"]
# CMD ["node", "./dist/main.js"] 
# CMD ["node", "/app/dist/main.js"]