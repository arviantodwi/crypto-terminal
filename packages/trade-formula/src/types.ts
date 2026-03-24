export type CandleLabel =
  | "up_strong"
  | "up_medium"
  | "up_weak"
  | "down_strong"
  | "down_medium"
  | "down_weak"
  | "flat";

export type TradeSide = "long" | "short";

export type Route = "Trend" | "Reversal" | "Pullback";

export type ConvictionTier = "Skip" | "Moderate" | "High" | "Dominant";

export type TradeDecision = "trade" | "skip";

export interface OhlcCandle {
  open: number;
  high: number;
  low: number;
  close: number;
  pct_change: number;
  body_ratio: number;
  candle_range: number;
}

export interface PrecomputeResult {
  momentum_scores: [number, number, number];
  sequence_slope: number;
  wick_ratios: [number, number, number];
  volatility_proxy: number;
  directional_agreement: number;
}

export interface GroupFormulaResult {
  name: string;
  value: number;
  sl_eligible: boolean;
}

export interface PercentileSelectionResult {
  selected_formula: string;
  selected_percentile: number;
  sl_pct: number;
}

export interface TradeParameters {
  entry_price: number;
  sl_price: number;
  tp_price: number;
  leverage: number;
  dollar_risk: number;
  wide_sl_flag: boolean;
}

export interface ConflictResult {
  conflict: boolean;
  conflict_reason: string | null;
}

export interface TradeDecisionResult {
  decision: TradeDecision;
  trade_side: TradeSide | null;
  conviction_tier: ConvictionTier;
  conflict: boolean;
  conflict_reason: string | null;
}
