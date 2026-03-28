import type { GroupFormulaResult, OhlcCandle } from "../types.js";

/**
 * P1 — Max Range: max(c1.candle_range, c2.candle_range, c3.candle_range).
 * Widest single candle sets the SL floor (see README §5).
 */
export function calcMaxRange(
  c1: OhlcCandle,
  c2: OhlcCandle,
  c3: OhlcCandle,
): GroupFormulaResult {
  const value = Math.max(c1.candle_range, c2.candle_range, c3.candle_range);
  return { name: "P1", value, sl_eligible: true };
}

/**
 * P2 — Absolute Volatility: avg(|c1.pct_change|, |c2.pct_change|, |c3.pct_change|).
 * Direction-agnostic average move magnitude (see README §5).
 */
export function calcAbsoluteVolatility(
  c1: OhlcCandle,
  c2: OhlcCandle,
  c3: OhlcCandle,
): GroupFormulaResult {
  const value =
    (Math.abs(c1.pct_change) + Math.abs(c2.pct_change) + Math.abs(c3.pct_change)) / 3;
  return { name: "P2", value, sl_eligible: true };
}

/**
 * P3 — Chaos Score: population standard deviation of [c1.pct_change, c2.pct_change, c3.pct_change].
 * Higher = more erratic price action within the window (see README §5).
 */
export function calcChaosScore(
  c1: OhlcCandle,
  c2: OhlcCandle,
  c3: OhlcCandle,
): GroupFormulaResult {
  const mean = (c1.pct_change + c2.pct_change + c3.pct_change) / 3;
  const variance =
    ((c1.pct_change - mean) ** 2 +
      (c2.pct_change - mean) ** 2 +
      (c3.pct_change - mean) ** 2) /
    3;
  const value = Math.sqrt(variance);
  return { name: "P3", value, sl_eligible: true };
}

/**
 * P4 — Wick Dominance: volatility_proxy × (1 - avg(c1.body_ratio, c2.body_ratio, c3.body_ratio)).
 * Noise level scaled by average wick proportion across the window (see README §5).
 */
export function calcWickDominance(
  c1: OhlcCandle,
  c2: OhlcCandle,
  c3: OhlcCandle,
  volatility_proxy: number,
): GroupFormulaResult {
  const avg_body_ratio = (c1.body_ratio + c2.body_ratio + c3.body_ratio) / 3;
  const value = volatility_proxy * (1 - avg_body_ratio);
  return { name: "P4", value, sl_eligible: true };
}

/**
 * P5 — Total Exposure: c1.candle_range + c2.candle_range + c3.candle_range.
 * Cumulative range across the entire 3-candle window (see README §5).
 */
export function calcTotalExposure(
  c1: OhlcCandle,
  c2: OhlcCandle,
  c3: OhlcCandle,
): GroupFormulaResult {
  const value = c1.candle_range + c2.candle_range + c3.candle_range;
  return { name: "P5", value, sl_eligible: true };
}
