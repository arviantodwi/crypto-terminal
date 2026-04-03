import { describe, expect, it } from 'vitest';
import { TimeMachine } from '../src/engine/time-machine.js';
import type { OhlcCandle } from '../src/engine/types.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeCandle(open_time: number, close: number): OhlcCandle {
  return {
    open_time,
    open: close - 1,
    high: close + 2,
    low: close - 2,
    close,
    volume: 100,
    quote_volume: close * 100,
    num_trades: 10,
    pct_change: 0.5,
    candle_range: 4,
    body_ratio: 0.5,
  };
}

const C1 = makeCandle(1000, 100);
const C2 = makeCandle(2000, 101);
const C3 = makeCandle(3000, 102);
const C4 = makeCandle(4000, 103);
const C5 = makeCandle(5000, 104);

// ── Constructor validation ────────────────────────────────────────────────────

describe('TimeMachine constructor', () => {
  it('throws when fewer than 3 candles are provided', () => {
    expect(() => new TimeMachine([])).toThrow('at least 3 candles');
    expect(() => new TimeMachine([C1])).toThrow('at least 3 candles');
    expect(() => new TimeMachine([C1, C2])).toThrow('at least 3 candles');
  });

  it('accepts exactly 3 candles', () => {
    expect(() => new TimeMachine([C1, C2, C3])).not.toThrow();
  });
});

// ── next() ────────────────────────────────────────────────────────────────────

describe('next()', () => {
  it('returns first window [c1, c2, c3] on first call', () => {
    const tm = new TimeMachine([C1, C2, C3]);
    const window = tm.next();
    expect(window).not.toBeNull();
    expect(window![0]).toBe(C1);
    expect(window![1]).toBe(C2);
    expect(window![2]).toBe(C3);
  });

  it('returns null after all candles are consumed', () => {
    const tm = new TimeMachine([C1, C2, C3]);
    tm.next(); // [C1, C2, C3]
    expect(tm.next()).toBeNull();
  });

  it('slides window by one candle on each call', () => {
    const tm = new TimeMachine([C1, C2, C3, C4, C5]);
    const w1 = tm.next()!;
    const w2 = tm.next()!;
    const w3 = tm.next()!;

    expect(w1).toEqual([C1, C2, C3]);
    expect(w2).toEqual([C2, C3, C4]);
    expect(w3).toEqual([C3, C4, C5]);
    expect(tm.next()).toBeNull();
  });

  it('produces (n - 2) windows for n candles', () => {
    const candles = [C1, C2, C3, C4, C5];
    const tm = new TimeMachine(candles);
    let count = 0;
    while (tm.next() !== null) count++;
    expect(count).toBe(candles.length - 2);
  });
});

// ── progress() ───────────────────────────────────────────────────────────────

describe('progress()', () => {
  it('reports "3 / 5" after first window on 5-candle set', () => {
    const tm = new TimeMachine([C1, C2, C3, C4, C5]);
    tm.next();
    expect(tm.progress()).toBe('3 / 5');
  });

  it('reports total after all windows consumed', () => {
    const tm = new TimeMachine([C1, C2, C3]);
    tm.next();
    tm.next(); // returns null — pos clamps to candles.length
    expect(tm.progress()).toBe('3 / 3');
  });
});

// ── currentTimestamp() ───────────────────────────────────────────────────────

describe('currentTimestamp()', () => {
  it('returns 0 before first next() call', () => {
    const tm = new TimeMachine([C1, C2, C3]);
    expect(tm.currentTimestamp()).toBe(0);
  });

  it('returns open_time of the last returned c3 candle', () => {
    const tm = new TimeMachine([C1, C2, C3, C4]);
    tm.next(); // window = [C1, C2, C3]
    expect(tm.currentTimestamp()).toBe(C3.open_time);
    tm.next(); // window = [C2, C3, C4]
    expect(tm.currentTimestamp()).toBe(C4.open_time);
  });
});

// ── total ─────────────────────────────────────────────────────────────────────

describe('total getter', () => {
  it('returns the number of candles provided', () => {
    expect(new TimeMachine([C1, C2, C3]).total).toBe(3);
    expect(new TimeMachine([C1, C2, C3, C4, C5]).total).toBe(5);
  });
});
