import { writeFileSync } from 'node:fs';
import type { ExecutedTrade } from '../engine/types.js';
import type { LoggedTrade } from './types.js';

// ── TradeLog interface ────────────────────────────────────────────────────────

export interface TradeLog {
  logTrade(trade: ExecutedTrade, strategyName: string, strategyVersion: string): void;
  /**
   * Returns a shallow copy of the internal trade array.
   * The array itself is a new instance, but the individual `LoggedTrade`
   * objects are shared references — mutating a returned trade object will
   * corrupt the log's internal state.
   */
  getAllTrades(): LoggedTrade[];
  /**
   * Returns trades filtered by strategy name.
   * Note: returned `LoggedTrade` objects are shared references to the
   * internal log entries — do not mutate them.
   */
  getTradesByStrategy(strategyName: string): LoggedTrade[];
  clearLog(): void;
  exportToJSON(filepath: string): void;
  exportToCSV(filepath: string): void;
}

// ── In-memory implementation ──────────────────────────────────────────────────

/**
 * In-memory trade log for backtest audit trails.
 *
 * Stores all executed trades in an array annotated with the strategy that
 * produced them. Export to JSON/CSV for offline analysis.
 */
export class InMemoryTradeLog implements TradeLog {
  private trades: LoggedTrade[] = [];

  logTrade(trade: ExecutedTrade, strategyName: string, strategyVersion: string): void {
    this.trades.push({ ...trade, strategyName, strategyVersion });
  }

  getAllTrades(): LoggedTrade[] {
    return [...this.trades];
  }

  getTradesByStrategy(strategyName: string): LoggedTrade[] {
    return this.trades.filter((t) => t.strategyName === strategyName);
  }

  clearLog(): void {
    this.trades = [];
  }

  exportToJSON(filepath: string): void {
    writeFileSync(filepath, JSON.stringify(this.trades, null, 2), 'utf-8');
  }

  exportToCSV(filepath: string): void {
    if (this.trades.length === 0) {
      writeFileSync(filepath, '', 'utf-8');
      return;
    }

    const headers = [
      'id',
      'instrument',
      'strategyName',
      'strategyVersion',
      'entryTimestamp',
      'exitTimestamp',
      'direction',
      'entryPrice',
      'slPrice',
      'tpPrice',
      'exitPrice',
      'exitReason',
      'dollarRisk',
      'pnlPercent',
      'pnlDollar',
      'leverage',
      'metadata',
    ];

    const rows = this.trades.map((t) => {
      const cells = [
        t.id,
        csvEscape(t.instrument),
        csvEscape(t.strategyName),
        csvEscape(t.strategyVersion),
        t.entryTimestamp.toISOString(),
        t.exitTimestamp.toISOString(),
        t.direction,
        t.entryPrice,
        t.slPrice,
        t.tpPrice,
        t.exitPrice,
        t.exitReason,
        t.dollarRisk,
        t.pnlPercent,
        t.pnlDollar,
        t.leverage,
        csvEscape(JSON.stringify(t.metadata)),
      ];
      return cells.join(',');
    });

    writeFileSync(filepath, [headers.join(','), ...rows].join('\n'), 'utf-8');
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function csvEscape(value: string): string {
  // Quote values that contain special CSV characters OR start with formula
  // trigger characters (=, +, -, @) to prevent formula injection when the
  // file is opened in spreadsheet applications.
  if (
    value.includes(',') ||
    value.includes('"') ||
    value.includes('\n') ||
    /^[=+\-@]/.test(value)
  ) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
