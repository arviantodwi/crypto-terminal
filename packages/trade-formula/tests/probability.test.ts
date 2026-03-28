import { describe, it, expect } from "vitest";
import {
  getConvictionTier,
  detectConflict,
  evaluateTradeDecision,
} from "../src/probability.js";
import type { ConflictResult } from "../src/types.js";

describe("getConvictionTier", () => {
  it("returns 'Skip' when probability < 68", () => {
    expect(getConvictionTier(0)).toBe("Skip");
    expect(getConvictionTier(67)).toBe("Skip");
    expect(getConvictionTier(67.9)).toBe("Skip");
  });

  it("returns 'Moderate' when probability is 68–74", () => {
    expect(getConvictionTier(68)).toBe("Moderate");
    expect(getConvictionTier(73)).toBe("Moderate"); // README §12 example: 73%
    expect(getConvictionTier(74)).toBe("Moderate");
    expect(getConvictionTier(74.9)).toBe("Moderate");
  });

  it("returns 'High' when probability is 75–79", () => {
    expect(getConvictionTier(75)).toBe("High");
    expect(getConvictionTier(77)).toBe("High");
    expect(getConvictionTier(79)).toBe("High");
    expect(getConvictionTier(79.9)).toBe("High");
  });

  it("returns 'Dominant' when probability >= 80", () => {
    expect(getConvictionTier(80)).toBe("Dominant");
    expect(getConvictionTier(95)).toBe("Dominant");
    expect(getConvictionTier(100)).toBe("Dominant");
  });
});

describe("detectConflict", () => {
  it("returns no conflict when Postgres=LONG and Trend route is bullish (+3)", () => {
    const result = detectConflict("LONG", "Trend", 3);
    expect(result.conflict).toBe(false);
    expect(result.reason).toBeNull();
  });

  it("returns no conflict when Postgres=SHORT and Trend route is bearish (-3)", () => {
    const result = detectConflict("SHORT", "Trend", -3);
    expect(result.conflict).toBe(false);
    expect(result.reason).toBeNull();
  });

  it("returns conflict when Postgres=SHORT but Trend route implies LONG (+3)", () => {
    const result = detectConflict("SHORT", "Trend", 3);
    expect(result.conflict).toBe(true);
    expect(result.reason).not.toBeNull();
    expect(result.reason).toContain("SHORT");
    expect(result.reason).toContain("LONG");
  });

  it("returns no conflict when Postgres=LONG and Pullback net bullish (+1)", () => {
    const result = detectConflict("LONG", "Pullback", 1);
    expect(result.conflict).toBe(false);
    expect(result.reason).toBeNull();
  });

  it("returns conflict when Postgres=SHORT but Pullback net bullish (+1)", () => {
    // README §2 example: 'down 70% | Pullback (uptrend continuation)' → conflict
    const result = detectConflict("SHORT", "Pullback", 1);
    expect(result.conflict).toBe(true);
    expect(result.reason).not.toBeNull();
  });

  it("returns no conflict when Postgres=SHORT and Reversal net bearish (-1)", () => {
    // README §2 example: 'down 75% | Reversal (from up to down)' → no conflict
    const result = detectConflict("SHORT", "Reversal", -1);
    expect(result.conflict).toBe(false);
    expect(result.reason).toBeNull();
  });

  it("returns conflict when Postgres=LONG but Reversal implies SHORT (-1)", () => {
    const result = detectConflict("LONG", "Reversal", -1);
    expect(result.conflict).toBe(true);
    expect(result.reason).not.toBeNull();
  });

  it("conflict reason includes route, postgres direction, and directional_agreement", () => {
    const result = detectConflict("LONG", "Pullback", -1);
    expect(result.reason).toContain("LONG");
    expect(result.reason).toContain("Pullback");
    expect(result.reason).toContain("-1");
  });
});

describe("evaluateTradeDecision", () => {
  const noConflict: ConflictResult = { conflict: false, reason: null };
  const withConflict: ConflictResult = {
    conflict: true,
    reason: "Postgres predicts LONG but route Pullback implies SHORT (directional_agreement=-1)",
  };

  it("returns Skip decision when conviction is Skip (conflict irrelevant)", () => {
    const result = evaluateTradeDecision("Skip", noConflict);
    expect(result.decision).toBe("Skip");
    expect(result.conviction).toBe("Skip");
  });

  it("returns Skip even when Skip + conflict", () => {
    const result = evaluateTradeDecision("Skip", withConflict);
    expect(result.decision).toBe("Skip");
  });

  it("returns Trade when Dominant + no conflict", () => {
    const result = evaluateTradeDecision("Dominant", noConflict);
    expect(result.decision).toBe("Trade");
    expect(result.conviction).toBe("Dominant");
  });

  it("returns Trade when Dominant + conflict (Postgres dominates, conflict overridden)", () => {
    const result = evaluateTradeDecision("Dominant", withConflict);
    expect(result.decision).toBe("Trade");
    expect(result.conviction).toBe("Dominant");
    expect(result.conflict_result.conflict).toBe(true);
  });

  it("returns Trade when Moderate + no conflict", () => {
    const result = evaluateTradeDecision("Moderate", noConflict);
    expect(result.decision).toBe("Trade");
    expect(result.conviction).toBe("Moderate");
  });

  it("returns Trade when High + no conflict", () => {
    const result = evaluateTradeDecision("High", noConflict);
    expect(result.decision).toBe("Trade");
    expect(result.conviction).toBe("High");
  });

  it("returns Conflicted when Moderate + conflict (never silently dropped)", () => {
    const result = evaluateTradeDecision("Moderate", withConflict);
    expect(result.decision).toBe("Conflicted");
    expect(result.conviction).toBe("Moderate");
    expect(result.conflict_result.conflict).toBe(true);
    expect(result.conflict_result.reason).not.toBeNull();
  });

  it("returns Conflicted when High + conflict (never silently dropped)", () => {
    const result = evaluateTradeDecision("High", withConflict);
    expect(result.decision).toBe("Conflicted");
    expect(result.conviction).toBe("High");
    expect(result.conflict_result.conflict).toBe(true);
    expect(result.conflict_result.reason).not.toBeNull();
  });

  it("always includes conflict_result in the returned object", () => {
    const result = evaluateTradeDecision("Moderate", withConflict);
    expect(result.conflict_result).toBeDefined();
    expect(result.conflict_result).toStrictEqual(withConflict);
  });
});
