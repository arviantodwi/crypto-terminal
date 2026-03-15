"""
Binance WebSocket Streamer
Streams real-time market data from Binance USDS Futures and exposes via FastAPI WebSocket.
"""

import asyncio
import logging

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Binance Stream",
    description="Real-time Binance USDS Futures market data streamer",
    version="0.1.0",
)

# CORS middleware for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Next.js dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for streaming Binance market data."""
    await websocket.accept()
    logger.info("WebSocket client connected")

    try:
        while True:
            # TODO: Implement Binance WebSocket streaming
            # For now, send a heartbeat message
            await websocket.send_json({
                "type": "heartbeat",
                "timestamp": asyncio.get_event_loop().time(),
                "message": "Connected to binance-stream",
            })
            await asyncio.sleep(5)
    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        await websocket.close()


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {
        "status": "ok",
        "service": "binance-stream",
        "version": "0.1.0",
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


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=3001,
        log_level="info",
    )
