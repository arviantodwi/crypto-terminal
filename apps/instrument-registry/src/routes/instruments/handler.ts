import { eq } from 'drizzle-orm';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { instruments } from '../../db/schema.js';
import { syncInstruments } from '../../services/sync.js';
import { config } from '../../config.js';

// In-progress lock for manual sync triggers
let manualSyncInProgress = false;

export async function getInstrumentsHandler(
  _request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const result = await reply.server.db.select().from(instruments);
  return reply.send(result);
}

export async function getInstrumentBySymbolHandler(
  request: FastifyRequest<{ Params: { symbol: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const { symbol } = request.params;
  const result = await reply.server.db
    .select()
    .from(instruments)
    .where(eq(instruments.symbol, symbol.toUpperCase()))
    .limit(1);

  if (result.length === 0) {
    return reply.code(404).send({
      statusCode: 404,
      error: 'Not Found',
      message: `Instrument "${symbol.toUpperCase()}" not found`,
    });
  }

  return reply.send(result[0]);
}

export async function syncInstrumentsHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (manualSyncInProgress) {
    return reply.code(409).send({
      statusCode: 409,
      error: 'Conflict',
      message: 'A sync is already in progress',
    });
  }

  manualSyncInProgress = true;
  try {
    const result = await syncInstruments(
      request.server.db,
      request.server.redis,
      config.binance.restBaseUrl,
      request.log,
    );
    return reply.send({ status: 'ok', ...result });
  } catch (err) {
    request.log.error({ err }, '[sync] Manual sync failed');
    return reply.code(500).send({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Sync failed',
    });
  } finally {
    manualSyncInProgress = false;
  }
}
