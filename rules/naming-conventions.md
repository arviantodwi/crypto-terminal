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
