# Crypto Terminal

Real-time cryptocurrency trading terminal with live market data from Binance USDS Futures.

## Architecture

This is a **monorepo** containing:

- **`apps/web/`** — Next.js 16 frontend (React 19, Tailwind CSS v4, TypeScript)
- **`packages/types/`** — Shared TypeScript types (future)

## Prerequisites

- **Node.js** 20+ and **pnpm** 9+

## Quick Start

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd crypto-terminal

# Install Node dependencies
pnpm install

### 2. Configure Environment

```bash
# Next.js app
cp apps/web/.env.example apps/web/.env.local

### 3. Run Development Servers
```bash
pnpm dev
```


```bash
# Terminal 1: Next.js frontend
pnpm dev:web
# → http://localhost:3000


## Available Commands

### Monorepo (Root)

```bash
pnpm dev:web       # Run Next.js app only

### Next.js App (`apps/web/`)

See [apps/web/README.md](apps/web/README.md) for details.

```bash
cd apps/web
pnpm dev           # Start dev server (localhost:3000)
pnpm build         # Production build
pnpm start         # Start production server
pnpm lint          # Lint with Biome
```


## Tech Stack

### Frontend (`apps/web/`)

- **Framework:** Next.js 16 (App Router) · React 19
- **Styling:** Tailwind CSS v4 (CSS-first config)
- **State:** TanStack Query v5
- **TypeScript:** Strict mode
- **Linting:** Biome

## Project Structure

```
crypto-terminal/
├── apps/
│   ├── web/                  # Next.js frontend
│       ├── src/
│       │   ├── app/          # Next.js App Router
│       │   ├── features/     # Domain features
│       │   ├── ui/           # Shared UI components
│       │   └── lib/          # Third-party configs
│       └── package.json
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
- **Default branch:** `dev`

## Author

Arvianto D. Wicaksono · [dev@arvian.to](mailto:dev@arvian.to)
