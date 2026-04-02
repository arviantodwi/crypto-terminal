import type { OhlcCandle as BaseOhlcCandle } from '@crypto-terminal/trade-formula';

// ── Candle ────────────────────────────────────────────────────────────────────

/**
 * A single OHLC candle as stored in ohlcv_candles, extending the trade-formula
 * base type with the timestamp and extra exchange fields.
 */
export interface OhlcCandle extends BaseOhlcCandle {
  /** Unix timestamp in milliseconds (bigint stored as number) */
  open_time: number;
  volume: number;
  quote_volume: number;
  num_trades: number;
}

// ── Strategy output ───────────────────────────────────────────────────────────

export interface TradeSignal {
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  slPrice: number;
  tpPrice: number;
  leverage: number;
  dollarRisk: number;
  /** Strategy-specific supplementary data */
  metadata: Record<string, unknown>;
}

// ── Completed trade ───────────────────────────────────────────────────────────

export interface ExecutedTrade {
  id: number;
  timestamp: Date;
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  slPrice: number;
  tpPrice: number;
  exitPrice: number;
  exitReason: 'SL' | 'TP';
  pnlPercent: number;
  pnlDollar: number;
  leverage: number;
  metadata: Record<string, unknown>;
}

// ── Strategy contract ─────────────────────────────────────────────────────────

export interface StrategyRunner {
  name: string;
  version: string;
  /**
   * Analyse the current 3-candle window and return a trade signal,
   * or null to skip this bar.
   */
  analyze(candles: [OhlcCandle, OhlcCandle, OhlcCandle]): TradeSignal | null;
  /** Called after every completed trade so the strategy can update internal state. */
  onTradeExecuted(trade: ExecutedTrade): void;
}

// ── Backtest results ──────────────────────────────────────────────────────────

export interface BacktestResults {
  initialBalance: number;
  finalBalance: number;
  totalTrades: number;
  winCount: number;
  lossCount: number;
  winRate: number;
  totalPnlDollar: number;
  trades: ExecutedTrade[];
}
