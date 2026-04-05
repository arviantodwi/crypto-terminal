import type { ExecutedTrade } from '../engine/types.js';
import type { EquityPoint } from './types.js';

// ── PerformanceMetrics interface ──────────────────────────────────────────────

export interface PerformanceMetrics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  /** Percentage of trades that are wins (0–100). */
  winRate: number;
  /** Total P&L as a percentage of initialBalance. */
  totalPnL: number;

  /** Maximum peak-to-trough equity decline as a percentage (negative). */
  maxDrawdown: number;
  sharpeRatio: number;
  profitFactor: number;
  /** Average P&L per trade in dollars. */
  expectedValue: number;

  /** Average winning trade P&L in percentage. */
  averageWin: number;
  /** Average losing trade P&L in percentage (negative). */
  averageLoss: number;
  /** Largest single winning trade P&L in percentage. */
  largestWin: number;
  /** Largest single losing trade P&L in percentage (negative). */
  largestLoss: number;
  /** Average time between entry and exit across all trades, in hours. */
  averageHoldTime: number;

  equityCurve: EquityPoint[];
}

// ── Individual metric functions ───────────────────────────────────────────────

export function totalTrades(trades: ExecutedTrade[]): number {
  return trades.length;
}

export function winningTrades(trades: ExecutedTrade[]): number {
  return trades.filter((t) => t.pnlPercent > 0).length;
}

export function losingTrades(trades: ExecutedTrade[]): number {
  return trades.filter((t) => t.pnlPercent < 0).length;
}

/** Returns win rate as a percentage (0–100). Returns 0 for empty trade arrays. */
export function winRate(trades: ExecutedTrade[]): number {
  if (trades.length === 0) return 0;
  return (winningTrades(trades) / trades.length) * 100;
}

/** Total P&L as a percentage of initialBalance. Returns 0 if initialBalance is 0. */
export function totalPnLPercent(trades: ExecutedTrade[], initialBalance: number): number {
  if (initialBalance === 0) return 0;
  const dollarPnL = trades.reduce((sum, t) => sum + t.pnlDollar, 0);
  return (dollarPnL / initialBalance) * 100;
}

/**
 * Maximum peak-to-trough equity decline as a percentage (always ≤ 0).
 * Returns 0 for empty trade arrays.
 */
export function maxDrawdown(trades: ExecutedTrade[], initialBalance: number): number {
  if (trades.length === 0) return 0;

  let peak = initialBalance;
  let maxDd = 0;
  let balance = initialBalance;

  for (const trade of trades) {
    balance += trade.pnlDollar;
    if (balance > peak) {
      peak = balance;
    }
    if (peak > 0) {
      const dd = ((balance - peak) / peak) * 100;
      if (dd < maxDd) {
        maxDd = dd;
      }
    }
  }

  return maxDd;
}

/**
 * Annualized Sharpe ratio based on per-trade P&L percentages.
 *
 * Annualizes using the actual trade frequency derived from the backtest period
 * (first entry → last exit), so the result is correct regardless of candle
 * interval or how frequently the strategy trades.
 *
 * Returns 0 when fewer than 2 trades exist or standard deviation is 0.
 * Returns the raw (un-annualized) Sharpe when the backtest duration is ≤ 0.
 *
 * @param riskFreeReturnPercent Per-trade risk-free return expressed as a
 *   percentage (e.g. `0.1` = 0.1% per trade), not an annualised rate.
 *   Default is `0`.
 */
export function sharpeRatio(trades: ExecutedTrade[], riskFreeReturnPercent = 0): number {
  if (trades.length < 2) return 0;

  const returns = trades.map((t) => t.pnlPercent);
  const avgReturn = returns.reduce((s, r) => s + r, 0) / returns.length;
  const variance = returns.reduce((s, r) => s + (r - avgReturn) ** 2, 0) / (returns.length - 1);
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return 0;

  const rawSharpe = (avgReturn - riskFreeReturnPercent) / stdDev;

  const durationYears =
    (trades[trades.length - 1]!.exitTimestamp.getTime() - trades[0]!.entryTimestamp.getTime()) /
    (365.25 * 24 * 3_600_000);
  if (durationYears <= 0) return rawSharpe;

  return rawSharpe * Math.sqrt(trades.length / durationYears);
}

/**
 * Profit factor: gross profit divided by gross loss.
 * Returns Infinity when there are no losing trades but some winning trades.
 * Returns 0 when there are no winning trades (or no trades at all).
 */
export function profitFactor(trades: ExecutedTrade[]): number {
  const grossProfit = trades
    .filter((t) => t.pnlPercent > 0)
    .reduce((s, t) => s + t.pnlPercent, 0);
  const grossLoss = Math.abs(
    trades.filter((t) => t.pnlPercent < 0).reduce((s, t) => s + t.pnlPercent, 0),
  );

  if (grossLoss === 0) return grossProfit > 0 ? Infinity : 0;
  return grossProfit / grossLoss;
}

