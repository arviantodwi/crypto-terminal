/**
 * End-to-end integration test for @crypto-terminal/trade-formula.
 *
 * Reproduces the full Section 12 worked example from the README using ONLY
 * imports from the package entry point — no internal path imports.
 *
 * Raw OHLC input → derived fields → classification → pre-computation →
 * route discrimination → probability check → group formulas →
 * percentile selection → SL/TP prices → leverage → dollar risk.
 */

import {
  calcBodyRatio,
  calcCandleRange,
  calcConvictionWeighted,
  calcDirectionalAgreement,
  calcDollarRisk,
  calcLeverage,
  // Pre-computation
  calcMomentumScore,
  // Derived fields
  calcPctChange,
  calcRangeCeiling,
  calcSequenceSlope,
  // Group formulas — Trend
  calcSimpleAverage,
  // Execution
  calcSlPrice,
  calcTpPrice,
  calcTrendAcceleration,
  calcVolatilityProxy,
  calcWeightedAverage,
  calcWickRatio,
  // Classification
  classifyCandle,
  detectConflict,
  // Route
  discriminateRoute,
  evaluateTradeDecision,
  // Probability
  getConvictionTier,
  // Types (imported to annotate locals)
  type OhlcCandle,
  // Percentile selection
  selectSlFormula,
} from '@crypto-terminal/trade-formula';
import { describe, expect, it } from 'vitest';

// ── §12 raw OHLC input ────────────────────────────────────────────────────────

const RAW = {
  c1: { close: 65_100, high: 65_150, low: 64_750, open: 64_800 },
  c2: { close: 65_350, high: 65_400, low: 65_050, open: 65_100 },
  c3: { close: 65_750, high: 65_850, low: 65_300, open: 65_350 },
};

const ENTRY_PRICE = 65_000; // fixed entry price from README §12 example
const ACCOUNT_SIZE = 1_000;
const RISK_PCT = 3;
const TP_MULTIPLIER = 2;
const PROBABILITY = 73; // from Postgres materialized table

// ── Step 0 — Derive base fields ───────────────────────────────────────────────

describe('Step 0 — Derive base fields', () => {
  it('computes pct_change for each candle', () => {
    expect(calcPctChange(RAW.c1.open, RAW.c1.close)).toBeCloseTo(0.463, 3);
    expect(calcPctChange(RAW.c2.open, RAW.c2.close)).toBeCloseTo(0.384, 3);
    expect(calcPctChange(RAW.c3.open, RAW.c3.close)).toBeCloseTo(0.612, 3);
  });

  it('computes body_ratio for each candle', () => {
    expect(calcBodyRatio(RAW.c1.open, RAW.c1.close, RAW.c1.high, RAW.c1.low)).toBeCloseTo(0.75, 3);
    expect(calcBodyRatio(RAW.c2.open, RAW.c2.close, RAW.c2.high, RAW.c2.low)).toBeCloseTo(0.714, 3);
    expect(calcBodyRatio(RAW.c3.open, RAW.c3.close, RAW.c3.high, RAW.c3.low)).toBeCloseTo(0.727, 3);
  });

  it('computes candle_range for each candle', () => {
    expect(calcCandleRange(RAW.c1.open, RAW.c1.high, RAW.c1.low)).toBeCloseTo(0.617, 3);
    expect(calcCandleRange(RAW.c2.open, RAW.c2.high, RAW.c2.low)).toBeCloseTo(0.538, 3);
    expect(calcCandleRange(RAW.c3.open, RAW.c3.high, RAW.c3.low)).toBeCloseTo(0.842, 3);
  });
});

// Build fully-derived candle objects for the rest of the pipeline
const c1: OhlcCandle = {
  ...RAW.c1,
  body_ratio: calcBodyRatio(RAW.c1.open, RAW.c1.close, RAW.c1.high, RAW.c1.low),
  candle_range: calcCandleRange(RAW.c1.open, RAW.c1.high, RAW.c1.low),
  pct_change: calcPctChange(RAW.c1.open, RAW.c1.close),
};
const c2: OhlcCandle = {
  ...RAW.c2,
  body_ratio: calcBodyRatio(RAW.c2.open, RAW.c2.close, RAW.c2.high, RAW.c2.low),
  candle_range: calcCandleRange(RAW.c2.open, RAW.c2.high, RAW.c2.low),
  pct_change: calcPctChange(RAW.c2.open, RAW.c2.close),
};
const c3: OhlcCandle = {
  ...RAW.c3,
  body_ratio: calcBodyRatio(RAW.c3.open, RAW.c3.close, RAW.c3.high, RAW.c3.low),
  candle_range: calcCandleRange(RAW.c3.open, RAW.c3.high, RAW.c3.low),
  pct_change: calcPctChange(RAW.c3.open, RAW.c3.close),
};

