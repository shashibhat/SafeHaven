FROM node:18-alpine AS builder

WORKDIR /app

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++ cmake

# Copy package files
COPY package*.json ./
COPY workers/inference/package*.json ./workers/inference/
COPY packages/shared/package*.json ./packages/shared/

# Install dependencies
RUN npm ci && npm cache clean --force

# Copy source code
COPY . .

# Build the shared package
RUN cd packages/shared && npm run build

# Build the inference worker
RUN cd workers/inference && npm run build

# Production stage
FROM node:18-alpine AS production

# Install runtime dependencies
RUN apk add --no-cache dumb-init

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S inference -u 1001

# Copy built application
COPY --from=builder --chown=inference:nodejs /app/workers/inference/dist ./dist
COPY --from=builder --chown=inference:nodejs /app/workers/inference/package*.json ./
COPY --from=builder --chown=inference:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=inference:nodejs /app/packages/shared/dist ./packages/shared/dist

# Create directories for models and data
RUN mkdir -p /app/models /app/models/custom /app/data && \
    chown -R inference:nodejs /app

USER inference

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8081/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# Start the application
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]