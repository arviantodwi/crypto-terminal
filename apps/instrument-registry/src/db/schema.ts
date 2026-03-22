import { bigint, pgTable, timestamp, varchar } from 'drizzle-orm/pg-core';

export const instruments = pgTable('instruments', {
  symbol: varchar('symbol', { length: 50 }).primaryKey(),
  pair: varchar('pair', { length: 50 }).notNull(),
  contractType: varchar('contract_type', { length: 50 }).notNull(),
  deliveryDate: bigint('delivery_date', { mode: 'number' }).notNull(),
  status: varchar('status', { length: 50 }).notNull(),
  lastSyncedAt: timestamp('last_synced_at').notNull(),
});

export type Instrument = typeof instruments.$inferSelect;
export type NewInstrument = typeof instruments.$inferInsert;
