import { classifyCandle } from '@crypto-terminal/trade-formula';
import type { ExecutedTrade, OhlcCandle, StrategyRunner, TradeSignal } from '../../engine/types.js';
import type { PatternProbability } from '../../db/schema.js';
import type { PatternBasedV1Config } from './config.js';
import { analyzePattern } from './analyzer.js';

// ── PatternBasedV1.3 strategy runner ──────────────────────────────────────────

/**
 * pattern-based-v1.3 strategy.
 *
 * Extends v1.2.1 with adaptive risk adjustment:
 *   - After 2 consecutive losses, reduce effective risk by 0.25% per additional
 *     consecutive loss (i.e. reduction kicks in on the 2nd loss and compounds
 *     if losses continue).
 *   - On the first winning trade, reset effective risk to config riskPct.
 *
 * The adaptive TP multiplier from v1.2.1 is retained unchanged:
 *   - If current multiplier > PF  → step down 3% of current multiplier
 *   - If current multiplier < PF  → track PF directly
 *   - If multiplier drops to ≤ 1.10 → reset to config tpMultiplier
 *
 * Instantiate via `loadStrategy('pattern-based-v1.3', db, config)` in
 * loader.ts rather than directly — the loader pre-populates the pattern cache
 * from the DB.
 */
export class PatternBasedV13 implements StrategyRunner {
  readonly name = 'pattern-based-v1.3';
  readonly version = '1.3.0';

  private currentBalance: number;
  private grossProfit = 0;
  private grossLoss = 0;
  private effectiveTpMultiplier: number;
  private effectiveRiskPct: number;
  private consecutiveLosses = 0;

  constructor(
    private readonly config: PatternBasedV1Config,
    /** Pre-loaded pattern probability rows keyed by "c1:c2:c3" label string. */
    private readonly patternCache: Map<string, PatternProbability>,
  ) {
    this.currentBalance = config.initialBalance;
    this.effectiveTpMultiplier = config.tpMultiplier;
    this.effectiveRiskPct = config.riskPct;
  }

  analyze(candles: [OhlcCandle, OhlcCandle, OhlcCandle]): TradeSignal | null {
    const [c1, c2, c3] = candles;

    const key = [
      classifyCandle(c1.pct_change, c1.body_ratio),
      classifyCandle(c2.pct_change, c2.body_ratio),
      classifyCandle(c3.pct_change, c3.body_ratio),
    ].join(':');

    const prob = this.patternCache.get(key) ?? null;

    return analyzePattern(
      candles,
      prob,
      { ...this.config, tpMultiplier: this.effectiveTpMultiplier, riskPct: this.effectiveRiskPct },
      this.currentBalance,
    );
  }

  onTradeExecuted(trade: ExecutedTrade): void {
    this.currentBalance = Math.max(0, this.currentBalance + trade.pnlDollar);

    if (trade.pnlPercent > 0) {
      this.grossProfit += trade.pnlPercent;
      // Win → reset both consecutive loss counter and risk
      this.consecutiveLosses = 0;
      this.effectiveRiskPct = this.config.riskPct;
    } else if (trade.pnlPercent < 0) {
      this.grossLoss += Math.abs(trade.pnlPercent);
      this.consecutiveLosses++;
      // Reduce risk starting from the 3rd consecutive loss
      if (this.consecutiveLosses >= 3) {
        // this.effectiveRiskPct = Math.max(1.5, this.effectiveRiskPct - 0.33);
        this.effectiveRiskPct = Math.max(1.5, this.effectiveRiskPct * 0.8);
        this.consecutiveLosses = 0
      }
    }

    // Adaptive TP multiplier (v1.2.1 logic)
    if (this.grossLoss > 0 && this.grossProfit > 0) {
      const pf = this.grossProfit / this.grossLoss;
      const raw = this.effectiveTpMultiplier > pf
        ? this.effectiveTpMultiplier * 0.97  // above PF → step down 3% of current multiplier
        : pf;                                // below PF → track PF directly

      const next = Math.round(raw * 100) / 100;

      // If the multiplier has fallen to the floor, reset to config default.
      this.effectiveTpMultiplier = next <= 1.10 ? this.config.tpMultiplier : next;
    }
  }

  getEffectiveTpMultiplier(): number {
    return this.effectiveTpMultiplier;
  }

  getEffectiveRiskPct(): number {
    return this.effectiveRiskPct;
  }

  reset(): void {
    this.currentBalance = this.config.initialBalance;
    this.grossProfit = 0;
    this.grossLoss = 0;
    this.effectiveTpMultiplier = this.config.tpMultiplier;
    this.effectiveRiskPct = this.config.riskPct;
    this.consecutiveLosses = 0;
  }
}
