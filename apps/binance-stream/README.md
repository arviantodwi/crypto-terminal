# Binance Stream

Real-time WebSocket streamer for Binance USDS Futures market data, built with FastAPI.

## Features

- Streams 5-minute continuous kline data from Binance USDS Futures WebSocket
- Exposes a WebSocket endpoint for the Next.js frontend
- Seeds the last 3 closed candles from the REST API on startup
- Broadcasts real-time tick and candle-close events to all connected clients
- Auto-reconnects to Binance with exponential backoff (1 s – 60 s)
- FastAPI server with automatic OpenAPI documentation

## Requirements

- Python 3.12 (managed via pyenv)
- Poetry for dependency management

## Setup

### 1. Install Python 3.12

```bash
pyenv install 3.12
pyenv local 3.12
```

### 2. Install Dependencies

```bash
poetry install
```

### 3. Configure Environment

```bash
cp .env.example .env
# Edit .env — see Environment Variables section below
```

### 4. Run the Server

```bash
# Development mode (auto-reload)
poetry run uvicorn src.main:app --reload --host 0.0.0.0 --port 3001

# Or from the monorepo root
pnpm dev:stream
```

## Environment Variables

All variables are optional — the defaults work for local development without Binance API keys.

| Variable | Default | Description |
|---|---|---|
| `BINANCE_API_KEY` | `""` | Binance API key (required for private endpoints; not needed for public kline stream) |
| `BINANCE_API_SECRET` | `""` | Binance API secret |
| `HOST` | `0.0.0.0` | Server bind address |
| `PORT` | `3001` | Server port |
| `LOG_LEVEL` | `INFO` | Logging level (`DEBUG`, `INFO`, `WARNING`, `ERROR`) |
| `CORS_ORIGINS` | `["http://localhost:3000"]` | JSON array of allowed CORS origins |

## Endpoints

| Endpoint | Protocol | Description |
|---|---|---|
| `/ws/{pair}/kline` | WebSocket | Real-time 5-minute kline stream for a pair (e.g. `btcusdt`) |
| `/health` | HTTP GET | Health check — returns service status and active stream list |
| `/docs` | HTTP GET | Auto-generated OpenAPI (Swagger UI) docs |
| `/` | HTTP GET | Service info and endpoint index |

Currently tracked pairs: **`btcusdt`**

## WebSocket Protocol

### Connecting

```
ws://localhost:3001/ws/btcusdt/kline
```

If the requested pair is not tracked by the server, the connection is closed with code `1008`.

### Message Types

All messages are JSON objects. After connecting, the client receives a `snapshot` message immediately, followed by a live stream of `tick` and `candle_closed` messages.

#### `snapshot` — sent once on connect

```json
{
  "type": "snapshot",
  "closed_candles": [ /* last ≤3 closed KlineMessage objects */ ],
  "current_candle": { /* current in-progress KlineMessage, or null */ }
}
```

#### `tick` — sent on every incoming kline update (candle still open)

```json
{
  "type": "tick",
  "event_time": 1700000000000,
  "pair": "BTCUSDT",
  "contract_type": "PERPETUAL",
  "kline": {
    "open_time": 1700000000000,
    "close_time": 1700000299999,
    "interval": "5m",
    "open": "42000.00",
    "high": "42100.00",
    "low": "41900.00",
    "close": "42050.00",
    "volume": "123.456",
    "num_trades": 500,
    "is_closed": false
  }
}
```

#### `candle_closed` — sent when a 5-minute candle closes

Same shape as `tick` but `type` is `"candle_closed"` and `kline.is_closed` is `true`.

#### Stale candle flag

If the Binance WebSocket reconnects mid-candle, the in-progress candle is marked stale. A `"stale": true` field is added to the kline object in the next message until a new candle starts.

## Architecture

```
Binance USDS Futures
  ├── REST API  → fetch_initial_candles() seeds 3 closed candles on startup
  └── WebSocket → run_binance_stream() runs continuously, one task per pair
                          ↓
               ConnectionManager (per pair)
               ├── closed_candles  (last 3)
               └── current_candle
                          ↓
                  broadcast to all connected
                  frontend WebSocket clients
```

### Key Modules

| File | Purpose |
|---|---|
| `src/main.py` | FastAPI app, lifespan management, HTTP/WebSocket endpoints |
| `src/stream.py` | Binance WebSocket client, reconnect loop, message parsing |
| `src/connection_manager.py` | Manages frontend client connections and in-memory candle state |
| `src/models.py` | `KlineData` / `KlineMessage` dataclasses and parse helpers |
| `src/config.py` | `pydantic-settings` config loaded from `.env` |

## Development

### Linting & Formatting

```bash
poetry run ruff check .    # Lint
poetry run ruff format .   # Format
```

Ruff is configured with rules `E` (pycodestyle errors), `F` (pyflakes), and `I` (isort). Line length is 100 characters.