// ── Step 1 — Candle classification ───────────────────────────────────────────

describe('Step 1 — Candle classification', () => {
  it('classifies the 3-candle pattern as [up_strong, up_medium, up_strong]', () => {
    expect(classifyCandle(c1.pct_change, c1.body_ratio)).toBe('up_strong');
    expect(classifyCandle(c2.pct_change, c2.body_ratio)).toBe('up_medium');
    expect(classifyCandle(c3.pct_change, c3.body_ratio)).toBe('up_strong');
  });
});

const c1Label = classifyCandle(c1.pct_change, c1.body_ratio);
const c2Label = classifyCandle(c2.pct_change, c2.body_ratio);
const c3Label = classifyCandle(c3.pct_change, c3.body_ratio);

// ── Step 3 — Pre-computation layer ───────────────────────────────────────────

describe('Step 3 — Pre-computation layer', () => {
  it('computes momentum scores', () => {
    expect(calcMomentumScore(c1.pct_change, c1.body_ratio)).toBeCloseTo(0.347, 3);
    expect(calcMomentumScore(c2.pct_change, c2.body_ratio)).toBeCloseTo(0.274, 3);
    expect(calcMomentumScore(c3.pct_change, c3.body_ratio)).toBeCloseTo(0.445, 3);
  });

  it('computes sequence slope = +0.149 (accelerating)', () => {
    expect(calcSequenceSlope(c1.pct_change, c3.pct_change)).toBeCloseTo(0.149, 3);
  });

  it('computes wick ratios', () => {
    expect(calcWickRatio(c1.body_ratio)).toBeCloseTo(0.25, 3);
    expect(calcWickRatio(c2.body_ratio)).toBeCloseTo(0.286, 3);
    expect(calcWickRatio(c3.body_ratio)).toBeCloseTo(0.273, 3);
  });

  it('computes volatility proxy ≈ 0.666%', () => {
    expect(calcVolatilityProxy(c1.candle_range, c2.candle_range, c3.candle_range)).toBeCloseTo(
      0.666,
      3,
    );
  });

  it('computes directional agreement = +3 (all bullish)', () => {
    expect(calcDirectionalAgreement(c1Label, c2Label, c3Label)).toBe(3);
  });
});

const m1 = calcMomentumScore(c1.pct_change, c1.body_ratio);
const m3 = calcMomentumScore(c3.pct_change, c3.body_ratio);
const sequenceSlope = calcSequenceSlope(c1.pct_change, c3.pct_change);
const _volatilityProxy = calcVolatilityProxy(c1.candle_range, c2.candle_range, c3.candle_range);
const directionalAgreement = calcDirectionalAgreement(c1Label, c2Label, c3Label);

// ── Step 4 — Route discrimination ────────────────────────────────────────────

describe('Step 4 — Route discrimination', () => {
  it('routes to Trend (directional_agreement = +3)', () => {
    expect(discriminateRoute(directionalAgreement, c1Label, c3Label, m1, m3)).toBe('Trend');
  });
});

const route = discriminateRoute(directionalAgreement, c1Label, c3Label, m1, m3);

// ── Step 2 — Probability check and conflict detection ─────────────────────────
// (evaluated after route is known, per README §11)

describe('Step 2 — Probability check and conflict detection', () => {
  it('73% → Moderate conviction', () => {
    expect(getConvictionTier(PROBABILITY)).toBe('Moderate');
  });

  it('no conflict — Postgres says LONG, Trend route implies uptrend', () => {
    const result = detectConflict('LONG', route, directionalAgreement);
    expect(result.conflict).toBe(false);
    expect(result.reason).toBeNull();
  });

  it('trade decision = Trade (Moderate + no conflict)', () => {
    const conviction = getConvictionTier(PROBABILITY);
    const conflictResult = detectConflict('LONG', route, directionalAgreement);
    const decision = evaluateTradeDecision(conviction, conflictResult);
    expect(decision.decision).toBe('Trade');
    expect(decision.conviction).toBe('Moderate');
  });
});

const conviction = getConvictionTier(PROBABILITY);

// ── Step 5 — Compute Trend group formulas ─────────────────────────────────────

