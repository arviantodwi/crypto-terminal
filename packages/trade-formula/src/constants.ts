import type { Route, ConvictionTier } from "./types.js";

export const CANDLE_THRESHOLDS = {
  PCT_UP_STRONG: 1.5,
  PCT_UP_MEDIUM: 0.5,
  PCT_UP_WEAK: 0.1,
  PCT_DOWN_STRONG: -1.5,
  PCT_DOWN_MEDIUM: -0.5,
  PCT_DOWN_WEAK: -0.1,
  BODY_STRONG: 0.5,
  BODY_MEDIUM: 0.4,
  BODY_WEAK: 0.3,
} as const;

export const PROBABILITY_TIERS = {
  MODERATE_MIN: 68,
  HIGH_MIN: 75,
  DOMINANT_MIN: 80,
} as const;

export const LEVERAGE_CONSTRAINTS = {
  MIN: 1,
  MAX: 20,
} as const;

/**
 * Maps Route × ConvictionTier to 0-indexed position in a sorted ascending
 * array of eligible formula outputs.
 *
 * Trend:    4 eligible → Moderate→2, High→1, Dominant→0
 * Reversal: 4 eligible → Moderate→3, High→2, Dominant→1
 * Pullback: 5 eligible → Moderate→3, High→2, Dominant→1
 */
export const PERCENTILE_MATRIX: Record<
  Route,
  Record<Exclude<ConvictionTier, "Skip">, number>
> = {
  Trend: {
    Moderate: 2,
    High: 1,
    Dominant: 0,
  },
  Reversal: {
    Moderate: 3,
    High: 2,
    Dominant: 1,
  },
  Pullback: {
    Moderate: 3,
    High: 2,
    Dominant: 1,
  },
} as const;
