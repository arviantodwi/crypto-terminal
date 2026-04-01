import type { FastifyInstance } from 'fastify';
import { fetchOhlcHandler } from './fetch-handler';
import { fetchOhlcSchema } from './fetch-schema';
import { seedOhlcHandler } from './seed-handler';
import { seedOhlcSchema } from './seed-schema';

export async function ohlcRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post('/ohlc/fetch', { schema: fetchOhlcSchema }, fetchOhlcHandler);
  fastify.post('/ohlc/seed', { schema: seedOhlcSchema }, seedOhlcHandler);
}
