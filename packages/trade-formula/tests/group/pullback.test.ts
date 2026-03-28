import { describe, expect, it } from 'vitest';
import {
  calcAbsoluteVolatility,
  calcChaosScore,
  calcMaxRange,
  calcTotalExposure,
  calcWickDominance,
} from '../../src/group/pullback.js';
import type { OhlcCandle } from '../../src/types.js';

// Mixed-direction scenario: 2 up, 1 down (directional_agreement = +1, pullback)
// c1: strong up, c2: down pullback, c3: up continuation
const c1: OhlcCandle = {
  body_ratio: 0.75,
  candle_range: 1.6,
  close: 101.2,
  high: 101.5,
  low: 99.9,
  open: 100,
  pct_change: 1.2,
};
const c2: OhlcCandle = {
  body_ratio: 0.625,
  candle_range: 0.79,
  close: 100.7,
  high: 101.3,
  low: 100.5,
  open: 101.2,
  pct_change: -0.494,
};
const c3: OhlcCandle = {
  body_ratio: 0.727,
  candle_range: 1.092,
  close: 101.5,
  high: 101.8,
  low: 100.6,
  open: 100.7,
  pct_change: 0.794,
};

// volatility_proxy = avg(1.6, 0.79, 1.092) ≈ 1.161
const volatility_proxy = (1.6 + 0.79 + 1.092) / 3;

describe('calcMaxRange (P1)', () => {
  it('returns max(c1.candle_range, c2.candle_range, c3.candle_range)', () => {
    const result = calcMaxRange(c1, c2, c3);
    expect(result.name).toBe('P1');
    expect(result.sl_eligible).toBe(true);
    // max(1.6, 0.79, 1.092) = 1.6
    expect(result.value).toBe(1.6);
  });

  it('picks the widest candle regardless of position', () => {
    const wide: OhlcCandle = { ...c2, candle_range: 3.0 };
    expect(calcMaxRange(c1, wide, c3).value).toBe(3.0);
  });
});

describe('calcAbsoluteVolatility (P2)', () => {
  it('returns avg of abs(pct_change) across 3 candles', () => {
    const result = calcAbsoluteVolatility(c1, c2, c3);
    expect(result.name).toBe('P2');
    expect(result.sl_eligible).toBe(true);
    // avg(|1.2|, |-0.494|, |0.794|) = avg(1.2, 0.494, 0.794) = 2.488/3 ≈ 0.829
    expect(result.value).toBeCloseTo(
      (Math.abs(c1.pct_change) + Math.abs(c2.pct_change) + Math.abs(c3.pct_change)) / 3,
      5,
    );
    expect(result.value).toBeGreaterThan(0);
  });
});

describe('calcChaosScore (P3)', () => {
  it('returns population stdev of pct_change values', () => {
    const result = calcChaosScore(c1, c2, c3);
    expect(result.name).toBe('P3');
    expect(result.sl_eligible).toBe(true);

    const values = [c1.pct_change, c2.pct_change, c3.pct_change];
    const mean = values.reduce((a, b) => a + b, 0) / 3;
    const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / 3;
    const expected = Math.sqrt(variance);
    expect(result.value).toBeCloseTo(expected, 5);
  });

  it('returns 0 when all pct_change values are equal', () => {
    const flat: OhlcCandle = { ...c1, pct_change: 1.0 };
    const result = calcChaosScore(flat, { ...flat }, { ...flat });
    expect(result.value).toBeCloseTo(0, 10);
  });

  it('known manual example: stdev([2, 0, -2]) = sqrt(8/3) ≈ 1.633', () => {
    const a: OhlcCandle = { ...c1, pct_change: 2 };
    const b: OhlcCandle = { ...c2, pct_change: 0 };
    const c: OhlcCandle = { ...c3, pct_change: -2 };
    // mean = 0, variance = (4+0+4)/3 = 8/3, stdev ≈ 1.633
    expect(calcChaosScore(a, b, c).value).toBeCloseTo(Math.sqrt(8 / 3), 5);
  });
});

describe('calcWickDominance (P4)', () => {
  it('returns volatility_proxy × (1 - avg_body_ratio)', () => {
    const result = calcWickDominance(c1, c2, c3, volatility_proxy);
    expect(result.name).toBe('P4');
    expect(result.sl_eligible).toBe(true);

    const avg_body = (c1.body_ratio + c2.body_ratio + c3.body_ratio) / 3;
    const expected = volatility_proxy * (1 - avg_body);
    expect(result.value).toBeCloseTo(expected, 5);
  });

  it('returns 0 when all candles have body_ratio = 1 (no wicks)', () => {
    const full_body: OhlcCandle = { ...c1, body_ratio: 1 };
    const result = calcWickDominance(
      full_body,
      { ...c2, body_ratio: 1 },
      { ...c3, body_ratio: 1 },
      1.0,
    );
    expect(result.value).toBeCloseTo(0, 10);
  });
});

describe('calcTotalExposure (P5)', () => {
  it('returns sum of all 3 candle ranges', () => {
    const result = calcTotalExposure(c1, c2, c3);
    expect(result.name).toBe('P5');
    expect(result.sl_eligible).toBe(true);
    // 1.6 + 0.79 + 1.092 = 3.482
    expect(result.value).toBeCloseTo(1.6 + 0.79 + 1.092, 5);
  });
});

describe('sl_eligible flags — all P1–P5 are eligible', () => {
  it('all 5 pullback formulas are sl_eligible', () => {
    expect(calcMaxRange(c1, c2, c3).sl_eligible).toBe(true);
    expect(calcAbsoluteVolatility(c1, c2, c3).sl_eligible).toBe(true);
    expect(calcChaosScore(c1, c2, c3).sl_eligible).toBe(true);
    expect(calcWickDominance(c1, c2, c3, volatility_proxy).sl_eligible).toBe(true);
    expect(calcTotalExposure(c1, c2, c3).sl_eligible).toBe(true);
  });
});
