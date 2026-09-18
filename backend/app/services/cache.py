"""Small optional server-side cache for read-only API responses.

The cache is intentionally best-effort. A Redis outage must never fail a CRM
request, and cached values are used only for public reference data.
"""

from __future__ import annotations

import asyncio
import json
from collections.abc import Awaitable, Callable
from typing import Any, Protocol

from redis.asyncio import Redis

from app.core.config import settings


class ResponseCache(Protocol):
    async def get(self, key: str) -> dict[str, Any] | None: ...

    async def set(self, key: str, value: dict[str, Any]) -> None: ...

    async def invalidate_prefix(self, prefix: str) -> None: ...


class NullResponseCache:
    async def get(self, key: str) -> dict[str, Any] | None:
        return None

    async def set(self, key: str, value: dict[str, Any]) -> None:
        return None

    async def invalidate_prefix(self, prefix: str) -> None:
        return None


class RedisResponseCache:
    def __init__(self) -> None:
        self.client = Redis.from_url(settings.redis_url, decode_responses=True)

    async def get(self, key: str) -> dict[str, Any] | None:
        try:
            value = await self.client.get(key)
            return json.loads(value) if value is not None else None
        except Exception:
            return None

    async def set(self, key: str, value: dict[str, Any]) -> None:
        try:
            await self.client.set(key, json.dumps(value), ex=settings.cache_ttl_seconds)
        except Exception:
            return None

    async def invalidate_prefix(self, prefix: str) -> None:
        try:
            cursor = 0
            while True:
                cursor, keys = await self.client.scan(cursor, match=f"{prefix}*", count=100)
                if keys:
                    await self.client.delete(*keys)
                if cursor == 0:
                    break
        except Exception:
            return None


_cache: ResponseCache | None = None
_cache_lock = asyncio.Lock()


async def get_response_cache() -> ResponseCache:
    """Return Redis only when both cache controls explicitly enable it."""
    global _cache
    if not (settings.cache_enabled and settings.feature_cache_enabled):
        return NullResponseCache()
    if _cache is not None:
        return _cache
    async with _cache_lock:
        if _cache is None:
            _cache = (
                RedisResponseCache() if settings.cache_backend == "redis" else NullResponseCache()
            )
    return _cache


async def get_or_set_json(
    key: str, loader: Callable[[], Awaitable[dict[str, Any]]]
) -> dict[str, Any]:
    """Read a JSON-safe value or populate it without making cache mandatory."""
    cache = await get_response_cache()
    cached = await cache.get(key)
    if cached is not None:
        return cached
    value = await loader()
    await cache.set(key, value)
    return value
