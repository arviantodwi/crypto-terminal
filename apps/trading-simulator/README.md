# trading-simulator

Backtesting engine for OHLCV-based trading strategies. Iterates through historical BTCUSDT 5-minute candles, runs a strategy against a sliding 3-candle window, and tracks portfolio performance (balance, SL/TP hits, P&L).

## Prerequisites

- Node.js >= 20
- PostgreSQL database populated by `candle-collector` and `probability-materializer`
- pnpm (installed from the monorepo root)

## Setup

1. Copy `.env.example` to `.env` and set the required variables:

```env
DATABASE_URL=postgres://user:password@localhost:5432/crypto_terminal
INSTRUMENT=BTCUSDT
TIMEFRAME=5m
INITIAL_BALANCE=1000
LOG_LEVEL=info
```

2. Install dependencies from the monorepo root:

```bash
pnpm install
```

## Usage

### Interactive TUI

Run the full interactive terminal UI:

```bash
pnpm tui
```

Use a specific strategy:

```bash
pnpm tui -- --strategy=pattern-based-v1
```

### CLI Backtest (headless-friendly)

Run a backtest and print results to stdout:

```bash
pnpm start
pnpm start -- --strategy=pattern-based-v1
```

Override environment variables via CLI flags:

```bash
# Set initial balance
pnpm start -- --strategy=pattern-based-v1 --balance=5000

# Set risk percent per trade
pnpm start -- --strategy=pattern-based-v1 --risk=2

# Halt on first strategy error instead of skipping
pnpm start -- --strategy=pattern-based-v1 --halt-on-error
```

### Headless Mode (CI / Automation)

Run a backtest without a TUI and auto-save results to JSON + CSV:

```bash
pnpm start -- --headless --strategy=pattern-based-v1
```

Save to a specific output file:

```bash
pnpm start -- --headless --strategy=pattern-based-v1 --output=results.json
```

The `--output` flag can also be used without `--headless` to save results after a non-interactive run:

```bash
pnpm start -- --strategy=pattern-based-v1 --output=run-2024-01-15.json
```

### CLI Flags Reference

| Flag | Description | Default |
|------|-------------|---------|
| `--strategy=<name>` | Strategy to run | `dummy` |
| `--balance=<number>` | Initial balance in USD | From `INITIAL_BALANCE` env |
| `--risk=<number>` | Risk % per trade (0–100) | From strategy default |
| `--headless` | Run without TUI, auto-save on completion | `false` |
| `--output=<path>` | Output JSON file path | Auto-generated filename |
| `--halt-on-error` | Halt on first strategy error instead of skipping | `false` |

## Keyboard Controls (TUI)

| Key | Action |
|-----|--------|
| `Space` | Start / Pause / Resume |
| `R` | Restart backtest |
| `S` | Save results to JSON + CSV |
| `Q` | Quit |
| `↑` | Increase speed |
| `↓` | Decrease speed |

### Speed Levels

| Level | Description |
|-------|-------------|
| `1×` | 1 candle per 100ms — real-time feel |
| `10×` | 1 candle per 10ms |
| `100×` | 10 candles per 10ms |
| `1000×` | 100 candles per 10ms |
| `MAX` | 5000 candles per 10ms — as fast as possible |

## Interpreting Results

### Performance Metrics

| Metric | Description |
|--------|-------------|
| **Win Rate** | % of trades that hit TP (denominator includes break-evens) |
| **Total P&L** | Net P&L as % of initial balance |
| **Max Drawdown** | Largest peak-to-trough equity decline (negative %) |
| **Sharpe Ratio** | Annualized risk-adjusted return (5-min candle basis) |
| **Profit Factor** | Gross profit / gross loss (∞ = no losses) |
| **Expected Value** | Average P&L per trade (%) |
| **Avg Win / Avg Loss** | Average winning / losing trade size (%) |
| **Largest Win / Loss** | Best and worst single trades (%) |
| **Avg Hold Time** | Average time between entry and exit (hours) |

### Trade Log

Each trade records:
- **ID** — sequential trade number
- **Direction** — `LONG` or `SHORT`
- **Entry / SL / TP / Exit** — price levels
- **Exit Reason** — `SL` (stop-loss) or `TP` (take-profit)
- **P&L** — in USD and as % of balance at close time
- **Metadata** — strategy-specific data (pattern labels, formula outputs, etc.)

### SL vs TP Priority

When both SL and TP are hit within the same candle (candle range spans both levels), **SL takes priority**. This is a conservative assumption — in live trading the order of execution is unknown.

## Saving and Exporting Results

### JSON Export

Saved via `S` key in TUI or automatically in headless mode. Format:

```json
{
  "metadata": {
    "strategy": "pattern-based-v1",
    "instrument": "BTCUSDT",
    "timeframe": "5m",
    "initialBalance": 1000,
    "finalBalance": 1128.45,
    "runDate": "2024-01-15T14:35:00Z",
    "strategyErrors": 0
  },
  "trades": [...],
  "metrics": { ... }
}
```

Default filename: `backtest-<strategy>-<timestamp>.json`

### CSV Export

A `.csv` file is saved alongside the JSON. Columns:

