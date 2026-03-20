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
