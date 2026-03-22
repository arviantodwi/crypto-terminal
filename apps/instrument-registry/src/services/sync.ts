import { inArray, sql } from 'drizzle-orm';
import type { FastifyBaseLogger } from 'fastify';
import type { Db } from '../db/client.js';
import { instruments, type NewInstrument } from '../db/schema.js';
import { fetchExchangeInfo } from './binance.js';
import type { InstrumentChangePayload } from '../plugins/redis.js';

// Symbols whose deliveryDate falls within this window are flagged as upcoming delistings.
const UPCOMING_DELISTING_WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

interface SyncResult {
  newListings: number;
  delistings: number;
  upcomingDelistings: number;
  updates: number;
}

export async function syncInstruments(
  db: Db,
  publisher: { publishInstrumentChanges: (payload: InstrumentChangePayload) => Promise<void> },
  binanceBaseUrl: string,
  log: FastifyBaseLogger,
): Promise<SyncResult> {
  log.info('[sync] Fetching exchange info from Binance');
  const allSymbols = await fetchExchangeInfo(binanceBaseUrl);

  // Filter to PERPETUAL contracts only
  const perpetuals = allSymbols.filter((s) => s.contractType === 'PERPETUAL');
  log.info('[sync] Fetched %d PERPETUAL symbols from Binance', perpetuals.length);

  // Load current DB state
  const existing = await db.select().from(instruments);
  const existingMap = new Map(existing.map((i) => [i.symbol, i]));
  const incomingMap = new Map(perpetuals.map((s) => [s.symbol, s]));

  const now = Date.now();
  const delistingThreshold = now + UPCOMING_DELISTING_WINDOW_MS;

  const newListings: string[] = [];
  const updatedSymbols: string[] = [];
  const upcomingDelistings: Array<{ symbol: string; deliveryDate: number }> = [];
  const removedSymbols: string[] = [];

  // Detect new and updated symbols
  for (const [symbol, incoming] of incomingMap) {
    const current = existingMap.get(symbol);

    if (!current) {
      newListings.push(symbol);
      // New symbol with near-future delivery date is an upcoming delisting
      if (incoming.deliveryDate > now && incoming.deliveryDate < delistingThreshold) {
        upcomingDelistings.push({ symbol, deliveryDate: incoming.deliveryDate });
      }
    } else {
      const hasChanges =
        current.status !== incoming.status ||
        current.deliveryDate !== incoming.deliveryDate ||
        current.contractType !== incoming.contractType ||
        current.pair !== incoming.pair;

      if (hasChanges) {
        updatedSymbols.push(symbol);
        // Delivery date updated to near future signals an upcoming delisting
        if (incoming.deliveryDate > now && incoming.deliveryDate < delistingThreshold) {
          upcomingDelistings.push({ symbol, deliveryDate: incoming.deliveryDate });
        }
      }
    }
  }

  // Detect removed symbols
  for (const symbol of existingMap.keys()) {
    if (!incomingMap.has(symbol)) {
      removedSymbols.push(symbol);
    }
  }

  log.info(
    {
      newListings: newListings.length,
      updates: updatedSymbols.length,
      delistings: removedSymbols.length,
      upcomingDelistings: upcomingDelistings.length,
    },
    '[sync] Diff complete',
  );

  // Upsert new and changed symbols
  const syncTime = new Date();
  const toUpsert: NewInstrument[] = [...newListings, ...updatedSymbols].map((symbol) => {
    const s = incomingMap.get(symbol)!;
    return {
      symbol: s.symbol,
      pair: s.pair,
      contractType: s.contractType,
      deliveryDate: s.deliveryDate,
      status: s.status,
      lastSyncedAt: syncTime,
    };
  });

  if (toUpsert.length > 0) {
    await db
      .insert(instruments)
      .values(toUpsert)
      .onConflictDoUpdate({
        target: instruments.symbol,
        set: {
          pair: sql`excluded.pair`,
          contractType: sql`excluded.contract_type`,
          deliveryDate: sql`excluded.delivery_date`,
          status: sql`excluded.status`,
          lastSyncedAt: sql`excluded.last_synced_at`,
        },
      });
    log.info('[sync] Upserted %d instruments', toUpsert.length);
  }

  // Delete removed symbols
  if (removedSymbols.length > 0) {
    await db.delete(instruments).where(inArray(instruments.symbol, removedSymbols));
    log.info('[sync] Deleted %d removed instruments', removedSymbols.length);
  }

  // Publish change event if anything changed
  const hasChanges =
    newListings.length > 0 || removedSymbols.length > 0 || updatedSymbols.length > 0;

  if (hasChanges) {
    await publisher.publishInstrumentChanges({
      newListings,
      delistings: removedSymbols,
      upcomingDelistings,
      updates: updatedSymbols,
    });
  } else {
    log.info('[sync] No changes detected, skipping Redis publish');
  }

  return {
    newListings: newListings.length,
    delistings: removedSymbols.length,
    upcomingDelistings: upcomingDelistings.length,
    updates: updatedSymbols.length,
  };
}
