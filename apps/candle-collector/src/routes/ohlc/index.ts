import type { FastifyInstance } from 'fastify';
import { fetchOhlcHandler } from './handler';
import { fetchOhlcSchema } from './schema';

export async function ohlcRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post('/ohlc/fetch', { schema: fetchOhlcSchema }, fetchOhlcHandler);
}
