"""
Redis publisher for closed candle events.

Manages the Redis connection lifecycle and publishes closed candle payloads
to the configured kline channel. Errors are logged and never propagated to
the caller — a Redis failure must not interrupt the WebSocket stream.
"""

import json
import logging

import redis.asyncio as aioredis

from .config import settings

logger = logging.getLogger(__name__)

_redis: aioredis.Redis | None = None


async def connect() -> None:
    """Open the Redis connection. Called during FastAPI lifespan startup."""
    global _redis
    try:
        _redis = aioredis.Redis(
            host=settings.redis_host,
            port=settings.redis_port,
            decode_responses=True,
        )
        await _redis.ping()
        logger.info(
            "Redis connected: %s:%d (channel: %s)",
            settings.redis_host,
            settings.redis_port,
            settings.redis_kline_channel,
        )
    except Exception:
        logger.warning(
            "Redis connection failed (%s:%d) — candle publishing disabled",
            settings.redis_host,
            settings.redis_port,
            exc_info=True,
        )
        _redis = None


async def close() -> None:
    """Close the Redis connection. Called during FastAPI lifespan shutdown."""
    global _redis
    if _redis is not None:
        await _redis.aclose()
        _redis = None
        logger.info("Redis connection closed")


async def publish_closed_candle(candle_dict: dict) -> None:
    """Publish a closed candle payload to the Redis kline channel.

    Fire-and-forget: errors are logged but never re-raised.
    """
    if _redis is None:
        return
    try:
        await _redis.publish(settings.redis_kline_channel, json.dumps(candle_dict))
    except Exception:
        logger.error("Failed to publish closed candle to Redis", exc_info=True)
