import { calcBodyRatio, calcCandleRange, calcPctChange } from '@crypto-terminal/trade-formula';
import { ohlcvCandles, type NewOhlcvCandle } from '../../db/schema';
import type { FastifyRequest } from 'fastify';

export interface CoindeskRecord {
  TIMESTAMP: number;
  OPEN: number;
  HIGH: number;
  LOW: number;
  CLOSE: number;
  VOLUME: number;
  QUOTE_VOLUME: number;
  TOTAL_TRADES: number;
}

export interface AppError extends Error {
  statusCode?: number;
}

// In-memory lock: tracks instruments currently being fetched
export const activeFetches = new Set<string>();

export function aggregateToTimeframe(aggregate: number): string {
  if (aggregate >= 60 && aggregate % 60 === 0) {
    return `${aggregate / 60}h`;
  }
  return `${aggregate}m`;
}

export function getClosestAggregateTs(intervalSeconds: number): number {
  const nowSeconds = Math.floor(Date.now() / 1000);
  return Math.floor(nowSeconds / intervalSeconds) * intervalSeconds;
}

export function normalize(record: CoindeskRecord, instrument: string, timeframe: string): NewOhlcvCandle {
  const { OPEN: open, HIGH: high, LOW: low, CLOSE: close } = record;
  return {
    open_time: record.TIMESTAMP,
    open,
    high,
    low,
    close,
    volume: record.VOLUME,
    quote_volume: record.QUOTE_VOLUME,
    num_trades: record.TOTAL_TRADES,
    instrument,
    timeframe,
    pct_change: open !== 0 ? calcPctChange(open, close) : 0,
    candle_range: open !== 0 ? calcCandleRange(open, high, low) : 0,
    body_ratio: calcBodyRatio(open, close, high, low),
  };
}

export async function upsertCandles(
  db: FastifyRequest['server']['db'],
  candles: NewOhlcvCandle[],
): Promise<{ inserted: number; skipped: number }> {
  if (candles.length === 0) return { inserted: 0, skipped: 0 };

  const result = await db
    .insert(ohlcvCandles)
    .values(candles)
    .onConflictDoNothing()
    .returning({ instrument: ohlcvCandles.instrument });

  const inserted = result.length;
  const skipped = candles.length - inserted;
  return { inserted, skipped };
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
