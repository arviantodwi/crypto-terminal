import {
  calcDirectionalAgreement,
  calcDollarRisk,
  calcLeverage,
  calcMaxRange,
  calcMomentumScore,
  calcAbsoluteVolatility,
  calcBodyConflict,
  calcChaosScore,
  calcConvictionWeighted,
  calcFullSwing,
  calcPivotRange,
  calcRangeCeiling,
  calcRejectionMagnitude,
  calcReversalStrength,
  calcSequenceSlope,
  calcSimpleAverage,
  calcSlPrice,
  calcTotalExposure,
  calcTpPrice,
  calcTrendAcceleration,
  calcVolatilityProxy,
  calcWeightedAverage,
  calcWickDominance,
  calcWickRatio,
  classifyCandle,
  detectConflict,
  discriminateRoute,
  evaluateTradeDecision,
  getConvictionTier,
  selectSlFormula,
  type GroupFormulaResult,
} from '@crypto-terminal/trade-formula';
import type { OhlcCandle, TradeSignal } from '../../engine/types.js';
import type { PatternProbability } from '../../db/schema.js';
import type { PatternBasedV1Config } from './config.js';

// ── Public analyzePattern function ────────────────────────────────────────────

/**
 * Runs the full pattern-based-v1 analysis pipeline on a 3-candle window.
 *
 * @param candles  [c1, c2, c3] window — oldest to newest.
 * @param prob     Pattern probability row from the pre-loaded cache, or null.
 * @param config   Fully resolved strategy config.
 * @param balance  Current account balance in USD.
 * @returns TradeSignal if a valid trade opportunity is found, null otherwise.
 */
