import { describe, expect, it } from 'vitest';
import { classifyCandle } from '../src/classifier.js';

describe('classifyCandle', () => {
  it("returns 'up_strong' when pct_change > 0.45 and body_ratio >= 0.5", () => {
    expect(classifyCandle(2.0, 0.6)).toBe('up_strong');
    expect(classifyCandle(0.46, 0.5)).toBe('up_strong');
  });

  it("returns 'up_medium' when pct_change > 0.2 and body_ratio >= 0.4", () => {
    expect(classifyCandle(0.4, 0.45)).toBe('up_medium');
    expect(classifyCandle(0.21, 0.4)).toBe('up_medium');
  });

  it("returns 'up_weak' when pct_change > 0.05 and body_ratio >= 0.3", () => {
    expect(classifyCandle(0.1, 0.35)).toBe('up_weak');
    expect(classifyCandle(0.06, 0.3)).toBe('up_weak');
  });

  it("returns 'down_strong' when pct_change < -0.45 and body_ratio >= 0.5", () => {
    expect(classifyCandle(-2.0, 0.6)).toBe('down_strong');
    expect(classifyCandle(-0.46, 0.5)).toBe('down_strong');
  });

  it("returns 'down_medium' when pct_change < -0.2 and body_ratio >= 0.4", () => {
    expect(classifyCandle(-0.4, 0.45)).toBe('down_medium');
    expect(classifyCandle(-0.21, 0.4)).toBe('down_medium');
  });

  it("returns 'down_weak' when pct_change < -0.05 and body_ratio >= 0.3", () => {
    expect(classifyCandle(-0.1, 0.35)).toBe('down_weak');
    expect(classifyCandle(-0.06, 0.3)).toBe('down_weak');
  });

  it("returns 'flat' for any candle that does not meet a directional threshold", () => {
    // pct_change too small
    expect(classifyCandle(0.05, 0.8)).toBe('flat');
    expect(classifyCandle(-0.05, 0.8)).toBe('flat');
    // exactly at boundary (not strictly greater/less)
    expect(classifyCandle(0.45, 0.5)).toBe('flat'); // not > 0.45
    expect(classifyCandle(0.2, 0.4)).toBe('flat'); // not > 0.2
    expect(classifyCandle(0.05, 0.3)).toBe('flat'); // not > 0.05
    expect(classifyCandle(-0.45, 0.5)).toBe('flat'); // not < -0.45
    expect(classifyCandle(-0.2, 0.4)).toBe('flat'); // not < -0.2
    expect(classifyCandle(-0.05, 0.3)).toBe('flat'); // not < -0.05
  });

  it("returns 'flat' when body_ratio is too low despite sufficient pct_change", () => {
    // pct_change > 0.45 (strong tier) but body_ratio < 0.5
    expect(classifyCandle(2.0, 0.4)).toBe('flat');
    // pct_change > 0.45 (strong tier) but body_ratio < 0.5
    expect(classifyCandle(1.0, 0.35)).toBe('flat');
    // pct_change > 0.2 (medium tier) but body_ratio < 0.4
    expect(classifyCandle(0.3, 0.2)).toBe('flat');
    // bearish equivalents
    expect(classifyCandle(-2.0, 0.4)).toBe('flat');
    expect(classifyCandle(-1.0, 0.35)).toBe('flat');
    expect(classifyCandle(-0.3, 0.2)).toBe('flat');
  });

  it("returns 'flat' for zero pct_change", () => {
    expect(classifyCandle(0, 0.8)).toBe('flat');
  });

  it('matches README classification example: c1 → up_strong', () => {
    // pct_change=0.463 > 0.45, body_ratio=0.75 >= 0.5
    expect(classifyCandle(0.463, 0.75)).toBe('up_strong');
  });

  it('matches README classification example: c2 → up_medium', () => {
    // pct_change=0.384 in (0.2, 0.45), body_ratio=0.714 >= 0.4
    expect(classifyCandle(0.384, 0.714)).toBe('up_medium');
  });

  it('matches README classification example: c3 → up_strong', () => {
    // pct_change=0.612 > 0.45, body_ratio=0.727 >= 0.5
    expect(classifyCandle(0.612, 0.727)).toBe('up_strong');
  });

  it('prioritizes stronger label when multiple conditions could match', () => {
    // pct_change > 1.5 satisfies up_strong first; body_ratio >= 0.5 also satisfies up_medium threshold
    expect(classifyCandle(2.0, 0.6)).toBe('up_strong');
  });
});
