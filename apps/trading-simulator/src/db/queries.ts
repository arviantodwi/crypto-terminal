import { and, asc, eq } from 'drizzle-orm';
import type { Db } from './client.js';
import { ohlcvCandles, patternProbabilities, type PatternProbability } from './schema.js';
import type { OhlcCandle } from '../engine/types.js';
import type { CandleLabel } from '@crypto-terminal/trade-formula';

/**
 * Fetch all OHLCV candles for the given instrument and timeframe,
 * ordered chronologically. Returns the full set as an in-memory array
 * ready for TimeMachine iteration.
 */
export async function fetchAllCandles(
  db: Db,
  instrument: string,
  timeframe: string,
): Promise<OhlcCandle[]> {
  const rows = await db
    .select({
      open_time: ohlcvCandles.open_time,
      open: ohlcvCandles.open,
      high: ohlcvCandles.high,
      low: ohlcvCandles.low,
      close: ohlcvCandles.close,
      volume: ohlcvCandles.volume,
      quote_volume: ohlcvCandles.quote_volume,
      num_trades: ohlcvCandles.num_trades,
      pct_change: ohlcvCandles.pct_change,
      candle_range: ohlcvCandles.candle_range,
      body_ratio: ohlcvCandles.body_ratio,
    })
    .from(ohlcvCandles)
    .where(
      and(
        eq(ohlcvCandles.instrument, instrument),
        eq(ohlcvCandles.timeframe, timeframe),
      ),
    )
    .orderBy(asc(ohlcvCandles.open_time));

  return rows;
}

/**
 * Look up pattern probability stats for a specific 3-candle sequence.
 * Returns null if no matching row exists (pattern not yet materialised).
 */
export async function fetchPatternProbability(
  db: Db,
  instrument: string,
  timeframe: string,
  c1Label: CandleLabel,
  c2Label: CandleLabel,
  c3Label: CandleLabel,
): Promise<PatternProbability | null> {
  const rows = await db
    .select()
    .from(patternProbabilities)
    .where(
      and(
        eq(patternProbabilities.instrument, instrument),
        eq(patternProbabilities.timeframe, timeframe),
        eq(patternProbabilities.c1_label, c1Label),
        eq(patternProbabilities.c2_label, c2Label),
        eq(patternProbabilities.c3_label, c3Label),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}
