FROM node:20-alpine
RUN apk add --no-cache openssl
RUN corepack enable pnpm

WORKDIR /app

# Copy dependency manifests
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
COPY packages/config-typescript/package.json packages/config-typescript/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/ packages/
COPY apps/api/ apps/api/

# Build shared package and API
RUN pnpm --filter @viewboard/shared build 2>/dev/null || true
RUN cd apps/api && npx prisma generate
RUN pnpm --filter @viewboard/api build

# Set production environment
ENV NODE_ENV=production

WORKDIR /app/apps/api

# Make entrypoint executable
COPY apps/api/entrypoint.sh /app/apps/api/entrypoint.sh
RUN chmod +x /app/apps/api/entrypoint.sh

EXPOSE 3001
CMD ["/app/apps/api/entrypoint.sh"]
