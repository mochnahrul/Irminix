import asyncio
import logging
from typing import Any, Optional

from app.core.cache import cache
from app.core.config import settings
from app.core.http import get_http_client

logger = logging.getLogger(__name__)

ELEMENT_MAP: dict[str, str] = {
    "Fire": "Pyro",
    "Water": "Hydro",
    "Wind": "Anemo",
    "Electric": "Electro",
    "Grass": "Dendro",
    "Ice": "Cryo",
    "Rock": "Geo",
}

WEAPON_TYPE_MAP: dict[str, str] = {
    "WEAPON_SWORD_ONE_HAND": "Sword",
    "WEAPON_CLAYMORE": "Claymore",
    "WEAPON_POLE": "Polearm",
    "WEAPON_BOW": "Bow",
    "WEAPON_CATALYST": "Catalyst",
}


def yatta_icon_url(icon: Optional[str]) -> str:
    """Return full gi.yatta.moe UI asset URL for an icon key, or empty string."""
    if not icon:
        return ""
    return f"{settings.YATTA_ASSET_BASE}/{icon}.png"


def safe_int(val: Any, default: int = 0) -> int:
    """Safely coerce a value to int, returning default on None or invalid values."""
    if val is None or isinstance(val, bool):
        return default
    try:
        return int(val)
    except (TypeError, ValueError):
        return default


_YATTA_FETCH_LOCKS: dict[str, asyncio.Lock] = {}


async def fetch_yatta_json(
    cache_key: str,
    url: str,
    ttl_seconds: int = 21600,
) -> Optional[dict[str, Any]]:
    """Fetch JSON from gi.yatta.moe with TTL cache and per-key stampede protection.

    Only caches successful non-empty dict responses so transient failures never poison the cache.
    """
    cached = await cache.get(cache_key)
    if cached is not None:
        return cached

    lock = _YATTA_FETCH_LOCKS.setdefault(cache_key, asyncio.Lock())
    async with lock:
        cached = await cache.get(cache_key)
        if cached is not None:
            return cached

        client = get_http_client()
        for attempt in range(2):
            try:
                res = await client.get(url)
                if res.status_code == 200:
                    payload = res.json()
                    data = payload.get("data") if isinstance(payload, dict) else None
                    if isinstance(data, dict) and data:
                        await cache.set(cache_key, data, ttl_seconds=ttl_seconds)
                        return data
                    break
                if res.status_code in (429, 502, 503, 504) and attempt == 0:
                    await asyncio.sleep(0.4)
                    continue
                logger.warning("Yatta fetch returned HTTP %s for %s", res.status_code, url)
                break
            except Exception as exc:
                if attempt == 0:
                    await asyncio.sleep(0.4)
                    continue
                logger.warning("Yatta fetch failed for %s: %s(%s)", url, type(exc).__name__, exc)

    return None
