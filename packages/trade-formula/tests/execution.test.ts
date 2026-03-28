import { describe, it, expect } from "vitest";
import {
  calcSlPrice,
  calcTpPrice,
  calcLeverage,
  calcDollarRisk,
} from "../src/execution.js";

describe("calcSlPrice", () => {
  it("LONG: subtracts sl_distance from entry", () => {
    // entry=100, sl_pct=1.5% → sl_distance=1.5 → SL=98.5
    expect(calcSlPrice(100, 1.5, "LONG")).toBeCloseTo(98.5, 5);
  });

  it("SHORT: adds sl_distance to entry", () => {
    // entry=100, sl_pct=1.5% → sl_distance=1.5 → SL=101.5
    expect(calcSlPrice(100, 1.5, "SHORT")).toBeCloseTo(101.5, 5);
  });

  it("README §8 example: entry=100, sl=1.5% → SL long=$98.50", () => {
    expect(calcSlPrice(100, 1.5, "LONG")).toBeCloseTo(98.5, 2);
  });
});

describe("calcTpPrice", () => {
  it("LONG: adds sl_distance × multiplier to entry", () => {
    // entry=100, sl_pct=1.5%, multiplier=2 → sl_distance=1.5 → TP=103
    expect(calcTpPrice(100, 1.5, 2, "LONG")).toBeCloseTo(103, 5);
  });

  it("SHORT: subtracts sl_distance × multiplier from entry", () => {
    expect(calcTpPrice(100, 1.5, 2, "SHORT")).toBeCloseTo(97, 5);
  });

  it("README §8 example: entry=100, sl=1.5%, mult=2 → TP long=$103.00", () => {
    expect(calcTpPrice(100, 1.5, 2, "LONG")).toBeCloseTo(103, 2);
  });
});

describe("calcLeverage", () => {
  it("uses floor() — never round()", () => {
    // risk=3%, sl=0.46% → raw=6.52 → floor=6, not round=7
    const { leverage, raw_leverage } = calcLeverage(3, 0.46);
    expect(raw_leverage).toBeCloseTo(6.52, 2);
    expect(leverage).toBe(6);
  });

  it("caps at 20x when raw leverage exceeds 20", () => {
    // risk=3%, sl=0.05% → raw=60 → capped at 20
    const { leverage } = calcLeverage(3, 0.05);
    expect(leverage).toBe(20);
  });

  it("floors at 1x when sl_pct > risk_pct", () => {
    // risk=3%, sl=3.2% → raw=0.9375 → floor=0 → clamp to 1
    const { leverage, wide_sl_flag } = calcLeverage(3, 3.2);
    expect(leverage).toBe(1);
    expect(wide_sl_flag).toBe(true);
  });

  it("wide_sl_flag is false when sl_pct <= risk_pct", () => {
    expect(calcLeverage(3, 0.514).wide_sl_flag).toBe(false);
    expect(calcLeverage(3, 3).wide_sl_flag).toBe(false);
  });

  it("wide_sl_flag is true only when sl_pct strictly > risk_pct", () => {
    expect(calcLeverage(3, 3.001).wide_sl_flag).toBe(true);
  });

  it("README §9 simulated cases", () => {
    // T-A: Dominant 0.46% → 6x
    expect(calcLeverage(3, 0.46).leverage).toBe(6);
    // T-B: High 0.90% → 3x
    expect(calcLeverage(3, 0.90).leverage).toBe(3);
    // T-C: Moderate 2.80% → 1x
    expect(calcLeverage(3, 2.80).leverage).toBe(1);
    // T-D: Dominant 0.05% → 20x (cap)
    expect(calcLeverage(3, 0.05).leverage).toBe(20);
    // R-A: Dominant 3.20% → 1x (floor), WIDE_SL
    const rA = calcLeverage(3, 3.2);
    expect(rA.leverage).toBe(1);
    expect(rA.wide_sl_flag).toBe(true);
  });
});

describe("calcDollarRisk", () => {
  it("returns account × leverage × (sl_pct / 100)", () => {
    // account=$1000, leverage=6, sl=0.46% → $1000×6×0.0046=$27.60
    expect(calcDollarRisk(1000, 6, 0.46)).toBeCloseTo(27.6, 2);
  });

  it("README §9 example: risk=3%, sl=0.46%, account=$1000 → $27.60", () => {
    expect(calcDollarRisk(1000, 6, 0.46)).toBeCloseTo(27.6, 2);
  });
});

describe("README §12 end-to-end integration fixture", () => {
  // BTCUSDT 5-min: entry=$65,000, sl_pct=0.514% (T2 selected), LONG
  // account=$1,000, risk_pct=3%, tp_multiplier=2
  const entry = 65_000;
  const sl_pct = 0.514;
  const side = "LONG" as const;
  const tp_multiplier = 2;
  const risk_pct = 3;
  const account_size = 1_000;

  it("SL price = $64,665.90", () => {
    expect(calcSlPrice(entry, sl_pct, side)).toBeCloseTo(64_665.9, 1);
  });

  it("TP price = $65,668.20", () => {
    expect(calcTpPrice(entry, sl_pct, tp_multiplier, side)).toBeCloseTo(65_668.2, 1);
  });

  it("leverage = 5x (raw=5.84, floor=5)", () => {
    const { leverage, raw_leverage } = calcLeverage(risk_pct, sl_pct);
    expect(raw_leverage).toBeCloseTo(5.84, 2);
    expect(leverage).toBe(5);
  });

  it("dollar_risk = $25.70", () => {
    const { leverage } = calcLeverage(risk_pct, sl_pct);
    expect(calcDollarRisk(account_size, leverage, sl_pct)).toBeCloseTo(25.7, 1);
  });

  it("wide_sl_flag = false (0.514% < 3%)", () => {
    expect(calcLeverage(risk_pct, sl_pct).wide_sl_flag).toBe(false);
  });
});
