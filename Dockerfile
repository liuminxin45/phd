# Unified Dockerfile for Phabricator Dashboard
# Single service containing both frontend and API routes
FROM node:20-alpine AS builder

# Install dependencies
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install yarn
RUN corepack enable && corepack prepare yarn@stable --activate

# Copy package files
COPY frontend/package.json frontend/package-lock.json* ./
RUN yarn config set nodeLinker node-modules
RUN yarn install --frozen-lockfile || yarn install

# Copy source code
COPY frontend/ ./

# Build Next.js application
RUN yarn build

# Production image
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 9641

ENV PORT=9641
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
