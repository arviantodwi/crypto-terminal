#!/usr/bin/env bash
# setup-claude-rules.sh
#
# Creates the .claude/rules/ directory structure with all rule files.
# Run once from the repository root, then commit and push the result.
#
# Usage:
#   bash setup-claude-rules.sh
#   git add .claude/rules/
#   git commit -m "feat: add claude rules collection"
#   git push

set -euo pipefail

RULES_DIR=".claude/rules"

mkdir -p \
  "$RULES_DIR/web" \
  "$RULES_DIR/binance-stream" \
  "$RULES_DIR/candle-collector"

# ---------------------------------------------------------------------------
# Shared rules
# ---------------------------------------------------------------------------

cat > "$RULES_DIR/monorepo-structure.md" << 'ENDFILE'
---
paths:
  - "**/*"
---

# Monorepo Structure

This is a **pnpm workspace monorepo**.

## Apps

| App | Path | Stack | Port |
|-----|------|-------|------|
| Web frontend | `apps/web/` | Next.js 16, React 19, TypeScript | 3000 |
| Binance stream | `apps/binance-stream/` | Python, FastAPI, Binance SDK | 3001 |
| Candle collector | `apps/candle-collector/` | Node.js, Fastify, Drizzle ORM | 3002 |

## Packages

- `packages/types/` — Shared TypeScript types (`@crypto-terminal/types`), future use

## Root-Level Files

Keep at root (do not move into apps): `.editorconfig`, `.gitignore`, `AGENTS.md`, `CLAUDE.md`, `biome.jsonc`, `.claude/`, `.opencode/`, `.vscode/`, `design/`
ENDFILE

cat > "$RULES_DIR/commands.md" << 'ENDFILE'
---
paths:
  - "**/*"
---

# Development Commands

## Monorepo Root

```bash
pnpm dev           # Run all apps in parallel
pnpm dev:web       # Run Next.js app only
pnpm dev:stream    # Run binance-stream only
```

## apps/web

```bash
pnpm dev           # Start dev server (localhost:3000)
pnpm build         # Production build
pnpm start         # Start production server
pnpm lint          # Check with Biome
pnpm lint:fix      # Auto-fix with Biome (--unsafe)
```

## apps/binance-stream

```bash
poetry install
poetry run uvicorn src.main:app --reload --host 0.0.0.0 --port 3001
poetry run ruff check .
poetry run ruff format .
```

## apps/candle-collector

```bash
pnpm install
pnpm dev           # Development with hot reload (localhost:3002)
pnpm start         # Production
pnpm build         # Compile TypeScript
pnpm typecheck     # Type-check without emitting
pnpm db:generate   # Generate Drizzle migration after schema changes
pnpm db:migrate    # Apply pending migrations (requires DATABASE_URL in .env)
```

No test runner is configured for any app.
ENDFILE

cat > "$RULES_DIR/naming-conventions.md" << 'ENDFILE'
---
paths:
  - "apps/web/**"
  - "packages/types/**"
---

# File Naming Conventions

Applies to `apps/web/` and `packages/types/` only.

| File type | Convention | Examples |
|-----------|------------|---------|
| React components (`*.tsx`) | PascalCase | `MyComponent.tsx`, `PriceChart.tsx` |
| Hooks (`use*.ts` / `use*.tsx`) | camelCase with `use` prefix | `useMarketData.ts`, `usePriceHistory.ts` |
| All other files (utils, lib, types, config) | kebab-case | `query-client.ts`, `format-currency.ts` |
ENDFILE

# ---------------------------------------------------------------------------
# apps/web rules
# ---------------------------------------------------------------------------

cat > "$RULES_DIR/web/architecture.md" << 'ENDFILE'
---
paths:
  - "apps/web/**"
---

# Web App Architecture

**Stack:** Next.js 16 (App Router) · React 19 · Tailwind CSS v4 · Tailwind Variants v3 · TypeScript (strict) · Biome · TanStack Query v5

## Folder Structure (`apps/web/src/`)

| Directory | Purpose |
|-----------|---------|
| `app/` | Next.js App Router routes — thin layout wrappers only. Path alias `@/*` maps to `src/*`. |
| `features/` | Domain features; each has its own `components/`, `hooks/`, `utils/` |
| `ui/` | Shared, reusable UI components used across features |
| `hooks/` | Shared hooks used across multiple features |
| `utils/` | Shared utility/helper functions |
| `lib/` | Third-party client configs and adapters (e.g. `query-client.ts`, `Providers.tsx`) |
| `types/` | Global TypeScript types and interfaces |

## TanStack Query (v5)

- `QueryClient` is created via `makeQueryClient()` in `src/lib/query-client.ts` — factory function, not a module-level singleton, to avoid cross-request cache leaks in SSR.
- `src/lib/Providers.tsx` wraps the app with `QueryClientProvider`; client is held in `useState` so it survives re-renders without being recreated.
- Default `staleTime`: 60s.