/** Average P&L per trade in dollars. Returns 0 for empty trade arrays. */
export function expectedValue(trades: ExecutedTrade[]): number {
  if (trades.length === 0) return 0;
  return trades.reduce((s, t) => s + t.pnlDollar, 0) / trades.length;
}

/** Average winning trade P&L in percentage. Returns 0 when no wins exist. */
export function averageWin(trades: ExecutedTrade[]): number {
  const wins = trades.filter((t) => t.pnlPercent > 0);
  if (wins.length === 0) return 0;
  return wins.reduce((s, t) => s + t.pnlPercent, 0) / wins.length;
}

/** Average losing trade P&L in percentage (negative). Returns 0 when no losses exist. */
export function averageLoss(trades: ExecutedTrade[]): number {
  const losses = trades.filter((t) => t.pnlPercent < 0);
  if (losses.length === 0) return 0;
  return losses.reduce((s, t) => s + t.pnlPercent, 0) / losses.length;
}

/** Largest single win P&L in percentage. Returns 0 when no wins exist. */
export function largestWin(trades: ExecutedTrade[]): number {
  const wins = trades.filter((t) => t.pnlPercent > 0);
  if (wins.length === 0) return 0;
  return Math.max(...wins.map((t) => t.pnlPercent));
}

/** Largest single loss P&L in percentage (negative). Returns 0 when no losses exist. */
export function largestLoss(trades: ExecutedTrade[]): number {
  const losses = trades.filter((t) => t.pnlPercent < 0);
  if (losses.length === 0) return 0;
  return Math.min(...losses.map((t) => t.pnlPercent));
}

/** Average hold time across all trades, in hours. Returns 0 for empty trade arrays. */
export function averageHoldTime(trades: ExecutedTrade[]): number {
  if (trades.length === 0) return 0;
  const totalMs = trades.reduce(
    (s, t) => s + (t.exitTimestamp.getTime() - t.entryTimestamp.getTime()),
    0,
  );
  return totalMs / trades.length / 3_600_000;
}

/**
 * Build an equity curve from the trade list.
 *
 * The first point uses the entry timestamp of the first trade (or
 * `startTimestamp` if provided) at initialBalance. Each subsequent point is
 * appended after each trade closes.
 *
 * @param startTimestamp Explicit start timestamp for the initial equity point.
 *   Used when `trades` is empty to produce a deterministic curve. Defaults to
 *   the first trade's `entryTimestamp` when trades are present.
 */
export function buildEquityCurve(
  trades: ExecutedTrade[],
  initialBalance: number,
  startTimestamp?: Date,
): EquityPoint[] {
  const startTime = trades.length > 0 ? trades[0].entryTimestamp : (startTimestamp ?? new Date(0));
  const curve: EquityPoint[] = [{ timestamp: startTime, balance: initialBalance }];

  let balance = initialBalance;
  for (const trade of trades) {
    balance += trade.pnlDollar;
    curve.push({ timestamp: trade.exitTimestamp, balance });
  }

  return curve;
}

// ── Aggregate function ────────────────────────────────────────────────────────

/**
 * Compute all performance metrics from a list of executed trades.
 *
 * @param trades               Completed trades in chronological order.
 * @param initialBalance       Starting account balance in USD.
 * @param riskFreeReturnPercent Per-trade risk-free return expressed as a
 *   percentage (e.g. `0.1` = 0.1% per trade), not an annualised rate.
 *   Default is `0`.
 * @param startTimestamp       Explicit start timestamp for the equity curve's
 *   initial point. Only relevant when `trades` is empty.
 */
export function calculateMetrics(
  trades: ExecutedTrade[],
  initialBalance: number,
  riskFreeReturnPercent = 0,
  startTimestamp?: Date,
): PerformanceMetrics {
  return {
    totalTrades: totalTrades(trades),
    winningTrades: winningTrades(trades),
    losingTrades: losingTrades(trades),
    winRate: winRate(trades),
    totalPnL: totalPnLPercent(trades, initialBalance),
    maxDrawdown: maxDrawdown(trades, initialBalance),
    sharpeRatio: sharpeRatio(trades, riskFreeReturnPercent),
    profitFactor: profitFactor(trades),
    expectedValue: expectedValue(trades),
    averageWin: averageWin(trades),
    averageLoss: averageLoss(trades),
    largestWin: largestWin(trades),
    largestLoss: largestLoss(trades),
    averageHoldTime: averageHoldTime(trades),
    equityCurve: buildEquityCurve(trades, initialBalance, startTimestamp),
  };
}
