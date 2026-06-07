# Multi-stage build for Moha Weaves monolithic application
FROM node:20-alpine AS base

# ── deps stage: install dependencies ──────────────────────────────────────────
FROM base AS deps
# libc6-compat needed by some native modules on Alpine
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Use npm ci for reproducible, locked installs
COPY package.json package-lock.json* ./
RUN npm ci --legacy-peer-deps

# ── builder stage: compile the application ────────────────────────────────────
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build the application (both frontend and backend)
RUN npm run build

# Verify build output exists
RUN ls -la /app/dist/

# ── runner stage: lean production image ───────────────────────────────────────
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs

# Copy built artifacts and locked node_modules from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Create uploads directory with correct ownership
RUN mkdir -p /app/uploads && chown -R nodejs:nodejs /app/uploads

USER nodejs

EXPOSE 5000

ENV PORT=5000
ENV HOSTNAME="0.0.0.0"

CMD ["npm", "start"]
