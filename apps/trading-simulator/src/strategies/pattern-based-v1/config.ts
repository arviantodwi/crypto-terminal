import { BASE_STRATEGY_CONFIG, type StrategyConfig } from '../base-config.js';

// ── pattern-based-v1 specific settings ───────────────────────────────────────

/**
 * Extended config for pattern-based-v1. Inherits all base config fields and
 * adds strategy-specific settings.
 */
export interface PatternBasedV1Config extends StrategyConfig {
  // No overrides of base config defaults for v1 — kept at canonical values.
  // Future iterations can add percentile band overrides or timeframe weighting here.
}

/**
 * Creates a fully resolved config by merging caller-provided fields with
 * pattern-based-v1 defaults (which inherit from BASE_STRATEGY_CONFIG).
 */
export function createPatternBasedV1Config(
  overrides: Pick<StrategyConfig, 'instrument' | 'timeframe' | 'initialBalance'> &
    Partial<Omit<StrategyConfig, 'instrument' | 'timeframe' | 'initialBalance'>>,
): PatternBasedV1Config {
  return {
    ...BASE_STRATEGY_CONFIG,
    ...overrides,
  };
}
