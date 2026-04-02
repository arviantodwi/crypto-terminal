/**
 * Integration test for pattern-based-v1 strategy.
 *
 * Uses the §12 worked example from the @crypto-terminal/trade-formula README
 * to verify the full analyzer pipeline produces expected trade signals.
 * No real database is required — pattern probabilities are provided inline.
 */

import {
  calcBodyRatio,
  calcCandleRange,
  calcPctChange,
} from '@crypto-terminal/trade-formula';
import { describe, expect, it } from 'vitest';
import { analyzePattern } from '../src/strategies/pattern-based-v1/analyzer.js';
import { createPatternBasedV1Config } from '../src/strategies/pattern-based-v1/config.js';
import { PatternBasedV1 } from '../src/strategies/pattern-based-v1/index.js';
import type { PatternProbability } from '../src/db/schema.js';
import type { OhlcCandle } from '../src/engine/types.js';

// ── §12 raw OHLC data (from trade-formula README worked example) ──────────────

const RAW = {
  c1: { open: 64_800, high: 65_150, low: 64_750, close: 65_100 },
  c2: { open: 65_100, high: 65_400, low: 65_050, close: 65_350 },
  c3: { open: 65_350, high: 65_850, low: 65_300, close: 65_750 },
};

function makeCandle(raw: { open: number; high: number; low: number; close: number }): OhlcCandle {
  return {
    open_time: 0,
    open: raw.open,
    high: raw.high,
    low: raw.low,
    close: raw.close,
    volume: 0,
    quote_volume: 0,
    num_trades: 0,
    pct_change: calcPctChange(raw.open, raw.close),
    body_ratio: calcBodyRatio(raw.open, raw.close, raw.high, raw.low),
    candle_range: calcCandleRange(raw.open, raw.high, raw.low),
  };
}

const c1 = makeCandle(RAW.c1);
const c2 = makeCandle(RAW.c2);
const c3 = makeCandle(RAW.c3);

// ── Mocked pattern probability (73% up — §12 example value) ──────────────────

const mockPatternProbability: PatternProbability = {
  instrument: 'BTCUSDT',
  timeframe: '5m',
  c1_label: 'up_weak',
  c2_label: 'up_weak',
  c3_label: 'up_medium',
  occurrences: 100,
  up_count: 73,
  down_count: 27,
  up_probability: 73,
  down_probability: 27,
  computed_at: new Date('2026-01-01'),
};

