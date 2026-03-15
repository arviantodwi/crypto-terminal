# Binance Stream

WebSocket streamer for Binance USDS Futures market data with FastAPI.

## Features

- Real-time WebSocket streaming from Binance USDS Futures
- FastAPI server with automatic API documentation
- PostgreSQL integration for data persistence
- CORS enabled for Next.js frontend integration

## Requirements

- Python 3.12 (managed via pyenv)
- Poetry for dependency management
- PostgreSQL database (local setup)

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
# Edit .env with your Binance API credentials and database URL
```

### 4. Run the Server

```bash
# Development mode (auto-reload)
poetry run uvicorn src.main:app --reload --host 0.0.0.0 --port 3001

# Or from project root
pnpm dev:stream
```

## Endpoints

- **WebSocket**: `ws://localhost:3001/ws`
- **Health Check**: `http://localhost:3001/health`
- **API Docs**: `http://localhost:3001/docs`
- **Root**: `http://localhost:3001/`

## Development

### Code Linting & Formatting

```bash
poetry run ruff check .
poetry run ruff format .
```

## Architecture

- **FastAPI**: Modern async web framework
- **WebSockets**: Bi-directional communication with frontend
- **Binance Connector**: Official Binance Python SDK for USDS Futures
- **asyncpg**: Async PostgreSQL driver for high-performance DB writes
