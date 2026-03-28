import { PERCENTILE_MATRIX } from './constants.js';
import type {
  ConvictionTier,
  GroupFormulaResult,
  PercentileSelectionResult,
  Route,
} from './types.js';

/**
 * Selects the SL formula from eligible group formula outputs using percentile
 * banding (see README §6 and PERCENTILE_MATRIX in constants.ts).
 *
 * Steps:
 *   1. Sort eligible outputs ascending by value.
 *   2. Look up the 0-based index for this route × conviction_tier.
 *   3. Pick the formula at that index.
 *   4. Derive the percentile rank as `round((index + 1) / n × 100)`.
 *
 * Tied formula values are handled naturally — the sort is stable and
 * selection is purely position-based (see README §5, "Tied Formula Outputs").
 *
 * @param conviction_tier Must not be 'Skip' — Skip decisions never reach here.
 */
export function selectSlFormula(
  route: Route,
  conviction_tier: Exclude<ConvictionTier, 'Skip'>,
  eligible_formula_outputs: GroupFormulaResult[],
): PercentileSelectionResult {
  const sorted = [...eligible_formula_outputs].sort((a, b) => a.value - b.value);
  const index = PERCENTILE_MATRIX[route][conviction_tier];
  const selected = sorted[index];
  if (!selected) {
    throw new RangeError(
      `selectSlFormula: index ${index} out of bounds for ${sorted.length} eligible formulas (route=${route}, conviction=${conviction_tier})`,
    );
  }
  const percentile_rank = Math.round(((index + 1) / sorted.length) * 100);
  return {
    formula_name: selected.name,
    percentile_rank,
    value: selected.value,
  };
}
