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
  const t = CANDLE_THRESHOLDS;

  if (pct_change > t.PCT_UP_STRONG) {
    return body_ratio >= t.BODY_RATIO_STRONG ? "up_strong" : "flat";
  }
  if (pct_change > t.PCT_UP_MEDIUM && pct_change < t.PCT_UP_STRONG) {
    return body_ratio >= t.BODY_RATIO_MEDIUM ? "up_medium" : "flat";
  }
  if (pct_change > t.PCT_UP_WEAK && pct_change < t.PCT_UP_MEDIUM) {
    return body_ratio >= t.BODY_RATIO_WEAK ? "up_weak" : "flat";
  }

  if (pct_change < t.PCT_DOWN_STRONG) {
    return body_ratio >= t.BODY_RATIO_STRONG ? "down_strong" : "flat";
  }
  if (pct_change < t.PCT_DOWN_MEDIUM && pct_change > t.PCT_DOWN_STRONG) {
    return body_ratio >= t.BODY_RATIO_MEDIUM ? "down_medium" : "flat";
  }
  if (pct_change < t.PCT_DOWN_WEAK && pct_change > t.PCT_DOWN_MEDIUM) {
    return body_ratio >= t.BODY_RATIO_WEAK ? "down_weak" : "flat";
  }

  return "flat";
}
