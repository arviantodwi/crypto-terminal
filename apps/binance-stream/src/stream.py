"""
Connects to the Binance USDS Futures continuous kline WebSocket stream
and broadcasts parsed kline messages to all connected frontend clients.

Uses the 'websockets' asyncio client directly — the installed binance-connector
SDK is thread-based and has no USDS futures stream support.
"""

import asyncio
import json
import logging

import httpx
from websockets.asyncio.client import connect
from websockets.exceptions import ConnectionClosed

from .connection_manager import ConnectionManager
from .models import kline_message_to_dict, parse_kline_message
from . import redis_publisher

logger = logging.getLogger(__name__)

BINANCE_FUTURES_WS_BASE = "wss://fstream.binance.com/ws"
BINANCE_FUTURES_REST_BASE = "https://fapi.binance.com"

# Minimum number of fields required in a REST kline entry.
_REST_CANDLE_MIN_FIELDS = 9


def make_stream_url(pair: str) -> str:
    return f"{BINANCE_FUTURES_WS_BASE}/{pair.lower()}_perpetual@continuousKline_5m"


def _rest_candle_to_dict(candle: list, pair: str) -> dict:
    """Convert a Binance REST continuousKlines array entry to the standard kline dict format."""
    if len(candle) < _REST_CANDLE_MIN_FIELDS:
        raise ValueError(
            f"Candle entry has {len(candle)} fields, expected at least {_REST_CANDLE_MIN_FIELDS}"
        )
    return {
        "type": "kline",
        "event_time": candle[6],  # use close_time as event_time for historical candles
        "pair": pair.upper(),
        "contract_type": "PERPETUAL",
        "kline": {
            "open_time": candle[0],
            "close_time": candle[6],
            "interval": "5m",
            "open": candle[1],
            "high": candle[2],
            "low": candle[3],
            "close": candle[4],
            "volume": candle[5],
            "num_trades": candle[8],
            "is_closed": True,
        },
    }


async def fetch_initial_candles(pair: str) -> list[dict]:
    """Fetch the last 3 closed candles from the Binance REST API to seed in-memory state."""
    url = f"{BINANCE_FUTURES_REST_BASE}/fapi/v1/continuousKlines"
    params = {
        "pair": pair.upper(),
        "contractType": "PERPETUAL",
        "interval": "5m",
        "limit": 4,  # fetch 4, discard the currently forming one
    }
    async with httpx.AsyncClient(timeout=httpx.Timeout(10.0)) as client:
        response = await client.get(url, params=params)
        response.raise_for_status()
        candles = response.json()
        return [_rest_candle_to_dict(c, pair) for c in candles[:-1]]


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

    candle_dict = kline_message_to_dict(msg)
    if msg.kline.is_closed:
        cm.update_closed_candle(candle_dict)
        closed_payload = {**candle_dict, "type": "candle_closed"}
        await cm.broadcast(closed_payload)
        await redis_publisher.publish_closed_candle(closed_payload)
    else:
        cm.update_current_candle(candle_dict)
        await cm.broadcast({**candle_dict, "type": "tick"})


async def run_binance_stream(pair: str, cm: ConnectionManager) -> None:
    url = make_stream_url(pair)
    logger.info("Starting Binance futures kline stream: %s", url)
    first = True
    # delay_min/delay_max configure the exponential backoff between reconnect attempts.
    async for websocket in connect(url, delay_min=1, delay_max=60):
        if not first:
            logger.warning("Binance WebSocket reconnected for %s, marking current candle stale", pair)
            cm.mark_current_candle_stale()
        first = False
        try:
            async for message in websocket:
                await _handle_message(message, cm)
        except ConnectionClosed:
            logger.warning("Binance WebSocket closed for %s, reconnecting...", pair)
            continue
        except asyncio.CancelledError:
            logger.info("Binance stream task cancelled for %s", pair)
            raise
        except Exception:
            logger.exception("Unexpected error in stream for %s, reconnecting...", pair)
            continue
