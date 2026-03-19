const required = ['COINDESK_API_KEY', 'COINDESK_BASE_URL', 'DATABASE_URL'];

for (const key of required) {
  if (!process.env[key]) {
    console.error(`[config] Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

export const config = {
  coindesk: {
    apiKey: process.env.COINDESK_API_KEY,
    baseUrl: process.env.COINDESK_BASE_URL,
  },
  database: {
    url: process.env.DATABASE_URL,
  },
  port: parseInt(process.env.PORT ?? '3001', 10),
  logLevel: process.env.LOG_LEVEL ?? 'info',
};
