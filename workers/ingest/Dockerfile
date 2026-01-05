FROM node:18-alpine AS builder

WORKDIR /app

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++ ffmpeg ffmpeg-dev

# Copy package files
COPY package*.json ./
COPY workers/ingest/package*.json ./workers/ingest/
COPY packages/shared/package*.json ./packages/shared/

# Install dependencies
RUN npm ci && npm cache clean --force

# Copy source code
COPY . .

# Build the shared package
RUN cd packages/shared && npm run build

# Build the ingest worker
RUN cd workers/ingest && npm run build

# Production stage
FROM node:18-alpine AS production

# Install runtime dependencies
RUN apk add --no-cache ffmpeg dumb-init

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S ingest -u 1001

# Copy built application
COPY --from=builder --chown=ingest:nodejs /app/workers/ingest/dist ./dist
COPY --from=builder --chown=ingest:nodejs /app/workers/ingest/package*.json ./
COPY --from=builder --chown=ingest:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=ingest:nodejs /app/packages/shared/dist ./packages/shared/dist

# Create directories for frames and data
RUN mkdir -p /app/frames /app/data && \
    chown -R ingest:nodejs /app

USER ingest

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# Start the application
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]