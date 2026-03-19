import Fastify from 'fastify';
import { config } from './config.js';
import coindeskPlugin from './plugins/coindesk.js';
import postgresPlugin from './plugins/postgres.js';
import { ohlcRoutes } from './routes/ohlc/index.js';

export async function buildApp() {
  const fastify = Fastify({
    logger: {
      level: config.logLevel,
    },
  });

  // Plugins
  await fastify.register(postgresPlugin);
  await fastify.register(coindeskPlugin);

  // Health check
  fastify.get('/health', async () => ({ status: 'ok' }));

  // Routes
  await fastify.register(ohlcRoutes);

  return fastify;
}
