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
