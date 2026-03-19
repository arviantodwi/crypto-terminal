import fp from 'fastify-plugin';
import pg from 'pg';
import { config } from '../config.js';

const { Pool } = pg;

async function postgresPlugin(fastify) {
  const pool = new Pool({ connectionString: config.database.url });

  // Connectivity check on startup
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    fastify.log.info('[postgres] Database connection established');
  } catch (err) {
    fastify.log.error({ err }, '[postgres] Failed to connect to database');
    process.exit(1);
  }

  fastify.decorate('pg', pool);

  fastify.addHook('onClose', async () => {
    await pool.end();
    fastify.log.info('[postgres] Connection pool closed');
  });
}

export default fp(postgresPlugin, { name: 'postgres' });
