from fastapi import APIRouter, Query
from app.schemas.auth import PlayerProfile, UidConnectRequest
from app.services.enka_service import fetch_player_showcase

router = APIRouter(prefix="/api/auth", tags=["Authentication & UID Connect"])


@router.post("/connect", response_model=PlayerProfile)
async def connect_uid(payload: UidConnectRequest):
    """
    Zero-password UID Quick-Connect via Enka.Network.
    Fetches the player's public Genshin Impact profile and character showcase.
    """
    return await fetch_player_showcase(payload.uid)


@router.get("/profile/{uid}", response_model=PlayerProfile)
async def get_profile(
    uid: str,
    refresh: bool = Query(default=False, description="Bypass 5-minute TTL cache"),
):
    """Retrieve or refresh a connected player's Enka.Network showcase."""
    return await fetch_player_showcase(uid, force_refresh=refresh)
