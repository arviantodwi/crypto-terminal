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
pnpm build && pnpm start
```

The service listens on `PORT` (default: `3002`).

## Endpoints

### `GET /health`

Returns `200 { "status": "ok" }` — confirms the process is alive.

---

### `POST /ohlc/fetch`

Fetches a fixed number of pages from CoinDesk and upserts them into PostgreSQL. Returns a JSON summary when complete.

**Request body:**

```json
{
  "instrument": "BTCUSDT",
  "to_ts": 1773926478,
  "aggregate": 5,
  "pages": 10
}
```

| Field        | Type    | Required | Default | Description                                                                                                                                                         |
| ------------ | ------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `instrument` | string  | ✅       | —       | CoinDesk instrument identifier                                                                                                                                      |
| `to_ts`      | integer | ❌       | now     | Unix timestamp — start paginating backwards from here. Defaults to the closest interval boundary before now                                                         |
| `aggregate`  | integer | ❌       | `5`     | Candle width in minutes (e.g. `5` → 5m, `15` → 15m, `60` → 1h)                                                                                                     |
| `pages`      | integer | ❌       | `10`    | Number of pages to fetch. Each page returns up to `floor(2000 / aggregate)` candles (e.g. 400 at `aggregate=5`, 2000 at `aggregate=1`). Max `20` |

**Response `200`:**

```json
{
  "instrument": "BTCUSDT",
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

| Status | Cause                                                       |
| ------ | ----------------------------------------------------------- |
| `400`  | Validation failure (missing required fields, `pages` > 20) |
| `409`  | A fetch for this instrument is already in progress          |
| `502`  | CoinDesk returned an error or unexpected response           |
| `500`  | Database write failed                                       |

---

### `POST /ohlc/seed`

Long-running seeding operation that streams progress as NDJSON. Supports two phases that can be used independently or together:

- **Forward fill** (`forward_fill: true`): fetches pages from the newest existing candle up to the present, filling any gap since the last run.
- **Backward fill** (`numbers: N`): fetches pages backwards from the oldest existing candle until the total candle count for the instrument+timeframe reaches `N`.

At least one of `forward_fill` or `numbers` must be provided.

**Request body:**

```json
{
  "instrument": "BTCUSDT",
  "aggregate": 5,
  "forward_fill": true,
  "numbers": 500000
}
```

| Field          | Type    | Required | Default | Description                                                                               |
| -------------- | ------- | -------- | ------- | ----------------------------------------------------------------------------------------- |
| `instrument`   | string  | ✅       | —       | CoinDesk instrument identifier                                                            |
| `aggregate`    | integer | ❌       | `5`     | Candle width in minutes                                                                   |
| `forward_fill` | boolean | ❌       | `false` | Fill gaps from the newest stored candle to the present                                    |
| `numbers`      | integer | ❌       | —       | Target total candle count for this instrument+timeframe. Backward fill stops when reached |

**Response `200` — streaming NDJSON:**

The connection stays open and the server writes one JSON object per line. Object shapes by `status`:

| `status`         | Key fields                                                                         | Description                                    |
| ---------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------- |
| `notification`   | `message`                                                                          | Informational message (e.g. already up-to-date) |
| `progress`       | `phase`, `page`, `total_pages`, `inserted`, `skipped`, `earliest_ts`, `ratelimit_remaining` | One event per page fetched                     |
| `phase_complete` | `phase`, `pages_fetched`, `inserted`, `skipped`                                    | Emitted after each phase completes             |
| `done`           | `pages_fetched`, `total_inserted`, `total_skipped`, `earliest_candle_ts`, `latest_candle_ts`, `duration_ms` | Final event — stream closes after this         |
| `error`          | `phase`, `page`, `message`                                                         | Unrecoverable error — stream closes after this |

**Error codes (pre-flight, JSON body):**

| Status | Cause                                                                     |
| ------ | ------------------------------------------------------------------------- |
| `400`  | Validation failure, or existing count already meets or exceeds `numbers`  |
| `409`  | A fetch for this instrument is already in progress                        |

#### Using `seed.sh`

`scripts/seed.sh` is a developer convenience wrapper that calls `/ohlc/seed` and renders a live
progress bar in the terminal. On success it automatically runs `probability-materializer` for the
same instrument and timeframe. Pass `--skip-materialize` to skip that step.

**Dependencies:** `curl`, `jq`

```bash
bash scripts/seed.sh -f                              # forward fill only
bash scripts/seed.sh -n 500000                       # backward fill to 500k candles
bash scripts/seed.sh -f -n 500000                    # forward fill, then backward fill
bash scripts/seed.sh -f -n 500000 --skip-materialize # skip materializer
INSTRUMENT=ETHUSDT bash scripts/seed.sh -f -n 500000
```

**Flags:**

| Flag                   | Description                                                              |
| ---------------------- | ------------------------------------------------------------------------ |
| `-f`, `--forward-fill` | Enable forward fill phase                                                |
| `-n`, `--numbers <N>`  | Backward fill target (must be a positive integer)                        |
| `--skip-materialize`   | Skip the automatic `probability-materializer` run after successful seed  |

**Environment variables (override defaults):**

| Variable     | Default                   |
| ------------ | ------------------------- |
| `BASE_URL`   | `http://localhost:3002`   |
| `INSTRUMENT` | `BTCUSDT`                 |
| `AGGREGATE`  | `5`                       |

---

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

| Variable               | Required | Default | Description                                                              |
| ---------------------- | -------- | ------- | ------------------------------------------------------------------------ |
| `COINDESK_API_KEY`     | ✅       | —       | API key for CoinDesk requests                                            |
| `COINDESK_BASE_URL`    | ✅       | —       | `https://data-api.coindesk.com`                                          |
| `DATABASE_URL`         | ✅       | —       | PostgreSQL connection string                                             |
| `PORT`                 | ❌       | `3002`  | Port the service listens on                                              |
| `LOG_LEVEL`            | ❌       | `info`  | Pino log level (`trace`, `debug`, `info`, `warn`, `error`, `fatal`)      |
| `SEED_PAGES_DELAY_MS`  | ❌       | `100`   | Delay between CoinDesk API pages during seeding (ms). `0` disables it   |
