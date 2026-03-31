import { doublePrecision, integer, pgTable, primaryKey, timestamp, varchar } from 'drizzle-orm/pg-core';

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
export type NewPatternProbability = typeof patternProbabilities.$inferInsert;
