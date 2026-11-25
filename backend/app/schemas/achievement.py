from pydantic import BaseModel


class AchievementCategory(BaseModel):
    id: str
    name: str
    order: int
    count: int


class AchievementItem(BaseModel):
    id: int
    title: str
    description: str
    categoryId: str
    categoryName: str
    primogems: int
    version: str = ""


class AchievementCatalogResponse(BaseModel):
    total: int
    categories: list[AchievementCategory]
    items: list[AchievementItem]


class AchievementGuideRequest(BaseModel):
    title: str
    description: str
    categoryName: str = "Wonders of the World"


class AchievementGuideResponse(BaseModel):
    title: str
    steps: list[str]
    tip: str
    poweredBy: str
