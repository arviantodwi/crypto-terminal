import { describe, it, expect } from "vitest";
import { classifyCandle } from "../src/classifier.js";

describe("classifyCandle", () => {
  it("returns 'up_strong' when pct_change > 1.5 and body_ratio >= 0.5", () => {
    expect(classifyCandle(2.0, 0.6)).toBe("up_strong");
    expect(classifyCandle(1.51, 0.5)).toBe("up_strong");
  });

  it("returns 'up_medium' when pct_change > 0.5 and body_ratio >= 0.4", () => {
    expect(classifyCandle(1.0, 0.45)).toBe("up_medium");
    expect(classifyCandle(0.51, 0.4)).toBe("up_medium");
  });

  it("returns 'up_weak' when pct_change > 0.1 and body_ratio >= 0.3", () => {
    expect(classifyCandle(0.3, 0.35)).toBe("up_weak");
    expect(classifyCandle(0.11, 0.3)).toBe("up_weak");
  });

  it("returns 'down_strong' when pct_change < -1.5 and body_ratio >= 0.5", () => {
    expect(classifyCandle(-2.0, 0.6)).toBe("down_strong");
    expect(classifyCandle(-1.51, 0.5)).toBe("down_strong");
  });

  it("returns 'down_medium' when pct_change < -0.5 and body_ratio >= 0.4", () => {
    expect(classifyCandle(-1.0, 0.45)).toBe("down_medium");
    expect(classifyCandle(-0.51, 0.4)).toBe("down_medium");
  });

  it("returns 'down_weak' when pct_change < -0.1 and body_ratio >= 0.3", () => {
    expect(classifyCandle(-0.3, 0.35)).toBe("down_weak");
    expect(classifyCandle(-0.11, 0.3)).toBe("down_weak");
  });

  it("returns 'flat' for any candle that does not meet a directional threshold", () => {
    // pct_change too small
    expect(classifyCandle(0.05, 0.8)).toBe("flat");
    expect(classifyCandle(-0.05, 0.8)).toBe("flat");
    // exactly at boundary (not strictly greater/less)
    expect(classifyCandle(1.5, 0.5)).toBe("flat"); // not > 1.5
    expect(classifyCandle(0.5, 0.4)).toBe("flat"); // not > 0.5
    expect(classifyCandle(0.1, 0.3)).toBe("flat"); // not > 0.1
    expect(classifyCandle(-1.5, 0.5)).toBe("flat"); // not < -1.5
    expect(classifyCandle(-0.5, 0.4)).toBe("flat"); // not < -0.5
    expect(classifyCandle(-0.1, 0.3)).toBe("flat"); // not < -0.1
  });

  it("returns 'flat' when body_ratio is too low despite sufficient pct_change", () => {
    // pct_change > 1.5 but body_ratio < 0.5
    expect(classifyCandle(2.0, 0.4)).toBe("flat");
    // pct_change > 0.5 but body_ratio < 0.4
    expect(classifyCandle(1.0, 0.35)).toBe("flat");
    // pct_change > 0.1 but body_ratio < 0.3
    expect(classifyCandle(0.3, 0.2)).toBe("flat");
    // bearish equivalents
    expect(classifyCandle(-2.0, 0.4)).toBe("flat");
    expect(classifyCandle(-1.0, 0.35)).toBe("flat");
    expect(classifyCandle(-0.3, 0.2)).toBe("flat");
  });

  it("returns 'flat' for zero pct_change", () => {
    expect(classifyCandle(0, 0.8)).toBe("flat");
  });

  it("matches README classification example: c1 → up_weak", () => {
    // pct_change=0.463, body_ratio=0.75
    expect(classifyCandle(0.463, 0.75)).toBe("up_weak");
  });

  it("matches README classification example: c3 → up_medium", () => {
    // pct_change=0.612, body_ratio=0.727
    expect(classifyCandle(0.612, 0.727)).toBe("up_medium");
  });

  it("prioritizes stronger label when multiple conditions could match", () => {
    // pct_change > 1.5 satisfies up_strong first; body_ratio >= 0.5 also satisfies up_medium threshold
    expect(classifyCandle(2.0, 0.6)).toBe("up_strong");
  });
});
