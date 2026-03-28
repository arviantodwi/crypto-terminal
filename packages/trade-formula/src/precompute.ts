import { labelSign } from './helper/label.js';
import type { CandleLabel } from './types.js';

/**
 * Momentum score for a single candle: pct_change × body_ratio.
 * Filters noise — only counts moves backed by body strength (see README §3).
 */
export function calcMomentumScore(pct_change: number, body_ratio: number): number {
  return pct_change * body_ratio;
}

/**
 * Sequence slope across the 3-candle window: c3.pct_change - c1.pct_change.
 * Positive = accelerating, negative = fading, sign flip = reversal (see README §3).
 */
export function calcSequenceSlope(c1_pct_change: number, c3_pct_change: number): number {
  return c3_pct_change - c1_pct_change;
}

/**
 * Wick ratio for a single candle: 1 - body_ratio.
 * High value = more rejection / noisy price action (see README §3).
 */
export function calcWickRatio(body_ratio: number): number {
  return 1 - body_ratio;
}

/**
 * Volatility proxy: average candle_range across the 3-candle window.
 * Direction-agnostic noise level (see README §3).
 */
export function calcVolatilityProxy(
  c1_candle_range: number,
  c2_candle_range: number,
  c3_candle_range: number,
): number {
  return (c1_candle_range + c2_candle_range + c3_candle_range) / 3;
}

/**
 * Directional agreement: sign(c1) + sign(c2) + sign(c3).
 * up_* = +1, down_* = -1. Possible results: ±3 (all same) or ±1 (2-vs-1).
 * Throws if any label is 'flat' — flat candles must be excluded before calling (see README §3).
 */
export function calcDirectionalAgreement(
  c1_label: CandleLabel,
  c2_label: CandleLabel,
  c3_label: CandleLabel,
): -3 | -1 | 1 | 3 {
  let sum: number;
  try {
    sum = labelSign(c1_label) + labelSign(c2_label) + labelSign(c3_label);
  } catch {
    throw new Error(
      `calcDirectionalAgreement requires non-flat candle labels, got: [${c1_label}, ${c2_label}, ${c3_label}]`,
    );
  }
  if (sum !== -3 && sum !== -1 && sum !== 1 && sum !== 3) {
    throw new Error(`Unexpected directional agreement sum: ${sum}`);
  }
  return sum;
}
