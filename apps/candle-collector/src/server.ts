import { config } from './config';
import { buildApp } from './app';

const fastify = await buildApp();

try {
  await fastify.listen({ port: config.port, host: '0.0.0.0' });
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
