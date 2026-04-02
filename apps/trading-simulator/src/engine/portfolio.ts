import type { ExecutedTrade, OhlcCandle, TradeSignal } from './types.js';

interface OpenPosition {
  entryPrice: number;
  slPrice: number;
  tpPrice: number;
  side: 'LONG' | 'SHORT';
  leverage: number;
  dollarRisk: number;
  entryTimestamp: Date;
  metadata: Record<string, unknown>;
}

/**
 * Tracks account balance and manages a single open position at a time.
 *
 * P&L is computed relative to `dollarRisk` (the max loss if SL is hit):
 *   - SL hit  → pnlDollar = -dollarRisk
 *   - TP hit  → pnlDollar = dollarRisk × (tp_distance / sl_distance)
 */
export class Portfolio {
  private balance: number;
  private position: OpenPosition | null = null;
  private readonly completedTrades: ExecutedTrade[] = [];
  private tradeIdCounter = 0;

  constructor(initialBalance: number) {
    this.balance = initialBalance;
  }

  // ── Position lifecycle ──────────────────────────────────────────────────────

  openPosition(signal: TradeSignal): void {
    if (this.position !== null) {
      throw new Error('Cannot open position: close the existing position first');
    }
    this.position = {
      entryPrice: signal.entryPrice,
      slPrice: signal.slPrice,
      tpPrice: signal.tpPrice,
      side: signal.direction,
      leverage: signal.leverage,
      dollarRisk: signal.dollarRisk,
      entryTimestamp: new Date(),
      metadata: signal.metadata,
    };
  }

  /**
   * Check whether the stop-loss was hit on this candle.
   * If hit, the position is closed and the trade is recorded.
   * Returns true if SL was hit.
   */
  checkStopLoss(candle: OhlcCandle): boolean {
    if (!this.position) return false;
    const { side, slPrice } = this.position;
    const hit = side === 'LONG' ? candle.low <= slPrice : candle.high >= slPrice;
    if (hit) this.closePosition(slPrice, 'SL', candle.open_time);
    return hit;
  }

  /**
   * Check whether the take-profit was hit on this candle.
   * If hit, the position is closed and the trade is recorded.
   * Returns true if TP was hit.
   */
  checkTakeProfit(candle: OhlcCandle): boolean {
    if (!this.position) return false;
    const { side, tpPrice } = this.position;
    const hit = side === 'LONG' ? candle.high >= tpPrice : candle.low <= tpPrice;
    if (hit) this.closePosition(tpPrice, 'TP', candle.open_time);
    return hit;
  }

  /**
   * Manually close the current position at `exitPrice`.
   * Returns the completed trade, or null if no position is open.
   */
  closePosition(
    exitPrice: number,
    exitReason: 'SL' | 'TP',
    exitTimestamp?: number,
  ): ExecutedTrade | null {
    if (!this.position) return null;

    const { entryPrice, slPrice, tpPrice, side, leverage, dollarRisk, metadata } = this.position;

    const slDistance =
      side === 'LONG' ? entryPrice - slPrice : slPrice - entryPrice;

    const exitDistance =
      side === 'LONG' ? exitPrice - entryPrice : entryPrice - exitPrice;

    const pnlDollar =
      slDistance > 0 ? dollarRisk * (exitDistance / slDistance) : 0;

    const pnlPercent = this.balance > 0 ? (pnlDollar / this.balance) * 100 : 0;

    const trade: ExecutedTrade = {
      id: ++this.tradeIdCounter,
      timestamp: exitTimestamp ? new Date(exitTimestamp) : new Date(),
      direction: side,
      entryPrice,
      slPrice,
      tpPrice,
      exitPrice,
      exitReason,
      pnlPercent,
      pnlDollar,
      leverage,
      metadata,
    };

    this.balance += pnlDollar;
    this.completedTrades.push(trade);
    this.position = null;

    return trade;
  }

  // ── Queries ─────────────────────────────────────────────────────────────────

  hasOpenPosition(): boolean {
    return this.position !== null;
  }

  getOpenPosition(): OpenPosition | null {
    return this.position;
  }

  getBalance(): number {
    return this.balance;
  }

  getTrades(): ExecutedTrade[] {
    return this.completedTrades;
  }
}
