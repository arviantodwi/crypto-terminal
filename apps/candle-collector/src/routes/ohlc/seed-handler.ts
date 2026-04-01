import type { FastifyRequest, FastifyReply } from 'fastify';
import { count, max, min, eq, and } from 'drizzle-orm';
import { ohlcvCandles } from '../../db/schema';
import { config } from '../../config';
import {
  activeFetches,
  aggregateToTimeframe,
  getClosestAggregateTs,
  normalize,
  upsertCandles,
  delay,
  type AppError,
  type CoindeskRecord,
} from './shared';

interface SeedOhlcBody {
  instrument: string;
  aggregate?: number;
  forward_fill?: boolean;
  numbers?: number;
}

export async function seedOhlcHandler(
  request: FastifyRequest<{ Body: SeedOhlcBody }>,
  reply: FastifyReply,
): Promise<void> {
  const { instrument, aggregate = 5, forward_fill = false, numbers } = request.body;
  const intervalSeconds = aggregate * 60;
  const timeframe = aggregateToTimeframe(aggregate);
  const db = request.server.db;

  // Validate: at least one of forward_fill or numbers must be provided
  if (!forward_fill && numbers === undefined) {
    return reply.code(400).send({
      statusCode: 400,
      error: 'Bad Request',
      message: 'At least one of forward_fill or numbers must be provided.',
    });
  }

  // Pre-flight check 1: numbers below existing count
  if (numbers !== undefined) {
    const countResult = await db
      .select({ total: count() })
      .from(ohlcvCandles)
      .where(and(eq(ohlcvCandles.instrument, instrument), eq(ohlcvCandles.timeframe, timeframe)));
    const existingCount = Number(countResult[0]?.total ?? 0);
    if (existingCount >= numbers) {
      return reply.code(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: `Existing data (${existingCount} candles) already meets or exceeds the target (${numbers}). No seeding required. Use a larger -n value if you want more history.`,
      });
    }
  }

  // Pre-flight check 2: activeFetches lock
  if (activeFetches.has(instrument)) {
    return reply.code(409).send({
      statusCode: 409,
      error: 'Conflict',
      message: `A fetch for instrument "${instrument}" is already in progress`,
    });
  }

  // All pre-flight checks passed — start streaming
  activeFetches.add(instrument);
  const startTime = Date.now();

  reply.hijack();
  reply.raw.writeHead(200, {
    'Content-Type': 'application/x-ndjson',
    'Cache-Control': 'no-cache',
    'X-Content-Type-Options': 'nosniff',
  });

  const flush = (obj: object): void => {
    reply.raw.write(JSON.stringify(obj) + '\n');
  };

  let streamEnded = false;
  const endStream = (): void => {
    if (!streamEnded) {
      streamEnded = true;
      reply.raw.end();
    }
  };

  let totalInserted = 0;
  let totalSkipped = 0;
  let pagesFetched = 0;
  let earliestCandleTs: number | null = null;
  let latestCandleTs: number | null = null;

  const candlesPerPage = Math.floor(2000 / aggregate);

  try {
    // ── Phase 1: Forward fill ─────────────────────────────────────────────────
    if (forward_fill) {
      const maxResult = await db
        .select({ maxTs: max(ohlcvCandles.open_time) })
        .from(ohlcvCandles)
        .where(and(eq(ohlcvCandles.instrument, instrument), eq(ohlcvCandles.timeframe, timeframe)));
      const maxOpenTime = maxResult[0]?.maxTs ?? null;
      const closestAggregateTs = getClosestAggregateTs(intervalSeconds);

      if (maxOpenTime === null) {
        flush({ status: 'notification', message: 'No existing data — skipping forward fill.' });
      } else if (maxOpenTime >= closestAggregateTs) {
        flush({ status: 'notification', message: 'Data is already up to date — skipping forward fill.' });
      } else {
        // Estimate total pages for progress reporting
        const gapSeconds = closestAggregateTs - maxOpenTime;
        const estimatedPages = Math.max(1, Math.ceil(gapSeconds / (candlesPerPage * intervalSeconds)));

        let phase1Inserted = 0;
        let phase1Skipped = 0;
        let phase1PagesFetched = 0;
        let currentToTs = closestAggregateTs;
        let phase1Done = false;

        while (!phase1Done) {
          phase1PagesFetched++;
          pagesFetched++;

          let rawData: CoindeskRecord[];
          try {
            const result = await request.server.coindesk.fetchPage({ instrument, toTs: currentToTs, aggregate });
            rawData = result.data;

            if (!rawData || rawData.length === 0) {
              break;
            }

            const candles = rawData.map((r) => normalize(r, instrument, timeframe));
            const insertResult = await upsertCandles(db, candles);

            const timestamps = rawData.map((r) => r.TIMESTAMP);
            const pageEarliest = Math.min(...timestamps);
            const pageLatest = Math.max(...timestamps);

            phase1Inserted += insertResult.inserted;
            phase1Skipped += insertResult.skipped;
            totalInserted += insertResult.inserted;
            totalSkipped += insertResult.skipped;

            if (earliestCandleTs === null || pageEarliest < earliestCandleTs) earliestCandleTs = pageEarliest;
            if (latestCandleTs === null || pageLatest > latestCandleTs) latestCandleTs = pageLatest;

            flush({
              status: 'progress',
              phase: 'forward_fill',
              page: phase1PagesFetched,
              total_pages: estimatedPages,
              inserted: insertResult.inserted,
              skipped: insertResult.skipped,
              earliest_ts: pageEarliest,
              ratelimit_remaining: result.ratelimitRemaining,
            });

            if (pageEarliest <= maxOpenTime) {
              phase1Done = true;
            } else {
              currentToTs = pageEarliest - intervalSeconds;
              if (config.seedPagesDelayMs > 0) {
                await delay(config.seedPagesDelayMs);
              }
            }
          } catch (err) {
            const appErr = err as AppError;
            flush({
              status: 'error',
              phase: 'forward_fill',
              page: phase1PagesFetched,
              message: appErr.message,
            });
            endStream();
            return;
          }
        }

        flush({
          status: 'phase_complete',
          phase: 'forward_fill',
          pages_fetched: phase1PagesFetched,
          inserted: phase1Inserted,
          skipped: phase1Skipped,
        });
      }
    }

    // ── Phase 2: Backward fill ────────────────────────────────────────────────
    if (numbers !== undefined) {
      // Re-query count after Phase 1
      const countResult = await db
        .select({ total: count() })
        .from(ohlcvCandles)
        .where(and(eq(ohlcvCandles.instrument, instrument), eq(ohlcvCandles.timeframe, timeframe)));
      const currentTotal = Number(countResult[0]?.total ?? 0);
      const backwardBudget = numbers - currentTotal;

      if (backwardBudget <= 0) {
        flush({
          status: 'notification',
          message: `Forward fill already met the target (${currentTotal} candles ≥ ${numbers}). Skipping backward fill.`,
        });
      } else {
        const backwardPages = Math.ceil(backwardBudget / candlesPerPage);

        // Determine start point
        const minResult = await db
          .select({ minTs: min(ohlcvCandles.open_time) })
          .from(ohlcvCandles)
          .where(and(eq(ohlcvCandles.instrument, instrument), eq(ohlcvCandles.timeframe, timeframe)));
        const minOpenTime = minResult[0]?.minTs ?? null;

        let currentToTs =
          minOpenTime !== null ? minOpenTime - intervalSeconds : getClosestAggregateTs(intervalSeconds);

        let phase2Inserted = 0;
        let phase2Skipped = 0;
        let phase2PagesFetched = 0;

        for (let page = 1; page <= backwardPages; page++) {
          pagesFetched++;
          phase2PagesFetched++;

          try {
            const result = await request.server.coindesk.fetchPage({ instrument, toTs: currentToTs, aggregate });
            const rawData = result.data;

            if (!rawData || rawData.length === 0) {
              break;
            }

            const candles = rawData.map((r) => normalize(r, instrument, timeframe));
            const insertResult = await upsertCandles(db, candles);

            const timestamps = rawData.map((r) => r.TIMESTAMP);
            const pageEarliest = Math.min(...timestamps);
            const pageLatest = Math.max(...timestamps);

            phase2Inserted += insertResult.inserted;
            phase2Skipped += insertResult.skipped;
            totalInserted += insertResult.inserted;
            totalSkipped += insertResult.skipped;

            if (earliestCandleTs === null || pageEarliest < earliestCandleTs) earliestCandleTs = pageEarliest;
            if (latestCandleTs === null || pageLatest > latestCandleTs) latestCandleTs = pageLatest;

            flush({
              status: 'progress',
              phase: 'backward_fill',
              page,
              total_pages: backwardPages,
              inserted: insertResult.inserted,
              skipped: insertResult.skipped,
              earliest_ts: pageEarliest,
              ratelimit_remaining: result.ratelimitRemaining,
            });

            currentToTs = pageEarliest - intervalSeconds;

            if (page < backwardPages && config.seedPagesDelayMs > 0) {
              await delay(config.seedPagesDelayMs);
            }
          } catch (err) {
            const appErr = err as AppError;
            flush({
              status: 'error',
              phase: 'backward_fill',
              page,
              message: appErr.message,
            });
            endStream();
            return;
          }
        }

        flush({
          status: 'phase_complete',
          phase: 'backward_fill',
          pages_fetched: phase2PagesFetched,
          inserted: phase2Inserted,
          skipped: phase2Skipped,
        });
      }
    }

    flush({
      status: 'done',
      pages_fetched: pagesFetched,
      total_inserted: totalInserted,
      total_skipped: totalSkipped,
      earliest_candle_ts: earliestCandleTs ?? 0,
      latest_candle_ts: latestCandleTs ?? 0,
      duration_ms: Date.now() - startTime,
    });
  } catch (err) {
    const appErr = err as AppError;
    flush({ status: 'error', phase: 'unknown', page: 0, message: appErr.message ?? 'Unknown error' });
  } finally {
    activeFetches.delete(instrument);
    endStream();
  }
}
