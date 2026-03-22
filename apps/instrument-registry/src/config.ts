const required = ['DATABASE_URL', 'REDIS_HOST', 'REDIS_PORT', 'BINANCE_REST_BASE_URL'] as const;

for (const key of required) {
  if (!process.env[key]) {
    console.error(`[config] Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

export const config = {
  database: {
    url: process.env.DATABASE_URL as string,
  },
  redis: {
    host: process.env.REDIS_HOST as string,
    port: parseInt(process.env.REDIS_PORT as string, 10),
    instrumentsChannel: process.env.REDIS_INSTRUMENTS_CHANNEL ?? 'exchange:instruments',
  },
  binance: {
    restBaseUrl: process.env.BINANCE_REST_BASE_URL as string,
  },
  sync: {
    cron: process.env.SYNC_CRON ?? '0 0 * * *',
  },
  port: parseInt(process.env.PORT ?? '3003', 10),
  logLevel: process.env.LOG_LEVEL ?? 'info',
};
