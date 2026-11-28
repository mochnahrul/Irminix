import asyncio
from typing import Optional
import httpx
from app.core.config import settings

_client: Optional[httpx.AsyncClient] = None
_client_loop: Optional[asyncio.AbstractEventLoop] = None


def get_http_client() -> httpx.AsyncClient:
    """Return a shared async HTTP client bound to the active event loop."""
    global _client, _client_loop
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    if _client is None or _client.is_closed or _client_loop is not loop:
        if _client is not None and not _client.is_closed and _client_loop is not None and _client_loop.is_running():
            _client_loop.create_task(_client.aclose())
        _client = httpx.AsyncClient(
            timeout=httpx.Timeout(15.0, connect=8.0),
            limits=httpx.Limits(max_connections=30, max_keepalive_connections=15),
            headers={
                "User-Agent": settings.ENKA_USER_AGENT,
                "Accept": "application/json",
            },
            follow_redirects=True,
        )
        _client_loop = loop
    return _client


async def close_http_client() -> None:
    """Close the shared async HTTP client cleanly on shutdown."""
    global _client, _client_loop
    if _client is not None and not _client.is_closed:
        await _client.aclose()
        _client = None
        _client_loop = None
