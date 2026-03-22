import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import Redis from 'ioredis';
import { config } from '../config.js';

export interface InstrumentChangePayload {
  newListings: string[];
  delistings: string[];
  upcomingDelistings: Array<{ symbol: string; deliveryDate: number }>;
  updates: string[];
}

interface InstrumentChangeEvent extends InstrumentChangePayload {
  type: 'instruments_changed';
  timestamp: number;
}

declare module 'fastify' {
  interface FastifyInstance {
    redis: {
      publishInstrumentChanges: (payload: InstrumentChangePayload) => Promise<void>;
    };
  }
}

async function redisPlugin(fastify: FastifyInstance): Promise<void> {
  const client = new Redis({
    host: config.redis.host,
    port: config.redis.port,
    lazyConnect: true,
  });

  client.on('error', (err) => {
    fastify.log.error({ err }, '[redis] Connection error');
  });

  try {
    await client.connect();
    fastify.log.info('[redis] Connected to %s:%d', config.redis.host, config.redis.port);
  } catch (err) {
    fastify.log.error({ err }, '[redis] Failed to connect');
    process.exit(1);
  }

  async function publishInstrumentChanges(payload: InstrumentChangePayload): Promise<void> {
    const event: InstrumentChangeEvent = {
      type: 'instruments_changed',
      timestamp: Date.now(),
      ...payload,
    };
    try {
      await client.publish(config.redis.instrumentsChannel, JSON.stringify(event));
      fastify.log.info(
        {
          newListings: payload.newListings.length,
          delistings: payload.delistings.length,
          upcomingDelistings: payload.upcomingDelistings.length,
          updates: payload.updates.length,
        },
        '[redis] Published instrument changes to %s',
        config.redis.instrumentsChannel,
      );
    } catch (err) {
      fastify.log.error({ err }, '[redis] Failed to publish instrument changes');
    }
  }

  fastify.decorate('redis', { publishInstrumentChanges });

  fastify.addHook('onClose', async () => {
    await client.quit();
    fastify.log.info('[redis] Connection closed');
  });
}

export default fp(redisPlugin, { name: 'redis' });
