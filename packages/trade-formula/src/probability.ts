import { PROBABILITY_TIERS } from './constants.js';
import type {
  ConflictResult,
  ConvictionTier,
  Route,
  TradeDecisionResult,
  TradeSide,
} from './types.js';

/**
 * Maps a probability value to a conviction tier (see README §2).
 *
 * | Tier     | Range    |
 * |----------|----------|
 * | Dominant | ≥ 80%    |
 * | High     | 75–79%   |
 * | Moderate | 68–74%   |
 * | Skip     | < 68%    |
 */
export function getConvictionTier(probability: number): ConvictionTier {
  const t = PROBABILITY_TIERS;
  if (probability >= t.DOMINANT_MIN) return 'Dominant';
  if (probability >= t.HIGH_MIN) return 'High';
  if (probability >= t.MODERATE_MIN) return 'Moderate';
  return 'Skip';
}

/**
 * Detects a directional conflict between the Postgres predicted direction and
 * the structural direction implied by the route (see README §2).
 *
 * Structural direction is derived from directional_agreement sign:
 *   > 0 → LONG  (net bullish window)
 *   < 0 → SHORT (net bearish window)
 */
export function detectConflict(
  postgres_direction: TradeSide,
  route: Route,
  directional_agreement: number,
): ConflictResult {
  const structural: TradeSide = directional_agreement > 0 ? 'LONG' : 'SHORT';
  if (postgres_direction !== structural) {
    return {
      conflict: true,
      reason: `Postgres predicts ${postgres_direction} but route ${route} implies ${structural} (directional_agreement=${directional_agreement})`,
    };
  }
  return { conflict: false, reason: null };
}

/**
 * Applies the full trade decision matrix (see README §2):
 *
 * | Conviction | Conflict | Decision   |
 * |------------|----------|------------|
 * | Skip       | any      | Skip       |
 * | Dominant   | any      | Trade      | ← Postgres dominates, conflict overridden
 * | Moderate   | false    | Trade      |
 * | High       | false    | Trade      |
 * | Moderate   | true     | Conflicted |
 * | High       | true     | Conflicted |
 *
 * Conflicted patterns are never silently dropped — they are always returned
 * with a non-null conflict reason for AI learning.
 */
export function evaluateTradeDecision(
  conviction_tier: ConvictionTier,
  conflict: ConflictResult,
): TradeDecisionResult {
  if (conviction_tier === 'Skip') {
    return { conflict_result: conflict, conviction: conviction_tier, decision: 'Skip' };
  }

  if (conviction_tier === 'Dominant') {
    return { conflict_result: conflict, conviction: conviction_tier, decision: 'Trade' };
  }

  // Moderate or High
  if (conflict.conflict) {
    return { conflict_result: conflict, conviction: conviction_tier, decision: 'Conflicted' };
  }

  return { conflict_result: conflict, conviction: conviction_tier, decision: 'Trade' };
}
