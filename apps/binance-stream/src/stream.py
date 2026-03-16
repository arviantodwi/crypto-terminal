"""
Connects to the Binance USDS Futures continuous kline WebSocket stream
and broadcasts parsed kline messages to all connected frontend clients.

Uses the 'websockets' asyncio client directly — the installed binance-connector
SDK is thread-based and has no USDS futures stream support.
"""

import asyncio
import json
import logging

from websockets.asyncio.client import connect
from websockets.exceptions import ConnectionClosed

from .connection_manager import manager
from .models import kline_message_to_dict, parse_kline_message

logger = logging.getLogger(__name__)

BINANCE_FUTURES_WS_URL = "wss://fstream.binance.com/ws/btcusdt_perpetual@continuousKline_5m"


async def _handle_message(raw_text: str) -> None:
    try:
        raw = json.loads(raw_text)
    except json.JSONDecodeError:
        logger.warning("Received non-JSON message: %s", raw_text[:100])
        return

    if raw.get("e") != "continuous_kline":
        return

    try:
        msg = parse_kline_message(raw)
    except (KeyError, TypeError) as exc:
        logger.warning("Failed to parse kline message: %s", exc)
        return

    await manager.broadcast(kline_message_to_dict(msg))


async def run_binance_stream() -> None:
    logger.info("Starting Binance futures kline stream: %s", BINANCE_FUTURES_WS_URL)
    async for websocket in connect(BINANCE_FUTURES_WS_URL):
        try:
            async for raw_message in websocket:
                await _handle_message(raw_message)
        except ConnectionClosed:
            logger.warning("Binance WebSocket closed, reconnecting...")
            continue
        except asyncio.CancelledError:
            logger.info("Binance stream task cancelled, shutting down")
            raise
