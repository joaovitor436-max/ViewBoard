# ViewBoard - Plataforma de Sinalização Digital

Plataforma SaaS completa para gestão de sinalização digital (digital signage). Gerencie telas, crie playlists visuais, agende conteúdo e monitore dispositivos em tempo real.

## Arquitetura

```
ViewBoard (Monorepo pnpm)
├── apps/
│   ├── api          — Backend (Fastify + Prisma + BullMQ + Socket.io)
│   ├── dashboard    — Painel admin (Next.js 14 + React Query + Tailwind)
│   ├── player       — Player para TV (Vite + React + Zustand + Service Worker)
│   └── chromecast-player — Player Chromecast (experimental)
├── packages/
│   ├── shared       — Tipos e schemas Zod partilhados
│   └── config-typescript — Configuração TypeScript base
├── e2e/             — Testes E2E (Playwright)
├── tests/load/      — Testes de carga WebSocket
└── docker-compose.yml
```

## Pré-requisitos

- **Node.js** >= 20.0.0
- **pnpm** >= 9.0.0
- **Docker** e **Docker Compose** (para PostgreSQL, Redis, MinIO)
- **Git**

## Início Rápido

### 1. Clonar e instalar dependências

```bash
git clone <repo-url> viewboard
cd viewboard
pnpm install
```

### 2. Iniciar serviços de infraestrutura

```bash
docker compose up -d
```

Isto inicia:
- **PostgreSQL 16** na porta 5432
- **Redis 7** na porta 6379
- **MinIO** na porta 9000 (API) e 9001 (Console)

### 3. Configurar variáveis de ambiente

```bash
# API
cp apps/api/.env.example apps/api/.env

# Dashboard
cp apps/dashboard/.env.example apps/dashboard/.env

# Player
cp apps/player/.env.example apps/player/.env
```

Edite os ficheiros `.env` conforme necessário. Os valores default funcionam para desenvolvimento local.

### 4. Configurar base de dados

```bash
cd apps/api
pnpm db:generate    # Gerar Prisma Client
pnpm db:migrate     # Executar migrações
pnpm db:seed        # (Opcional) Popular com dados de exemplo
```

### 5. Iniciar a aplicação

```bash
# Na raiz do projeto (inicia todos os apps)
pnpm dev
```

Ou individualmente:

```bash
pnpm --filter @viewboard/api dev        # API: http://localhost:3001
pnpm --filter @viewboard/dashboard dev   # Dashboard: http://localhost:3000
pnpm --filter @viewboard/player dev      # Player: http://localhost:3002
```

### 6. Aceder

| Serviço | URL |
|---------|-----|
| Dashboard | http://localhost:3000 |
| API | http://localhost:3001 |
| API Docs (Swagger) | http://localhost:3001/api/docs |
| Player | http://localhost:3002 |
| MinIO Console | http://localhost:9001 |
| Health Check | http://localhost:3001/health |

## Variáveis de Ambiente

### API (`apps/api/.env`)

| Variável | Descrição | Default |
|----------|-----------|---------|
| `DATABASE_URL` | Connection string PostgreSQL | `postgresql://viewboard:viewboard_secret@localhost:5432/viewboard` |
| `REDIS_URL` | Connection string Redis | `redis://:redis_secret@localhost:6379` |
| `MINIO_ENDPOINT` | Hostname do MinIO | `localhost` |
| `MINIO_PORT` | Porta do MinIO | `9000` |
| `MINIO_USE_SSL` | Usar HTTPS para MinIO | `false` |
| `MINIO_ACCESS_KEY` | Chave de acesso MinIO | `minio_access_key` |
| `MINIO_SECRET_KEY` | Chave secreta MinIO | `minio_secret_key` |
| `MINIO_BUCKET` | Nome do bucket | `viewboard` |
| `JWT_SECRET` | Secret para access tokens (min 32 chars) | — |
| `JWT_REFRESH_SECRET` | Secret para refresh tokens (min 32 chars) | — |
| `JWT_ACCESS_EXPIRES_IN` | Tempo de expiração do access token | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Tempo de expiração do refresh token | `7d` |
| `PORT` | Porta do servidor | `3001` |
| `HOST` | Host de escuta | `0.0.0.0` |
| `NODE_ENV` | Ambiente | `development` |
| `LOG_LEVEL` | Nível de log (debug/info/warn/error) | `info` |
| `CORS_ORIGIN` | Origens CORS (separadas por vírgula) | `http://localhost:3000` |
| `OPENWEATHERMAP_KEY` | API key OpenWeatherMap (opcional) | — |
| `NEWS_API_KEY` | API key NewsAPI.org (opcional) | — |

