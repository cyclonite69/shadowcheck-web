# Multi-stage build for optimized production image
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Prevent Husky from running during install in container builds
ENV HUSKY=0

# Ensure devDependencies are available for the build step
ENV NODE_ENV=development \
    NPM_CONFIG_PRODUCTION=false \
    NPM_CONFIG_OMIT=

# Copy package files
COPY package*.json ./

# Install dependencies (including devDependencies for build)
RUN npm ci --include=dev

# Copy application files
COPY . .

# Build frontend and server
RUN npm run build

# Remove development dependencies
RUN npm prune --omit=dev

###########################################
# Production image
###########################################
FROM node:20-alpine

# Install dumb-init for proper signal handling, pg_dump for backups, AWS CLI for S3, and Docker CLI for PgAdmin management
RUN apk add --no-cache dumb-init postgresql-client aws-cli docker-cli docker-cli-compose su-exec curl

# Install dependencies: gcompat provides the glibc compatibility layer needed for the binary
RUN apk add --no-cache curl rpm gcompat

# Install AWS SSM Session Manager Plugin
RUN ARCH=$(uname -m) && \
    if [ "$ARCH" = "x86_64" ]; then \
        SSM_URL="https://s3.amazonaws.com/session-manager-downloads/plugin/latest/linux_64bit/session-manager-plugin.rpm"; \
    elif [ "$ARCH" = "aarch64" ]; then \
        SSM_URL="https://s3.amazonaws.com/session-manager-downloads/plugin/latest/linux_arm64/session-manager-plugin.rpm"; \
    else \
        echo "Unsupported architecture: $ARCH"; exit 1; \
    fi && \
    curl -sL "$SSM_URL" -o /tmp/ssm.rpm && \
    cd /tmp && rpm2cpio ssm.rpm | cpio -idmv && \
    mkdir -p /usr/local/sessionmanagerplugin && \
    mv /tmp/usr/local/sessionmanagerplugin/* /usr/local/sessionmanagerplugin/ && \
    ln -s /usr/local/sessionmanagerplugin/bin/session-manager-plugin /usr/local/bin/session-manager-plugin && \
    chmod +x /usr/local/sessionmanagerplugin/bin/session-manager-plugin && \
    rm -rf /tmp/* && \
    apk del rpm

# Create app user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy package files and installed dependencies from builder
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist/

# Copy application code and built frontend
COPY --chown=nodejs:nodejs server ./server/
COPY --chown=nodejs:nodejs scripts ./scripts/
COPY --chown=nodejs:nodejs sql ./sql/
COPY --chown=nodejs:nodejs docker/infrastructure ./docker/infrastructure/
COPY --chown=root:root docker/entrypoint.sh /entrypoint.sh

# Create directories for data and logs with proper ownership
RUN mkdir -p data/logs data/csv && \
    chown -R nodejs:nodejs /app && \
    chmod +x /entrypoint.sh

# Don't switch to nodejs user yet - entrypoint needs to run as root first
# USER nodejs will be handled by entrypoint via su-exec after setting up Docker socket permissions

# Set production environment
ENV NODE_ENV=production

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Use entrypoint to handle Docker socket permissions, then dumb-init for signals
ENTRYPOINT ["/entrypoint.sh"]

# Start application with compiled server
CMD ["node", "dist/server/server/server.js"]
