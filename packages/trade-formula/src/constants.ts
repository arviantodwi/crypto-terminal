import type { ConvictionTier, Route } from './types.js';

// ── Candle classification thresholds ────────────────────────────────────────
// All pct_change and body_ratio boundary values from the formulations document
// (see README §1).

// biome-ignore assist/source/useSortedKeys: Clarity
export const CANDLE_THRESHOLDS = {
  // body_ratio boundaries (direction-agnostic — same threshold for up and down)
  BODY_RATIO_STRONG: 0.5,
  BODY_RATIO_MEDIUM: 0.4,
  BODY_RATIO_WEAK: 0.3,
  // pct_change boundaries (signed — down values are negative)
  PCT_DOWN_STRONG: -0.4,
  PCT_DOWN_MEDIUM: -0.2,
  PCT_DOWN_WEAK: -0.05,
  PCT_UP_STRONG: 0.4,
  PCT_UP_MEDIUM: 0.2,
  PCT_UP_WEAK: 0.05,
} as const;

// ── Probability tier boundaries ──────────────────────────────────────────────
// 68 / 75 / 80 thresholds that separate Skip → Moderate → High → Dominant
// (see README §2).

export const PROBABILITY_TIERS = {
  // DOMINANT_MIN: 71,
  // HIGH_MIN: 63,
  // MODERATE_MIN: 55,
  DOMINANT_MIN: 60,
  HIGH_MIN: 55,
  MODERATE_MIN: 50,
} as const;

// ── Leverage constraints ─────────────────────────────────────────────────────
// Binance requires ≥5 % margin → max 20x. Floor is always 1x (see README §9).

export const LEVERAGE_CONSTRAINTS = {
  MAX: 50,
  MIN: 1,
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
  // 5 eligible formulas (P1–P5) sorted ascending by risk; values are 0-based
  // indices, so 1 = 2nd of 5, 3 = 4th of 5, etc.
  // Higher conviction → smaller index → tighter formula.
  Pullback: {
    Dominant: 1, // 40th  → 2nd of 5
    High: 2, // 60th  → 3rd of 5
    Moderate: 3, // 80th  → 4th of 5
  },
  // 4 eligible formulas (R1, R2, R4, R5) sorted ascending by risk; values are
  // 0-based indices, so 1 = 2nd of 4, 3 = 4th of 4 (widest), etc.
  // Higher conviction → smaller index → tighter formula.
  Reversal: {
    Dominant: 1, // 50th  → 2nd of 4
    High: 2, // 75th  → 3rd of 4
    Moderate: 3, // 100th → 4th of 4 (widest)
  },
  // 4 eligible formulas (T1–T4) sorted ascending by risk; values are 0-based
  // indices into that array, so 0 = 1st of 4 (tightest), 2 = 3rd of 4, etc.
  // Higher conviction → smaller index → tighter (lower-risk) formula.
  Trend: {
    Dominant: 0, // 25th  → 1st of 4 (tightest)
    High: 1, // 50th  → 2nd of 4
    Moderate: 2, // 75th  → 3rd of 4
  },
};
