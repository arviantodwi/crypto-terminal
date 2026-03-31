# Probability Materializer Service

CLI tool that computes pattern probabilities from OHLCV candle data and stores the results in PostgreSQL. It analyzes 3-candle sequences to calculate the probability that the next (4th) candle will move up or down, enabling pattern-based trading signals.

## How it works

1. Reads `ohlcv_candles` from the database (populated by `candle-collector`)
2. Classifies each candle into a directional label using `pct_change` and `body_ratio`
3. Slides a 4-candle window across the series, grouping sequences by their 3-candle pattern
4. Calculates `up_probability` and `down_probability` for each unique pattern
5. Upserts results into the `pattern_probabilities` table

### Candle classification

Each candle is classified using `classifyCandle` from `@crypto-terminal/trade-formula`:

| Label                                     | Direction                                                                              |
| ----------------------------------------- | -------------------------------------------------------------------------------------- |
| `up_strong`, `up_medium`, `up_weak`       | Bullish                                                                                |
| `down_strong`, `down_medium`, `down_weak` | Bearish                                                                                |
| `flat`                                    | Excluded — candles classified as `flat` cause the entire 4-candle window to be skipped |

### Output schema (`pattern_probabilities`)

| Column                               | Description                          |
| ------------------------------------ | ------------------------------------ |
| `instrument`                         | Symbol, e.g. `BTCUSDT`               |
| `timeframe`                          | Candle interval, e.g. `5m`           |
| `c1_label`, `c2_label`, `c3_label`   | The 3-candle pattern                 |
| `occurrences`                        | How many times this pattern occurred |
| `up_count`, `down_count`             | Outcome counts                       |
| `up_probability`, `down_probability` | Outcome percentages (0–100)          |
| `computed_at`                        | Timestamp of last computation        |

Primary key: `(instrument, timeframe, c1_label, c2_label, c3_label)`. All writes are upserts — safe to re-run.

## Environment variables

| Variable       | Required | Default | Description                                                    |
| -------------- | -------- | ------- | -------------------------------------------------------------- |
| `DATABASE_URL` | Yes      | —       | PostgreSQL connection string                                   |
| `INSTRUMENT`   | Yes      | —       | Symbol to compute, e.g. `BTCUSDT`                              |
| `TIMEFRAME`    | No       | `5m`    | Candle timeframe                                               |
| `LOG_LEVEL`    | No       | `info`  | Pino log level (`trace` / `debug` / `info` / `warn` / `error`) |

Copy `.env.example` and fill in your values:

```bash
cp .env.example .env
```

## Usage

```bash
# Run the computation pipeline
pnpm run compute

# Database migrations
pnpm run db:generate   # generate migrations after schema changes
pnpm run db:migrate    # apply pending migrations

# Type-check
pnpm run typecheck
```

## Dependencies

- **Input:** `ohlcv_candles` table — must be populated by `apps/candle-collector`
- **Output:** `pattern_probabilities` table — consumed by downstream trading logic
- **Runtime:** Node.js ≥ 20, PostgreSQL
