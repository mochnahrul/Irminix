from typing import Optional
from pydantic import BaseModel, Field


class BuildAdvisorRequest(BaseModel):
    characterName: str
    uid: Optional[str] = None
    role: Optional[str] = None
    tone: str = Field(default="scholar", description="scholar | strategist | concise")


class BuildDimensionScore(BaseModel):
    label: str
    score: int


class BuildAdvisorResponse(BaseModel):
    characterName: str
    overallGrade: str
    headline: str
    summary: str
    strengths: list[str]
    improvements: list[str]
    recommendedNextFarm: str
    dimensions: list[BuildDimensionScore]
    poweredBy: str
