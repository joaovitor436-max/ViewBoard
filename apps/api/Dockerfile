FROM node:20-alpine AS base
RUN corepack enable pnpm

# ── Stage 1: Install ALL deps (dev + prod) ──────────────────────────────
FROM base AS deps
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
COPY packages/config-typescript/package.json packages/config-typescript/
RUN pnpm install --frozen-lockfile --prod=false

# ── Stage 2: Build TypeScript ────────────────────────────────────────────
FROM base AS build
WORKDIR /app
COPY --from=deps /app ./
COPY . .
RUN pnpm --filter @viewboard/shared build 2>/dev/null || true
RUN cd apps/api && npx prisma generate
RUN pnpm --filter @viewboard/api build

# ── Stage 3: Production runtime ──────────────────────────────────────────
FROM base AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Copy monorepo structure needed for pnpm
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
COPY packages/config-typescript/package.json packages/config-typescript/

# Install production deps only
RUN pnpm install --frozen-lockfile --prod

# Copy compiled code and prisma
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma

# Generate Prisma client in production node_modules
RUN cd apps/api && npx prisma generate

WORKDIR /app/apps/api
EXPOSE 3001
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
