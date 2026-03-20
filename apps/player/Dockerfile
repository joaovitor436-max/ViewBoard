FROM node:20-alpine AS base
RUN corepack enable pnpm

FROM base AS deps
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY apps/player/package.json apps/player/
COPY packages/shared/package.json packages/shared/
COPY packages/config-typescript/package.json packages/config-typescript/
RUN pnpm install --frozen-lockfile --prod=false

FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/player/node_modules ./apps/player/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY . .
ARG VITE_API_URL
ARG VITE_WS_URL
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL
RUN pnpm --filter @viewboard/shared build 2>/dev/null || true
RUN pnpm --filter @viewboard/player build

FROM nginx:alpine AS runtime
COPY --from=build /app/apps/player/dist /usr/share/nginx/html
COPY apps/player/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
