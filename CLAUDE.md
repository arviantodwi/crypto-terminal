# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev          # Start dev server
pnpm build        # Production build
pnpm lint         # Check with Biome
pnpm lint:fix     # Auto-fix with Biome (--unsafe)
```

No test runner is configured.

## File Naming Conventions

- **React components** (`*.tsx`): PascalCase — `MyComponent.tsx`, `PriceChart.tsx`
- **Hooks** (`use*.ts` / `use*.tsx`): camelCase with `use` prefix — `useMarketData.ts`, `usePriceHistory.ts`
- **All other files** (utils, lib, types, config): kebab-case — `query-client.ts`, `format-currency.ts`

## Architecture

**Stack:** Next.js 16 (App Router) · React 19 · Tailwind CSS v4 · TypeScript (strict) · Biome · TanStack Query v5

**Folder structure** (`src/`):
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

**Design files** live in `design/` as `.pen` files (Pencil design tool). Use the `pencil` MCP tools to read/write them — do not use `Read`/`Grep` on `.pen` files directly.
