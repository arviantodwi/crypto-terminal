---
paths:
  - "apps/binance-stream/**"
---

# Binance Stream Architecture

**Stack:** FastAPI · Binance Connector (USDS Futures) · asyncpg · Python 3.12 · Poetry · Ruff

## Purpose

Stream real-time market data from Binance USDS Futures WebSocket and expose it to the Next.js frontend.

## Key Files

| File | Purpose |
|------|---------|
| `src/main.py` | FastAPI application entry point |
| `src/stream.py` | WebSocket streaming logic |
| `src/connection_manager.py` | WebSocket client connection management |
| `src/models.py` | Pydantic data models |
| `src/config.py` | App configuration |
| `pyproject.toml` | Poetry dependencies and Ruff config |

## Endpoints

| Endpoint | Description |
|----------|-------------|
| `ws://localhost:3001/ws` | WebSocket stream for the frontend |
| `GET /health` | Health check |
| `GET /docs` | Auto-generated FastAPI docs |
