import type { CandleLabel } from '@crypto-terminal/trade-formula';
import type { OhlcCandle } from '../engine/types.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const CANDLE_WIDTH = 6;
const WICK_ROW = '  ││  ';   // 6 chars: 2 spaces + ││ + 2 spaces
const BULL_BODY = '██████';  // 6 full-block chars (bullish)
const BEAR_BODY = '│    │';  // outlined body (bearish)
const EMPTY_ROW = '      ';  // 6 spaces
const COLUMN_GAP = '  ';     // separator between side-by-side candles

// ── Normalization ─────────────────────────────────────────────────────────────

/**
 * Map a price to a row index within [0, height-1].
 * Row 0 is the bottom of the display; row height-1 is the top.
 * When globalHigh === globalLow all prices map to the midpoint row.
 */
function normalizePrice(
  price: number,
  globalLow: number,
  globalHigh: number,
  height: number,
): number {
  if (globalHigh === globalLow) return Math.floor(height / 2);
  return Math.round(((price - globalLow) / (globalHigh - globalLow)) * (height - 1));
}

// ── Single candle renderer ────────────────────────────────────────────────────

/**
 * Render a single candle column within a shared price range.
 *
 * Rows are returned from top (index 0) to bottom (index height-1).
 * Each row is exactly CANDLE_WIDTH characters wide.
 */
function renderCandleColumn(
  candle: OhlcCandle,
  globalLow: number,
  globalHigh: number,
  height: number,
): string[] {
  const isBullish = candle.close >= candle.open;
  const bodyTop = Math.max(candle.open, candle.close);
  const bodyBottom = Math.min(candle.open, candle.close);

  const highRow = normalizePrice(candle.high, globalLow, globalHigh, height);
  const lowRow = normalizePrice(candle.low, globalLow, globalHigh, height);
  const bodyTopRow = normalizePrice(bodyTop, globalLow, globalHigh, height);
  const bodyBottomRow = normalizePrice(bodyBottom, globalLow, globalHigh, height);

  const lines: string[] = [];

  // Iterate from top row (height-1) down to row 0, push one line per row.
  for (let row = height - 1; row >= 0; row--) {
    if (row >= bodyBottomRow && row <= bodyTopRow) {
      lines.push(isBullish ? BULL_BODY : BEAR_BODY);
    } else if (row >= lowRow && row <= highRow) {
      lines.push(WICK_ROW);
    } else {
      lines.push(EMPTY_ROW);
    }
  }

  return lines;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Render a single OHLC candle as an ASCII art column.
 *
 * The candle is scaled so that the full wick range (low → high) fills the
 * specified height. Returns an array of strings, one per line, top to bottom.
 * Each string is {@link CANDLE_WIDTH} characters wide.
 *
 * @param candle  The OHLC candle to render.
 * @param height  Total height in character rows (must be ≥ 1).
 */
export function renderCandle(candle: OhlcCandle, height: number): string[] {
  return renderCandleColumn(candle, candle.low, candle.high, height);
}

/**
 * Render three candles side by side, normalized to a shared price range.
 *
 * All candles are scaled against the global high/low of the window so that
 * relative price levels are preserved across the three columns.
 *
 * Returns an array of strings, one per line, top to bottom. Each string is
 * `3 × CANDLE_WIDTH + 2 × COLUMN_GAP` characters wide.
 *
 * @param candles  The three-candle window [oldest, middle, newest].
 * @param height   Total height in character rows (must be ≥ 1).
 */
export function render3CandleWindow(
  candles: [OhlcCandle, OhlcCandle, OhlcCandle],
  height: number,
): string[] {
  const globalHigh = Math.max(...candles.map((c) => c.high));
  const globalLow = Math.min(...candles.map((c) => c.low));

  const cols = candles.map((c) => renderCandleColumn(c, globalLow, globalHigh, height));

  return cols[0].map(
    (_, i) => cols[0][i] + COLUMN_GAP + cols[1][i] + COLUMN_GAP + cols[2][i],
  );
}

/**
 * Format a three-label pattern tuple as a readable string.
 *
 * @example
 * formatPattern(['up_weak', 'up_weak', 'up_medium'])
 * // => "[up_weak, up_weak, up_medium]"
 */
export function formatPattern(
  labels: [CandleLabel, CandleLabel, CandleLabel],
): string {
  return `[${labels.join(', ')}]`;
}

// Re-export for convenience
export { CANDLE_WIDTH };
