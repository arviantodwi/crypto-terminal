import { CANDLE_THRESHOLDS } from "./constants.js";
import type { CandleLabel } from "./types.js";

/**
 * Classifies a candle into one of 7 labels based on pct_change and body_ratio.
 * Thresholds are sourced from CANDLE_THRESHOLDS in constants.ts.
 * Returns 'flat' as the default fallback when no directional condition is met.
 */
export function classifyCandle(
  pct_change: number,
  body_ratio: number,
): CandleLabel {
  if (
    pct_change > CANDLE_THRESHOLDS.PCT_UP_STRONG &&
    body_ratio >= CANDLE_THRESHOLDS.BODY_RATIO_STRONG
  ) {
    return "up_strong";
  }
  if (
    pct_change > CANDLE_THRESHOLDS.PCT_UP_MEDIUM &&
    body_ratio >= CANDLE_THRESHOLDS.BODY_RATIO_MEDIUM
  ) {
    return "up_medium";
  }
  if (
    pct_change > CANDLE_THRESHOLDS.PCT_UP_WEAK &&
    body_ratio >= CANDLE_THRESHOLDS.BODY_RATIO_WEAK
  ) {
    return "up_weak";
  }
  if (
    pct_change < CANDLE_THRESHOLDS.PCT_DOWN_STRONG &&
    body_ratio >= CANDLE_THRESHOLDS.BODY_RATIO_STRONG
  ) {
    return "down_strong";
  }
  if (
    pct_change < CANDLE_THRESHOLDS.PCT_DOWN_MEDIUM &&
    body_ratio >= CANDLE_THRESHOLDS.BODY_RATIO_MEDIUM
  ) {
    return "down_medium";
  }
  if (
    pct_change < CANDLE_THRESHOLDS.PCT_DOWN_WEAK &&
    body_ratio >= CANDLE_THRESHOLDS.BODY_RATIO_WEAK
  ) {
    return "down_weak";
  }
  return "flat";
}
