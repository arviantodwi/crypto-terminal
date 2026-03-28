import { describe, it, expect } from "vitest";
import type { GroupFormulaResult } from "../src/types.js";
import { selectSlFormula } from "../src/percentile.js";

// README §12 worked example: Trend + Moderate → 75th → 3rd of 4 = T2 (0.514%)
const trendEligible: GroupFormulaResult[] = [
  { name: "T1", value: 0.486, sl_eligible: true },
  { name: "T2", value: 0.514, sl_eligible: true },
  { name: "T3", value: 0.355, sl_eligible: true },
  { name: "T4", value: 0.842, sl_eligible: true },
];

// 4 eligible reversal formulas (R1, R2, R4, R5)
const reversalEligible: GroupFormulaResult[] = [
  { name: "R1", value: 0.8, sl_eligible: true },
  { name: "R2", value: 2.613, sl_eligible: true },
  { name: "R4", value: 1.915, sl_eligible: true },
  { name: "R5", value: 0.283, sl_eligible: true },
];
// sorted asc: [R5=0.283, R1=0.8, R4=1.915, R2=2.613]

// 5 eligible pullback formulas (P1–P5)
const pullbackEligible: GroupFormulaResult[] = [
  { name: "P1", value: 1.6, sl_eligible: true },
  { name: "P2", value: 0.829, sl_eligible: true },
  { name: "P3", value: 0.701, sl_eligible: true },
  { name: "P4", value: 0.312, sl_eligible: true },
  { name: "P5", value: 3.482, sl_eligible: true },
];
// sorted asc: [P4=0.312, P3=0.701, P2=0.829, P1=1.6, P5=3.482]

describe("selectSlFormula — Trend", () => {
  it("Moderate → 75th → 3rd of 4 — README §12 fixture", () => {
    const result = selectSlFormula("Trend", "Moderate", trendEligible);
    // sorted: [T3=0.355, T1=0.486, T2=0.514, T4=0.842] → index 2 → T2
    expect(result.formula_name).toBe("T2");
    expect(result.value).toBeCloseTo(0.514, 3);
    expect(result.percentile_rank).toBe(75);
  });

  it("High → 50th → 2nd of 4", () => {
    const result = selectSlFormula("Trend", "High", trendEligible);
    // sorted: [T3=0.355, T1=0.486, T2=0.514, T4=0.842] → index 1 → T1
    expect(result.formula_name).toBe("T1");
    expect(result.value).toBeCloseTo(0.486, 3);
    expect(result.percentile_rank).toBe(50);
  });

  it("Dominant → 25th → 1st of 4 (tightest)", () => {
    const result = selectSlFormula("Trend", "Dominant", trendEligible);
    // sorted: [T3=0.355, ...] → index 0 → T3
    expect(result.formula_name).toBe("T3");
    expect(result.value).toBeCloseTo(0.355, 3);
    expect(result.percentile_rank).toBe(25);
  });
});

describe("selectSlFormula — Reversal", () => {
  it("Moderate → 100th → 4th of 4 (widest)", () => {
    const result = selectSlFormula("Reversal", "Moderate", reversalEligible);
    // sorted asc: [R5=0.283, R1=0.8, R4=1.915, R2=2.613] → index 3 → R2
    expect(result.formula_name).toBe("R2");
    expect(result.value).toBeCloseTo(2.613, 3);
    expect(result.percentile_rank).toBe(100);
  });

  it("High → 75th → 3rd of 4", () => {
    const result = selectSlFormula("Reversal", "High", reversalEligible);
    // index 2 → R4
    expect(result.formula_name).toBe("R4");
    expect(result.value).toBeCloseTo(1.915, 3);
    expect(result.percentile_rank).toBe(75);
  });

  it("Dominant → 50th → 2nd of 4", () => {
    const result = selectSlFormula("Reversal", "Dominant", reversalEligible);
    // index 1 → R1
    expect(result.formula_name).toBe("R1");
    expect(result.value).toBeCloseTo(0.8, 3);
    expect(result.percentile_rank).toBe(50);
  });
});

describe("selectSlFormula — Pullback", () => {
  it("Moderate → 80th → 4th of 5", () => {
    const result = selectSlFormula("Pullback", "Moderate", pullbackEligible);
    // sorted: [P4=0.312, P3=0.701, P2=0.829, P1=1.6, P5=3.482] → index 3 → P1
    expect(result.formula_name).toBe("P1");
    expect(result.value).toBeCloseTo(1.6, 3);
    expect(result.percentile_rank).toBe(80);
  });

  it("High → 60th → 3rd of 5", () => {
    const result = selectSlFormula("Pullback", "High", pullbackEligible);
    // index 2 → P2
    expect(result.formula_name).toBe("P2");
    expect(result.value).toBeCloseTo(0.829, 3);
    expect(result.percentile_rank).toBe(60);
  });

  it("Dominant → 40th → 2nd of 5", () => {
    const result = selectSlFormula("Pullback", "Dominant", pullbackEligible);
    // index 1 → P3
    expect(result.formula_name).toBe("P3");
    expect(result.value).toBeCloseTo(0.701, 3);
    expect(result.percentile_rank).toBe(40);
  });
});

describe("selectSlFormula — tied values are handled positionally", () => {
  it("duplicate values in sorted list — pick is still stable and position-based", () => {
    const tied: GroupFormulaResult[] = [
      { name: "T1", value: 0.5, sl_eligible: true },
      { name: "T2", value: 0.5, sl_eligible: true },
      { name: "T3", value: 0.5, sl_eligible: true },
      { name: "T4", value: 0.5, sl_eligible: true },
    ];
    // All tied — Moderate picks index 2 regardless
    const result = selectSlFormula("Trend", "Moderate", tied);
    expect(result.value).toBe(0.5);
    expect(result.percentile_rank).toBe(75);
  });
});

describe("selectSlFormula — does not mutate input array", () => {
  it("original order of eligible_formula_outputs is preserved", () => {
    const input = [...trendEligible];
    const originalOrder = input.map((f) => f.name);
    selectSlFormula("Trend", "Moderate", input);
    expect(input.map((f) => f.name)).toEqual(originalOrder);
  });
});
