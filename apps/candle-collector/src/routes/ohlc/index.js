import { fetchOhlcHandler } from './handler.js';
import { fetchOhlcSchema } from './schema.js';

/**
 * @param {import('fastify').FastifyInstance} fastify
 */
export async function ohlcRoutes(fastify) {
  fastify.post('/ohlc/fetch', { schema: fetchOhlcSchema }, fetchOhlcHandler);
}
