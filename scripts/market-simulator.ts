/**
 * Crypto Market Simulator
 *
 * Generates synthetic OHLCV candle data using a geometric Brownian motion model,
 * computes RSI and moving averages, detects simple chart patterns, and renders
 * an ASCII price chart with signal annotations — all without any dependencies.
 *
 * Run: npx tsx scripts/market-simulator.ts
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface Pattern {
  index: number;
  name: string;
  direction: "bullish" | "bearish" | "neutral";
}

// ---------------------------------------------------------------------------
// Pseudo-random number generator (seeded Mulberry32)
// ---------------------------------------------------------------------------

function mulberry32(seed: number) {
  return function (): number {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Candle generation — geometric Brownian motion with volume spikes
// ---------------------------------------------------------------------------

function generateCandles(
  symbol: string,
  startPrice: number,
  count: number,
  seed: number,
): Candle[] {
  const rand = mulberry32(seed);
  const candles: Candle[] = [];
  let price = startPrice;
  const now = Date.now();
  const intervalMs = 15 * 60 * 1000; // 15-minute candles

  const drift = 0.0002; // slight upward bias
  const volatility = 0.018;

  for (let i = 0; i < count; i++) {
    const timestamp = now - (count - i) * intervalMs;

    // GBM step: price *= exp((drift - 0.5*vol²) + vol * N(0,1))
    const z = boxMullerNormal(rand);
    const logReturn = drift - 0.5 * volatility ** 2 + volatility * z;
    const open = price;
    const close = open * Math.exp(logReturn);

    // Intra-candle wicks
    const wickRange = Math.abs(close - open) * (0.5 + rand() * 1.5);
    const high = Math.max(open, close) + wickRange * rand();
    const low = Math.min(open, close) - wickRange * rand();

    // Volume: base + occasional spikes
    const baseVolume = 500 + rand() * 2000;
    const spike = rand() < 0.08 ? rand() * 8000 : 0;
    const volume = baseVolume + spike;

    candles.push({ timestamp, open, high, low, close, volume });
    price = close;
  }

  return candles;
}

/** Box–Muller transform: uniform → standard normal */
function boxMullerNormal(rand: () => number): number {
  const u1 = Math.max(rand(), 1e-10);
  const u2 = rand();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// ---------------------------------------------------------------------------
// Technical indicators
// ---------------------------------------------------------------------------

function sma(closes: number[], period: number): (number | null)[] {
  return closes.map((_, i) => {
    if (i < period - 1) return null;
    const slice = closes.slice(i - period + 1, i + 1);
    return slice.reduce((a, b) => a + b, 0) / period;
  });
}

function ema(closes: number[], period: number): (number | null)[] {
  const k = 2 / (period + 1);
  const result: (number | null)[] = [];
  let prev: number | null = null;

  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else if (i === period - 1) {
      const init = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
      prev = init;
      result.push(init);
    } else {
      prev = closes[i] * k + prev! * (1 - k);
      result.push(prev);
    }
  }
  return result;
}

function rsi(closes: number[], period = 14): (number | null)[] {
  const result: (number | null)[] = Array(period).fill(null);
  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 1; i <= period; i++) {
    const delta = closes[i] - closes[i - 1];
    if (delta > 0) avgGain += delta;
    else avgLoss += Math.abs(delta);
  }
  avgGain /= period;
  avgLoss /= period;

  const pushRsi = () => {
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - 100 / (1 + rs);
  };

  result.push(pushRsi());

  for (let i = period + 1; i < closes.length; i++) {
    const delta = closes[i] - closes[i - 1];
    const gain = Math.max(delta, 0);
    const loss = Math.max(-delta, 0);
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    result.push(pushRsi());
  }

  return result;
}

function bollingerBands(
  closes: number[],
  period = 20,
  stdDevMultiplier = 2,
): { upper: (number | null)[]; middle: (number | null)[]; lower: (number | null)[] } {
  const middle = sma(closes, period);
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];

  closes.forEach((_, i) => {
    if (i < period - 1) {
      upper.push(null);
      lower.push(null);
    } else {
      const slice = closes.slice(i - period + 1, i + 1);
      const mean = middle[i]!;
      const variance = slice.reduce((acc, v) => acc + (v - mean) ** 2, 0) / period;
      const std = Math.sqrt(variance);
      upper.push(mean + stdDevMultiplier * std);
      lower.push(mean - stdDevMultiplier * std);
    }
  });

  return { upper, middle, lower };
}

