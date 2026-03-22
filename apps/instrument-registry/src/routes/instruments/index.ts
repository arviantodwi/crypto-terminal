import type { FastifyInstance } from 'fastify';
import {
  getInstrumentBySymbolHandler,
  getInstrumentsHandler,
  syncInstrumentsHandler,
} from './handler.js';
import {
  getInstrumentBySymbolSchema,
  getInstrumentsSchema,
  syncInstrumentsSchema,
} from './schema.js';

export async function instrumentRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/instruments', { schema: getInstrumentsSchema }, getInstrumentsHandler);
  fastify.get(
    '/instruments/:symbol',
    { schema: getInstrumentBySymbolSchema },
    getInstrumentBySymbolHandler,
  );
  fastify.post('/instruments/sync', { schema: syncInstrumentsSchema }, syncInstrumentsHandler);
}
