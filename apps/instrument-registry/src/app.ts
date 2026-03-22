import Fastify from 'fastify';
import { config } from './config.js';
import postgresPlugin from './plugins/postgres.js';
import redisPlugin from './plugins/redis.js';
import syncPlugin from './plugins/sync.js';
import { instrumentRoutes } from './routes/instruments/index.js';

export async function buildApp() {
  const fastify = Fastify({
    logger: {
      level: config.logLevel,
    },
  });

  // Infrastructure plugins
  await fastify.register(postgresPlugin);
  await fastify.register(redisPlugin);

  // Sync plugin — registers triggerSync decorator and sets up cron + startup sync
  await fastify.register(syncPlugin);

  // Health check
  fastify.get('/health', async () => ({ status: 'ok' }));

  // Routes
  await fastify.register(instrumentRoutes);

  return fastify;
}
