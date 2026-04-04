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
    if (initialBalance <= 0) {
      throw new Error(`initialBalance must be positive, got ${initialBalance}`);
    }
    this.balance = initialBalance;
  }

  // ── Position lifecycle ──────────────────────────────────────────────────────

  openPosition(signal: TradeSignal, entryTimestamp: number): void {
    if (this.position !== null) {
      throw new Error('Cannot open position: close the existing position first');
    }
    if (signal.dollarRisk <= 0) {
      throw new Error(`Invalid signal: dollarRisk must be positive, got ${signal.dollarRisk}`);
    }
    if (signal.entryPrice <= 0) {
      throw new Error(`Invalid signal: entryPrice must be positive, got ${signal.entryPrice}`);
    }
    if (signal.leverage <= 0) {
      throw new Error(`Invalid signal: leverage must be positive, got ${signal.leverage}`);
    }
    if (signal.direction === 'LONG') {
      if (signal.slPrice >= signal.entryPrice) {
        throw new Error(
          `Invalid LONG signal: slPrice (${signal.slPrice}) must be below entryPrice (${signal.entryPrice})`,
        );
      }
      if (signal.tpPrice <= signal.entryPrice) {
        throw new Error(
          `Invalid LONG signal: tpPrice (${signal.tpPrice}) must be above entryPrice (${signal.entryPrice})`,
        );
      }
    } else {
      if (signal.slPrice <= signal.entryPrice) {
        throw new Error(
          `Invalid SHORT signal: slPrice (${signal.slPrice}) must be above entryPrice (${signal.entryPrice})`,
        );
      }
      if (signal.tpPrice >= signal.entryPrice) {
        throw new Error(
          `Invalid SHORT signal: tpPrice (${signal.tpPrice}) must be below entryPrice (${signal.entryPrice})`,
        );
      }
    }
    this.position = {
      entryPrice: signal.entryPrice,
      slPrice: signal.slPrice,
      tpPrice: signal.tpPrice,
      side: signal.direction,
      leverage: signal.leverage,
      dollarRisk: signal.dollarRisk,
      entryTimestamp: new Date(entryTimestamp * 1000),
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
    exitTimestamp: number,
  ): ExecutedTrade | null {
    if (!this.position) return null;

    const { entryPrice, slPrice, tpPrice, side, leverage, dollarRisk, entryTimestamp, metadata } = this.position;

    const slDistance =
      side === 'LONG' ? entryPrice - slPrice : slPrice - entryPrice;

    const exitDistance =
      side === 'LONG' ? exitPrice - entryPrice : entryPrice - exitPrice;

    const pnlDollar =
      slDistance > 0 ? dollarRisk * (exitDistance / slDistance) : 0;

    const pnlPercent = this.balance > 0 ? (pnlDollar / this.balance) * 100 : 0;

    // Note: `leverage` is stored as metadata only — it is not applied to position
    // sizing here. P&L is driven entirely by dollarRisk and price distance, so
    // strategies must bake leverage into dollarRisk themselves if needed.
    const trade: ExecutedTrade = {
      id: ++this.tradeIdCounter,
      entryTimestamp,
      exitTimestamp: new Date(exitTimestamp * 1000),
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
