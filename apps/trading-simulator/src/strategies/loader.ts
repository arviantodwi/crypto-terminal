import type { Db } from '../db/client.js';
import { fetchAllPatternProbabilities } from '../db/queries.js';
import type { StrategyRunner } from '../engine/types.js';
import type { StrategyConfig } from './base-config.js';
import { createPatternBasedV1Config } from './pattern-based-v1/config.js';
import { PatternBasedV1 } from './pattern-based-v1/index.js';
import { createPatternBasedV1Config as createPatternBasedV11Config } from './pattern-based-v1.1/config.js';
import { PatternBasedV11 } from './pattern-based-v1.1/index.js';

// ── Strategy registry ─────────────────────────────────────────────────────────

export const KNOWN_STRATEGIES = ['pattern-based-v1', 'pattern-based-v1.1'] as const;
export type StrategyName = (typeof KNOWN_STRATEGIES)[number];

/**
 * Dynamically loads and initialises a strategy by name.
 *
 * For strategies that require historical data (e.g. pattern-based-v1), this
 * function fetches the necessary data from the database and passes it to the
 * strategy constructor so that `analyze()` can remain synchronous.
 *
 * @throws Error if the strategy name is unknown.
 */
export async function loadStrategy(
  name: StrategyName,
  db: Db,
  config: Pick<StrategyConfig, 'instrument' | 'timeframe' | 'initialBalance'> &
    Partial<Omit<StrategyConfig, 'instrument' | 'timeframe' | 'initialBalance'>>,
): Promise<StrategyRunner> {
  if (name === 'pattern-based-v1') {
    const resolvedConfig = createPatternBasedV1Config(config);

    const rows = await fetchAllPatternProbabilities(db, config.instrument, config.timeframe);

    const patternCache = new Map(
      rows.map((row) => [`${row.c1_label}:${row.c2_label}:${row.c3_label}`, row]),
    );

    return new PatternBasedV1(resolvedConfig, patternCache);
  }

  if (name === 'pattern-based-v1.1') {
    const resolvedConfig = createPatternBasedV11Config(config);

    const rows = await fetchAllPatternProbabilities(db, config.instrument, config.timeframe);

    const patternCache = new Map(
      rows.map((row) => [`${row.c1_label}:${row.c2_label}:${row.c3_label}`, row]),
    );

    return new PatternBasedV11(resolvedConfig, patternCache);
  }

  throw new Error(
    `[loader] Unknown strategy: "${name}". Known strategies: ${KNOWN_STRATEGIES.join(', ')}`,
  );
}
