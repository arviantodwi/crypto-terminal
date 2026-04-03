# Strategy Development Guide

Each strategy is a self-contained directory under `src/strategies/` that implements the `StrategyRunner` interface from `../engine/types.ts`.

## Strategy Interface

```typescript
interface StrategyRunner {
  name: string;
  version: string;
  analyze(candles: [OhlcCandle, OhlcCandle, OhlcCandle]): TradeSignal | null;
  onTradeExecuted(trade: ExecutedTrade): void;
}
```

### `analyze(candles)`

Called on every 3-candle window. Return a `TradeSignal` to open a position, or `null` to skip the bar.

- `candles[0]` = c1 (oldest)
- `candles[1]` = c2 (middle)
- `candles[2]` = c3 (signal bar — most recent)

The returned signal must satisfy these constraints (enforced by `Portfolio.openPosition()`):

| Field | Constraint |
|---|---|
| `dollarRisk` | Must be > 0 |
| `entryPrice` | Must be > 0 |
| `slPrice` (LONG) | Must be < `entryPrice` |
| `tpPrice` (LONG) | Must be > `entryPrice` |
| `slPrice` (SHORT) | Must be > `entryPrice` |
| `tpPrice` (SHORT) | Must be < `entryPrice` |

Violations throw and halt the backtest. Always validate price levels before returning a signal.

### `onTradeExecuted(trade)`

Called after every completed trade. Use this to update internal state (e.g. track consecutive
losses, adjust position sizing, reset indicators).

### `analyze()` must be synchronous

The backtest loop is synchronous. Pre-load all required data in the constructor (e.g. DB queries,
probability tables). See `pattern-based-v1` for an example of constructor-time pre-loading.

### Error handling

If `analyze()` throws:
- The `BacktestRunner` emits a `strategyError` event and skips the candle (default)
- If `haltOnStrategyError: true` is set, the runner throws instead

## Base Configuration

`base-config.ts` defines `StrategyConfig` with defaults:

| Field | Default | Description |
|---|---|---|
| `instrument` | (required) | Instrument symbol, e.g. `'BTCUSDT'` |
| `timeframe` | (required) | Candle timeframe, e.g. `'5m'` |
| `initialBalance` | (required) | Starting account balance in USD |
| `riskPct` | 3 | % of balance to risk per trade |
| `tpMultiplier` | 2 | TP distance = SL distance × multiplier |
| `convictionThreshold` | 68 | Minimum probability (%) to enter a trade |

## Adding a New Strategy

1. Create a directory: `src/strategies/<strategy-name>/`
2. Add at minimum:
   - `index.ts` — exports a class implementing `StrategyRunner`
   - `config.ts` — exports a factory that merges caller-supplied config with `BASE_STRATEGY_CONFIG`
3. Register the name in `loader.ts`:
   - Add it to the `KNOWN_STRATEGIES` tuple
   - Add a branch in `loadStrategy()` to construct it

Strategies must be **self-contained**: no shared code between strategy directories.

## Loading a Strategy

```typescript
import { loadStrategy } from './strategies/loader.js';

const strategy = await loadStrategy('pattern-based-v1', db, {
  instrument: 'BTCUSDT',
  timeframe: '5m',
  initialBalance: 1000,
});
```

`loadStrategy` handles async initialisation (e.g. DB pre-loading) before returning a ready-to-use `StrategyRunner`.

## Skeleton Strategy

```typescript
// src/strategies/my-strategy/index.ts
import type { ExecutedTrade, OhlcCandle, StrategyRunner, TradeSignal } from '../../engine/types.js';
import type { StrategyConfig } from '../base-config.js';

export class MyStrategy implements StrategyRunner {
  readonly name = 'my-strategy';
  readonly version = '0.1.0';

  private readonly config: StrategyConfig;

  constructor(config: StrategyConfig) {
    this.config = config;
  }

  analyze(candles: [OhlcCandle, OhlcCandle, OhlcCandle]): TradeSignal | null {
    const [_c1, _c2, c3] = candles;

    // Example: enter LONG on a bullish bar, SL at candle low
    const isBullish = c3.close > c3.open;
    if (!isBullish) return null;

    const entry = c3.close;
    const slDist = entry - c3.low;
    if (slDist <= 0) return null;

    return {
      direction: 'LONG',
      entryPrice: entry,
      slPrice: entry - slDist,
      tpPrice: entry + slDist * this.config.tpMultiplier,
      leverage: 1,
      dollarRisk: this.config.initialBalance * (this.config.riskPct / 100),
      metadata: {},
    };
  }

  onTradeExecuted(_trade: ExecutedTrade): void {
    // Update internal state after each closed trade (optional)
  }
}
```

## Implemented Strategies

### `pattern-based-v1`

Full `@crypto-terminal/trade-formula` pipeline driven by historical pattern probabilities.

**Pipeline:**
1. Classify [c1, c2, c3] into directional labels
2. Look up `up_probability` / `down_probability` from the pre-loaded pattern cache
3. Skip if no match or neither direction meets `convictionThreshold`
4. Pre-compute momentum scores, sequence slope, volatility proxy, directional agreement, wick ratios
5. Discriminate route (Trend / Reversal / Pullback)
6. Detect Postgres ↔ structural direction conflict
7. Compute all 5 group formulas for the route (T1–T5, R1–R5, or P1–P5)
8. Select SL% via percentile banding (route × conviction tier)
9. Calculate `slPrice`, `tpPrice`, `leverage`, `dollarRisk`

**Entry price:** `c3.close`. All intermediate values are stored in `TradeSignal.metadata`.

## Best Practices

- **Return `null` by default** — only signal when all conditions are met
- **Validate SL/TP before returning** — a signal with `slPrice >= entryPrice` (LONG) throws in the portfolio
- **Use `metadata` for debugging** — intermediate values are preserved in the trade log and exported to JSON/CSV
- **Handle zero denominators** — check for `slDist <= 0` before dividing
- **Test your strategy** — add a test file in `tests/` that verifies signals against known candle sequences (see `tests/pattern-based-v1.test.ts`)