const config = createPatternBasedV1Config({
  instrument: 'BTCUSDT',
  timeframe: '5m',
  initialBalance: 1_000,
  // Using defaults: riskPct=3, tpMultiplier=2, convictionThreshold=68
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('pattern-based-v1 analyzer — §12 worked example', () => {
  it('produces a LONG trade signal for the §12 pattern', () => {
    const signal = analyzePattern([c1, c2, c3], mockPatternProbability, config, 1_000);

    expect(signal).not.toBeNull();
    expect(signal!.direction).toBe('LONG');
  });

  it('entry price is c3.close', () => {
    const signal = analyzePattern([c1, c2, c3], mockPatternProbability, config, 1_000);
    expect(signal!.entryPrice).toBe(c3.close); // 65_750
  });

  it('SL price is below entry for LONG', () => {
    const signal = analyzePattern([c1, c2, c3], mockPatternProbability, config, 1_000);
    expect(signal!.slPrice).toBeLessThan(signal!.entryPrice);
  });

  it('TP price is above entry for LONG', () => {
    const signal = analyzePattern([c1, c2, c3], mockPatternProbability, config, 1_000);
    expect(signal!.tpPrice).toBeGreaterThan(signal!.entryPrice);
  });

  it('leverage is between 1 and 20', () => {
    const signal = analyzePattern([c1, c2, c3], mockPatternProbability, config, 1_000);
    expect(signal!.leverage).toBeGreaterThanOrEqual(1);
    expect(signal!.leverage).toBeLessThanOrEqual(20);
  });

  it('dollarRisk is positive', () => {
    const signal = analyzePattern([c1, c2, c3], mockPatternProbability, config, 1_000);
    expect(signal!.dollarRisk).toBeGreaterThan(0);
  });

  it('metadata captures route as Trend (directional_agreement = +3)', () => {
    const signal = analyzePattern([c1, c2, c3], mockPatternProbability, config, 1_000);
    expect(signal!.metadata.route).toBe('Trend');
    expect(signal!.metadata.directional_agreement).toBe(3);
  });

  it('metadata captures conviction as Moderate (73%)', () => {
    const signal = analyzePattern([c1, c2, c3], mockPatternProbability, config, 1_000);
    expect(signal!.metadata.conviction).toBe('Moderate');
  });

  it('metadata captures candle pattern labels', () => {
    const signal = analyzePattern([c1, c2, c3], mockPatternProbability, config, 1_000);
    expect(signal!.metadata.pattern).toEqual(['up_weak', 'up_weak', 'up_medium']);
  });

  it('metadata contains 5 group formulas for Trend route', () => {
    const signal = analyzePattern([c1, c2, c3], mockPatternProbability, config, 1_000);
    const formulas = signal!.metadata.group_formulas as Array<{ name: string }>;
    expect(formulas).toHaveLength(5);
    expect(formulas.map((f) => f.name)).toEqual(['T1', 'T2', 'T3', 'T4', 'T5']);
  });

  it('selected SL formula is T2 (Trend + Moderate → 75th percentile)', () => {
    const signal = analyzePattern([c1, c2, c3], mockPatternProbability, config, 1_000);
    expect(signal!.metadata.selected_formula).toBe('T2');
    expect(signal!.metadata.percentile_rank).toBe(75);
  });

  it('sl_pct matches T2 weighted average ≈ 0.514%', () => {
    const signal = analyzePattern([c1, c2, c3], mockPatternProbability, config, 1_000);
    expect(signal!.metadata.sl_pct as number).toBeCloseTo(0.514, 3);
  });

  it('leverage is 5x (riskPct=3, sl_pct≈0.514 → floor(3/0.514)=5)', () => {
    const signal = analyzePattern([c1, c2, c3], mockPatternProbability, config, 1_000);
    expect(signal!.leverage).toBe(5);
  });
});

describe('pattern-based-v1 analyzer — null cases', () => {
  it('returns null when no pattern probability found', () => {
    const signal = analyzePattern([c1, c2, c3], null, config, 1_000);
    expect(signal).toBeNull();
  });

  it('returns null when neither probability meets threshold', () => {
    const lowProb: PatternProbability = {
      ...mockPatternProbability,
      up_probability: 60,
      down_probability: 40,
    };
    const signal = analyzePattern([c1, c2, c3], lowProb, config, 1_000);
    expect(signal).toBeNull();
  });

  it('returns null when a candle is flat', () => {
    // A flat candle: pct_change near 0, body_ratio near 0
    const flatCandle: OhlcCandle = {
      ...c2,
      pct_change: 0.05, // below PCT_UP_WEAK=0.1 threshold
      body_ratio: 0.1,
    };
    const signal = analyzePattern([c1, flatCandle, c3], mockPatternProbability, config, 1_000);
    expect(signal).toBeNull();
  });

  it('returns null for conflicted pattern at Moderate conviction (HIGH conviction overrides)', () => {
    // up_probability < 75 (Moderate) with structural conflict
    // Here directional_agreement=+3 but we force SHORT direction via high down_probability
    const conflictedProb: PatternProbability = {
      ...mockPatternProbability,
      up_probability: 20,
      down_probability: 73, // Moderate conviction for SHORT
    };
    // c1, c2, c3 are all bullish → directional_agreement=+3 → structural=LONG
    // Postgres says SHORT → conflict → Moderate + conflict = Conflicted → null
    const signal = analyzePattern([c1, c2, c3], conflictedProb, config, 1_000);
    expect(signal).toBeNull();
  });

  it('returns TRADE for conflicted pattern at Dominant conviction (≥80% overrides conflict)', () => {
    // Dominant conviction overrides conflict regardless of structural route
    const dominantProb: PatternProbability = {
      ...mockPatternProbability,
      up_probability: 20,
      down_probability: 82, // Dominant conviction for SHORT
    };
    const signal = analyzePattern([c1, c2, c3], dominantProb, config, 1_000);
    expect(signal).not.toBeNull();
    expect(signal!.direction).toBe('SHORT');
    expect(signal!.metadata.conviction).toBe('Dominant');
  });
});

describe('PatternBasedV1 strategy runner', () => {
  it('implements StrategyRunner interface correctly', () => {
    const patternCache = new Map([
      ['up_weak:up_weak:up_medium', mockPatternProbability],
    ]);
    const strategy = new PatternBasedV1(config, patternCache);

    expect(strategy.name).toBe('pattern-based-v1');
    expect(strategy.version).toBe('1.0.0');
    expect(typeof strategy.analyze).toBe('function');
    expect(typeof strategy.onTradeExecuted).toBe('function');
  });

  it('analyze() returns a signal for a known pattern in the cache', () => {
    const patternCache = new Map([
      ['up_weak:up_weak:up_medium', mockPatternProbability],
    ]);
    const strategy = new PatternBasedV1(config, patternCache);

    const signal = strategy.analyze([c1, c2, c3]);
    expect(signal).not.toBeNull();
    expect(signal!.direction).toBe('LONG');
  });

  it('analyze() returns null for a pattern not in the cache', () => {
    const emptyCache = new Map<string, PatternProbability>();
    const strategy = new PatternBasedV1(config, emptyCache);

    const signal = strategy.analyze([c1, c2, c3]);
    expect(signal).toBeNull();
  });

  it('balance updates via onTradeExecuted affect dollarRisk', () => {
    const patternCache = new Map([
      ['up_weak:up_weak:up_medium', mockPatternProbability],
    ]);
    const strategy = new PatternBasedV1(config, patternCache);

    // First signal uses initialBalance=1000
    const signal1 = strategy.analyze([c1, c2, c3])!;
    const dollarRisk1 = signal1.dollarRisk;

    // Simulate a profit — balance should increase
    strategy.onTradeExecuted({
      id: 1,
      entryTimestamp: new Date(),
      exitTimestamp: new Date(),
      direction: 'LONG',
      entryPrice: signal1.entryPrice,
      slPrice: signal1.slPrice,
      tpPrice: signal1.tpPrice,
      exitPrice: signal1.tpPrice,
      exitReason: 'TP',
      pnlPercent: 1.5,
      pnlDollar: 50,
      leverage: signal1.leverage,
      metadata: {},
    });

    // Second signal uses updated balance=1050
    const signal2 = strategy.analyze([c1, c2, c3])!;
    expect(signal2.dollarRisk).toBeGreaterThan(dollarRisk1);
  });
});
