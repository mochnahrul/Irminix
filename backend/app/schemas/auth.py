from typing import Optional
from pydantic import BaseModel, Field


class UidConnectRequest(BaseModel):
    uid: str = Field(..., min_length=9, max_length=10, description="9-digit or 10-digit Genshin Impact UID")


class ShowcaseArtifact(BaseModel):
    slot: str
    name: str
    setName: str
    rarity: int
    level: int
    mainStat: str
    mainStatValue: str
    subStats: list[dict[str, str]] = []
    iconUrl: Optional[str] = None


class ShowcaseWeapon(BaseModel):
    name: str
    rarity: int
    level: int
    refinement: int
    baseAtk: Optional[int] = None
    subStat: Optional[str] = None
    iconUrl: Optional[str] = None


class ShowcaseCharacter(BaseModel):
    avatarId: int
    name: str
    element: str
    rarity: int
    level: int
    friendship: int
    constellationsUnlocked: int
    talentLevels: list[int] = []
    stats: dict[str, str] = {}
    weapon: Optional[ShowcaseWeapon] = None
    artifacts: list[ShowcaseArtifact] = []
    iconUrl: Optional[str] = None
    critValue: float = 0.0


class PlayerProfile(BaseModel):
    uid: str
    nickname: str
    level: int
    worldLevel: int
    signature: str = ""
    finishAchievementNum: int = 0
    towerFloorIndex: Optional[int] = None
    towerLevelIndex: Optional[int] = None
    towerStarIndex: Optional[int] = None
    theaterActIndex: Optional[int] = None
    theaterStarIndex: Optional[int] = None
    stygianIndex: Optional[int] = None
    stygianSeconds: Optional[int] = None
    profilePictureUrl: Optional[str] = None
    showcaseCharacters: list[ShowcaseCharacter] = []
    cached: bool = False
    ttlSeconds: int = 300
