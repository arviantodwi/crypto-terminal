import Fastify from 'fastify';
import { config } from './config';
import coindeskPlugin from './plugins/coindesk';
import postgresPlugin from './plugins/postgres';
import { ohlcRoutes } from './routes/ohlc/index';

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