### Dashboard (`apps/dashboard/.env`)

| Variável | Descrição | Default |
|----------|-----------|---------|
| `NEXT_PUBLIC_API_URL` | URL da API | `http://localhost:3001` |
| `NEXT_PUBLIC_WS_URL` | URL WebSocket | `http://localhost:3001` |

### Player (`apps/player/.env`)

| Variável | Descrição | Default |
|----------|-----------|---------|
| `VITE_API_URL` | URL da API | `http://localhost:3001` |
| `VITE_WS_URL` | URL WebSocket | `http://localhost:3001` |
| `VITE_SCREEN_ID` | ID fixo de tela para modo kiosk (opcional) | — |

## Comandos Úteis

### Raiz do projeto

```bash
pnpm dev              # Iniciar todos os apps em dev
pnpm build            # Build de produção de todos os apps
pnpm lint             # Lint de todos os apps
pnpm clean            # Limpar artefactos de build
```

### API

```bash
pnpm --filter @viewboard/api dev          # Dev com hot reload
pnpm --filter @viewboard/api build        # Build para produção
pnpm --filter @viewboard/api db:generate  # Gerar Prisma Client
pnpm --filter @viewboard/api db:migrate   # Executar migrações
pnpm --filter @viewboard/api db:studio    # Abrir Prisma Studio
pnpm --filter @viewboard/api db:seed      # Popular base de dados
pnpm --filter @viewboard/api test         # Executar testes unitários
```

### Testes

```bash
# E2E (requer apps a correr)
cd e2e && npx playwright test

# Testes de carga WebSocket
cd tests/load && npx tsx websocket-load.ts
```

## Funcionalidades

### Dashboard
- Multi-tenant com isolamento por tenant
- Gestão de utilizadores e permissões (SUPER_ADMIN, ADMIN, MANAGER, OPERATOR, VIEWER)
- Biblioteca de mídias com upload drag-and-drop (imagens e vídeos)
- Editor visual de playlists com reordenação drag-and-drop
- Agendamento com recorrência (diário, semanal, personalizado)
- Templates de layout (Fullscreen, Split, Grid)
- Widgets configuráveis (relógio, meteorologia, notícias, ticker)
- Dark mode
- Responsivo para tablets (min 768px)
- Atalhos de teclado (Ctrl+S para salvar)

### Player
- Pareamento por código QR
- Exibição em tempo real via WebSocket
- Modo offline com Service Worker e IndexedDB
- Cache proativo de mídias (até 500MB)
- Indicador de estado de conexão
- Reconexão automática transparente
- Suporte a múltiplos tipos de conteúdo (imagem, vídeo, HTML, relógio, meteorologia, ticker, anúncios)
- Animações de transição suaves (Framer Motion)

### API
- RESTful com Fastify
- Autenticação JWT (access + refresh tokens)
- Documentação Swagger/OpenAPI em /api/docs
- Rate limiting
- Validação MIME real de uploads (magic bytes)
- Jobs em background (BullMQ) para agendamentos, meteorologia, notícias
- WebSocket (Socket.io) para atualizações em tempo real
- Armazenamento de ficheiros em MinIO (compatível S3)

## Segurança

- Helmet.js para headers HTTP
- Rate limiting global (200 req/min) e específico por endpoint
- Validação de tenantId em todos os endpoints autenticados
- Validação MIME real de uploads (não apenas extensão)
- Tokens JWT com rotação de refresh tokens
- CORS configurável
- Sanitização de inputs com Zod

## Tecnologias

| Camada | Tecnologias |
|--------|-------------|
| **Backend** | Node.js, Fastify, Prisma, PostgreSQL, Redis, BullMQ, Socket.io, MinIO |
| **Dashboard** | Next.js 14, React 18, Tailwind CSS, React Query, Zustand, React Hook Form |
| **Player** | Vite, React 18, Zustand, Framer Motion, Socket.io, Service Worker |
| **Infra** | Docker, pnpm workspaces, Turborepo |
| **Testes** | Vitest (unitários), Playwright (E2E) |

## Licença

Proprietário - Todos os direitos reservados.
