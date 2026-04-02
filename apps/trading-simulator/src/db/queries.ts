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
  // NOTE: full in-memory load — for large datasets this can be significant.
  // Consider streaming or pagination if memory becomes a concern.
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
 * Fetch all pattern probability rows for a given instrument and timeframe.
 * Returns the full set as an array — callers should build a lookup Map keyed
 * by "c1_label:c2_label:c3_label" for O(1) per-candle access.
 *
 * Intended for strategies that pre-load probabilities at initialisation time
 * to keep the per-candle `analyze()` call synchronous.
 */
export async function fetchAllPatternProbabilities(
  db: Db,
  instrument: string,
  timeframe: string,
): Promise<PatternProbability[]> {
  return db
    .select()
    .from(patternProbabilities)
    .where(
      and(
        eq(patternProbabilities.instrument, instrument),
        eq(patternProbabilities.timeframe, timeframe),
      ),
    );
}

/**
 * Look up pattern probability stats for a specific 3-candle sequence.
 * Returns null if no matching row exists (pattern not yet materialised).
 *
 * Reserved for future strategies that perform per-candle DB lookups rather
 * than pre-loading the full probability set at initialisation. The current
 * pattern-based-v1 strategy uses `fetchAllPatternProbabilities` instead and
 * builds an in-memory Map for O(1) synchronous access during `analyze()`.
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
