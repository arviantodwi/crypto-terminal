import type { GroupFormulaResult, OhlcCandle } from "../types.js";

/**
 * R1 — Pivot Range: c2.candle_range.
 * The middle candle's range captures the pivot point width (see README §5).
 */
export function calcPivotRange(c2: OhlcCandle): GroupFormulaResult {
  return { name: "R1", value: c2.candle_range, sl_eligible: true };
}

/**
 * R2 — Full Swing: abs(c1.pct_change) + abs(c3.pct_change).
 * Total directional distance of the reversal legs (see README §5).
 */
export function calcFullSwing(
  c1: OhlcCandle,
  c3: OhlcCandle,
): GroupFormulaResult {
  const value = Math.abs(c1.pct_change) + Math.abs(c3.pct_change);
  return { name: "R2", value, sl_eligible: true };
}

/**
 * R3 — Reversal Strength: c3.pct_change × c3.body_ratio.
 * Can be negative — directional signal only, not eligible for SL selection (see README §5).
 */
export function calcReversalStrength(c3: OhlcCandle): GroupFormulaResult {
  const value = c3.pct_change * c3.body_ratio;
  return { name: "R3", value, sl_eligible: false };
}

/**
 * R4 — Rejection Magnitude: max(c1.candle_range, c3.candle_range).
 * Largest swing leg sets the SL floor (see README §5).
 */
export function calcRejectionMagnitude(
  c1: OhlcCandle,
  c3: OhlcCandle,
): GroupFormulaResult {
  const value = Math.max(c1.candle_range, c3.candle_range);
  return { name: "R4", value, sl_eligible: true };
}

/**
 * R5 — Body Conflict: abs(c1.body_ratio - c3.body_ratio) × volatility_proxy.
 * Measures conviction disagreement between the pivot candles, scaled by noise level (see README §5).
 */
export function calcBodyConflict(
  c1: OhlcCandle,
  c3: OhlcCandle,
  volatility_proxy: number,
): GroupFormulaResult {
  const value = Math.abs(c1.body_ratio - c3.body_ratio) * volatility_proxy;
  return { name: "R5", value, sl_eligible: true };
}