## React Compiler

React Compiler is enabled (`reactCompiler: true` in `next.config.ts`). Avoid manual `useMemo`/`useCallback` unless profiling shows a need.
ENDFILE

cat > "$RULES_DIR/web/styling.md" << 'ENDFILE'
---
paths:
  - "apps/web/**"
---

# Styling System

## Tailwind v4 CSS-First Config

- No `tailwind.config.ts`. All theme customization is in the `@theme inline {}` block in `src/app/globals.css`.
- Design tokens sourced from the Figma Dark Color Palette: 5 color scales (neutral, yellow, green, red, blue) with shades 50–950, plus semantic aliases (`--color-bg`, `--color-text`, `--color-text-muted`, `--color-border`).
- Currently dark-only. The `:root` and `@media (prefers-color-scheme: dark)` blocks both use the same dark token values. The media query is preserved for future light theme support.

## Typography

- Font stack: Space Grotesk (`font-sans`) + JetBrains Mono (`font-mono`), loaded via `next/font/google` in `layout.tsx`.
- Slashed zero (`"zero"`) is enabled globally via `font-feature-settings`.

## Tailwind Variants

Always use `tailwind-variants` (`tv`) for component styling. Do not use plain `clsx`/`cx` for conditional classes in components.
ENDFILE

cat > "$RULES_DIR/web/icons.md" << 'ENDFILE'
---
paths:
  - "apps/web/**"
---

# Icon System

Location: `src/ui/icon/`

- `index.tsx` — `Icon` component + re-exports all glyphs. Uses `tailwind-variants` (`tv`) for size variants: `16` (default) / `14` / `20` / `24`. Stroke weight is derived automatically from size.
- `glyphs/` — one file per glyph.

## Glyph Patterns

**Stroke glyphs:**
- Receive `{ size, strokeWidth }`
- Render `<svg fill="none" stroke="currentColor" strokeWidth={strokeWidth}>`
- No `Filled` suffix in name

**Fill glyphs:**
- Receive `{ size }` (strokeWidth optional and ignored)
- Render `<svg fill="currentColor">`
- Must have `Filled` suffix in both filename and exported function name

All SVGs must have `aria-hidden="true"` (icons are decorative; surrounding context provides the accessible label).

## Usage

```tsx
<Icon glyph={Settings} size={20} />
<Icon glyph={SettingsFilled} className="text-yellow-400" />
```
ENDFILE

cat > "$RULES_DIR/web/figma.md" << 'ENDFILE'
---
paths:
  - "apps/web/**"
---

# Figma to Code

## Font Mapping

| Figma font | Tailwind utility |
|------------|-----------------|
| Space Grotesk | `font-sans` |
| JetBrains Mono | `font-mono` |

## Guidelines

- Always use Tailwind Variants (`tv`) when converting designs to UI components.
- Ensure the rendered UI appearance matches the Figma design as closely as possible.
- Use design tokens defined in `src/app/globals.css` for colors — do not use raw Tailwind color utilities unless they match a design token.
ENDFILE

cat > "$RULES_DIR/web/linting.md" << 'ENDFILE'
---
paths:
  - "apps/web/**"
---

# Linting & Formatting (Biome)

Config lives in `biome.jsonc` at the repository root.

| Setting | Value |
|---------|-------|
| Quotes | Single |
| Indent | 2 spaces |
| Line width | 100 characters |
| Line endings | LF |
| Trailing commas | Always |

- Import organization and attribute/key sorting are enforced automatically.
- Tailwind CSS directives are recognized (`tailwindDirectives: true`).

## Commands

```bash
pnpm lint        # Check
pnpm lint:fix    # Auto-fix (--unsafe flag enabled)
```
ENDFILE

# ---------------------------------------------------------------------------
# apps/binance-stream rules
# ---------------------------------------------------------------------------

cat > "$RULES_DIR/binance-stream/architecture.md" << 'ENDFILE'
---
paths:
  - "apps/binance-stream/**"
---

# Binance Stream Architecture

**Stack:** FastAPI · Binance Connector (USDS Futures) · asyncpg · Python 3.12 · Poetry · Ruff

## Purpose

Stream real-time market data from Binance USDS Futures WebSocket and expose it to the Next.js frontend.

## Key Files

| File | Purpose |
|------|---------|
| `src/main.py` | FastAPI application entry point |
| `src/stream.py` | WebSocket streaming logic |
| `src/connection_manager.py` | WebSocket client connection management |
| `src/models.py` | Pydantic data models |
| `src/config.py` | App configuration |
| `pyproject.toml` | Poetry dependencies and Ruff config |

