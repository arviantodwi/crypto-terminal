"""
Binance WebSocket Streamer
Streams real-time market data from Binance USDS Futures and exposes via FastAPI WebSocket.
"""

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from .connection_manager import ConnectionManager
from .stream import run_binance_stream

logging.basicConfig(level=logging.INFO)
_ws_logger = logging.getLogger("websockets")
_ws_logger.setLevel(logging.CRITICAL)
_ws_logger.propagate = False
logger = logging.getLogger(__name__)

# Per-pair state: each pair gets its own ConnectionManager and stream task.
_managers: dict[str, ConnectionManager] = {}
_stream_tasks: dict[str, asyncio.Task] = {}


@asynccontextmanager
async def lifespan(_: FastAPI):
    yield
    # Cancel all active stream tasks on shutdown.
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

    if pair not in _managers:
        _managers[pair] = ConnectionManager()

    cm = _managers[pair]

    if pair not in _stream_tasks or _stream_tasks[pair].done():
        _stream_tasks[pair] = asyncio.create_task(
            run_binance_stream(pair, cm),
            name=f"binance-kline-{pair}",
        )

    await cm.connect(websocket)
    logger.info("Client connected to %s/kline (%d total)", pair, cm.client_count)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        logger.info("Client disconnected from %s/kline", pair)
    finally:
        await cm.disconnect(websocket)
        if cm.client_count == 0:
            _stream_tasks.pop(pair).cancel()
            _managers.pop(pair)


@app.get("/health")
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
