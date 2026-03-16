# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Monorepo Structure

This is a **pnpm workspace monorepo** with multiple applications:

### Apps
- **`apps/web/`** — Next.js 16 frontend (React 19, Tailwind CSS v4, TypeScript)
- **`apps/binance-stream/`** — Python WebSocket streamer (FastAPI, Binance SDK, Python 3.12)

### Packages
- **`packages/types/`** — Shared TypeScript types (future use)

### Root-Level Files
Keep these at root: `.editorconfig`, `.gitignore`, `AGENTS.md`, `CLAUDE.md`, `biome.jsonc`, `.claude/`, `.opencode/`, `.vscode/`, `design/`

## Commands

### Monorepo (Root)

```bash
pnpm dev           # Run both web + binance-stream in parallel
pnpm dev:web       # Run Next.js app only
pnpm dev:stream    # Run Python streamer only
```

### Next.js App (`apps/web/`)

```bash
pnpm dev           # Start dev server (localhost:3000)
pnpm build         # Production build
pnpm start         # Start production server
pnpm lint          # Check with Biome
pnpm lint:fix      # Auto-fix with Biome (--unsafe)
```

### Python App (`apps/binance-stream/`)

```bash
poetry install                                                       # Install dependencies
poetry run uvicorn src.main:app --reload --host 0.0.0.0 --port 3001 # Start dev server (localhost:3001)
poetry run ruff check .                                              # Lint Python code
poetry run ruff format .                                             # Format Python code
```

No test runner is configured for either app.

## File Naming Conventions

Applies to `apps/web/` and `packages/types/` only:

- **React components** (`*.tsx`): PascalCase — `MyComponent.tsx`, `PriceChart.tsx`
- **Hooks** (`use*.ts` / `use*.tsx`): camelCase with `use` prefix — `useMarketData.ts`, `usePriceHistory.ts`
- **All other files** (utils, lib, types, config): kebab-case — `query-client.ts`, `format-currency.ts`

## Next.js App Architecture

**Stack:** Next.js 16 (App Router) · React 19 · Tailwind CSS v4 · Tailwind Variants v3 · TypeScript (strict) · Biome · TanStack Query v5

**Folder structure** (`apps/web/src/`):
- `app/` — Next.js App Router routes only (thin layout wrappers). Path alias `@/*` maps to `src/*`.
- `features/` — domain features, each with their own `components/`, `hooks/`, `utils/`
- `ui/` — shared, reusable UI components used across features
- `hooks/` — shared hooks used across multiple features
- `utils/` — shared utility/helper functions
- `lib/` — third-party client configs and adapters (e.g. `query-client.ts`, `Providers.tsx`)
- `types/` — global TypeScript types and interfaces

**TanStack Query (v5):**
- `QueryClient` is created via `makeQueryClient()` in `src/lib/query-client.ts` — factory function, not a module-level singleton, to avoid cross-request cache leaks in SSR.
- `src/lib/Providers.tsx` wraps the app with `QueryClientProvider`; client is held in `useState` so it survives re-renders without being recreated. Default `staleTime`: 60 s.

**Styling system** (`src/app/globals.css`):
- Tailwind v4 CSS-first config — no `tailwind.config.ts`. All theme customization is in the `@theme inline {}` block in `globals.css`.
- Design tokens sourced from the Figma Dark Color Palette: 5 color scales (neutral, yellow, green, red, blue) with shades 50–950, plus semantic aliases (`--color-bg`, `--color-text`, `--color-text-muted`, `--color-border`).
- Currently dark-only. The `:root` and `@media (prefers-color-scheme: dark)` blocks both use the same dark token values. The media query is preserved for future light theme support.
- Font stack: Space Grotesk (`font-sans`) + JetBrains Mono (`font-mono`), loaded via `next/font/google` in `layout.tsx`. Slashed zero (`"zero"`) is enabled globally via `font-feature-settings`.

**Linting/Formatting (Biome):**
- Single quotes, 2-space indent, 100-char line width, LF endings, trailing commas everywhere.
- Import organization and attribute/key sorting are enforced automatically.
- Tailwind CSS directives are recognized (`tailwindDirectives: true`).

**React Compiler** is enabled (`reactCompiler: true` in `next.config.ts`) — avoid manual `useMemo`/`useCallback` unless profiling shows a need.

**Icon system** (`src/ui/icon/`):
- `index.tsx` — `Icon` component + re-exports all glyphs. Uses `tailwind-variants` (`tv`) for size variants: `16` (default) / `14` / `20` / `24`. Stroke weight is derived automatically from size.
- `glyphs/` — one file per glyph. Two patterns:
  - **Stroke glyphs**: receive `{ size, strokeWidth }`, render `<svg fill="none" stroke="currentColor" strokeWidth={strokeWidth}>`. No `Filled` suffix.
  - **Fill glyphs**: receive `{ size }` (strokeWidth is optional and ignored), render `<svg fill="currentColor">`. Must have `Filled` suffix in both filename and exported function name.
- All SVGs must have `aria-hidden="true"` (icons are decorative; surrounding context provides the accessible label).
- Usage: `<Icon glyph={Settings} size={20} />` or `<Icon glyph={SettingsFilled} className="text-yellow-400" />`.

**Figma to Code:**
- If an element in the Figma node uses Space Grotesk font, apply `font-sans` utility class.
- If an element in the Figma node uses JetBrains Mono font, apply `font-mono` utility class.
- Always use Tailwind Variants (`tv`) when converting designs to UI code.
- Ensure the rendered UI appearance matches the Figma design as closely as possible.

## Python App Architecture

**Stack:** FastAPI · Binance Connector (USDS Futures) · asyncpg · Python 3.12 · Poetry · Ruff

**Location:** `apps/binance-stream/`

**Environment:**
- Python 3.12 managed via `pyenv` (`.python-version` file at `apps/binance-stream/.python-version`)
- Dependencies managed via Poetry (`pyproject.toml`)
- Virtual environment auto-created by Poetry

**Purpose:**
- Stream real-time market data from Binance USDS Futures WebSocket
- Expose WebSocket endpoint (`ws://localhost:3001/ws`) for Next.js frontend

**Key Files:**
- `src/main.py` — FastAPI application entry point
- `pyproject.toml` — Poetry dependencies and Ruff config
- `.env` — Environment variables (API keys, DB config); copy from `.env.example`
- `.python-version` — Python version pin for pyenv

**Endpoints:**
- WebSocket: `ws://localhost:3001/ws`
- Health check: `http://localhost:3001/health`
- API docs: `http://localhost:3001/docs` (auto-generated by FastAPI)

**Linting/Formatting (Ruff):**
- Line length: 100 characters
- Rules: `E`, `F`, `I` (pycodestyle errors, pyflakes, isort)
- Target: Python 3.12
