/**
 * Read-only Drizzle schema referencing tables owned by other apps.
 *
 * Source of truth:
 *   ohlcv_candles       → apps/candle-collector/src/db/schema.ts
 *   pattern_probabilities → apps/probability-materializer/src/db/schema.ts
 */

import {
  bigint,
  doublePrecision,
  integer,
  pgTable,
  primaryKey,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';

// ── ohlcv_candles ─────────────────────────────────────────────────────────────

export const ohlcvCandles = pgTable(
  'ohlcv_candles',
  {
    instrument: varchar('instrument', { length: 100 }).notNull(),
    open_time: bigint('open_time', { mode: 'number' }).notNull(),
    timeframe: varchar('timeframe', { length: 10 }).notNull(),
    open: doublePrecision('open').notNull(),
    high: doublePrecision('high').notNull(),
    low: doublePrecision('low').notNull(),
    close: doublePrecision('close').notNull(),
    volume: doublePrecision('volume').notNull(),
    quote_volume: doublePrecision('quote_volume').notNull(),
    num_trades: bigint('num_trades', { mode: 'number' }).notNull(),
    // Derived fields — computed at ingestion time by candle-collector
    pct_change: doublePrecision('pct_change').notNull(),
    candle_range: doublePrecision('candle_range').notNull(),
    body_ratio: doublePrecision('body_ratio').notNull(),
  },
  (table) => [primaryKey({ columns: [table.instrument, table.open_time, table.timeframe] })],
);

// ── pattern_probabilities ─────────────────────────────────────────────────────

export const patternProbabilities = pgTable(
  'pattern_probabilities',
  {
    instrument: varchar('instrument', { length: 100 }).notNull(),
    timeframe: varchar('timeframe', { length: 10 }).notNull(),
    c1_label: varchar('c1_label', { length: 20 }).notNull(),
    c2_label: varchar('c2_label', { length: 20 }).notNull(),
    c3_label: varchar('c3_label', { length: 20 }).notNull(),
    occurrences: integer('occurrences').notNull(),
    up_count: integer('up_count').notNull(),
    down_count: integer('down_count').notNull(),
    up_probability: doublePrecision('up_probability').notNull(),
    down_probability: doublePrecision('down_probability').notNull(),
    computed_at: timestamp('computed_at').notNull(),
  },
  (table) => [
    primaryKey({
      columns: [
        table.instrument,
        table.timeframe,
        table.c1_label,
        table.c2_label,
        table.c3_label,
      ],
    }),
  ],
);

export type PatternProbability = typeof patternProbabilities.$inferSelect;
