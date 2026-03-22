import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import cron from 'node-cron';
import { config } from '../config.js';
import { syncInstruments } from '../services/sync.js';

declare module 'fastify' {
  interface FastifyInstance {
    triggerSync: () => Promise<void>;
  }
}

async function syncPlugin(fastify: FastifyInstance): Promise<void> {
  let syncInProgress = false;

  async function triggerSync(): Promise<void> {
    if (syncInProgress) {
      fastify.log.warn('[sync] Sync already in progress, skipping');
      return;
    }

    syncInProgress = true;
    try {
      await syncInstruments(fastify.db, fastify.redis, config.binance.restBaseUrl, fastify.log);
    } finally {
      syncInProgress = false;
    }
  }

  fastify.decorate('triggerSync', triggerSync);

  // Run initial sync after server is ready
  fastify.addHook('onReady', async () => {
    fastify.log.info('[sync] Running initial sync on startup');
    try {
      await triggerSync();
      fastify.log.info('[sync] Initial sync complete');
    } catch (err) {
      fastify.log.error({ err }, '[sync] Initial sync failed');
    }
  });

  // Schedule periodic sync
  const task = cron.schedule(config.sync.cron, async () => {
    fastify.log.info('[sync] Running scheduled sync (cron: %s)', config.sync.cron);
    try {
      await triggerSync();
    } catch (err) {
      fastify.log.error({ err }, '[sync] Scheduled sync failed');
    }
  });

  fastify.addHook('onClose', async () => {
    task.stop();
    fastify.log.info('[sync] Cron task stopped');
  });
}

export default fp(syncPlugin, { name: 'sync', dependencies: ['postgres', 'redis'] });
