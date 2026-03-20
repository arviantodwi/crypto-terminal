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