function macd(
  closes: number[],
  fast = 12,
  slow = 26,
  signal = 9,
): { macdLine: (number | null)[]; signalLine: (number | null)[]; histogram: (number | null)[] } {
  const fastEma = ema(closes, fast);
  const slowEma = ema(closes, slow);

  const macdLine = closes.map((_, i) => {
    if (fastEma[i] == null || slowEma[i] == null) return null;
    return fastEma[i]! - slowEma[i]!;
  });

  const macdValues = macdLine.filter((v): v is number => v !== null);
  const rawSignal = ema(macdValues, signal);

  // Re-align signal to the original length
  const offset = macdLine.findIndex((v) => v !== null);
  const signalLine: (number | null)[] = Array(offset + signal - 1).fill(null);
  rawSignal.forEach((v) => signalLine.push(v));
  while (signalLine.length < closes.length) signalLine.push(null);

  const histogram = closes.map((_, i) => {
    if (macdLine[i] == null || signalLine[i] == null) return null;
    return macdLine[i]! - signalLine[i]!;
  });

  return { macdLine, signalLine, histogram };
}

// ---------------------------------------------------------------------------
// Pattern detection
// ---------------------------------------------------------------------------

function detectPatterns(candles: Candle[]): Pattern[] {
  const patterns: Pattern[] = [];

  for (let i = 2; i < candles.length; i++) {
    const [prev2, prev1, curr] = [candles[i - 2], candles[i - 1], candles[i]];

    // Bullish engulfing
    if (
      prev1.close < prev1.open &&
      curr.close > curr.open &&
      curr.open < prev1.close &&
      curr.close > prev1.open
    ) {
      patterns.push({ index: i, name: "Bullish Engulfing", direction: "bullish" });
    }

    // Bearish engulfing
    if (
      prev1.close > prev1.open &&
      curr.close < curr.open &&
      curr.open > prev1.close &&
      curr.close < prev1.open
    ) {
      patterns.push({ index: i, name: "Bearish Engulfing", direction: "bearish" });
    }

    // Doji (open ≈ close, small body relative to range)
    const body = Math.abs(curr.close - curr.open);
    const range = curr.high - curr.low;
    if (range > 0 && body / range < 0.1) {
      patterns.push({ index: i, name: "Doji", direction: "neutral" });
    }

    // Morning star (3-candle)
    if (
      prev2.close < prev2.open &&
      Math.abs(prev1.close - prev1.open) < (prev1.high - prev1.low) * 0.3 &&
      curr.close > curr.open &&
      curr.close > (prev2.open + prev2.close) / 2
    ) {
      patterns.push({ index: i, name: "Morning Star", direction: "bullish" });
    }

    // Evening star (3-candle)
    if (
      prev2.close > prev2.open &&
      Math.abs(prev1.close - prev1.open) < (prev1.high - prev1.low) * 0.3 &&
      curr.close < curr.open &&
      curr.close < (prev2.open + prev2.close) / 2
    ) {
      patterns.push({ index: i, name: "Evening Star", direction: "bearish" });
    }
  }

  return patterns;
}

// ---------------------------------------------------------------------------
// ASCII chart renderer
// ---------------------------------------------------------------------------

