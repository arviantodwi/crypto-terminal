import { classifyCandle } from '@crypto-terminal/trade-formula';
import type { ExecutedTrade, OhlcCandle, StrategyRunner, TradeSignal } from '../../engine/types.js';
import type { PatternProbability } from '../../db/schema.js';
import type { PatternBasedV1Config } from './config.js';
import { analyzePattern } from './analyzer.js';

// ── PatternBasedV1.2 strategy runner ──────────────────────────────────────────

/**
 * pattern-based-v1.2 strategy.
 *
 * Extends v1.1 with a refined adaptive TP multiplier. The initial `tpMultiplier`
 * from config is used until both sides of Profit Factor are available. Once
 * PF becomes finite (grossLoss > 0 && grossProfit > 0), the effective multiplier
 * adjusts each trade:
 *   - If current multiplier > PF → pull down to PF − 3% (converge cautiously)
 *   - If current multiplier ≤ PF → track PF directly (follow upside)
 *   - Hard floor of 1.10 (never below 1x growth)
 *   - Always stored at 2 decimal places.
 *
 * Instantiate via `loadStrategy('pattern-based-v1.2', db, config)` in loader.ts
 * rather than directly — the loader pre-populates the pattern cache from the DB.
 */
export class PatternBasedV11 implements StrategyRunner {
  readonly name = 'pattern-based-v1.2';
  readonly version = '1.2.0';

  private currentBalance: number;
  private grossProfit = 0;
  private grossLoss = 0;
  private effectiveTpMultiplier: number;

  constructor(
    private readonly config: PatternBasedV1Config,
    /** Pre-loaded pattern probability rows keyed by "c1:c2:c3" label string. */
    private readonly patternCache: Map<string, PatternProbability>,
  ) {
    this.currentBalance = config.initialBalance;
    this.effectiveTpMultiplier = config.tpMultiplier;
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

    return analyzePattern(
      candles,
      prob,
      { ...this.config, tpMultiplier: this.effectiveTpMultiplier },
      this.currentBalance,
    );
  }

  onTradeExecuted(trade: ExecutedTrade): void {
    this.currentBalance = Math.max(0, this.currentBalance + trade.pnlDollar);

    if (trade.pnlPercent > 0) {
      this.grossProfit += trade.pnlPercent;
    } else if (trade.pnlPercent < 0) {
      this.grossLoss += Math.abs(trade.pnlPercent);
    }

    // Switch to adaptive multiplier only once we have meaningful PF data (both
    // profit and loss). If the first trade is a loss, grossProfit is 0 and PF
    // would be 0, making tpPrice equal to entryPrice on the next signal.
    if (this.grossLoss > 0 && this.grossProfit > 0) {
      const pf = this.grossProfit / this.grossLoss;
      const raw = this.effectiveTpMultiplier > pf
        ? pf * 0.97  // above PF → converge downward with 3% buffer
        : pf;        // at or below PF → track PF directly
      this.effectiveTpMultiplier = Math.max(1.10, Math.round(raw * 100) / 100);
    }
  }

  getEffectiveTpMultiplier(): number {
    return this.effectiveTpMultiplier;
  }

  reset(): void {
    this.currentBalance = this.config.initialBalance;
    this.grossProfit = 0;
    this.grossLoss = 0;
    this.effectiveTpMultiplier = this.config.tpMultiplier;
  }
}
