"""
Manages the set of active frontend WebSocket connections.
"""

import logging

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self) -> None:
        self._clients: set[WebSocket] = set()
        self.closed_candles: list[dict] = []
        self.current_candle: dict | None = None

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self._clients.add(websocket)
        await websocket.send_json({
            "type": "snapshot",
            "closed_candles": self.closed_candles,
            "current_candle": self.current_candle,
        })

    async def disconnect(self, websocket: WebSocket) -> None:
        self._clients.discard(websocket)

    async def broadcast(self, payload: dict) -> None:
        failed: list[WebSocket] = []
        for client in list(self._clients):
            try:
                await client.send_json(payload)
            except Exception:
                logger.warning("Failed to send to client, removing", exc_info=True)
                failed.append(client)
        for client in failed:
            self._clients.discard(client)

    def update_closed_candle(self, candle: dict) -> None:
        self.closed_candles.append(candle)
        self.closed_candles = self.closed_candles[-3:]

    def update_current_candle(self, candle: dict) -> None:
        self.current_candle = candle

    def mark_current_candle_stale(self) -> None:
        """Mark the current in-progress candle as stale after a stream reconnect."""
        if self.current_candle is not None:
            self.current_candle = {**self.current_candle, "stale": True}

    @property
    def client_count(self) -> int:
        return len(self._clients)
