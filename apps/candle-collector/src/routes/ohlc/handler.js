// In-memory lock: tracks instruments currently being fetched
const activeFetches = new Set();

const INTERVAL_SECONDS = 300; // 5 minutes

/**
 * Normalize a raw CoinDesk record to the internal schema.
 * @param {object} record
 * @param {string} instrument
 */
function normalize(record, instrument) {
  return {
    open_time: record.TIMESTAMP,
    open: record.OPEN,
    high: record.HIGH,
    low: record.LOW,
    close: record.CLOSE,
    volume: record.VOLUME,
    quote_volume: record.QUOTE_VOLUME,
    instrument,
  };
}

/**
 * Batch-upsert candles into the ohlc_candles table.
 * Returns { inserted, skipped }.
 * @param {import('pg').Pool} pool
 * @param {Array} candles
 */
async function upsertCandles(pool, candles) {
  if (candles.length === 0) return { inserted: 0, skipped: 0 };

  // Build parameterized query
  const values = [];
  const placeholders = candles.map((c, i) => {
    const base = i * 8;
    values.push(c.open_time, c.instrument, c.open, c.high, c.low, c.close, c.volume, c.quote_volume);
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8})`;
  });

  const sql = `
    INSERT INTO ohlc_candles (open_time, instrument, open, high, low, close, volume, quote_volume)
    VALUES ${placeholders.join(', ')}
    ON CONFLICT (open_time, instrument) DO NOTHING
  `;

  const result = await pool.query(sql, values);
  const inserted = result.rowCount ?? 0;
  const skipped = candles.length - inserted;
  return { inserted, skipped };
}

export async function fetchOhlcHandler(request, reply) {
  const { instrument, to_ts, pages = 10 } = request.body;

  // 409 — in-progress lock
  if (activeFetches.has(instrument)) {
    return reply.code(409).send({
      statusCode: 409,
      error: 'Conflict',
      message: `A fetch for instrument "${instrument}" is already in progress`,
    });
  }

  activeFetches.add(instrument);
  const startTime = Date.now();

  let currentToTs = to_ts;
  let pagesFetched = 0;
  let totalRecords = 0;
  let totalInserted = 0;
  let totalSkipped = 0;
  let earliestTs = null;
  let latestTs = null;

  try {
    for (let page = 1; page <= pages; page++) {
      let rawData;
      try {
        rawData = await request.server.coindesk.fetchPage({ instrument, toTs: currentToTs });
      } catch (err) {
        request.log.error({ err, instrument, page }, '[ohlc] CoinDesk fetch failed');
        return reply.code(err.statusCode ?? 502).send({
          statusCode: err.statusCode ?? 502,
          error: 'Bad Gateway',
          message: err.message,
        });
      }

      // No more history available
      if (!rawData || rawData.length === 0) {
        request.log.info({ instrument, page }, '[ohlc] Empty response — stopping early');
        break;
      }

      const candles = rawData.map((r) => normalize(r, instrument));

      let insertResult;
      try {
        insertResult = await upsertCandles(request.server.pg, candles);
      } catch (err) {
        request.log.error({ err, instrument, page }, '[ohlc] Database write failed');
        return reply.code(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'Database write failed',
        });
      }

      const timestamps = rawData.map((r) => r.TIMESTAMP);
      const pageEarliest = Math.min(...timestamps);
      const pageLatest = Math.max(...timestamps);

      if (earliestTs === null || pageEarliest < earliestTs) earliestTs = pageEarliest;
      if (latestTs === null || pageLatest > latestTs) latestTs = pageLatest;

      totalRecords += candles.length;
      totalInserted += insertResult.inserted;
      totalSkipped += insertResult.skipped;
      pagesFetched = page;

      const nextToTs = pageEarliest - INTERVAL_SECONDS;

      request.log.info(
        {
          instrument,
          page,
          records: candles.length,
          inserted: insertResult.inserted,
          skipped: insertResult.skipped,
          nextToTs,
        },
        '[ohlc] Page fetched',
      );

      currentToTs = nextToTs;
    }
  } finally {
    activeFetches.delete(instrument);
  }

  return reply.code(200).send({
    instrument,
    pages_fetched: pagesFetched,
    total_records: totalRecords,
    inserted: totalInserted,
    skipped: totalSkipped,
    earliest_candle_ts: earliestTs ?? 0,
    latest_candle_ts: latestTs ?? 0,
    duration_ms: Date.now() - startTime,
  });
}
