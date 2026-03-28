import type { CandleLabel } from "../types.js";

/**
 * Returns +1 for bullish labels and -1 for bearish labels.
 * Throws when given a 'flat' label — callers should catch and rethrow with
 * a context-specific message describing why flat was disallowed.
 */
export function labelSign(label: CandleLabel): 1 | -1 {
  if (label.startsWith("up_")) return 1;
  if (label.startsWith("down_")) return -1;
  throw new Error(`flat label not allowed: ${label}`);
}
