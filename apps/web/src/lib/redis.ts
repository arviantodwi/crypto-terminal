/**
 * Creates a dedicated ioredis subscriber client for use in SSE route handlers.
 *
 * Each SSE connection gets its own subscriber so that unsubscribing on
 * disconnect does not affect other open connections.
 */
import Redis from 'ioredis';

export function createRedisSubscriber(): Redis {
  return new Redis({
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    lazyConnect: true,
  });
}

export const INSTRUMENTS_CHANNEL =
  process.env.REDIS_INSTRUMENTS_CHANNEL ?? 'exchange:instruments';
