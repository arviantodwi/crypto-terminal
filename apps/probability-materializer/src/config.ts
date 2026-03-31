const required = ['DATABASE_URL', 'INSTRUMENT'] as const;

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
  instrument: process.env.INSTRUMENT as string,
  timeframe: process.env.TIMEFRAME ?? '5m',
  logLevel: process.env.LOG_LEVEL ?? 'info',
};
