FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY workers/rules-engine/package*.json ./workers/rules-engine/
COPY packages/shared/package*.json ./packages/shared/

# Install dependencies
RUN npm ci && npm cache clean --force

# Copy source code
COPY . .

# Build the shared package
RUN cd packages/shared && npm run build

# Build the rules engine worker
RUN cd workers/rules-engine && npm run build

# Production stage
FROM node:18-alpine AS production

# Install runtime dependencies
RUN apk add --no-cache dumb-init

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S rules-engine -u 1001

# Copy built application
COPY --from=builder --chown=rules-engine:nodejs /app/workers/rules-engine/dist ./dist
COPY --from=builder --chown=rules-engine:nodejs /app/workers/rules-engine/package*.json ./
COPY --from=builder --chown=rules-engine:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=rules-engine:nodejs /app/packages/shared/dist ./packages/shared/dist

# Create directories for data
RUN mkdir -p /app/data && \
    chown -R rules-engine:nodejs /app

USER rules-engine

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8082/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# Start the application
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]