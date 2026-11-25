from pydantic import BaseModel


class MapLabelNode(BaseModel):
    id: int
    name: str
    icon: str = ""
    count: int = 0
    children: list["MapLabelNode"] = []


class MapAnchor(BaseModel):
    id: str
    name: str
    x: float
    y: float


class MapConfigResponse(BaseModel):
    mapId: int
    name: str
    origin: list[float]
    totalSize: list[int]
    slices: list[list[str]]
    categories: list[MapLabelNode]
    anchors: list[MapAnchor] = []
    totalPins: int = 0


class MapPoint(BaseModel):
    id: int
    labelId: int
    x: float
    y: float
    zLevel: int = 0


class MapPointsResponse(BaseModel):
    mapId: int
    points: list[MapPoint]


class MapPointDetail(BaseModel):
    id: int
    labelId: int
    content: str = ""
    img: str = ""
    authorName: str = ""
