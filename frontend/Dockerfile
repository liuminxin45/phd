# Multi-stage build for Next.js frontend
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install yarn
RUN corepack enable && corepack prepare yarn@stable --activate

# Install dependencies
COPY package.json package-lock.json* ./
RUN yarn config set nodeLinker node-modules
RUN yarn install --frozen-lockfile || yarn install

# Copy source and build
COPY . .
RUN yarn build

# Production image, copy all the files and run next
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built assets
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 9641

ENV PORT=9641
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
