from typing import Optional
from pydantic import BaseModel


class GearUserRecommendation(BaseModel):
    characterId: str
    name: str
    vision: str
    rarity: int
    image: str = ""
    role: str = ""
    rank: int = 1


class WeaponItem(BaseModel):
    id: int
    name: str
    rarity: int
    weaponType: str
    subStat: Optional[str] = None
    image: str = ""
    recommendedFor: list[GearUserRecommendation] = []


class WeaponDetailResponse(WeaponItem):
    baseAtk: Optional[str] = None
    subStatValue: Optional[str] = None
    description: str = ""
    passiveName: Optional[str] = None
    passiveDescription: Optional[str] = None
    passiveRefinements: list[str] = []


class ArtifactSetItem(BaseModel):
    id: int
    name: str
    maxRarity: int
    image: str = ""
    bonuses: list[str] = []
    recommendedFor: list[GearUserRecommendation] = []


class ElementalResonanceItem(BaseModel):
    id: str
    name: str
    description: str


class ElementalReactionItem(BaseModel):
    name: str
    elements: list[str]
    category: str
    scaling: str
    description: str


class ElementsDatabaseResponse(BaseModel):
    resonances: list[ElementalResonanceItem]
    reactions: list[ElementalReactionItem]
