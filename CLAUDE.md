# CLAUDE.md

Guidance for Claude Code when working with this repository.

## Overview

**pnpm workspace monorepo** with three apps and a shared types package.

| App | Path | Port |
|-----|------|------|
| Web frontend | `apps/web/` | 3000 |
| Binance stream | `apps/binance-stream/` | 3001 |
| Candle collector | `apps/candle-collector/` | 3002 |

Shared types: `packages/types/` (`@crypto-terminal/types`)

## Rules

Detailed guidelines live in `.claude/rules/`, organized by topic. Files use `paths` frontmatter so Claude loads the right rules automatically.

### Shared
- [`monorepo-structure.md`](.claude/rules/monorepo-structure.md) — repo layout, root-level files
- [`commands.md`](.claude/rules/commands.md) — dev/build/lint commands for all apps
- [`naming-conventions.md`](.claude/rules/naming-conventions.md) — file naming (`apps/web/`, `packages/types/`)

### apps/web
- [`web/architecture.md`](.claude/rules/web/architecture.md) — folder structure, TanStack Query, React Compiler
- [`web/styling.md`](.claude/rules/web/styling.md) — Tailwind v4, design tokens, fonts
- [`web/icons.md`](.claude/rules/web/icons.md) — icon system and glyph patterns
- [`web/figma.md`](.claude/rules/web/figma.md) — Figma-to-code conventions
- [`web/linting.md`](.claude/rules/web/linting.md) — Biome config

### apps/binance-stream
- [`binance-stream/architecture.md`](.claude/rules/binance-stream/architecture.md) — FastAPI structure and endpoints
- [`binance-stream/environment.md`](.claude/rules/binance-stream/environment.md) — Python/Poetry setup
- [`binance-stream/linting.md`](.claude/rules/binance-stream/linting.md) — Ruff config

### apps/candle-collector
- [`candle-collector/architecture.md`](.claude/rules/candle-collector/architecture.md) — Fastify service structure and endpoints
- [`candle-collector/database.md`](.claude/rules/candle-collector/database.md) — Drizzle ORM and migrations
- [`candle-collector/environment.md`](.claude/rules/candle-collector/environment.md) — env variables and setup
