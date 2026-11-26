import asyncio
import time
from typing import Any, Optional


class TTLCache:
    """Async-safe in-memory TTL cache replacing a persistent database."""

    def __init__(self, max_size: int = 2000) -> None:
        self._store: dict[str, tuple[float, Any]] = {}
        self._lock = asyncio.Lock()
        self._max_size = max_size

    async def get(self, key: str) -> Optional[Any]:
        async with self._lock:
            entry = self._store.get(key)
            if entry is None:
                return None
            expires_at, value = entry
            if time.monotonic() > expires_at:
                del self._store[key]
                return None
            return value

    async def set(self, key: str, value: Any, ttl_seconds: int = 300) -> None:
        async with self._lock:
            now = time.monotonic()
            if key in self._store:
                del self._store[key]
            elif len(self._store) >= self._max_size:
                expired = [k for k, (exp, _) in self._store.items() if exp <= now]
                for k in expired:
                    del self._store[k]
                while len(self._store) >= self._max_size:
                    oldest_key = next(iter(self._store))
                    del self._store[oldest_key]
            self._store[key] = (now + ttl_seconds, value)

    async def clear(self) -> None:
        async with self._lock:
            self._store.clear()

    def stats(self) -> dict[str, int]:
        now = time.monotonic()
        active = sum(1 for exp, _ in self._store.values() if exp > now)
        return {"active_entries": active, "total_keys": len(self._store)}


cache = TTLCache()
