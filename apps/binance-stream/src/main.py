"""
Binance WebSocket Streamer
Streams real-time market data from Binance USDS Futures and exposes via FastAPI WebSocket.
"""

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from pydantic import BaseModel

from .connection_manager import ConnectionManager
from .stream import fetch_initial_candles, run_binance_stream


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    active_streams: list[str]


logging.basicConfig(level=logging.INFO)
_ws_logger = logging.getLogger("websockets")
_ws_logger.setLevel(logging.WARNING)
_ws_logger.propagate = False
logger = logging.getLogger(__name__)

# Per-pair state: each pair gets its own ConnectionManager and stream task.
_managers: dict[str, ConnectionManager] = {}
_stream_tasks: dict[str, asyncio.Task] = {}

TRACKED_PAIRS = ["btcusdt"]


@asynccontextmanager
async def lifespan(_: FastAPI):
    for pair in TRACKED_PAIRS:
        _managers[pair] = ConnectionManager()
        initial_candles = await fetch_initial_candles(pair)
        for candle in initial_candles:
            _managers[pair].update_closed_candle(candle)
        logger.info("Seeded %d initial candles for %s", len(initial_candles), pair)
        _stream_tasks[pair] = asyncio.create_task(
            run_binance_stream(pair, _managers[pair]),
            name=f"binance-kline-{pair}",
        )
    logger.info("All stream tasks started")

    yield

    for task in list(_stream_tasks.values()):
        task.cancel()
    if _stream_tasks:
        await asyncio.gather(*_stream_tasks.values(), return_exceptions=True)
    logger.info("All stream tasks stopped")


app = FastAPI(
    title="Binance Stream",
    description="Real-time Binance USDS Futures market data streamer",
    version="0.1.0",
    lifespan=lifespan,
)

def _custom_openapi() -> dict:
    if app.openapi_schema:
        return app.openapi_schema
    schema = get_openapi(
        title=app.title,
        version=app.version,
        description=app.description,
        routes=app.routes,
    )
    schema["paths"]["/ws/{pair}/kline"] = {
        "get": {
            "tags": ["WebSocket"],
            "summary": "Stream continuous kline data",
            "description": (
                "Open a WebSocket connection to receive real-time 5-minute continuous "
                "kline updates for a USDS Futures perpetual pair (e.g. `btcusdt`). "
                "Each message is a JSON `KlineMessage` object. "
                "The stream runs independently of client connections — "
                "it starts at app startup and stops only at app shutdown."
            ),
            "operationId": "ws_kline",
            "parameters": [
                {
                    "name": "pair",
                    "in": "path",
                    "required": True,
                    "schema": {"type": "string", "example": "btcusdt"},
                    "description": "Lowercase pair symbol, e.g. `btcusdt`, `ethusdt`.",
                }
            ],
            "responses": {
                "101": {"description": "Switching Protocols — WebSocket connection established"},
            },
        }
    }
    app.openapi_schema = schema
    return schema


app.openapi = _custom_openapi  # type: ignore[method-assign]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.websocket("/ws/{pair}/kline")
async def kline_endpoint(websocket: WebSocket, pair: str):
    """Stream continuous kline data for a given pair (e.g. btcusdt)."""
    pair = pair.lower()
    cm = _managers.get(pair)

    if cm is None:
        await websocket.close(code=1008)
        return

    await cm.connect(websocket)
    logger.info("Client connected to %s/kline (%d total)", pair, cm.client_count)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        logger.info("Client disconnected from %s/kline", pair)
    finally:
        await cm.disconnect(websocket)
        # stream keeps running regardless of client count


@app.get("/health", response_model=HealthResponse)
async def health():
    """Health check endpoint."""
    return {
        "status": "ok",
        "service": "binance-stream",
        "version": "0.1.0",
        "active_streams": list(_stream_tasks.keys()),
    }


@app.get("/")
async def root():
    """Root endpoint with service info."""
    return {
        "message": "Binance Stream API",
        "endpoints": {
            "websocket": "ws://localhost:3001/ws/{pair}/kline",
            "health": "http://localhost:3001/health",
            "docs": "http://localhost:3001/docs",
        },
    }
