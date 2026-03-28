import type { GroupFormulaResult, OhlcCandle } from "../types.js";

/**
 * T1 — Simple Average: avg(c1.pct_change, c2.pct_change, c3.pct_change).
 * Can be negative in a downtrend — abs() applied so sl_pct is always a positive magnitude (see README §5).
 */
export function calcSimpleAverage(
  c1: OhlcCandle,
  c2: OhlcCandle,
  c3: OhlcCandle,
): GroupFormulaResult {
  const value = Math.abs((c1.pct_change + c2.pct_change + c3.pct_change) / 3);
  return { name: "T1", value, sl_eligible: true };
}

/**
 * T2 — Weighted Average: c1×0.2 + c2×0.3 + c3×0.5.
 * More recent candles weighted higher. abs() applied for positive sl_pct (see README §5).
 */
export function calcWeightedAverage(
  c1: OhlcCandle,
  c2: OhlcCandle,
  c3: OhlcCandle,
): GroupFormulaResult {
  const value = Math.abs(
    c1.pct_change * 0.2 + c2.pct_change * 0.3 + c3.pct_change * 0.5,
  );
  return { name: "T2", value, sl_eligible: true };
}

/**
 * T3 — Conviction-Weighted: avg of momentum scores (pct_change × body_ratio) per candle.
 * Filters noise — only counts moves backed by body strength. abs() applied (see README §5).
 */
export function calcConvictionWeighted(
  c1: OhlcCandle,
  c2: OhlcCandle,
  c3: OhlcCandle,
): GroupFormulaResult {
  const m1 = c1.pct_change * c1.body_ratio;
  const m2 = c2.pct_change * c2.body_ratio;
  const m3 = c3.pct_change * c3.body_ratio;
  const value = Math.abs((m1 + m2 + m3) / 3);
  return { name: "T3", value, sl_eligible: true };
}

/**
 * T4 — Range Ceiling: max(c1.candle_range, c2.candle_range, c3.candle_range).
 * candle_range is always ≥ 0, so no abs() needed (see README §5).
 */
export function calcRangeCeiling(
  c1: OhlcCandle,
  c2: OhlcCandle,
  c3: OhlcCandle,
): GroupFormulaResult {
  const value = Math.max(c1.candle_range, c2.candle_range, c3.candle_range);
  return { name: "T4", value, sl_eligible: true };
}

/**
 * T5 — Trend Acceleration: sequence_slope (c3.pct_change - c1.pct_change).
 * Directional signal only — not a magnitude, not eligible for SL selection (see README §5).
 */
export function calcTrendAcceleration(
  sequence_slope: number,
): GroupFormulaResult {
  return { name: "T5", value: sequence_slope, sl_eligible: false };
}
