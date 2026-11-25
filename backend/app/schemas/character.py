from typing import Optional
from pydantic import BaseModel


class VisionInfo(BaseModel):
    name: str
    image: str


class BuildWeapon(BaseModel):
    name: str
    rarity: int
    refine: int = 0
    image: str = ""
    subStat: Optional[str] = None
    passiveName: Optional[str] = None
    description: Optional[str] = None


class BuildArtifactPiece(BaseModel):
    name: str
    rarity: int = 5
    piece: int = 4
    image: str = ""
    bonuses: list[str] = []


class BuildArtifactOption(BaseModel):
    name: Optional[str] = None
    rarity: int = 5
    piece: int = 4
    image: str = ""
    bonuses: list[str] = []
    mix: Optional[list[BuildArtifactPiece]] = None


class CharacterBuildGuide(BaseModel):
    role: str
    weapons: list[BuildWeapon] = []
    artifacts: list[BuildArtifactOption] = []
    mainStats: list[str] = []
    subStats: list[str] = []
    talentPriority: list[str] = []


class CharacterSummary(BaseModel):
    id: str
    name: str
    weapon: str
    region: str
    rarity: int
    vision: str
    visionImage: str = ""
    image: str = ""
    hasCuratedBuild: bool = True
    roles: list[str] = []
    source: str = "curated"


class CharacterDetail(CharacterSummary):
    title: Optional[str] = None
    description: Optional[str] = None
    constellation: Optional[str] = None
    birthday: Optional[str] = None
    builds: list[CharacterBuildGuide] = []
    talents: list[dict[str, str]] = []
    constellations: list[dict[str, str]] = []
