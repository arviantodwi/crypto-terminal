import { describe, expect, it } from 'vitest';
import {
  calcConvictionWeighted,
  calcRangeCeiling,
  calcSimpleAverage,
  calcTrendAcceleration,
  calcWeightedAverage,
} from '../../src/group/trend.js';
import type { OhlcCandle } from '../../src/types.js';

// README §12 worked example fixture
// c1: open=64800, high=65150, low=64750, close=65100
// c2: open=65100, high=65400, low=65050, close=65350
// c3: open=65350, high=65850, low=65300, close=65750
const c1: OhlcCandle = {
  body_ratio: 0.75,
  candle_range: 0.617,
  close: 65100,
  high: 65150,
  low: 64750,
  open: 64800,
  pct_change: 0.463,
};
const c2: OhlcCandle = {
  body_ratio: 0.714,
  candle_range: 0.538,
  close: 65350,
  high: 65400,
  low: 65050,
  open: 65100,
  pct_change: 0.384,
};
const c3: OhlcCandle = {
  body_ratio: 0.727,
  candle_range: 0.842,
  close: 65750,
  high: 65850,
  low: 65300,
  open: 65350,
  pct_change: 0.612,
};

describe('calcSimpleAverage (T1)', () => {
  it('returns avg(pct_change) of 3 candles — README §12 fixture', () => {
    const result = calcSimpleAverage(c1, c2, c3);
    expect(result.name).toBe('T1');
    expect(result.sl_eligible).toBe(true);
    // avg(0.463, 0.384, 0.612) = 1.459 / 3 ≈ 0.486
    expect(result.value).toBeCloseTo(0.486, 3);
  });

  it('returns abs() of a downtrend result (directional_agreement = -3)', () => {
    const down1: OhlcCandle = { ...c1, body_ratio: 0.75, candle_range: 0.617, pct_change: -0.463 };
    const down2: OhlcCandle = { ...c2, body_ratio: 0.714, candle_range: 0.538, pct_change: -0.384 };
    const down3: OhlcCandle = { ...c3, body_ratio: 0.727, candle_range: 0.842, pct_change: -0.612 };
    const result = calcSimpleAverage(down1, down2, down3);
    expect(result.value).toBeCloseTo(0.486, 3);
    expect(result.value).toBeGreaterThan(0);
  });
});

describe('calcWeightedAverage (T2)', () => {
  it('applies weights 0.2 / 0.3 / 0.5 — README §12 fixture', () => {
    const result = calcWeightedAverage(c1, c2, c3);
    expect(result.name).toBe('T2');
    expect(result.sl_eligible).toBe(true);
    // 0.463×0.2 + 0.384×0.3 + 0.612×0.5 = 0.0926 + 0.1152 + 0.306 = 0.5138 ≈ 0.514
    expect(result.value).toBeCloseTo(0.514, 3);
  });

  it('returns abs() for bearish candles', () => {
    const down1: OhlcCandle = { ...c1, pct_change: -0.463 };
    const down2: OhlcCandle = { ...c2, pct_change: -0.384 };
    const down3: OhlcCandle = { ...c3, pct_change: -0.612 };
    const result = calcWeightedAverage(down1, down2, down3);
    expect(result.value).toBeCloseTo(0.514, 3);
    expect(result.value).toBeGreaterThan(0);
  });
});

describe('calcConvictionWeighted (T3)', () => {
  it('computes avg of momentum scores (pct_change × body_ratio) — README §12 fixture', () => {
    const result = calcConvictionWeighted(c1, c2, c3);
    expect(result.name).toBe('T3');
    expect(result.sl_eligible).toBe(true);
    // m1 = 0.463×0.75 = 0.347, m2 = 0.384×0.714 = 0.274, m3 = 0.612×0.727 = 0.445
    // avg = (0.347 + 0.274 + 0.445) / 3 = 1.066 / 3 ≈ 0.355
    expect(result.value).toBeCloseTo(0.355, 3);
  });

  it('returns abs() for bearish candles', () => {
    const down1: OhlcCandle = { ...c1, pct_change: -0.463 };
    const down2: OhlcCandle = { ...c2, pct_change: -0.384 };
    const down3: OhlcCandle = { ...c3, pct_change: -0.612 };
    const result = calcConvictionWeighted(down1, down2, down3);
    expect(result.value).toBeCloseTo(0.355, 3);
    expect(result.value).toBeGreaterThan(0);
  });
});

describe('calcRangeCeiling (T4)', () => {
  it('returns max candle_range — README §12 fixture', () => {
    const result = calcRangeCeiling(c1, c2, c3);
    expect(result.name).toBe('T4');
    expect(result.sl_eligible).toBe(true);
    // max(0.617, 0.538, 0.842) = 0.842
    expect(result.value).toBeCloseTo(0.842, 3);
  });

  it('picks the widest candle regardless of position', () => {
    const wide: OhlcCandle = { ...c1, candle_range: 2.5 };
    expect(calcRangeCeiling(wide, c2, c3).value).toBe(2.5);
    expect(calcRangeCeiling(c1, wide, c3).value).toBe(2.5);
    expect(calcRangeCeiling(c1, c2, wide).value).toBe(2.5);
  });
});

describe('calcTrendAcceleration (T5)', () => {
  it('returns sequence_slope as-is and is not SL eligible — README §12 fixture', () => {
    // sequence_slope from §12 = 0.612 - 0.463 = 0.149
    const result = calcTrendAcceleration(0.149);
    expect(result.name).toBe('T5');
    expect(result.sl_eligible).toBe(false);
    expect(result.value).toBeCloseTo(0.149, 3);
  });

  it('can return a negative value (fading trend)', () => {
    const result = calcTrendAcceleration(-0.3);
    expect(result.value).toBe(-0.3);
    expect(result.sl_eligible).toBe(false);
  });
});

describe('eligible sort — README §12 sorted ascending', () => {
  it('eligible outputs sort to [T3, T1, T2, T4] = [0.355, 0.486, 0.514, 0.842]', () => {
    const results = [
      calcSimpleAverage(c1, c2, c3),
      calcWeightedAverage(c1, c2, c3),
      calcConvictionWeighted(c1, c2, c3),
      calcRangeCeiling(c1, c2, c3),
      calcTrendAcceleration(0.149),
    ];
    const eligible = results
      .filter(r => r.sl_eligible)
      .map(r => r.value)
      .sort((a, b) => a - b);
    expect(eligible).toHaveLength(4);
    expect(eligible[0]).toBeCloseTo(0.355, 3); // T3
    expect(eligible[1]).toBeCloseTo(0.486, 3); // T1
    expect(eligible[2]).toBeCloseTo(0.514, 3); // T2
    expect(eligible[3]).toBeCloseTo(0.842, 3); // T4
    // Moderate conviction → 75th percentile → 3rd of 4 = 0.514 (T2)
    expect(eligible[2]).toBeCloseTo(0.514, 3);
  });
});
