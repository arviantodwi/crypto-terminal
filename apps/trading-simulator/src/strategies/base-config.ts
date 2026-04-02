// ── Base strategy configuration ───────────────────────────────────────────────

/**
 * Configuration shared across all strategies. Individual strategies may
 * override any of these defaults via their own config.
 */
export interface StrategyConfig {
  /** Instrument symbol, e.g. 'BTCUSDT' */
  instrument: string;
  /** Candle timeframe, e.g. '5m' */
  timeframe: string;
  /** Starting account balance in USD. Used for dollar_risk calculation. */
  initialBalance: number;
  /** Percentage of account balance to risk per trade. Default: 3% */
  riskPct: number;
  /** Take-profit multiplier relative to the SL distance. Default: 2x */
  tpMultiplier: number;
  /** Minimum probability required to consider a directional trade. Default: 68% */
  convictionThreshold: number;
}

/**
 * Default values applied when a strategy does not override a field.
 * Instrument, timeframe, and initialBalance are required by all callers.
 */
export const BASE_STRATEGY_CONFIG = {
  riskPct: 3,
  tpMultiplier: 2,
  convictionThreshold: 68,
} as const satisfies Omit<StrategyConfig, 'instrument' | 'timeframe' | 'initialBalance'>;
