# Strategy System

Each strategy is a self-contained directory under `src/strategies/` that implements the `StrategyRunner` interface from `../engine/types.ts`.

## Adding a New Strategy

1. Create a directory: `src/strategies/<strategy-name>/`
2. Add at minimum:
   - `index.ts` — exports a class implementing `StrategyRunner`
   - `config.ts` — extends `StrategyConfig` from `../base-config.ts`
3. Register the name in `loader.ts`

Strategies must be **self-contained**: no shared code between strategy directories. Each strategy owns its own logic, helpers, and configuration.

## Base Configuration

`base-config.ts` defines `StrategyConfig` with defaults:

| Field | Default | Description |
|---|---|---|
| `riskPct` | 3 | % of balance to risk per trade |
| `tpMultiplier` | 2 | TP distance = SL distance × multiplier |
| `convictionThreshold` | 68 | Minimum probability (%) to take a trade |

## Loading a Strategy

```typescript
import { loadStrategy } from './strategies/loader.js';

const strategy = await loadStrategy('pattern-based-v1', db, {
  instrument: 'BTCUSDT',
  timeframe: '5m',
  initialBalance: 1000,
});
```

`loadStrategy` handles any async initialisation (e.g. DB pre-loading) before returning a ready-to-use `StrategyRunner`.

## Implemented Strategies

### `pattern-based-v1`

Full `@crypto-terminal/trade-formula` pipeline driven by historical pattern probabilities.

**Pipeline:**
1. Classify [c1, c2, c3] into directional labels
2. Look up `up_probability` / `down_probability` from `pattern_probabilities` table
3. Skip if no match or neither direction meets `convictionThreshold`
4. Pre-compute momentum scores, sequence slope, volatility proxy, directional agreement, wick ratios
5. Discriminate route (Trend / Reversal / Pullback)
6. Detect Postgres ↔ structural direction conflict
7. Compute all 5 group formulas for the route (T1–T5, R1–R5, or P1–P5)
8. Select SL% via percentile banding (route × conviction tier)
9. Calculate `slPrice`, `tpPrice`, `leverage`, `dollarRisk`

**CLI usage:**
```bash
pnpm start --strategy=pattern-based-v1
```

**Entry price:** `c3.close` (close of the third candle in the window).

All pre-computation values and formula outputs are stored in `TradeSignal.metadata` for inspection and TUI display.
