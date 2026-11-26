import asyncio
from typing import Optional
import httpx

_client: Optional[httpx.AsyncClient] = None
_client_loop_id: Optional[int] = None


def get_http_client() -> httpx.AsyncClient:
    """Return a shared async HTTP client bound to the active event loop."""
    global _client, _client_loop_id
    try:
        loop_id = id(asyncio.get_running_loop())
    except RuntimeError:
        loop_id = None

    if _client is None or _client.is_closed or _client_loop_id != loop_id:
        _client = httpx.AsyncClient(
            timeout=httpx.Timeout(12.0, connect=5.0),
            limits=httpx.Limits(max_connections=40, max_keepalive_connections=20),
            follow_redirects=True,
        )
        _client_loop_id = loop_id
    return _client


async def close_http_client() -> None:
    """Close the shared async HTTP client cleanly on shutdown."""
    global _client, _client_loop_id
    if _client is not None and not _client.is_closed:
        await _client.aclose()
        _client = None
        _client_loop_id = None
