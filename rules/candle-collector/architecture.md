---
paths:
  - "apps/candle-collector/**"
---

# Candle Collector Architecture

**Stack:** Node.js (>=20) · Fastify 5 · Drizzle ORM · PostgreSQL · TypeScript · tsx

## Purpose

Standalone service that fetches historical OHLC candle data from the CoinDesk API and upserts it into PostgreSQL. Triggered manually via HTTP — not on a schedule.

## Key Files

| File | Purpose |
|------|---------|
| `src/server.ts` | Fastify server entry point |
| `src/app.ts` | App factory / plugin registration |
| `src/config.ts` | Environment config |
| `src/db/schema.ts` | Drizzle schema — single source of truth for DB and TypeScript types |
| `src/db/client.ts` | Database client setup |
| `src/routes/ohlc/` | OHLC fetch route handlers |
| `src/plugins/` | Fastify plugins |

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check — returns `200 { "status": "ok" }` |
| `POST` | `/ohlc/fetch` | Trigger paginated CoinDesk fetch and upsert into PostgreSQL |

### POST /ohlc/fetch — Request Body

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `instrument` | Yes | — | CoinDesk instrument identifier (e.g. `BTCUSDT`) |
| `to_ts` | No | closest boundary before now | Unix timestamp to paginate backward from |
| `aggregate` | No | `5` | Candle width in minutes |
| `pages` | No | `10` | Pages of 1,000 candles to fetch (max `20`) |

### Error Codes

| Status | Cause |
|--------|-------|
| `400` | Validation failure |
| `409` | Fetch already in progress for this instrument |
| `502` | CoinDesk returned an error |
| `500` | Database write failed |
