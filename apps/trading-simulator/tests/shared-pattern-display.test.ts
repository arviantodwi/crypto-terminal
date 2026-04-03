import { describe, expect, it } from 'vitest';
import {
  CANDLE_WIDTH,
  formatPattern,
  render3CandleWindow,
  renderCandle,
} from '../src/shared/pattern-display.js';
import type { OhlcCandle } from '../src/engine/types.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeCandle(
  open: number,
  high: number,
  low: number,
  close: number,
): OhlcCandle {
  const range = high - low;
  return {
    open_time: 0,
    open,
    high,
    low,
    close,
    volume: 0,
    quote_volume: 0,
    num_trades: 0,
    pct_change: ((close - open) / open) * 100,
    body_ratio: range === 0 ? 0 : Math.abs(close - open) / range,
    candle_range: range === 0 ? 0 : (range / open) * 100,
  };
}

const BULLISH = makeCandle(100, 110, 95, 108); // close > open
const BEARISH = makeCandle(100, 108, 95, 97);  // close < open
const DOJI = makeCandle(100, 105, 95, 100);    // close === open

// ── renderCandle ──────────────────────────────────────────────────────────────

describe('renderCandle — output shape', () => {
  it('returns exactly `height` lines', () => {
    const lines = renderCandle(BULLISH, 10);
    expect(lines).toHaveLength(10);
  });

  it('every line is CANDLE_WIDTH characters wide', () => {
    const lines = renderCandle(BEARISH, 8);
    for (const line of lines) {
      expect(line).toHaveLength(CANDLE_WIDTH);
    }
  });

  it('works for height of 1', () => {
    const lines = renderCandle(BULLISH, 1);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toHaveLength(CANDLE_WIDTH);
  });
});

describe('renderCandle — bullish vs bearish body', () => {
  it('bullish candle body row contains █', () => {
    const lines = renderCandle(BULLISH, 20);
    const bodyLines = lines.filter((l) => l.includes('█'));
    expect(bodyLines.length).toBeGreaterThan(0);
  });

  it('bearish candle body row uses outlined style (│ at edges)', () => {
    const lines = renderCandle(BEARISH, 20);
    const bodyLines = lines.filter((l) => l.startsWith('│') && l.endsWith('│'));
    expect(bodyLines.length).toBeGreaterThan(0);
  });

  it('bullish candle has no outlined body rows', () => {
    const lines = renderCandle(BULLISH, 20);
    const outlinedRows = lines.filter((l) => l.startsWith('│') && l.endsWith('│'));
    expect(outlinedRows).toHaveLength(0);
  });
});

describe('renderCandle — wick rows', () => {
  it('wick rows contain ││', () => {
    const lines = renderCandle(BULLISH, 20);
    const wickRows = lines.filter((l) => l.includes('││'));
    expect(wickRows.length).toBeGreaterThan(0);
  });

  it('doji candle still renders without error', () => {
    const lines = renderCandle(DOJI, 10);
    expect(lines).toHaveLength(10);
    for (const line of lines) {
      expect(line).toHaveLength(CANDLE_WIDTH);
    }
  });
});

describe('renderCandle — flat candle (high === low)', () => {
  it('renders without throwing for zero-range candle', () => {
    const flat = makeCandle(100, 100, 100, 100);
    expect(() => renderCandle(flat, 10)).not.toThrow();
    const lines = renderCandle(flat, 10);
    expect(lines).toHaveLength(10);
  });
});

// ── render3CandleWindow ───────────────────────────────────────────────────────

describe('render3CandleWindow — output shape', () => {
  const c1 = makeCandle(100, 110, 95, 108);
  const c2 = makeCandle(108, 115, 106, 112);
  const c3 = makeCandle(112, 120, 110, 118);

  it('returns exactly `height` lines', () => {
    const lines = render3CandleWindow([c1, c2, c3], 12);
    expect(lines).toHaveLength(12);
  });

  it('each line has the expected width (3 candles + 2 gaps)', () => {
    const lines = render3CandleWindow([c1, c2, c3], 12);
    const expectedWidth = CANDLE_WIDTH * 3 + 2 * 2; // 3 candles + 2 × 2-char gap
    for (const line of lines) {
      expect(line).toHaveLength(expectedWidth);
    }
  });
});

describe('render3CandleWindow — shared price range', () => {
  it('candles are normalized against global high/low', () => {
    // All candles with very different ranges — should still render consistently
    const low = makeCandle(100, 102, 99, 101);
    const mid = makeCandle(150, 155, 148, 153);
    const high = makeCandle(200, 210, 198, 205);
    expect(() => render3CandleWindow([low, mid, high], 10)).not.toThrow();
    const lines = render3CandleWindow([low, mid, high], 10);
    expect(lines).toHaveLength(10);
  });

  it('all three candles flat (globalHigh === globalLow) renders without throwing', () => {
    const flat = makeCandle(100, 100, 100, 100);
    expect(() => render3CandleWindow([flat, flat, flat], 10)).not.toThrow();
    const lines = render3CandleWindow([flat, flat, flat], 10);
    expect(lines).toHaveLength(10);
    const expectedWidth = CANDLE_WIDTH * 3 + 2 * 2;
    for (const line of lines) {
      expect(line).toHaveLength(expectedWidth);
    }
  });
});

// ── formatPattern ─────────────────────────────────────────────────────────────

describe('formatPattern', () => {
  it('formats three labels into bracketed, comma-separated string', () => {
    expect(formatPattern(['up_weak', 'up_weak', 'up_medium'])).toBe(
      '[up_weak, up_weak, up_medium]',
    );
  });

  it('formats all-strong pattern', () => {
    expect(formatPattern(['up_strong', 'up_strong', 'up_strong'])).toBe(
      '[up_strong, up_strong, up_strong]',
    );
  });

  it('formats mixed direction pattern', () => {
    expect(formatPattern(['down_medium', 'up_weak', 'down_strong'])).toBe(
      '[down_medium, up_weak, down_strong]',
    );
  });
});
