"""
Binance WebSocket Streamer
Streams real-time market data from Binance USDS Futures and exposes via FastAPI WebSocket.
"""

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from .connection_manager import manager
from .stream import run_binance_stream

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.stream_task = asyncio.create_task(
        run_binance_stream(),
        name="binance-kline-stream",
    )
    logger.info("Binance stream task started")

    yield

    app.state.stream_task.cancel()
    try:
        await app.state.stream_task
    except asyncio.CancelledError:
        pass
    logger.info("Binance stream task stopped")


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


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for streaming Binance market data to frontend clients."""
    await manager.connect(websocket)
    logger.info("Frontend client connected (%d total)", manager.client_count)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        logger.info("Frontend client disconnected")
    finally:
        await manager.disconnect(websocket)


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {
        "status": "ok",
        "service": "binance-stream",
        "version": "0.1.0",
        "connected_clients": manager.client_count,
    }


@app.get("/")
async def root():
    """Root endpoint with service info."""
    return {
        "message": "Binance Stream API",
        "endpoints": {
            "websocket": "ws://localhost:3001/ws",
            "health": "http://localhost:3001/health",
            "docs": "http://localhost:3001/docs",
        },
    }
