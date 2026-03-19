import type { FastifyInstance } from 'fastify';
import { fetchOhlcHandler } from './handler.js';
import { fetchOhlcSchema } from './schema.js';

export async function ohlcRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post('/ohlc/fetch', { schema: fetchOhlcSchema }, fetchOhlcHandler);
}
