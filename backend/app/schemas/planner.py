from typing import Optional
from pydantic import BaseModel, Field
from app.schemas.character import CharacterSummary
from app.schemas.database import ElementalReactionItem, ElementalResonanceItem


class MaterialBrief(BaseModel):
    id: int
    name: str
    rank: int = 1
    icon: str = ""
    count: int = 1


class DomainScheduleItem(BaseModel):
    id: int
    name: str
    city: str
    category: str  # "Talent Books" | "Weapon Materials"
    materials: list[MaterialBrief] = Field(default_factory=list)
    characters: list[CharacterSummary] = Field(default_factory=list)


class DailyFarmingResponse(BaseModel):
    day: str
    availableDays: list[str]
    talentDomains: list[DomainScheduleItem] = Field(default_factory=list)
    weaponDomains: list[DomainScheduleItem] = Field(default_factory=list)


class AscensionStagePlan(BaseModel):
    promoteLevel: int
    unlockMaxLevel: int
    coinCost: int = 0
    items: list[MaterialBrief] = Field(default_factory=list)


class TalentStagePlan(BaseModel):
    level: int
    coinCost: int = 0
    items: list[MaterialBrief] = Field(default_factory=list)


class CharacterMaterialPlanResponse(BaseModel):
    characterId: str
    name: str
    rarity: int
    vision: str
    image: str
    ascensionStages: list[AscensionStagePlan] = Field(default_factory=list)
    talentStages: list[TalentStagePlan] = Field(default_factory=list)


class TeamAnalyzeRequest(BaseModel):
    characterIds: list[str] = Field(default_factory=list, max_length=4)


class TeamAnalyzeResponse(BaseModel):
    characters: list[CharacterSummary] = Field(default_factory=list)
    activeResonances: list[ElementalResonanceItem] = Field(default_factory=list)
    triggerableReactions: list[ElementalReactionItem] = Field(default_factory=list)
    roleCounts: dict[str, int] = Field(default_factory=dict)
    synergyNotes: list[str] = Field(default_factory=list)
