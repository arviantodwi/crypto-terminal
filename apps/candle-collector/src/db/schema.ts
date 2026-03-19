import { bigint, doublePrecision, pgTable, primaryKey, varchar } from 'drizzle-orm/pg-core';

export const ohlcCandles = pgTable(
  'ohlc_history',
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
  },
  (table) => [primaryKey({ columns: [table.instrument, table.open_time, table.timeframe] })],
);

export type NewOhlcCandle = typeof ohlcCandles.$inferInsert;
