import { classifyCandle } from '@crypto-terminal/trade-formula';
import type { ExecutedTrade, OhlcCandle, StrategyRunner, TradeSignal } from '../../engine/types.js';
import type { PatternProbability } from '../../db/schema.js';
import type { PatternBasedV1Config } from './config.js';
import { analyzePattern } from './analyzer.js';

// ── PatternBasedV1 strategy runner ────────────────────────────────────────────

/**
 * pattern-based-v1 strategy.
 *
 * Uses a 3-candle pattern classification + historical probability lookup
 * (pre-loaded from `pattern_probabilities`) to generate trade signals via the
 * full `@crypto-terminal/trade-formula` pipeline.
 *
 * Instantiate via `loadStrategy('pattern-based-v1', db, config)` in loader.ts
 * rather than directly — the loader pre-populates the pattern cache from the DB.
 */
export class PatternBasedV1 implements StrategyRunner {
  readonly name = 'pattern-based-v1';
  readonly version = '1.0.0';

  private currentBalance: number;

  constructor(
    private readonly config: PatternBasedV1Config,
    /** Pre-loaded pattern probability rows keyed by "c1:c2:c3" label string. */
    private readonly patternCache: Map<string, PatternProbability>,
  ) {
    this.currentBalance = config.initialBalance;
  }

  analyze(candles: [OhlcCandle, OhlcCandle, OhlcCandle]): TradeSignal | null {
    const [c1, c2, c3] = candles;

    // Build the cache key from candle labels for O(1) pattern lookup.
    // classifyCandle is pure — the cost is negligible, and the analyzer
    // will re-derive labels internally as part of the full pipeline.
    const key = [
      classifyCandle(c1.pct_change, c1.body_ratio),
      classifyCandle(c2.pct_change, c2.body_ratio),
      classifyCandle(c3.pct_change, c3.body_ratio),
    ].join(':');

    const prob = this.patternCache.get(key) ?? null;

    return analyzePattern(candles, prob, this.config, this.currentBalance);
  }

  onTradeExecuted(trade: ExecutedTrade): void {
    this.currentBalance = Math.max(0, this.currentBalance + trade.pnlDollar);
  }
}
