# candle-collector

A standalone Node.js + Fastify service that fetches historical OHLC candle data from the CoinDesk API and stores it in PostgreSQL.

It is triggered manually by a developer via HTTP — not on a schedule.

## Prerequisites

- Postgres container running: `pnpm pg:up` (from the repo root — see [apps/postgres/](../postgres/README.md))

## Setup

```bash
cp .env.example .env
# Fill in all required values in .env
# Set DATABASE_URL to match the credentials in apps/postgres/.env:
# postgres://<POSTGRES_USER>:<POSTGRES_PASSWORD>@localhost:<POSTGRES_PORT>/<POSTGRES_DB>

pnpm install

# Apply database migrations
pnpm db:migrate
```

## Running

```bash
# Development (hot reload)
pnpm dev

# Production
pnpm start
```

The service listens on `PORT` (default: `3002`).

## Endpoints

### `GET /health`

Returns `200 { "status": "ok" }` — confirms the process is alive.

### `POST /ohlc/fetch`

Runs the paginated CoinDesk fetch and upserts candles into PostgreSQL.

**Request body:**

```json
{
  "instrument": "BTCUSDT",
  "to_ts": 1773926478,
  "aggregate": 5,
  "pages": 10
}
```

| Field        | Type    | Required | Description                                                                                                                                                        |
| ------------ | ------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `instrument` | string  | ✅       | CoinDesk instrument identifier                                                                                                                                     |
| `to_ts`      | integer | ❌       | Unix timestamp — start paginating backwards from here. Defaults to the closest boundary before now                                                                 |
| `aggregate`  | integer | ❌       | Candle width in minutes (e.g. `5` → 5m, `15` → 15m, `60` → 1h). Defaults to `5`                                                                                    |
| `pages`      | integer | ❌       | Number of pages to fetch. Each page returns up to `floor(2000 / aggregate)` candles (e.g. 400 at `aggregate=5`, 2000 at `aggregate=1`). Defaults to `10`. Max `20` |

**Successful response:**

```json
{
  "instrument": "BTC-USDT",
  "pages_fetched": 10,
  "total_records": 3987,
  "inserted": 3941,
  "skipped": 46,
  "earliest_candle_ts": 1770926400,
  "latest_candle_ts": 1773926400,
  "duration_ms": 4821
}
```

**Error codes:**

| Status | Cause                                                      |
| ------ | ---------------------------------------------------------- |
| `400`  | Validation failure (missing required fields, `pages` > 20) |
| `409`  | A fetch for this instrument is already in progress         |
| `502`  | CoinDesk returned an error or unexpected HTTP status       |
| `500`  | Database write failed                                      |

## Database

The schema is managed by [Drizzle ORM](https://orm.drizzle.team/). The table definition lives in `src/db/schema.ts` and is the single source of truth for both the database and TypeScript types.

### Migrations

```bash
# Generate a new migration after schema changes
pnpm db:generate

# Apply pending migrations to the database (requires DATABASE_URL in .env)
pnpm db:migrate
```

Migration files are stored in `src/db/migrations/` and should be committed to the repository.

## Environment Variables

See [`.env.example`](.env.example) for all variables with descriptions.

| Variable            | Required | Default | Description                     |
| ------------------- | -------- | ------- | ------------------------------- |
| `COINDESK_API_KEY`  | ✅       | —       | API key for CoinDesk requests   |
| `COINDESK_BASE_URL` | ✅       | —       | `https://data-api.coindesk.com` |
| `DATABASE_URL`      | ✅       | —       | PostgreSQL connection string    |
| `PORT`              | ❌       | `3002`  | Port the service listens on     |
| `LOG_LEVEL`         | ❌       | `info`  | Pino log level                  |
