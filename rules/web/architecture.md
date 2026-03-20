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
