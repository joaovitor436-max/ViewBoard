# Deploy em Produção — ViewBoard

Guia completo para deploy da plataforma ViewBoard em produção.

## Requisitos de Infraestrutura

| Serviço | Mínimo | Recomendado |
|---------|--------|-------------|
| **API Server** | 1 vCPU, 1GB RAM | 2 vCPU, 4GB RAM |
| **PostgreSQL** | 1 vCPU, 1GB RAM | 2 vCPU, 4GB RAM, SSD |
| **Redis** | 512MB RAM | 1GB RAM |
| **MinIO / S3** | 10GB storage | 100GB+ storage |

## Opção 1: Deploy com Docker Compose (Recomendado)

### 1. Criar ficheiro `docker-compose.prod.yml`

```yaml
version: "3.9"

services:
  postgres:
    image: postgres:16-alpine
    restart: always
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    restart: always
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  minio:
    image: minio/minio:latest
    restart: always
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ACCESS_KEY}
      MINIO_ROOT_PASSWORD: ${MINIO_SECRET_KEY}
    volumes:
      - minio_data:/data

  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    restart: always
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      minio:
        condition: service_started
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379
      MINIO_ENDPOINT: minio
      MINIO_PORT: 9000
      MINIO_USE_SSL: "false"
      MINIO_ACCESS_KEY: ${MINIO_ACCESS_KEY}
      MINIO_SECRET_KEY: ${MINIO_SECRET_KEY}
      MINIO_BUCKET: viewboard
      JWT_SECRET: ${JWT_SECRET}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET}
      JWT_ACCESS_EXPIRES_IN: "15m"
      JWT_REFRESH_EXPIRES_IN: "7d"
      PORT: 3001
      NODE_ENV: production
      LOG_LEVEL: info
      CORS_ORIGIN: ${CORS_ORIGIN}
    ports:
      - "3001:3001"

  dashboard:
    build:
      context: .
      dockerfile: apps/dashboard/Dockerfile
      args:
        NEXT_PUBLIC_API_URL: ${PUBLIC_API_URL}
        NEXT_PUBLIC_WS_URL: ${PUBLIC_WS_URL}
    restart: always
    ports:
      - "3000:3000"

  player:
    build:
      context: .
      dockerfile: apps/player/Dockerfile
      args:
        VITE_API_URL: ${PUBLIC_API_URL}
        VITE_WS_URL: ${PUBLIC_WS_URL}
    restart: always
    ports:
      - "3002:80"

volumes:
  postgres_data:
  redis_data:
  minio_data:
```

### 2. Criar `.env.prod`

```env
# Database
POSTGRES_USER=viewboard
POSTGRES_PASSWORD=<GERAR_PASSWORD_FORTE>
POSTGRES_DB=viewboard

# Redis
REDIS_PASSWORD=<GERAR_PASSWORD_FORTE>

# MinIO
MINIO_ACCESS_KEY=<GERAR_ACCESS_KEY>
MINIO_SECRET_KEY=<GERAR_SECRET_KEY>

# JWT (use: openssl rand -hex 32)
JWT_SECRET=<GERAR_SECRET_64_CHARS>
JWT_REFRESH_SECRET=<GERAR_SECRET_64_CHARS>

# URLs públicas
PUBLIC_API_URL=https://api.viewboard.exemplo.com
PUBLIC_WS_URL=wss://api.viewboard.exemplo.com
CORS_ORIGIN=https://app.viewboard.exemplo.com,https://player.viewboard.exemplo.com
```

### 3. Criar Dockerfiles

**`apps/api/Dockerfile`**

```dockerfile
FROM node:20-alpine AS base
RUN corepack enable pnpm

FROM base AS deps
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
COPY packages/config-typescript/package.json packages/config-typescript/
RUN pnpm install --frozen-lockfile --prod=false

FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm --filter @viewboard/shared build
RUN pnpm --filter @viewboard/api db:generate
RUN pnpm --filter @viewboard/api build

FROM base AS runtime
WORKDIR /app
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/apps/api/prisma ./prisma
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/package.json ./

EXPOSE 3001
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
```

**`apps/dashboard/Dockerfile`**

```dockerfile
FROM node:20-alpine AS base
RUN corepack enable pnpm

FROM base AS deps
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/dashboard/package.json apps/dashboard/
COPY packages/shared/package.json packages/shared/
COPY packages/config-typescript/package.json packages/config-typescript/
RUN pnpm install --frozen-lockfile --prod=false

FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
RUN pnpm --filter @viewboard/shared build
RUN pnpm --filter @viewboard/dashboard build

FROM base AS runtime
WORKDIR /app
COPY --from=build /app/apps/dashboard/.next ./.next
COPY --from=build /app/apps/dashboard/public ./public
COPY --from=build /app/apps/dashboard/package.json ./
COPY --from=build /app/node_modules ./node_modules

EXPOSE 3000
CMD ["npx", "next", "start"]
```