function renderAsciiChart(candles: Candle[], width = 80, height = 20): string {
  const closes = candles.map((c) => c.close);
  const minPrice = Math.min(...candles.map((c) => c.low));
  const maxPrice = Math.max(...candles.map((c) => c.high));
  const priceRange = maxPrice - minPrice;

  const cols = Math.min(candles.length, width);
  const startIdx = candles.length - cols;
  const visibleCandles = candles.slice(startIdx);

  const grid: string[][] = Array.from({ length: height }, () => Array(cols).fill(" "));

  const priceToRow = (price: number) =>
    Math.round(((maxPrice - price) / priceRange) * (height - 1));

  visibleCandles.forEach((candle, col) => {
    const openRow = priceToRow(candle.open);
    const closeRow = priceToRow(candle.close);
    const highRow = priceToRow(candle.high);
    const lowRow = priceToRow(candle.low);

    // Wick (top)
    for (let r = highRow; r < Math.min(openRow, closeRow); r++) {
      if (r >= 0 && r < height) grid[r][col] = "│";
    }
    // Wick (bottom)
    for (let r = Math.max(openRow, closeRow) + 1; r <= lowRow; r++) {
      if (r >= 0 && r < height) grid[r][col] = "│";
    }
    // Body
    const bodyTop = Math.min(openRow, closeRow);
    const bodyBot = Math.max(openRow, closeRow);
    const isBull = candle.close >= candle.open;
    for (let r = bodyTop; r <= bodyBot; r++) {
      if (r >= 0 && r < height) {
        grid[r][col] = r === bodyTop || r === bodyBot ? (isBull ? "▲" : "▼") : (isBull ? "█" : "░");
      }
    }
  });

  const lines: string[] = [];
  for (let r = 0; r < height; r++) {
    const labelPrice = maxPrice - (r / (height - 1)) * priceRange;
    const label = labelPrice.toFixed(2).padStart(10);
    lines.push(`${label} │${grid[r].join("")}`);
  }
  lines.push(`           └${"─".repeat(cols)}`);

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Stats & summary
// ---------------------------------------------------------------------------

function computeStats(candles: Candle[]) {
  const closes = candles.map((c) => c.close);
  const first = closes[0];
  const last = closes[closes.length - 1];
  const pnl = ((last - first) / first) * 100;

  const returns = closes.slice(1).map((c, i) => Math.log(c / closes[i]));
  const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + (b - meanReturn) ** 2, 0) / returns.length;
  const vol = Math.sqrt(variance) * Math.sqrt(252 * 24 * 4) * 100; // annualised %

  const drawdowns: number[] = [];
  let peak = closes[0];
  for (const c of closes) {
    if (c > peak) peak = c;
    drawdowns.push(((c - peak) / peak) * 100);
  }
  const maxDrawdown = Math.min(...drawdowns);

  const volumes = candles.map((c) => c.volume);
  const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;

  return { first, last, pnl, vol, maxDrawdown, avgVolume };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const symbols = [
    { symbol: "BTC/USDT", startPrice: 68_000, seed: 0xdeadbeef },
    { symbol: "ETH/USDT", startPrice: 3_500, seed: 0xcafebabe },
    { symbol: "SOL/USDT", startPrice: 160, seed: 0x12345678 },
  ];

  const CANDLE_COUNT = 96; // 24h of 15-min candles

  for (const { symbol, startPrice, seed } of symbols) {
    const candles = generateCandles(symbol, startPrice, CANDLE_COUNT, seed);
    const closes = candles.map((c) => c.close);

    const sma20 = sma(closes, 20);
    const ema12 = ema(closes, 12);
    const rsiValues = rsi(closes, 14);
    const bb = bollingerBands(closes, 20);
    const { macdLine, signalLine, histogram } = macd(closes, 12, 26, 9);
    const patterns = detectPatterns(candles);
    const stats = computeStats(candles);

    const lastClose = closes[closes.length - 1];
    const lastRsi = rsiValues[rsiValues.length - 1];
    const lastMacd = macdLine[macdLine.length - 1];
    const lastHist = histogram[histogram.length - 1];
    const lastBbUpper = bb.upper[bb.upper.length - 1];
    const lastBbLower = bb.lower[bb.lower.length - 1];

    const rsiSignal =
      lastRsi == null
        ? "N/A"
        : lastRsi > 70
          ? "OVERBOUGHT"
          : lastRsi < 30
            ? "OVERSOLD"
            : "NEUTRAL";

    const macdSignal =
      lastHist == null ? "N/A" : lastHist > 0 ? "BULLISH CROSS" : "BEARISH CROSS";

    const bbSignal =
      lastBbUpper == null || lastBbLower == null
        ? "N/A"
        : lastClose > lastBbUpper
          ? "ABOVE UPPER BAND"
          : lastClose < lastBbLower
            ? "BELOW LOWER BAND"
            : "INSIDE BANDS";

    console.log("\n" + "═".repeat(92));
    console.log(
      `  ${symbol}  │  Last: $${lastClose.toFixed(2)}  │  P&L: ${stats.pnl >= 0 ? "+" : ""}${stats.pnl.toFixed(2)}%  │  Ann. Vol: ${stats.vol.toFixed(1)}%  │  Max DD: ${stats.maxDrawdown.toFixed(2)}%`,
    );
    console.log("═".repeat(92));

    console.log(renderAsciiChart(candles, 80, 16));

    console.log("\n  ── Indicators (latest candle) ──────────────────────────────────────────────");
    console.log(`  RSI(14):     ${lastRsi?.toFixed(2).padEnd(10)}  Signal: ${rsiSignal}`);
    console.log(
      `  MACD(12,26,9):  line=${lastMacd?.toFixed(4)}  hist=${lastHist?.toFixed(4)}  → ${macdSignal}`,
    );
    console.log(
      `  Bollinger(20): upper=${lastBbUpper?.toFixed(2)}  lower=${lastBbLower?.toFixed(2)}  → ${bbSignal}`,
    );

    if (patterns.length > 0) {
      console.log("\n  ── Detected Patterns ────────────────────────────────────────────────────────");
      const recent = patterns.slice(-6);
      for (const p of recent) {
        const ts = new Date(candles[p.index].timestamp).toISOString().slice(11, 16);
        const arrow = p.direction === "bullish" ? "▲" : p.direction === "bearish" ? "▼" : "◆";
        console.log(`  ${arrow} [${ts}] candle #${p.index.toString().padStart(2)}  ${p.name}`);
      }
    }

    console.log(
      `\n  Avg Volume / candle: ${stats.avgVolume.toFixed(0)} USDT  │  Candles: ${CANDLE_COUNT} × 15min`,
    );
  }

  console.log("\n" + "═".repeat(92));
  console.log("  Simulation complete. All data is synthetic — not financial advice.");
  console.log("═".repeat(92) + "\n");
}

main();