```
id, strategyName, strategyVersion, entryTimestamp, exitTimestamp, direction,
entryPrice, slPrice, tpPrice, exitPrice, exitReason, pnlPercent, pnlDollar,
leverage, metadata
```

The CSV is safe to open in spreadsheet applications — formula injection characters (`=`, `+`, `-`, `@`) are quoted automatically.

## Architecture

```
src/
├── config.ts               — Environment configuration
├── index.ts                — CLI entry point (parse args, run backtest, save results)
├── tui.tsx                 — Interactive TUI entry point (React/Ink)
├── db/
│   ├── client.ts           — Drizzle + pg.Pool setup
│   ├── schema.ts           — Read-only Drizzle schemas
│   └── queries.ts          — Data fetchers (candles, pattern probabilities)
├── engine/
│   ├── types.ts            — Core interfaces (OhlcCandle, TradeSignal, BacktestResults, …)
│   ├── time-machine.ts     — Sliding 3-candle window iterator
│   ├── portfolio.ts        — Balance and position tracker with SL/TP validation
│   └── backtest-runner.ts  — Main orchestration loop (EventEmitter)
├── shared/
│   ├── types.ts            — LoggedTrade, EquityPoint
│   ├── execution-log.ts    — InMemoryTradeLog (JSON/CSV export)
│   ├── metrics.ts          — 15+ performance metric functions
│   └── pattern-display.ts  — ASCII candle rendering for TUI
├── strategies/
│   ├── README.md           — Strategy development guide
│   ├── base-config.ts      — Shared StrategyConfig interface and defaults
│   ├── loader.ts           — Strategy registry and factory
│   └── pattern-based-v1/  — Full trade-formula pipeline strategy
└── tui/
    ├── App.tsx             — Root TUI component
    ├── hooks/
    │   ├── useBacktest.ts  — Simulation loop and state management
    │   └── useKeyboard.ts  — Keyboard event handlers
    ├── components/         — Header, TradeLog, PerformanceMetrics, PatternDisplay, …
    └── utils/formatting.ts — Currency, percent, timestamp formatters
```

## Key Concepts

- **TimeMachine** — iterates candles in a sliding `[c1, c2, c3]` window, one step at a time
- **Portfolio** — holds at most one open position; validates signal prices; checks SL/TP on every candle
- **BacktestRunner** — ties TimeMachine + Portfolio + strategy together; emits events for trades and errors
- **StrategyRunner** — interface all strategies implement; receives `[c1, c2, c3]` and returns a `TradeSignal` or `null`
- **InMemoryTradeLog** — collects all executed trades for JSON/CSV export

## Error Handling

### Strategy errors

If `strategy.analyze()` throws, the runner emits a `strategyError` event, increments `strategyErrorCount`, and skips the candle. Set `--halt-on-error` to stop on the first error instead.

### Database errors

Connection failures and query errors are caught in `main()` with a descriptive log message and a non-zero exit code.

### Signal validation

`Portfolio.openPosition()` validates every signal before opening a position:
- `dollarRisk > 0`
- `entryPrice > 0`
- LONG: `slPrice < entryPrice` and `tpPrice > entryPrice`
- SHORT: `slPrice > entryPrice` and `tpPrice < entryPrice`

## Testing

```bash
pnpm test           # run all tests once
pnpm test:watch     # watch mode
pnpm typecheck      # TypeScript type checking
```

Tests cover:
- `engine-time-machine` — window iteration, progress, edge cases
- `engine-portfolio` — position lifecycle, P&L calculation, signal validation
- `engine-backtest-runner` — integration tests, error handling, trade lifecycle
- `shared-metrics` — all 15 metric functions with edge cases
- `shared-execution-log` — JSON/CSV export, formula injection protection
- `shared-pattern-display` — ASCII candle rendering
- `pattern-based-v1` — strategy pipeline against known worked examples

## Database

Reads from the shared `crypto_terminal` PostgreSQL database:

| Table | Purpose |
|-------|---------|
| `public.ohlcv_candles` | Source OHLCV data (written by `candle-collector`) |
| `public.pattern_probabilities` | Precomputed pattern stats (written by probability-materializer) |

## Known Limitations

- **Single instrument** — BTCUSDT only (configurable via `INSTRUMENT` env)
- **No date range selection** — always runs the full available history
- **No multi-strategy comparison** — one strategy per run
- **No commission/slippage modeling** — P&L is based on exact SL/TP prices
- **Single open position** — cannot hold multiple positions simultaneously
- **SL priority assumption** — when a candle spans both SL and TP, SL wins (conservative)
- **Sharpe ratio fixed for 5m candles** — annualization factor assumes 288 candles/day

## Troubleshooting

**`[config] Missing required environment variable: DATABASE_URL`**
→ Create a `.env` file from `.env.example` and fill in your database URL.

**`[db] Failed to connect to database`**
→ Verify that PostgreSQL is running and `DATABASE_URL` is correct.

**`[backtest] Not enough candles`**
→ Ensure `candle-collector` has populated the `ohlcv_candles` table for the configured instrument and timeframe.

**`[cli] Unknown strategy`**
→ Check available strategies with `grep KNOWN_STRATEGIES src/strategies/loader.ts`.

**TUI appears garbled**
→ Ensure your terminal is at least 120×40. Resize and restart with `R`.
