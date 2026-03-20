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
