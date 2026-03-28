import { LEVERAGE_CONSTRAINTS } from "./constants.js";
import type { TradeSide } from "./types.js";

/**
 * Converts sl_pct to an actual SL price level (see README §7).
 *
 * Long:  SL price = entry_price - (entry_price × sl_pct / 100)
 * Short: SL price = entry_price + (entry_price × sl_pct / 100)
 *
 * sl_pct is a raw percentage (e.g. 0.514 means 0.514%), not a decimal.
 */
export function calcSlPrice(
  entry_price: number,
  sl_pct: number,
  side: TradeSide,
): number {
  const sl_distance = entry_price * (sl_pct / 100);
  return side === "LONG"
    ? entry_price - sl_distance
    : entry_price + sl_distance;
}

/**
 * Computes TP price using a static multiplier against the SL distance (see README §8).
 *
 * Long:  TP price = entry_price + (sl_distance × tp_multiplier)
 * Short: TP price = entry_price - (sl_distance × tp_multiplier)
 *
 * sl_pct is a raw percentage (e.g. 0.514 means 0.514%), not a decimal.
 */
export function calcTpPrice(
  entry_price: number,
  sl_pct: number,
  tp_multiplier: number,
  side: TradeSide,
): number {
  const sl_distance = entry_price * (sl_pct / 100);
  return side === "LONG"
    ? entry_price + sl_distance * tp_multiplier
    : entry_price - sl_distance * tp_multiplier;
}

/**
 * Computes integer leverage from risk and SL percentages (see README §9).
 *
 * raw_leverage = risk_pct / sl_pct   (same units — /100 cancels)
 * leverage     = floor(raw_leverage) — never round; flooring keeps actual risk ≤ target
 * leverage     = clamp(leverage, 1, 20)
 * wide_sl_flag = true when sl_pct > risk_pct (leverage would be <1 without the floor)
 */
export function calcLeverage(
  risk_pct: number,
  sl_pct: number,
): { leverage: number; raw_leverage: number; wide_sl_flag: boolean } {
  const raw_leverage = risk_pct / sl_pct;
  const leverage = Math.max(
    LEVERAGE_CONSTRAINTS.MIN,
    Math.min(LEVERAGE_CONSTRAINTS.MAX, Math.floor(raw_leverage)),
  );
  const wide_sl_flag = sl_pct > risk_pct;
  return { leverage, raw_leverage, wide_sl_flag };
}

/**
 * Computes the actual dollar amount at risk given final leverage (see README §9).
 *
 * dollar_risk = (account_size × leverage) × (sl_pct / 100)
 *
 * sl_pct is a raw percentage (e.g. 0.514 means 0.514%), not a decimal.
 */
export function calcDollarRisk(
  account_size: number,
  leverage: number,
  sl_pct: number,
): number {
  return account_size * leverage * (sl_pct / 100);
}
