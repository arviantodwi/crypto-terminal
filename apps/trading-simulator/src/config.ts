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
  timeframe: process.env.TIMEFRAME ?? '5m',
  initialBalance: (() => {
    const v = Number(process.env.INITIAL_BALANCE ?? '1000');
    if (isNaN(v) || v <= 0) {
      console.error('[config] INITIAL_BALANCE must be a positive number');
      process.exit(1);
    }
    return v;
  })(),
  logLevel: process.env.LOG_LEVEL ?? 'info',
};
