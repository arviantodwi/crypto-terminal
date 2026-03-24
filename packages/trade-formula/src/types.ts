// ── Primitive union types ────────────────────────────────────────────────────

export type CandleLabel =
  | 'up_strong'
  | 'up_medium'
  | 'up_weak'
  | 'down_strong'
  | 'down_medium'
  | 'down_weak'
  | 'flat';

export type TradeSide = 'LONG' | 'SHORT';

export type Route = 'Trend' | 'Reversal' | 'Pullback';

export type ConvictionTier = 'Skip' | 'Moderate' | 'High' | 'Dominant';

export type TradeDecision = 'Trade' | 'Skip' | 'Conflicted';

// ── Candle ───────────────────────────────────────────────────────────────────

/**
 * A single OHLC candle with raw exchange fields and all derived fields
 * computed from them (see README §0).
 */
export interface OhlcCandle {
  // Raw fields from exchange
  open: number;
  high: number;
  low: number;
  close: number;

  // Derived fields
  /** (close - open) / open × 100 — signed percentage move */
  pct_change: number;
  /** abs(close - open) / (high - low) — body proportion of full range (0–1) */
  body_ratio: number;
  /** (high - low) / open × 100 — total candle span as a percentage of open */
  candle_range: number;
}

// ── Pre-computation layer ────────────────────────────────────────────────────

/**
 * All 5 pre-computation outputs for a 3-candle window (see README §3).
 * Computed once before routing and group formula evaluation.
 */
export interface PrecomputeResult {
  /** pct_change × body_ratio per candle [c1, c2, c3] */
  momentum_score: [number, number, number];
  /** c3.pct_change - c1.pct_change */
  sequence_slope: number;
  /** 1 - body_ratio per candle [c1, c2, c3] */
  wick_ratio: [number, number, number];
  /** avg(c1.candle_range, c2.candle_range, c3.candle_range) */
  volatility_proxy: number;
  /** sign(c1) + sign(c2) + sign(c3) — possible values: ±1 or ±3 */
  directional_agreement: number;
}

// ── Group formulas ───────────────────────────────────────────────────────────

/**
 * A single formula output within a route group (T1–T5 / R1–R5 / P1–P5).
 * Ineligible formulas are stored for AI learning but excluded from
 * percentile selection (see README §5).
 */
export interface GroupFormulaResult {
  /** Formula identifier, e.g. 'T1', 'R3', 'P4' */
  name: string;
  value: number;
  sl_eligible: boolean;
}

// ── Percentile selection ─────────────────────────────────────────────────────

/**
 * The SL formula chosen by percentile banding after sorting eligible
 * group formula outputs ascending (see README §6).
 */
export interface PercentileSelectionResult {
  formula_name: string;
  value: number;
  /** Percentile rank used for selection, e.g. 75 for 75th percentile */
  percentile_rank: number;
}

// ── Trade execution parameters ───────────────────────────────────────────────

/**
 * Final execution parameters produced after SL/TP and position sizing
 * calculations (see README §7–§9).
 */
export interface TradeParameters {
  /** Stop loss as a positive percentage magnitude */
  sl_pct: number;
  sl_price: number;
  tp_price: number;
  /** Integer leverage clamped to [1, 20] */
  leverage: number;
  /** Actual dollar amount at risk */
  dollar_risk: number;
  /** True when sl_pct > risk_pct — leverage is floored to 1x */
  wide_sl_flag: boolean;
}

// ── Conflict detection ───────────────────────────────────────────────────────

/**
 * Outcome of the directional conflict check between the Postgres
 * predicted direction and the structural route (see README §2).
 */
export interface ConflictResult {
  conflict: boolean;
  reason: string | null;
}

// ── Trade decision ───────────────────────────────────────────────────────────

/**
 * Combined trade decision: final verdict, conviction tier, and conflict
 * detection result (see README §2).
 */
export interface TradeDecisionResult {
  decision: TradeDecision;
  conviction: ConvictionTier;
  conflict_result: ConflictResult;
}
