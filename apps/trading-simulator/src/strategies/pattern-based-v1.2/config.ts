import { BASE_STRATEGY_CONFIG, type StrategyConfig } from '../base-config.js';

// ── pattern-based-v1 specific settings ───────────────────────────────────────

/**
 * Config for pattern-based-v1.1. Inherits all base config fields.
 *
 * `tpMultiplier` serves as the initial TP multiplier only. Once the running
 * Profit Factor transitions from Infinity to a finite value (first losing
 * trade), the strategy replaces it with the live PF value automatically.
 */
export interface PatternBasedV1Config extends StrategyConfig {
  // No additional fields beyond base config — the adaptive TP behaviour is
  // implemented in the strategy runner, not the config.
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
