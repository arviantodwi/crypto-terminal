function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`[config] Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

export const config = {
  database: {
    url: requireEnv('DATABASE_URL'),
  },
  instrument: process.env.INSTRUMENT ?? 'BTCUSDT',
  timeframe: process.env.TIMEFRAME ?? '5m',
  initialBalance: Number(process.env.INITIAL_BALANCE ?? '1000'),
  logLevel: process.env.LOG_LEVEL ?? 'info',
};
