import type { CandleLabel } from '@crypto-terminal/trade-formula';
import type { OhlcCandle, ExecutedTrade, TradeSignal, StrategyRunner } from '../engine/types.js';
import type { PerformanceMetrics } from '../shared/metrics.js';

// ── Backtest status ────────────────────────────────────────────────────────────

export type BacktestStatus = 'IDLE' | 'RUNNING' | 'PAUSED' | 'COMPLETE';

// ── Speed level (0 = MAX) ─────────────────────────────────────────────────────

export type SpeedLevel = 1 | 10 | 100 | 1000 | 0;

// ── Pattern analysis data (from strategy metadata or basic classification) ────

export interface PatternAnalysisData {
  c1Label: CandleLabel;
  c2Label: CandleLabel;
  c3Label: CandleLabel;
  upProbability?: number;
  downProbability?: number;
  momentumScores?: [number, number, number];
  sequenceSlope?: number;
  volatilityProxy?: number;
  directionalAgreement?: number;
  wickRatios?: [number, number, number];
  route?: string;
  conviction?: string;
}

// ── Backtest state managed by useBacktest ─────────────────────────────────────

export interface BacktestState {
  status: BacktestStatus;
  currentCandles: [OhlcCandle, OhlcCandle, OhlcCandle] | null;
  patternData: PatternAnalysisData | null;
  tradeSignal: TradeSignal | null;
  currentBalance: number;
  candlesProcessed: number;
  totalCandles: number;
  currentTimestamp: Date;
  /** Progress percentage 0–100 */
  progress: number;
  /** Last 8 completed trades */
  trades: ExecutedTrade[];
  metrics: PerformanceMetrics;
  /** Number of candles where strategy.analyze() threw an exception */
  strategyErrorCount: number;
  /** Live TP multiplier — set when the strategy adapts it at runtime (e.g. v1.1), otherwise undefined. */
  effectiveTpMultiplier?: number;
  /** Live risk % — set when the strategy adapts it at runtime (e.g. v1.3), otherwise undefined. */
  effectiveRiskPct?: number;
}

// ── Props for the TUI App root component ─────────────────────────────────────

export interface TuiAppProps {
  candles: OhlcCandle[];
  strategy: StrategyRunner;
  strategyName: string;
  instrument: string;
  timeframe: string;
  initialBalance: number;
  riskPercent: number;
  tpMultiplier: number;
}
