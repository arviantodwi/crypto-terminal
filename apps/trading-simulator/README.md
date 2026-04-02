# trading-simulator

Backtesting engine for OHLCV-based trading strategies. Iterates through historical BTCUSDT 5-minute candles, runs a strategy against a sliding 3-candle window, and tracks portfolio performance (balance, SL/TP hits, P&L).

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

Run a backtest with the default dummy strategy:

```bash
pnpm start
```

Pass a strategy name and optional initial balance via environment variables or CLI args:

```bash
INSTRUMENT=BTCUSDT INITIAL_BALANCE=5000 pnpm start -- --strategy dummy
```

## Architecture

```
src/
├── config.ts               — Environment configuration
├── index.ts                — CLI entry point
├── db/
│   ├── client.ts           — Drizzle + pg.Pool setup
│   ├── schema.ts           — Read-only Drizzle schema (ohlcv_candles, pattern_probabilities)
│   └── queries.ts          — Data fetchers
└── engine/
    ├── types.ts            — Shared TypeScript interfaces
    ├── time-machine.ts     — Sliding 3-candle window iterator
    ├── portfolio.ts        — Balance and position tracker
    └── backtest-runner.ts  — Main orchestration loop
```

## Key Concepts

- **TimeMachine**: iterates candles in a sliding `[c1, c2, c3]` window, one step at a time
- **Portfolio**: holds at most one open position; checks SL/TP on every candle; computes P&L
- **BacktestRunner**: ties TimeMachine + Portfolio + strategy together in a single loop
- **StrategyRunner**: interface all strategies must implement — receives `[c1, c2, c3]` and returns a `TradeSignal` or `null`

## Database

Reads from the shared `crypto_terminal` PostgreSQL database:

| Table | Purpose |
|-------|---------|
| `public.ohlcv_candles` | Source OHLCV data (written by candle-collector) |
| `public.pattern_probabilities` | Precomputed pattern stats (written by probability-materializer) |
