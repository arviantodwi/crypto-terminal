# Crypto Terminal

Real-time cryptocurrency trading terminal with live market data from Binance USDS Futures.

## Architecture

This is a **pnpm workspace monorepo** containing:

- **`apps/web/`** — Next.js 16 frontend (React 19, Tailwind CSS v4, TypeScript)
- **`apps/binance-stream/`** — Python WebSocket streamer (FastAPI, Binance USDS Futures)
- **`apps/candle-collector/`** — Node.js service that fetches historical OHLC data from CoinDesk and stores it in PostgreSQL
- **`apps/instrument-registry/`** — Node.js service that syncs tradable instrument data from Binance and stores it in PostgreSQL
- **`packages/types/`** — Shared TypeScript types (future use)

### Data Flow

```
Binance USDS Futures API (WebSocket)
    ↓
apps/binance-stream (FastAPI + Python)
    ↓
    └─→ WebSocket (ws://localhost:3001/ws/{pair}/kline)
            ↓
    apps/web (Next.js Frontend)
            ↓
    Browser (localhost:3000)

CoinDesk API (REST)
    ↓
apps/candle-collector (Fastify + Node.js)  ← triggered manually via HTTP
    ↓
PostgreSQL (historical OHLC candles)

Binance USDS Futures REST API
    ↓
apps/instrument-registry (Fastify + Node.js)  ← periodic cron sync + manual trigger
    ↓
    ├─→ PostgreSQL (instruments table)
    └─→ Redis (exchange:instruments channel — change events)
```

## Prerequisites

