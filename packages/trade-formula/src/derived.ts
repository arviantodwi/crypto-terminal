/**
 * Computes the signed percentage move of a candle.
 * Positive = bullish, negative = bearish.
 * Returns a raw percentage (e.g. 1.5 means 1.5%).
 */
export function calcPctChange(open: number, close: number): number {
  return ((close - open) / open) * 100;
}

/**
 * Computes the proportion of the candle range occupied by the body.
 * Range: 0 to 1. A value of 1 means no wicks.
 * Returns 0 when high === low (zero-range candle).
 */
export function calcBodyRatio(open: number, close: number, high: number, low: number): number {
  const range = high - low;
  if (range === 0) return 0;
  return Math.abs(close - open) / range;
}

/**
 * Computes the total candle span as a percentage of the open price.
 * Always >= 0. Direction-agnostic.
 * Returns a raw percentage (e.g. 0.617 means 0.617%).
 */
export function calcCandleRange(open: number, high: number, low: number): number {
  return ((high - low) / open) * 100;
}
