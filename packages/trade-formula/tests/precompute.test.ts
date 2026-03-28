import { describe, expect, it } from 'vitest';
import {
  calcDirectionalAgreement,
  calcMomentumScore,
  calcSequenceSlope,
  calcVolatilityProxy,
  calcWickRatio,
} from '../src/precompute.js';

describe('calcMomentumScore', () => {
  it('returns pct_change × body_ratio', () => {
    expect(calcMomentumScore(2.0, 0.5)).toBe(1.0);
    expect(calcMomentumScore(-1.5, 0.6)).toBeCloseTo(-0.9);
    expect(calcMomentumScore(0, 0.8)).toBe(0);
  });

  it('matches README §12 worked example values', () => {
    expect(calcMomentumScore(0.463, 0.75)).toBeCloseTo(0.347);
    expect(calcMomentumScore(0.384, 0.714)).toBeCloseTo(0.274);
    expect(calcMomentumScore(0.612, 0.727)).toBeCloseTo(0.445);
  });
});

describe('calcSequenceSlope', () => {
  it('returns c3_pct_change - c1_pct_change', () => {
    expect(calcSequenceSlope(1.0, 2.0)).toBe(1.0);
    expect(calcSequenceSlope(2.0, 1.0)).toBe(-1.0);
    expect(calcSequenceSlope(0.5, 0.5)).toBe(0);
  });

  it('matches README §12 worked example: 0.612 - 0.463 = +0.149 (accelerating)', () => {
    expect(calcSequenceSlope(0.463, 0.612)).toBeCloseTo(0.149);
  });

  it('produces negative slope when trend is fading', () => {
    expect(calcSequenceSlope(1.5, 0.3)).toBeCloseTo(-1.2);
  });
});

describe('calcWickRatio', () => {
  it('returns 1 - body_ratio', () => {
    expect(calcWickRatio(0.75)).toBeCloseTo(0.25);
    expect(calcWickRatio(0)).toBe(1);
    expect(calcWickRatio(1)).toBe(0);
  });

  it('matches README §12 worked example values', () => {
    expect(calcWickRatio(0.75)).toBeCloseTo(0.25);
    expect(calcWickRatio(0.714)).toBeCloseTo(0.286);
    expect(calcWickRatio(0.727)).toBeCloseTo(0.273);
  });
});

describe('calcVolatilityProxy', () => {
  it('returns average of three candle ranges', () => {
    expect(calcVolatilityProxy(1.0, 1.0, 1.0)).toBe(1.0);
    expect(calcVolatilityProxy(0, 0, 3.0)).toBe(1.0);
  });

  it('matches README §12 worked example: avg(0.617, 0.538, 0.842) ≈ 0.666', () => {
    expect(calcVolatilityProxy(0.617, 0.538, 0.842)).toBeCloseTo(0.666);
  });
});

describe('calcDirectionalAgreement', () => {
  it('returns +3 when all candles are bullish', () => {
    expect(calcDirectionalAgreement('up_weak', 'up_weak', 'up_medium')).toBe(3);
    expect(calcDirectionalAgreement('up_strong', 'up_medium', 'up_strong')).toBe(3);
  });

  it('returns -3 when all candles are bearish', () => {
    expect(calcDirectionalAgreement('down_strong', 'down_medium', 'down_weak')).toBe(-3);
  });

  it('returns +1 when two bullish and one bearish', () => {
    expect(calcDirectionalAgreement('up_weak', 'up_medium', 'down_strong')).toBe(1);
    expect(calcDirectionalAgreement('down_weak', 'up_medium', 'up_strong')).toBe(1);
  });

  it('returns -1 when two bearish and one bullish', () => {
    expect(calcDirectionalAgreement('down_weak', 'down_medium', 'up_strong')).toBe(-1);
    expect(calcDirectionalAgreement('up_weak', 'down_medium', 'down_strong')).toBe(-1);
  });

  it('never produces 0 or ±2 — only ±1 or ±3 are possible with binary signs', () => {
    const results = [
      calcDirectionalAgreement('up_weak', 'up_weak', 'up_medium'),
      calcDirectionalAgreement('down_strong', 'down_medium', 'down_weak'),
      calcDirectionalAgreement('up_weak', 'up_medium', 'down_strong'),
      calcDirectionalAgreement('down_weak', 'down_medium', 'up_strong'),
    ];
    for (const r of results) {
      expect([3, 1, -1, -3]).toContain(r);
    }
  });

  it("throws when any label is 'flat'", () => {
    expect(() => calcDirectionalAgreement('flat', 'up_weak', 'up_medium')).toThrow();
    expect(() => calcDirectionalAgreement('up_weak', 'flat', 'up_medium')).toThrow();
    expect(() => calcDirectionalAgreement('up_weak', 'up_medium', 'flat')).toThrow();
  });
});
