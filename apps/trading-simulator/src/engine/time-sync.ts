import type { OhlcCandle } from './types.js';

export interface TimeSyncTick {
  /** The timestamp shared by all candles in this tick (from OhlcCandle.open_time). */
  timestamp: number;
  /**
   * Instruments that have a complete 3-candle sliding window at this tick.
   * Instruments are absent until they have accumulated at least 3 candles.
   */
  windows: Map<string, [OhlcCandle, OhlcCandle, OhlcCandle]>;
}

/**
 * Merges multiple per-instrument candle arrays into a single unified timeline,
 * sorted by timestamp. At each tick, every instrument that has a candle at that
 * timestamp — and has accumulated at least 3 candles — receives a [c1,c2,c3]
 * sliding window suitable for passing to strategy.analyze().
 *
 * This enables true parallel multi-instrument backtesting where all instruments
 * advance together through shared historical time, sharing a single balance pool.
 */
export class TimeSync {
  private readonly sortedTimestamps: number[];
  private readonly candlesByTimestamp: Map<number, Map<string, OhlcCandle>>;
  private readonly instrumentBuffers: Map<string, OhlcCandle[]>;
  private pos: number = 0;

  /** Total number of unique timestamps across all instruments. */
  readonly total: number;

  /** Number of timestamps that have been processed so far. */
  get processed(): number {
    return this.pos;
  }

  constructor(instrumentCandles: Map<string, OhlcCandle[]>) {
    this.candlesByTimestamp = new Map();
    this.instrumentBuffers = new Map();

    for (const [instrument, candles] of instrumentCandles) {
      this.instrumentBuffers.set(instrument, []);
      for (const candle of candles) {
        let atTime = this.candlesByTimestamp.get(candle.open_time);
        if (!atTime) {
          atTime = new Map();
          this.candlesByTimestamp.set(candle.open_time, atTime);
        }
        atTime.set(instrument, candle);
      }
    }

    this.sortedTimestamps = Array.from(this.candlesByTimestamp.keys()).sort((a, b) => a - b);
    this.total = this.sortedTimestamps.length;
  }

  /**
   * Advance to the next timestamp and return the tick, or null when all
   * timestamps have been consumed.
   */
  next(): TimeSyncTick | null {
    if (this.pos >= this.sortedTimestamps.length) return null;

    const timestamp = this.sortedTimestamps[this.pos++]!;
    const candlesAtTime = this.candlesByTimestamp.get(timestamp)!;
    const windows = new Map<string, [OhlcCandle, OhlcCandle, OhlcCandle]>();

    for (const [instrument, candle] of candlesAtTime) {
      const buf = this.instrumentBuffers.get(instrument)!;
      buf.push(candle);
      if (buf.length > 3) buf.shift();
      if (buf.length === 3) {
        windows.set(instrument, [buf[0]!, buf[1]!, buf[2]!]);
      }
    }

    return { timestamp, windows };
  }

  /**
   * Current position as a human-readable string, e.g. "75,384 / 520,000".
   * Counts timestamps processed, not individual candles.
   */
  progress(): string {
    const current = Math.min(this.pos, this.total);
    return `${current.toLocaleString()} / ${this.total.toLocaleString()}`;
  }
}
