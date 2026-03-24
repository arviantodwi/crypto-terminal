import type { ConvictionTier, Route } from './types.js';

// ── Candle classification thresholds ────────────────────────────────────────
// All pct_change and body_ratio boundary values from the formulations document
// (see README §1).

export const CANDLE_THRESHOLDS = {
  // pct_change boundaries (signed — down values are negative)
  PCT_UP_STRONG: 1.5,
  PCT_UP_MEDIUM: 0.5,
  PCT_UP_WEAK: 0.1,
  PCT_DOWN_STRONG: -1.5,
  PCT_DOWN_MEDIUM: -0.5,
  PCT_DOWN_WEAK: -0.1,

  // body_ratio boundaries
  BODY_UP_STRONG: 0.5,
  BODY_UP_MEDIUM: 0.4,
  BODY_UP_WEAK: 0.3,
  BODY_DOWN_STRONG: 0.5,
  BODY_DOWN_MEDIUM: 0.4,
  BODY_DOWN_WEAK: 0.3,
} as const;

// ── Probability tier boundaries ──────────────────────────────────────────────
// 68 / 75 / 80 thresholds that separate Skip → Moderate → High → Dominant
// (see README §2).

export const PROBABILITY_TIERS = {
  MODERATE_MIN: 68,
  HIGH_MIN: 75,
  DOMINANT_MIN: 80,
} as const;

// ── Leverage constraints ─────────────────────────────────────────────────────
// Binance requires ≥5 % margin → max 20x. Floor is always 1x (see README §9).

export const LEVERAGE_CONSTRAINTS = {
  MIN: 1,
  MAX: 20,
} as const;

// ── Percentile banding matrix ────────────────────────────────────────────────
// Full Route × ConvictionTier → 0-indexed position in the ascending-sorted
// eligible formula array (see README §6).
//
// Example: PERCENTILE_MATRIX.Trend.Moderate === 2
//   → pick the element at index 2 (3rd of 4) from the sorted eligible list.

type TradingConviction = Exclude<ConvictionTier, 'Skip'>;
type PercentileMatrix = Record<Route, Record<TradingConviction, number>>;

export const PERCENTILE_MATRIX: PercentileMatrix = {
  // 4 eligible formulas: T1, T2, T3, T4
  Trend: {
    Moderate: 2, // 75th  → 3rd of 4
    High: 1,     // 50th  → 2nd of 4
    Dominant: 0, // 25th  → 1st of 4 (tightest)
  },
  // 4 eligible formulas: R1, R2, R4, R5
  Reversal: {
    Moderate: 3, // 100th → 4th of 4 (widest)
    High: 2,     // 75th  → 3rd of 4
    Dominant: 1, // 50th  → 2nd of 4
  },
  // 5 eligible formulas: P1, P2, P3, P4, P5
  Pullback: {
    Moderate: 3, // 80th  → 4th of 5
    High: 2,     // 60th  → 3rd of 5
    Dominant: 1, // 40th  → 2nd of 5
  },
};
