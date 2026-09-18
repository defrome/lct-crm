"""Optional server cache must stay a read-through optimisation."""

from __future__ import annotations

from typing import Any

from app.core.config import settings
from app.services import cache


class MemoryResponseCache:
    def __init__(self) -> None:
        self.values: dict[str, dict[str, Any]] = {}

    async def get(self, key: str) -> dict[str, Any] | None:
        return self.values.get(key)

    async def set(self, key: str, value: dict[str, Any]) -> None:
        self.values[key] = value

    async def invalidate_prefix(self, prefix: str) -> None:
        for key in [item for item in self.values if item.startswith(prefix)]:
            del self.values[key]


async def test_read_through_cache_is_optional_and_invalidateable(monkeypatch):
    backend = MemoryResponseCache()
    monkeypatch.setattr(settings, "cache_enabled", True)
    monkeypatch.setattr(settings, "feature_cache_enabled", True)
    monkeypatch.setattr(cache, "_cache", backend)
    calls = 0

    async def load() -> dict[str, Any]:
        nonlocal calls
        calls += 1
        return {"items": ["cached"]}

    assert await cache.get_or_set_json("crm:catalog:vendors", load) == {"items": ["cached"]}
    assert await cache.get_or_set_json("crm:catalog:vendors", load) == {"items": ["cached"]}
    assert calls == 1

    await backend.invalidate_prefix("crm:catalog:")
    assert await cache.get_or_set_json("crm:catalog:vendors", load) == {"items": ["cached"]}
    assert calls == 2