## Endpoints

| Endpoint | Description |
|----------|-------------|
| `ws://localhost:3001/ws` | WebSocket stream for the frontend |
| `GET /health` | Health check |
| `GET /docs` | Auto-generated FastAPI docs |
ENDFILE

cat > "$RULES_DIR/binance-stream/environment.md" << 'ENDFILE'
---
paths:
  - "apps/binance-stream/**"
---

# Binance Stream Environment

## Python Version

Python 3.12 managed via `pyenv`. Version pinned in `apps/binance-stream/.python-version`.

## Dependency Management

Dependencies managed via Poetry (`pyproject.toml`). Virtual environment is auto-created by Poetry.

```bash
poetry install   # Install all dependencies
```

## Environment Variables

Copy `.env.example` to `.env` and fill in required values (Binance API keys, database config, etc.).
ENDFILE

cat > "$RULES_DIR/binance-stream/linting.md" << 'ENDFILE'
---
paths:
  - "apps/binance-stream/**"
---

# Linting & Formatting (Ruff)

Config lives in `apps/binance-stream/pyproject.toml`.

| Setting | Value |
|---------|-------|
| Line length | 100 characters |
| Rules | `E` (pycodestyle errors), `F` (pyflakes), `I` (isort) |
| Target | Python 3.12 |

## Commands

```bash
poetry run ruff check .    # Lint
poetry run ruff format .   # Format
```
ENDFILE

# ---------------------------------------------------------------------------
# apps/candle-collector rules
# ---------------------------------------------------------------------------

cat > "$RULES_DIR/candle-collector/architecture.md" << 'ENDFILE'
---
paths:
  - "apps/candle-collector/**"
---

# Candle Collector Architecture

**Stack:** Node.js (>=20) · Fastify 5 · Drizzle ORM · PostgreSQL · TypeScript · tsx

## Purpose

Standalone service that fetches historical OHLC candle data from the CoinDesk API and upserts it into PostgreSQL. Triggered manually via HTTP — not on a schedule.

## Key Files

| File | Purpose |
|------|---------|
| `src/server.ts` | Fastify server entry point |
| `src/app.ts` | App factory / plugin registration |
| `src/config.ts` | Environment config |
| `src/db/schema.ts` | Drizzle schema — single source of truth for DB and TypeScript types |
| `src/db/client.ts` | Database client setup |
| `src/routes/ohlc/` | OHLC fetch route handlers |
| `src/plugins/` | Fastify plugins |

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check — returns `200 { "status": "ok" }` |
| `POST` | `/ohlc/fetch` | Trigger paginated CoinDesk fetch and upsert into PostgreSQL |

### POST /ohlc/fetch — Request Body

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `instrument` | Yes | — | CoinDesk instrument identifier (e.g. `BTCUSDT`) |
| `to_ts` | No | closest boundary before now | Unix timestamp to paginate backward from |
| `aggregate` | No | `5` | Candle width in minutes |
| `pages` | No | `10` | Pages of 1,000 candles to fetch (max `20`) |

### Error Codes

| Status | Cause |
|--------|-------|
| `400` | Validation failure |
| `409` | Fetch already in progress for this instrument |
| `502` | CoinDesk returned an error |
| `500` | Database write failed |
ENDFILE

cat > "$RULES_DIR/candle-collector/database.md" << 'ENDFILE'
---
paths:
  - "apps/candle-collector/**"
---

# Database (Drizzle ORM)

Schema is managed by Drizzle ORM. The table definition in `src/db/schema.ts` is the **single source of truth** for both the database structure and TypeScript types.

## Migrations

Migration files live in `src/db/migrations/` and must be committed to the repository.

```bash
pnpm db:generate   # Generate a new migration after schema changes
pnpm db:migrate    # Apply pending migrations (requires DATABASE_URL in .env)
```

Always run `pnpm db:generate` after changing `src/db/schema.ts`, and commit the generated migration file alongside the schema change.
ENDFILE

cat > "$RULES_DIR/candle-collector/environment.md" << 'ENDFILE'
---
paths:
  - "apps/candle-collector/**"
---

# Candle Collector Environment

## Setup

```bash
cp .env.example .env
# Fill in required values

pnpm install
pnpm db:generate
pnpm db:migrate
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `COINDESK_API_KEY` | Yes | — | API key for CoinDesk requests |
| `COINDESK_BASE_URL` | Yes | — | `https://data-api.coindesk.com` |
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `PORT` | No | `3002` | Port the service listens on |
| `LOG_LEVEL` | No | `info` | Pino log level |
ENDFILE

echo "Done! All rule files created in $RULES_DIR/"
echo ""
echo "Next steps:"
echo "  git add .claude/rules/"
echo "  git commit -m 'feat: add claude rules collection'"
echo "  git push"
