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

from .connection_manager import ConnectionManager
from .models import kline_message_to_dict, parse_kline_message

logger = logging.getLogger(__name__)

BINANCE_FUTURES_WS_BASE = "wss://fstream.binance.com/ws"


def make_stream_url(pair: str) -> str:
    return f"{BINANCE_FUTURES_WS_BASE}/{pair.lower()}_perpetual@continuousKline_5m"


async def _handle_message(raw_text: str, cm: ConnectionManager) -> None:
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

    await cm.broadcast(kline_message_to_dict(msg))


async def run_binance_stream(pair: str, cm: ConnectionManager) -> None:
    url = make_stream_url(pair)
    logger.info("Starting Binance futures kline stream: %s", url)
    async for websocket in connect(url):
        try:
            async for message in websocket:
                await _handle_message(message, cm)
        except ConnectionClosed:
            logger.warning("Binance WebSocket closed for %s, reconnecting...", pair)
            continue
        except asyncio.CancelledError:
            logger.info("Binance stream task cancelled for %s", pair)
            raise