**`apps/player/Dockerfile`**

```dockerfile
FROM node:20-alpine AS base
RUN corepack enable pnpm

FROM base AS deps
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/player/package.json apps/player/
COPY packages/shared/package.json packages/shared/
COPY packages/config-typescript/package.json packages/config-typescript/
RUN pnpm install --frozen-lockfile --prod=false

FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG VITE_API_URL
ARG VITE_WS_URL
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL
RUN pnpm --filter @viewboard/shared build
RUN pnpm --filter @viewboard/player build

FROM nginx:alpine AS runtime
COPY --from=build /app/apps/player/dist /usr/share/nginx/html
COPY apps/player/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

**`apps/player/nginx.conf`**

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### 4. Deploy

```bash
# Build e iniciar
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build

# Ver logs
docker compose -f docker-compose.prod.yml logs -f api

# Executar migrações manualmente (se necessário)
docker compose -f docker-compose.prod.yml exec api npx prisma migrate deploy

# Escalar API (se usando load balancer)
docker compose -f docker-compose.prod.yml up -d --scale api=3
```

## Opção 2: Deploy Manual (VPS/Cloud)

### 1. Preparar servidor

```bash
# Instalar Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Instalar pnpm
corepack enable pnpm

# Instalar PM2 para gestão de processos
npm install -g pm2
```

### 2. Configurar serviços

```bash
# PostgreSQL
sudo apt install postgresql-16

# Redis
sudo apt install redis-server

# MinIO (ou usar S3 da AWS)
wget https://dl.min.io/server/minio/release/linux-amd64/minio
chmod +x minio
sudo mv minio /usr/local/bin/
```

### 3. Build e deploy

```bash
cd /opt/viewboard
git pull
pnpm install
pnpm build

# API
pm2 start apps/api/dist/server.js --name viewboard-api -i max

# Dashboard
pm2 start npx --name viewboard-dashboard -- next start -p 3000

# Player (servir ficheiros estáticos com Nginx)
# Copiar apps/player/dist/ para /var/www/player
```

## Reverse Proxy (Nginx)

```nginx
# /etc/nginx/sites-available/viewboard

# API
server {
    listen 443 ssl http2;
    server_name api.viewboard.exemplo.com;

    ssl_certificate /etc/letsencrypt/live/api.viewboard.exemplo.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.viewboard.exemplo.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 500M;
    }
}

# Dashboard
server {
    listen 443 ssl http2;
    server_name app.viewboard.exemplo.com;

    ssl_certificate /etc/letsencrypt/live/app.viewboard.exemplo.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.viewboard.exemplo.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

# Player
server {
    listen 443 ssl http2;
    server_name player.viewboard.exemplo.com;

    ssl_certificate /etc/letsencrypt/live/player.viewboard.exemplo.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/player.viewboard.exemplo.com/privkey.pem;

    root /var/www/player;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

## Backups

### Base de dados

```bash
# Backup diário (adicionar ao crontab)
pg_dump -h localhost -U viewboard viewboard | gzip > /backups/viewboard-$(date +%Y%m%d).sql.gz

# Restaurar
gunzip -c backup.sql.gz | psql -h localhost -U viewboard viewboard
```

### MinIO

```bash
# Usar mc (MinIO Client)
mc alias set local http://localhost:9000 minio_access_key minio_secret_key
mc mirror local/viewboard /backups/minio/
```

## Monitoramento

- **Health check**: `GET /health` retorna status, timestamp e uptime
- **Swagger**: `/api/docs` para explorar e testar a API
- **Logs**: Configurar `LOG_LEVEL=info` para produção, `debug` para diagnóstico
- **Redis**: Monitorar via `redis-cli monitor`
- **BullMQ**: Jobs de agendamento, meteorologia e notícias executam periodicamente

## Checklist de Produção

- [ ] Gerar secrets JWT fortes (`openssl rand -hex 32`)
- [ ] Configurar CORS com domínios de produção
- [ ] Ativar HTTPS em todos os serviços
- [ ] Configurar backups automáticos (PostgreSQL + MinIO)
- [ ] Configurar monitoramento de uptime
- [ ] Configurar rate limiting adequado ao tráfego esperado
- [ ] Testar modo offline do player
- [ ] Configurar firewall (apenas portas 80/443 expostas)
- [ ] Atualizar `.env` com variáveis de produção
- [ ] Executar testes E2E antes do deploy
