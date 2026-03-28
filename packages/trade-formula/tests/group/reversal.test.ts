import { describe, expect, it } from 'vitest';
import {
  calcBodyConflict,
  calcFullSwing,
  calcPivotRange,
  calcRejectionMagnitude,
  calcReversalStrength,
} from '../../src/group/reversal.js';
import type { OhlcCandle } from '../../src/types.js';

// Sign-flip scenario: c1 bearish, c2 pivot, c3 bullish reversal
const c1: OhlcCandle = {
  body_ratio: 0.625,
  candle_range: 1.2,
  close: 99.0,
  high: 100.5,
  low: 98.8,
  open: 100,
  pct_change: -1.0,
};
const c2: OhlcCandle = {
  body_ratio: 0.25,
  candle_range: 0.8,
  close: 99.2,
  high: 99.5,
  low: 98.7,
  open: 99.0,
  pct_change: 0.202,
};
const c3: OhlcCandle = {
  body_ratio: 0.842,
  candle_range: 1.915,
  close: 100.8,
  high: 101.0,
  low: 99.1,
  open: 99.2,
  pct_change: 1.613,
};

const volatility_proxy = 1.305;

describe('calcPivotRange (R1)', () => {
  it('returns c2.candle_range', () => {
    const result = calcPivotRange(c2);
    expect(result.name).toBe('R1');
    expect(result.sl_eligible).toBe(true);
    expect(result.value).toBe(0.8);
  });
});

describe('calcFullSwing (R2)', () => {
  it('returns abs(c1.pct_change) + abs(c3.pct_change)', () => {
    const result = calcFullSwing(c1, c3);
    expect(result.name).toBe('R2');
    expect(result.sl_eligible).toBe(true);
    // abs(-1.0) + abs(1.613) = 2.613
    expect(result.value).toBeCloseTo(2.613, 3);
  });

  it('always returns positive regardless of candle directions', () => {
    expect(calcFullSwing(c1, c3).value).toBeGreaterThan(0);
  });
});

describe('calcReversalStrength (R3)', () => {
  it('returns c3.pct_change × c3.body_ratio — NOT sl eligible', () => {
    const result = calcReversalStrength(c3);
    expect(result.name).toBe('R3');
    expect(result.sl_eligible).toBe(false);
    expect(result.value).toBeCloseTo(1.613 * 0.842, 5);
  });

  it('can return a negative value when c3 is bearish (directional signal)', () => {
    const bearish_c3: OhlcCandle = { ...c3, body_ratio: 0.7, pct_change: -1.2 };
    const result = calcReversalStrength(bearish_c3);
    expect(result.value).toBeCloseTo(-1.2 * 0.7, 5);
    expect(result.sl_eligible).toBe(false);
  });
});

describe('calcRejectionMagnitude (R4)', () => {
  it('returns max(c1.candle_range, c3.candle_range)', () => {
    const result = calcRejectionMagnitude(c1, c3);
    expect(result.name).toBe('R4');
    expect(result.sl_eligible).toBe(true);
    // max(1.2, 1.915) = 1.915
    expect(result.value).toBe(1.915);
  });

  it('picks c1 when it has the larger range', () => {
    const narrow_c3: OhlcCandle = { ...c3, candle_range: 0.5 };
    expect(calcRejectionMagnitude(c1, narrow_c3).value).toBe(1.2);
  });
});

describe('calcBodyConflict (R5)', () => {
  it('returns abs(c1.body_ratio - c3.body_ratio) × volatility_proxy', () => {
    const result = calcBodyConflict(c1, c3, volatility_proxy);
    expect(result.name).toBe('R5');
    expect(result.sl_eligible).toBe(true);
    expect(result.value).toBeCloseTo(Math.abs(c1.body_ratio - c3.body_ratio) * volatility_proxy, 5);
    expect(result.value).toBeGreaterThanOrEqual(0);
  });

  it('returns 0 when body ratios are equal', () => {
    const equal_c3: OhlcCandle = { ...c3, body_ratio: c1.body_ratio };
    expect(calcBodyConflict(c1, equal_c3, 1.0).value).toBe(0);
  });
});

describe('sl_eligible flags — only R3 is ineligible', () => {
  it('R1, R2, R4, R5 are sl_eligible; R3 is not', () => {
    expect(calcPivotRange(c2).sl_eligible).toBe(true);
    expect(calcFullSwing(c1, c3).sl_eligible).toBe(true);
    expect(calcReversalStrength(c3).sl_eligible).toBe(false);
    expect(calcRejectionMagnitude(c1, c3).sl_eligible).toBe(true);
    expect(calcBodyConflict(c1, c3, volatility_proxy).sl_eligible).toBe(true);
  });
});