describe('Step 5 — Compute Trend group formulas', () => {
  it('T1 Simple Average ≈ 0.486%, sl_eligible', () => {
    const r = calcSimpleAverage(c1, c2, c3);
    expect(r.name).toBe('T1');
    expect(r.value).toBeCloseTo(0.486, 3);
    expect(r.sl_eligible).toBe(true);
  });

  it('T2 Weighted Average ≈ 0.514%, sl_eligible', () => {
    const r = calcWeightedAverage(c1, c2, c3);
    expect(r.name).toBe('T2');
    expect(r.value).toBeCloseTo(0.514, 3);
    expect(r.sl_eligible).toBe(true);
  });

  it('T3 Conviction-Weighted ≈ 0.356%, sl_eligible', () => {
    // README §12 shows 0.355 using rounded intermediate values; exact OHLC
    // inputs produce 0.35556, which rounds to 0.356 at 3 significant digits.
    const r = calcConvictionWeighted(c1, c2, c3);
    expect(r.name).toBe('T3');
    expect(r.value).toBeCloseTo(0.356, 2);
    expect(r.sl_eligible).toBe(true);
  });

  it('T4 Range Ceiling = 0.842%, sl_eligible', () => {
    const r = calcRangeCeiling(c1, c2, c3);
    expect(r.name).toBe('T4');
    expect(r.value).toBeCloseTo(0.842, 3);
    expect(r.sl_eligible).toBe(true);
  });

  it('T5 Trend Acceleration = 0.149, NOT sl_eligible', () => {
    const r = calcTrendAcceleration(sequenceSlope);
    expect(r.name).toBe('T5');
    expect(r.value).toBeCloseTo(0.149, 3);
    expect(r.sl_eligible).toBe(false);
  });
});

const allGroupFormulas = [
  calcSimpleAverage(c1, c2, c3),
  calcWeightedAverage(c1, c2, c3),
  calcConvictionWeighted(c1, c2, c3),
  calcRangeCeiling(c1, c2, c3),
  calcTrendAcceleration(sequenceSlope),
];
const eligibleFormulas = allGroupFormulas.filter(f => f.sl_eligible);

// ── Step 6 — Percentile selection ─────────────────────────────────────────────

describe('Step 6 — Percentile selection', () => {
  it('Trend + Moderate → 75th percentile → T2 at 0.514%', () => {
    // conviction is 'Moderate' — safe cast since we checked ≠ 'Skip' via Trade decision
    const result = selectSlFormula(route, 'Moderate', eligibleFormulas);
    expect(result.formula_name).toBe('T2');
    expect(result.value).toBeCloseTo(0.514, 3);
    expect(result.percentile_rank).toBe(75);
  });
});

const selectedFormula = selectSlFormula(route, 'Moderate', eligibleFormulas);
const sl_pct = selectedFormula.value;

// ── Steps 7 & 8 — SL/TP prices and position sizing ───────────────────────────

describe('Steps 7 & 8 — SL/TP prices and position sizing', () => {
  it('SL price ≈ $64,665.90 (LONG)', () => {
    // README §12 uses rounded sl_pct=0.514%; the full pipeline uses the exact
    // T2 output (~0.51389%), producing SL≈$64,666.00 — within $0.50 of the example.
    expect(calcSlPrice(ENTRY_PRICE, sl_pct, 'LONG')).toBeCloseTo(64_665.9, 0);
  });

  it('TP price ≈ $65,668.20 (LONG, multiplier=2)', () => {
    expect(calcTpPrice(ENTRY_PRICE, sl_pct, TP_MULTIPLIER, 'LONG')).toBeCloseTo(65_668.2, 0);
  });

  it('leverage = 5x (raw=5.84, floor to 5)', () => {
    const { leverage, raw_leverage, wide_sl_flag } = calcLeverage(RISK_PCT, sl_pct);
    expect(raw_leverage).toBeCloseTo(5.84, 2);
    expect(leverage).toBe(5);
    expect(wide_sl_flag).toBe(false);
  });

  it('dollar_risk = $25.70', () => {
    const { leverage } = calcLeverage(RISK_PCT, sl_pct);
    expect(calcDollarRisk(ACCOUNT_SIZE, leverage, sl_pct)).toBeCloseTo(25.7, 1);
  });
});

// ── Full pipeline summary assertion ──────────────────────────────────────────

describe('Full pipeline — §12 summary', () => {
  it('produces the exact trade parameters from README §12', () => {
    const { leverage, wide_sl_flag } = calcLeverage(RISK_PCT, sl_pct);

    expect(classifyCandle(c1.pct_change, c1.body_ratio)).toBe('up_strong');
    expect(classifyCandle(c2.pct_change, c2.body_ratio)).toBe('up_medium');
    expect(classifyCandle(c3.pct_change, c3.body_ratio)).toBe('up_strong');
    expect(route).toBe('Trend');
    expect(conviction).toBe('Moderate');
    expect(sl_pct).toBeCloseTo(0.514, 3);
    expect(calcSlPrice(ENTRY_PRICE, sl_pct, 'LONG')).toBeCloseTo(64_665.9, 0);
    expect(calcTpPrice(ENTRY_PRICE, sl_pct, TP_MULTIPLIER, 'LONG')).toBeCloseTo(65_668.2, 0);
    expect(leverage).toBe(5);
    expect(calcDollarRisk(ACCOUNT_SIZE, leverage, sl_pct)).toBeCloseTo(25.7, 1);
    expect(wide_sl_flag).toBe(false);
  });
});
