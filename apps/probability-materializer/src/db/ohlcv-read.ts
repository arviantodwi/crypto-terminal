import { bigint, doublePrecision, pgTable, primaryKey, varchar } from 'drizzle-orm/pg-core';

// Read-only table reference for querying ohlcv_candles.
// Source of truth: apps/candle-collector/src/db/schema.ts
// Only the columns required by probability computation are included here.
export const ohlcvCandles = pgTable(
  'ohlcv_candles',
  {
    instrument: varchar('instrument', { length: 100 }).notNull(),
    open_time: bigint('open_time', { mode: 'number' }).notNull(),
    timeframe: varchar('timeframe', { length: 10 }).notNull(),
    pct_change: doublePrecision('pct_change').notNull(),
    body_ratio: doublePrecision('body_ratio').notNull(),
  },
  (table) => [primaryKey({ columns: [table.instrument, table.open_time, table.timeframe] })],
);
