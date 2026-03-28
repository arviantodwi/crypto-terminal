import { describe, expect, it } from 'vitest';
import { calcBodyRatio, calcCandleRange, calcPctChange } from '../src/derived.js';

describe('calcPctChange', () => {
  it('returns positive value for bullish candle', () => {
    expect(calcPctChange(100, 102)).toBeCloseTo(2.0);
  });

  it('returns negative value for bearish candle', () => {
    expect(calcPctChange(100, 98)).toBeCloseTo(-2.0);
  });

  it('returns 0 for doji (open === close)', () => {
    expect(calcPctChange(100, 100)).toBe(0);
  });

  it('returns raw percentage not decimal (1.5 not 0.015)', () => {
    // (101.5 - 100) / 100 * 100 = 1.5
    expect(calcPctChange(100, 101.5)).toBeCloseTo(1.5);
  });

  it('matches README example for c1', () => {
    // (65100 - 64800) / 64800 * 100 = 0.463%
    expect(calcPctChange(64800, 65100)).toBeCloseTo(0.463, 2);
  });

  it('matches README example for c3', () => {
    // (65750 - 65350) / 65350 * 100 = 0.612%
    expect(calcPctChange(65350, 65750)).toBeCloseTo(0.612, 2);
  });
});

describe('calcBodyRatio', () => {
  it('returns correct ratio for bullish candle', () => {
    // abs(105 - 100) / (110 - 95) = 5/15 ≈ 0.333
    expect(calcBodyRatio(100, 105, 110, 95)).toBeCloseTo(5 / 15);
  });

  it('returns correct ratio for bearish candle', () => {
    // abs(95 - 100) / (105 - 90) = 5/15 ≈ 0.333
    expect(calcBodyRatio(100, 95, 105, 90)).toBeCloseTo(5 / 15);
  });

  it('returns 0 when high === low (zero-range candle)', () => {
    expect(calcBodyRatio(100, 100, 100, 100)).toBe(0);
  });

  it('returns 1 when there are no wicks (body fills entire range)', () => {
    // abs(105 - 100) / (105 - 100) = 1
    expect(calcBodyRatio(100, 105, 105, 100)).toBe(1);
  });

  it('returns value between 0 and 1', () => {
    const result = calcBodyRatio(100, 102, 105, 98);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(1);
  });

  it('matches README example for c1', () => {
    // abs(65100 - 64800) / (65150 - 64750) = 300/400 = 0.75
    expect(calcBodyRatio(64800, 65100, 65150, 64750)).toBeCloseTo(0.75);
  });

  it('matches README example for c2', () => {
    // abs(65350 - 65100) / (65400 - 65050) = 250/350 ≈ 0.714
    expect(calcBodyRatio(65100, 65350, 65400, 65050)).toBeCloseTo(0.714, 2);
  });
});

describe('calcCandleRange', () => {
  it('returns correct candle range as percentage of open', () => {
    // (110 - 90) / 100 * 100 = 20%
    expect(calcCandleRange(100, 110, 90)).toBeCloseTo(20);
  });

  it('returns 0 for zero-range candle', () => {
    expect(calcCandleRange(100, 100, 100)).toBe(0);
  });

  it('is always non-negative', () => {
    expect(calcCandleRange(100, 105, 95)).toBeGreaterThanOrEqual(0);
  });

  it('returns raw percentage not decimal', () => {
    // (101 - 99) / 100 * 100 = 2%
    expect(calcCandleRange(100, 101, 99)).toBeCloseTo(2.0);
  });

  it('matches README example for c1', () => {
    // (65150 - 64750) / 64800 * 100 = 0.617%
    expect(calcCandleRange(64800, 65150, 64750)).toBeCloseTo(0.617, 2);
  });

  it('matches README example for c3', () => {
    // (65850 - 65300) / 65350 * 100 = 0.842%
    expect(calcCandleRange(65350, 65850, 65300)).toBeCloseTo(0.842, 2);
  });
});
