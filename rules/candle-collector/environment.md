---
paths:
  - "apps/candle-collector/**"
---

# Candle Collector Environment

## Setup

```bash
cp .env.example .env
# Fill in required values

pnpm install
pnpm db:generate
pnpm db:migrate
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `COINDESK_API_KEY` | Yes | — | API key for CoinDesk requests |
| `COINDESK_BASE_URL` | Yes | — | `https://data-api.coindesk.com` |
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `PORT` | No | `3002` | Port the service listens on |
| `LOG_LEVEL` | No | `info` | Pino log level |
