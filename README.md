# Crypto Terminal

Real-time cryptocurrency trading terminal with live market data from Binance USDS Futures.

## Architecture

This is a **monorepo** containing:

- **`apps/web/`** — Next.js 16 frontend (React 19, Tailwind CSS v4, TypeScript)
- **`apps/binance-stream/`** — Python WebSocket streamer (FastAPI, Binance SDK)
- **`packages/types/`** — Shared TypeScript types (future)

### Data Flow

```
Binance API (WebSocket)
    ↓
apps/binance-stream (FastAPI + Python)
    ↓
    └─→ WebSocket (ws://localhost:3001/ws)
            ↓
    apps/web (Next.js Frontend)
            ↓
    Browser (localhost:3000)
```

## Prerequisites

- **Node.js** 20+ and **pnpm** 9+
- **Python** 3.12 (via [pyenv](https://github.com/pyenv/pyenv))
- **Poetry** ([installation guide](https://python-poetry.org/docs/#installation))

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
# Edit .env with your Binance API keys and PostgreSQL connection string
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
pnpm dev           # Run both apps in parallel
pnpm dev:web       # Run Next.js app only
pnpm dev:stream    # Run Python streamer only

### Next.js App (`apps/web/`)

See [apps/web/README.md](apps/web/README.md) for details.

```bash
cd apps/web
pnpm dev           # Start dev server (localhost:3000)
pnpm build         # Production build
pnpm start         # Start production server
pnpm lint          # Lint with Biome
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

## Tech Stack

### Frontend (`apps/web/`)

- **Framework:** Next.js 16 (App Router) · React 19
- **Styling:** Tailwind CSS v4 (CSS-first config)
- **State:** TanStack Query v5
- **TypeScript:** Strict mode
- **Linting:** Biome

### Backend (`apps/binance-stream/`)

- **Framework:** FastAPI (async)
- **WebSocket:** `websockets` library
- **Market Data:** Binance Connector (USDS Futures)
- **Python:** 3.12 (pyenv)
- **Package Manager:** Poetry
- **Linting:** Ruff

## Project Structure

```
crypto-terminal/
├── apps/
│   ├── web/                  # Next.js frontend
│   │   ├── src/
│   │   │   ├── app/          # Next.js App Router
│   │   │   ├── features/     # Domain features
│   │   │   ├── ui/           # Shared UI components
│   │   │   └── lib/          # Third-party configs
│   │   └── package.json
│   └── binance-stream/       # Python WebSocket streamer
│       ├── src/
│       │   └── main.py       # FastAPI app
│       └── pyproject.toml
├── packages/
│   └── types/                # Shared TypeScript types (future)
├── design/                   # Design assets (Figma exports)
├── .claude/                  # Claude Code settings
├── biome.jsonc               # Biome linter/formatter config
├── pnpm-workspace.yaml       # pnpm workspace config
└── package.json              # Root package with workspace scripts
```

## Development Notes

- **File Naming (TypeScript):**
  - React components: `PascalCase.tsx`
  - Hooks: `use*.ts` / `use*.tsx`
  - Utils/lib/types: `kebab-case.ts`
- **Python Formatting:** Line length 100, managed by Ruff (PEP 8 + import sorting)
- **Default branch:** `dev`

## Author

Arvianto D. Wicaksono · [dev@arvian.to](mailto:dev@arvian.to)