- **Node.js** 20+ and **pnpm** 9+
- **Python** 3.12 (via [pyenv](https://github.com/pyenv/pyenv))
- **Poetry** ([installation guide](https://python-poetry.org/docs/#installation))
- **PostgreSQL** (required by `candle-collector` and `instrument-registry`)
- **Redis** (required by `instrument-registry`)

## Quick Start

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd crypto-terminal

# Install Node dependencies
pnpm install

# Install Python dependencies
cd apps/binance-stream
poetry install
cd ../..
```

### 2. Configure Environment

```bash
# Next.js app
cp apps/web/.env.example apps/web/.env.local

# Python streamer
cp apps/binance-stream/.env.example apps/binance-stream/.env
# Edit .env with your Binance API keys

# Candle collector (requires PostgreSQL + CoinDesk API key)
cp apps/candle-collector/.env.example apps/candle-collector/.env
# Edit .env with your DATABASE_URL and COINDESK_API_KEY

# Instrument registry (requires PostgreSQL + Redis)
cp apps/instrument-registry/.env.example apps/instrument-registry/.env
# Edit .env with your DATABASE_URL, REDIS_HOST, REDIS_PORT, and BINANCE_REST_BASE_URL
```

### 3. Run Development Servers

**Option A: Run both apps in parallel**

```bash
pnpm dev
```

**Option B: Run separately**

```bash
# Terminal 1: Next.js frontend
pnpm dev:web
# → http://localhost:3000

# Terminal 2: Python WebSocket streamer
pnpm dev:stream
# → http://localhost:3001 (API docs at /docs)
```

## Available Commands

### Monorepo (Root)

```bash
pnpm dev                        # Run web + binance-stream in parallel
pnpm dev:web                    # Run Next.js app only
pnpm dev:stream                 # Run Python streamer only
pnpm dev:candle-collector       # Run candle-collector only
pnpm start:candle-collector     # Run candle-collector in production mode
pnpm dev:instrument-registry    # Run instrument-registry only
pnpm start:instrument-registry  # Run instrument-registry in production mode
```

### Next.js App (`apps/web/`)

See [apps/web/README.md](apps/web/README.md) for details.

```bash
cd apps/web
pnpm dev           # Start dev server (localhost:3000)
pnpm build         # Production build
pnpm start         # Start production server
pnpm lint          # Lint with Biome
pnpm lint:fix      # Auto-fix with Biome
```

### Python App (`apps/binance-stream/`)

See [apps/binance-stream/README.md](apps/binance-stream/README.md) for details.

```bash
cd apps/binance-stream
poetry install                                                       # Install dependencies
poetry run uvicorn src.main:app --reload --host 0.0.0.0 --port 3001 # Start dev server (localhost:3001)
poetry run ruff check .                                              # Lint
poetry run ruff format .                                             # Format
```

### Candle Collector (`apps/candle-collector/`)

See [apps/candle-collector/README.md](apps/candle-collector/README.md) for details.

```bash
cd apps/candle-collector
pnpm install        # Install dependencies
pnpm db:generate    # Generate DB migration (after schema changes)
pnpm db:migrate     # Apply pending migrations
pnpm dev            # Start dev server with hot reload (localhost:3002)
pnpm start          # Start production server
```

### Instrument Registry (`apps/instrument-registry/`)

```bash
cd apps/instrument-registry
pnpm install        # Install dependencies
pnpm db:generate    # Generate DB migration (after schema changes)
pnpm db:migrate     # Apply pending migrations
pnpm dev            # Start dev server with hot reload (localhost:3003)
pnpm start          # Start production server
```

## Tech Stack

### Frontend (`apps/web/`)

- **Framework:** Next.js 16 (App Router) · React 19
- **Styling:** Tailwind CSS v4 (CSS-first config) · Tailwind Variants v3
- **State:** TanStack Query v5
- **TypeScript:** Strict mode
- **Linting:** Biome

### Backend (`apps/binance-stream/`)

- **Framework:** FastAPI (async)
- **WebSocket:** `websockets` asyncio client
- **Market Data:** Binance USDS Futures via REST + WebSocket
- **HTTP Client:** httpx
- **Python:** 3.12 (pyenv)
- **Package Manager:** Poetry
- **Linting:** Ruff

### Candle Collector (`apps/candle-collector/`)

- **Framework:** Fastify v5 (Node.js)
- **Language:** TypeScript (ESM)
- **Data Source:** CoinDesk API (historical OHLC)
- **Database:** PostgreSQL via Drizzle ORM
- **Package Manager:** pnpm

### Instrument Registry (`apps/instrument-registry/`)

- **Framework:** Fastify v5 (Node.js)
- **Language:** TypeScript (ESM)
- **Data Source:** Binance USDS Futures REST API
- **Database:** PostgreSQL via Drizzle ORM
- **Cache/Pubsub:** Redis (ioredis)
- **Scheduling:** node-cron
- **Package Manager:** pnpm

## Project Structure

```
crypto-terminal/
├── apps/
│   ├── web/                  # Next.js frontend
│   │   ├── src/
│   │   │   ├── app/          # Next.js App Router
│   │   │   ├── features/     # Domain features
│   │   │   ├── ui/           # Shared UI components
│   │   │   ├── hooks/        # Shared hooks
│   │   │   ├── utils/        # Shared utilities
│   │   │   └── lib/          # Third-party client configs
│   │   └── package.json
│   ├── binance-stream/       # Python WebSocket streamer
│   │   ├── src/
│   │   │   ├── main.py       # FastAPI app entry point
│   │   │   ├── stream.py     # Binance WebSocket client
│   │   │   ├── connection_manager.py  # Frontend client manager
│   │   │   ├── models.py     # Kline data models
│   │   │   └── config.py     # Environment settings
│   │   └── pyproject.toml
│   ├── candle-collector/     # Node.js historical OHLC collector
│   │   ├── src/
│   │   │   ├── server.ts     # Fastify server entry point
│   │   │   ├── app.ts        # App factory
│   │   │   ├── config.ts     # Environment settings
│   │   │   ├── db/           # Drizzle schema, client, migrations
│   │   │   ├── plugins/      # Fastify plugins (postgres, coindesk)
│   │   │   └── routes/       # HTTP route handlers
│   │   └── package.json
│   └── instrument-registry/  # Node.js instrument sync service
│       ├── src/
│       │   ├── server.ts     # Fastify server entry point
│       │   ├── app.ts        # App factory
│       │   ├── config.ts     # Environment settings
│       │   ├── db/           # Drizzle schema, client, migrations
│       │   ├── plugins/      # Fastify plugins (postgres, redis, sync)
│       │   ├── routes/       # HTTP route handlers
│       │   └── services/     # Binance REST client, sync logic
│       └── package.json
├── packages/
│   └── types/                # Shared TypeScript types (future use)
├── design/                   # Design assets (Figma exports)
├── .claude/                  # Claude Code settings
├── biome.jsonc               # Biome linter/formatter config
├── pnpm-workspace.yaml       # pnpm workspace config
└── package.json              # Root package with workspace scripts
```

## Development Guidelines

### TypeScript / Next.js

- **React components** (`*.tsx`): PascalCase — `MyComponent.tsx`
- **Hooks** (`use*.ts` / `use*.tsx`): camelCase with `use` prefix — `useMarketData.ts`
- **All other files** (utils, lib, types, config): kebab-case — `format-currency.ts`
- React Compiler is enabled — avoid manual `useMemo`/`useCallback` unless profiling shows a need

### Python

- **Line length:** 100 characters
- **Formatter/Linter:** Ruff (PEP 8 + import sorting)
- **Python version:** 3.12 (pinned via `.python-version`)

### Branch Strategy

- **Default branch:** `dev` — all PRs target `dev`
- **Feature branches:** branch off `dev`, open PRs back to `dev`

## Author

Arvianto D. Wicaksono · [dev@arvian.to](mailto:dev@arvian.to)
