from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from app.core.cache import cache
from app.schemas.achievement import (
    AchievementCatalogResponse,
    AchievementGuideRequest,
    AchievementGuideResponse,
)
from app.schemas.advisor import BuildAdvisorRequest, BuildAdvisorResponse
from app.schemas.character import CharacterDetail, CharacterSummary
from app.services.achievement_service import (
    generate_achievement_guide,
    get_achievement_catalog,
)
from app.services.ai_service import generate_build_advice
from app.services.catalog_service import get_all_characters, get_character_detail, slugify_name
from app.services.enka_service import fetch_player_showcase

router = APIRouter(prefix="/api", tags=["Irminsul Archive"])


@router.get("/characters", response_model=list[CharacterSummary])
async def list_characters(
    vision: Optional[str] = Query(default=None, description="Filter by element/vision"),
    weapon: Optional[str] = Query(default=None, description="Filter by weapon type"),
    rarity: Optional[int] = Query(default=None, description="Filter by rarity (4 or 5)"),
    search: Optional[str] = Query(default=None, description="Search by character name"),
):
    """List all Genshin Impact characters with optional element, weapon, rarity, and text filters."""
    characters = await get_all_characters()

    if vision and vision.lower() != "all":
        characters = [c for c in characters if c.vision.lower() == vision.lower()]
    if weapon and weapon.lower() != "all":
        characters = [c for c in characters if c.weapon.lower() == weapon.lower()]
    if rarity in (4, 5):
        characters = [c for c in characters if c.rarity == rarity]
    if search:
        q = search.strip().lower()
        characters = [c for c in characters if q in c.name.lower()]

    return characters


@router.get("/characters/{identifier}", response_model=CharacterDetail)
async def character_detail(identifier: str):
    """Get full character metadata, curated build guides, talents, and constellations."""
    detail = await get_character_detail(identifier)
    if not detail:
        raise HTTPException(status_code=404, detail=f"Character '{identifier}' not found.")
    return detail


@router.post("/advisor", response_model=BuildAdvisorResponse)
async def build_advisor(payload: BuildAdvisorRequest):
    """Run AI or deterministic build evaluation for a character (optionally using connected UID)."""
    detail = await get_character_detail(payload.characterName)
    if not detail:
        raise HTTPException(status_code=404, detail=f"Character '{payload.characterName}' not found.")

    showcase_match = None
    if payload.uid:
        try:
            profile = await fetch_player_showcase(payload.uid)
            target_slug = slugify_name(detail.name)
            showcase_match = next(
                (ch for ch in profile.showcaseCharacters if slugify_name(ch.name) == target_slug),
                None,
            )
        except HTTPException:
            showcase_match = None

    return await generate_build_advice(payload, detail, showcase_match)


@router.post("/cache/clear")
async def clear_cache():
    """Clear in-memory TTL cache to force fresh upstream API fetches."""
    await cache.clear()
    return {"status": "cleared"}


@router.get("/achievements", response_model=AchievementCatalogResponse)
async def list_achievements():
    """Return all Genshin Impact achievements and categories from gi.yatta.moe."""
    return await get_achievement_catalog()


@router.post("/achievements/guide", response_model=AchievementGuideResponse)
async def achievement_guide(payload: AchievementGuideRequest):
    """Return concise unlock steps for an achievement."""
    return await generate_achievement_guide(payload)