export function analyzePattern(
  candles: [OhlcCandle, OhlcCandle, OhlcCandle],
  prob: PatternProbability | null,
  config: PatternBasedV1Config,
  balance: number,
): TradeSignal | null {
  const [c1, c2, c3] = candles;
  const entryPrice = c3.close;

  // ── Step 1: Classify each candle ─────────────────────────────────────────

  const c1Label = classifyCandle(c1.pct_change, c1.body_ratio);
  const c2Label = classifyCandle(c2.pct_change, c2.body_ratio);
  const c3Label = classifyCandle(c3.pct_change, c3.body_ratio);

  // Skip any window that contains a flat candle — pattern has no directional signal
  if (c1Label === 'flat' || c2Label === 'flat' || c3Label === 'flat') {
    return null;
  }

  // ── Step 2: Pattern probability lookup ───────────────────────────────────

  if (prob === null) {
    return null; // Pattern not in the materialized view
  }

  const { up_probability, down_probability } = prob;

  // Determine direction based on which side meets the conviction threshold.
  // Both cannot simultaneously meet the threshold: up_probability + down_probability === 100
  // and convictionThreshold must be > 50, so at most one side can qualify.
  let direction: 'LONG' | 'SHORT';
  let postgresProbability: number;

  if (up_probability >= config.convictionThreshold) {
    direction = 'LONG';
    postgresProbability = up_probability;
  } else if (down_probability >= config.convictionThreshold) {
    direction = 'SHORT';
    postgresProbability = down_probability;
  } else {
    return null; // Neither side meets threshold
  }

  // ── Step 3: Pre-computation layer ────────────────────────────────────────

  const m1 = calcMomentumScore(c1.pct_change, c1.body_ratio);
  const m2 = calcMomentumScore(c2.pct_change, c2.body_ratio);
  const m3 = calcMomentumScore(c3.pct_change, c3.body_ratio);
  const sequenceSlope = calcSequenceSlope(c1.pct_change, c3.pct_change);
  const volatilityProxy = calcVolatilityProxy(c1.candle_range, c2.candle_range, c3.candle_range);
  const directionalAgreement = calcDirectionalAgreement(c1Label, c2Label, c3Label);
  const wr1 = calcWickRatio(c1.body_ratio);
  const wr2 = calcWickRatio(c2.body_ratio);
  const wr3 = calcWickRatio(c3.body_ratio);

  // ── Step 4: Route discrimination ─────────────────────────────────────────

  const route = discriminateRoute(directionalAgreement, c1Label, c3Label, m1, m3);

  // ── Step 5: Conflict detection and trade decision ─────────────────────────

  const conviction = getConvictionTier(postgresProbability);
  const conflictResult = detectConflict(direction, route, directionalAgreement);
  const tradeDecision = evaluateTradeDecision(conviction, conflictResult);

  if (tradeDecision.decision !== 'Trade') {
    return null; // Skip or conflicted
  }

  // ── Step 6: Compute group formulas ────────────────────────────────────────

  let allFormulas: GroupFormulaResult[];

  if (route === 'Trend') {
    allFormulas = [
      calcSimpleAverage(c1, c2, c3),
      calcWeightedAverage(c1, c2, c3),
      calcConvictionWeighted(c1, c2, c3),
      calcRangeCeiling(c1, c2, c3),
      calcTrendAcceleration(sequenceSlope),
    ];
  } else if (route === 'Reversal') {
    allFormulas = [
      calcPivotRange(c2),
      calcFullSwing(c1, c3),
      calcReversalStrength(c3),
      calcRejectionMagnitude(c1, c3),
      calcBodyConflict(c1, c3, volatilityProxy),
    ];
  } else {
    // Pullback
    allFormulas = [
      calcMaxRange(c1, c2, c3),
      calcAbsoluteVolatility(c1, c2, c3),
      calcChaosScore(c1, c2, c3),
      calcWickDominance(c1, c2, c3, volatilityProxy),
      calcTotalExposure(c1, c2, c3),
    ];
  }

  const eligibleFormulas = allFormulas.filter((f) => f.sl_eligible);

  if (eligibleFormulas.length === 0) {
    // Should not happen with valid data — all route formula sets include at least one
    // sl_eligible formula. Log a warning to surface unexpected data quality issues.
    console.warn(
      `[pattern-based-v1] No eligible SL formulas for route "${route}" — skipping signal`,
    );
    return null;
  }

  // ── Step 7: Select SL via percentile banding ─────────────────────────────

  // conviction is guaranteed non-Skip here (evaluateTradeDecision returned 'Trade')
  const selectedFormula = selectSlFormula(
    route,
    conviction as Exclude<typeof conviction, 'Skip'>,
    eligibleFormulas,
  );
  const sl_pct = selectedFormula.value;

  // ── Step 8: Calculate execution parameters ────────────────────────────────

  const slPrice = calcSlPrice(entryPrice, sl_pct, direction);
  const tpPrice = calcTpPrice(entryPrice, sl_pct, config.tpMultiplier, direction);
  const { leverage, wide_sl_flag } = calcLeverage(config.riskPct, sl_pct);
  const dollarRisk = calcDollarRisk(balance, leverage, sl_pct);

  // ── Assemble TradeSignal ──────────────────────────────────────────────────

  return {
    direction,
    entryPrice,
    slPrice,
    tpPrice,
    leverage,
    dollarRisk,
    metadata: {
      // Candle classification
      pattern: [c1Label, c2Label, c3Label],
      // Probability
      up_probability,
      down_probability,
      postgres_probability: postgresProbability,
      // Pre-computation
      momentum_scores: [m1, m2, m3],
      sequence_slope: sequenceSlope,
      volatility_proxy: volatilityProxy,
      directional_agreement: directionalAgreement,
      wick_ratios: [wr1, wr2, wr3],
      // Route & decision
      route,
      conviction,
      conflict: conflictResult.conflict,
      conflict_reason: conflictResult.reason,
      // Group formulas
      group_formulas: allFormulas.map((f) => ({
        name: f.name,
        value: f.value,
        sl_eligible: f.sl_eligible,
      })),
      // Percentile selection
      selected_formula: selectedFormula.formula_name,
      percentile_rank: selectedFormula.percentile_rank,
      sl_pct,
      // Execution
      wide_sl_flag,
      balance_at_signal: balance,
    },
  };
}
