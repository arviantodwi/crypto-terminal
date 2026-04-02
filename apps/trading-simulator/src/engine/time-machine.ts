import type { OhlcCandle } from './types.js';

/**
 * Iterates through a historical candle array in a sliding 3-candle window
 * [c1, c2, c3], advancing one candle at a time to simulate real-time
 * progression.
 */
export class TimeMachine {
  private readonly candles: OhlcCandle[];
  /** Index of the c3 (most recent) candle in the next window to return. */
  private pos: number = 2;

  constructor(candles: OhlcCandle[]) {
    if (candles.length < 3) {
      throw new Error(`TimeMachine requires at least 3 candles, got ${candles.length}`);
    }
    this.candles = candles;
  }

  /**
   * Advance to the next candle and return the new [c1, c2, c3] window,
   * or null if all candles have been consumed.
   */
  next(): [OhlcCandle, OhlcCandle, OhlcCandle] | null {
    if (this.pos >= this.candles.length) return null;

    const window: [OhlcCandle, OhlcCandle, OhlcCandle] = [
      this.candles[this.pos - 2]!,
      this.candles[this.pos - 1]!,
      this.candles[this.pos]!,
    ];
    this.pos++;
    return window;
  }

  /**
   * Current position as a human-readable string, e.g. "75,384 / 105,120".
   * The first number is the 1-based index of the last returned c3 candle.
   */
  progress(): string {
    const current = Math.min(this.pos, this.candles.length);
    return `${current.toLocaleString()} / ${this.candles.length.toLocaleString()}`;
  }

  /**
   * Unix timestamp (ms) of the c3 candle from the most recently returned window.
   * Returns 0 before the first call to next().
   */
  currentTimestamp(): number {
    if (this.pos <= 2) return 0;
    return this.candles[this.pos - 1]!.open_time;
  }

  /** Total number of candles loaded. */
  get total(): number {
    return this.candles.length;
  }
}
