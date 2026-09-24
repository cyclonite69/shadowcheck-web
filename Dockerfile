# Unified multi-stage build for both API and Frontend services
# Targets: `api` (Node.js runtime), `frontend` (nginx runtime), `frontend-e2e` (nginx + e2e test seams)
# Usage: docker build --target api .
#        docker build --target frontend .
#        docker compose -f docker-compose.yml -f docker-compose.e2e.yml build frontend   (e2e target)

# ============================================================================
# Stage 1: shared-builder
# ============================================================================
# Runs once, produces both /app/dist (frontend) and /app/dist/server (backend)
FROM node:26.8.1-alpine AS shared-builder

WORKDIR /app

ENV HUSKY=0 \
    NODE_ENV=development \
    NPM_CONFIG_PRODUCTION=false \
    NPM_CONFIG_OMIT=

# Install build tools required for native modules and system utilities
RUN apk add --no-cache python3 make g++ docker-cli docker-cli-compose aws-cli postgresql-client curl exiftool

# Copy only package files first (better layer caching)
COPY package*.json tsconfig*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci --include=dev --legacy-peer-deps

# Copy entire codebase
COPY . .

# Build both frontend (Vite) and server (TypeScript) — ONCE
RUN npm run build

# Prune devDependencies for production (removes ~100MB) in a separate layer
RUN npm ci --omit=dev --legacy-peer-deps

# ============================================================================
# Stage 2: api (Node.js production runtime)
# ============================================================================
FROM node:26.8.1-alpine AS api

# Install runtime utilities only (no build tools)
RUN apk add --no-cache dumb-init postgresql-client aws-cli docker-cli docker-cli-compose su-exec curl exiftool

# Install gcompat for glibc compatibility (required for SSM plugin)
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
    adduser -S nodejs -u 1001 -h /home/nodejs && \
    mkdir -p /home/nodejs/.aws && \
    chown -R nodejs:nodejs /home/nodejs

WORKDIR /app

# Copy pruned node_modules and built artifacts from shared-builder
COPY --from=shared-builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=shared-builder --chown=nodejs:nodejs /app/package*.json ./
COPY --from=shared-builder --chown=nodejs:nodejs /app/dist ./dist/

# Copy application source (server, scripts, sql, etc.)
COPY --chown=nodejs:nodejs server ./server/
COPY --chown=nodejs:nodejs scripts ./scripts/
COPY --chown=nodejs:nodejs scripts/manual-ingest.js ./scripts/manual-ingest.js
COPY --chown=nodejs:nodejs sql ./sql/
COPY --chown=nodejs:nodejs docker/infrastructure ./docker/infrastructure/
COPY --chown=root:root docker/entrypoint.sh /entrypoint.sh

# Create directories for data and logs
RUN mkdir -p data/logs data/csv && \
    chown -R nodejs:nodejs /app && \
    chmod +x /entrypoint.sh

ENV NODE_ENV=production \
    HOME=/home/nodejs

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3001/health >/dev/null || exit 1

ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "dist/server/server/server.js"]

# ============================================================================
# Stage 3: frontend (nginx runtime)
# ============================================================================
FROM nginx:1.31.5-alpine AS frontend

# Copy frontend build from shared-builder (not from api stage)
COPY --from=shared-builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY docker/nginx.local.conf /etc/nginx/conf.d/default.conf

# Simple health check endpoint
RUN echo "OK" > /usr/share/nginx/html/health

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost/health >/dev/null 2>&1 || exit 1

CMD ["nginx", "-g", "daemon off;"]

# ============================================================================
# Stage 4: frontend-e2e-builder
# ============================================================================
# Builds the frontend with VITE_E2E=true (loaded from client/.env.e2e via
# --mode e2e). Kept separate so the production `shared-builder` stage is
# never tainted with test seams.
FROM node:26.8.1-alpine AS frontend-e2e-builder

WORKDIR /app

ENV HUSKY=0 \
    NODE_ENV=development \
    NPM_CONFIG_PRODUCTION=false \
    NPM_CONFIG_OMIT=

RUN apk add --no-cache python3 make g++

# Copy only package files first (better layer caching)
COPY package*.json tsconfig*.json ./

RUN npm ci --include=dev --legacy-peer-deps

# Copy entire codebase (build:e2e script lives at root, source in client/)
COPY . .

# Build frontend in e2e mode — outputs to /app/dist (same path as shared-builder)
RUN npm run build:e2e

# ============================================================================
# Stage 5: frontend-e2e (nginx runtime with e2e test seams)
# ============================================================================
FROM nginx:1.31.5-alpine AS frontend-e2e

COPY --from=frontend-e2e-builder /app/dist /usr/share/nginx/html
COPY docker/nginx.local.conf /etc/nginx/conf.d/default.conf

RUN echo "OK" > /usr/share/nginx/html/health

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost/health >/dev/null 2>&1 || exit 1

CMD ["nginx", "-g", "daemon off;"]
