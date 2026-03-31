import pg from 'pg';
import pino from 'pino';
import { and, asc, eq } from 'drizzle-orm';
import { config } from './config.js';
import { createDb } from './db/client.js';
import { ohlcvCandles } from './db/ohlcv-read.js';
import { computeProbabilities } from './compute.js';
import { upsertProbabilities } from './upsert.js';

const log = pino({ level: config.logLevel });
const { Pool } = pg;

async function main() {
  const pool = new Pool({ connectionString: config.database.url });

  try {
    try {
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      log.info('[db] Database connection established');
    } catch (err) {
      log.error({ err }, '[db] Failed to connect to database');
      process.exit(1);
    }

    const db = createDb(pool);

    log.info(
      { instrument: config.instrument, timeframe: config.timeframe },
      '[pipeline] Fetching candles',
    );

    const candles = await db
      .select({
        pct_change: ohlcvCandles.pct_change,
        body_ratio: ohlcvCandles.body_ratio,
      })
      .from(ohlcvCandles)
      .where(
        and(
          eq(ohlcvCandles.instrument, config.instrument),
          eq(ohlcvCandles.timeframe, config.timeframe),
        ),
      )
      .orderBy(asc(ohlcvCandles.open_time));

    log.info({ count: candles.length }, '[pipeline] Candles fetched');

    const { rows, total_windows, skipped_windows } = computeProbabilities(
      candles,
      config.instrument,
      config.timeframe,
    );

    log.info(
      { total_windows, skipped_windows, computed_rows: rows.length },
      '[pipeline] Computation complete',
    );

    const upserted = await upsertProbabilities(db, rows);

    log.info(
      {
        instrument: config.instrument,
        timeframe: config.timeframe,
        total_windows,
        skipped_windows,
        rows_upserted: upserted,
      },
      '[pipeline] Done',
    );
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  log.error({ err }, '[pipeline] Unrecoverable error');
  process.exit(1);
});
