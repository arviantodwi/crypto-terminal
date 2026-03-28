import { labelSign } from "./helper/label.js";
import type { CandleLabel, Route } from "./types.js";

/**
 * Determines the route for a 3-candle window based on directional agreement
 * and momentum scores (see README §4).
 *
 * Priority order:
 *   1. Trend  — directional_agreement = ±3
 *   2. Reversal — ±1 AND sign(c1) ≠ sign(c3) AND abs(c3_momentum) > abs(c1_momentum)
 *   3. Pullback — all remaining ±1 cases
 */
export function discriminateRoute(
  directional_agreement: number,
  c1_label: CandleLabel,
  c3_label: CandleLabel,
  c1_momentum_score: number,
  c3_momentum_score: number,
): Route {
  if (directional_agreement === 3 || directional_agreement === -3) {
    return "Trend";
  }

  try {
    if (
      labelSign(c1_label) !== labelSign(c3_label) &&
      Math.abs(c3_momentum_score) > Math.abs(c1_momentum_score)
    ) {
      return "Reversal";
    }
  } catch {
    throw new Error(
      `discriminateRoute requires non-flat candle labels, got: c1=${c1_label}, c3=${c3_label}`,
    );
  }

  return "Pullback";
}
