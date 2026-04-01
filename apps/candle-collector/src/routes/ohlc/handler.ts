import type { FastifyRequest, FastifyReply } from 'fastify';
import {
  activeFetches,
  aggregateToTimeframe,
  getClosestAggregateTs,
  normalize,
  upsertCandles,
  type CoindeskRecord,
} from './shared';

interface FetchOhlcBody {
  instrument: string;
  to_ts?: number;
  aggregate?: number;
  pages?: number;
}

interface AppError extends Error {
  statusCode?: number;
}

export async function fetchOhlcHandler(
  request: FastifyRequest<{ Body: FetchOhlcBody }>,
  reply: FastifyReply,
): Promise<void> {
  const { instrument, to_ts, aggregate = 5, pages = 10 } = request.body;
  const intervalSeconds = aggregate * 60;
  const timeframe = aggregateToTimeframe(aggregate);

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

  let currentToTs = to_ts ?? getClosestAggregateTs(intervalSeconds);
  let pagesFetched = 0;
  let totalRecords = 0;
  let totalInserted = 0;
  let totalSkipped = 0;
  let earliestTs: number | null = null;
  let latestTs: number | null = null;

  try {
    for (let page = 1; page <= pages; page++) {
      let rawData: CoindeskRecord[];
      try {
        const result = await request.server.coindesk.fetchPage({ instrument, toTs: currentToTs, aggregate });
        rawData = result.data;
      } catch (err) {
        const appErr = err as AppError;
        request.log.error({ err, instrument, page }, '[ohlc] CoinDesk fetch failed');
        return reply.code(appErr.statusCode ?? 502).send({
          statusCode: appErr.statusCode ?? 502,
          error: 'Bad Gateway',
          message: appErr.message,
        });
      }

      // No more history available
      if (!rawData || rawData.length === 0) {
        request.log.info({ instrument, page }, '[ohlc] Empty response — stopping early');
        break;
      }

      const candles = rawData.map((r) => normalize(r, instrument, timeframe));

      let insertResult: { inserted: number; skipped: number };
      try {
        insertResult = await upsertCandles(request.server.db, candles);
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

      const nextToTs = pageEarliest - intervalSeconds;

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
