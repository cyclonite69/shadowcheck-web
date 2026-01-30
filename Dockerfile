# Multi-stage build for optimized production image
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Prevent Husky from running during install in container builds
ENV HUSKY=0

# Copy package files
COPY package*.json ./

# Install dependencies (including devDependencies for build)
RUN npm ci

# Copy application files
COPY . .

# Build frontend
RUN npm run build

# Remove development dependencies
RUN npm prune --production

###########################################
# Production image
###########################################
FROM node:20-alpine

# Install dumb-init for proper signal handling and pg_dump for backups
RUN apk add --no-cache dumb-init postgresql-client

# Create app user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy package files and installed dependencies from builder
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist/

# Copy application code
COPY --chown=nodejs:nodejs server ./server/
COPY --chown=nodejs:nodejs scripts ./scripts/
COPY --chown=nodejs:nodejs sql ./sql/

# Create directories for data and logs with proper ownership
RUN mkdir -p data/logs data/csv && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Set production environment
ENV NODE_ENV=production

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["node", "server/server.js"]
