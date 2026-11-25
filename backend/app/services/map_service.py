import asyncio
from collections import defaultdict
import json
import logging
from typing import Any
from fastapi import HTTPException
from app.core.cache import cache
from app.core.http import get_http_client
from app.schemas.map import (
    MapAnchor,
    MapConfigResponse,
    MapLabelNode,
    MapPoint,
    MapPointDetail,
    MapPointsResponse,
)

logger = logging.getLogger(__name__)

MAP_TTL = 60 * 60 * 6  # 6 hours
POINT_DETAIL_TTL = 60 * 60 * 24  # 24 hours

HOYO_MAP_INFO = "https://sg-public-api.hoyolab.com/common/map_user/ys_obc/v1/map/info"
HOYO_LABEL_TREE = "https://sg-public-api.hoyolab.com/common/map_user/ys_obc/v1/map/label/tree"
HOYO_ANCHOR_LIST = "https://sg-public-api.hoyolab.com/common/map_user/ys_obc/v1/map/map_anchor/list"
HOYO_POINT_LIST = "https://sg-public-api-static.hoyolab.com/common/map_user/ys_obc/v2/map/point/list"
HOYO_POINT_INFO = "https://sg-public-api.hoyolab.com/common/map_user/ys_obc/v1/map/point/info"

HEADERS = {"User-Agent": "Mozilla/5.0"}

# Single-flight tasks for background point-list downloads per map_id
_inflight_points: dict[int, asyncio.Task[dict[int, list[tuple[int, float, float, int]]]]] = {}


async def _fetch_points_index(
    map_id: int,
) -> dict[int, list[tuple[int, float, float, int]]]:
    """Download and compactly index all pins by label_id: (id, x, y, z_level)."""
    cache_key = f"irminix:map:points_idx:{map_id}"
    cached = await cache.get(cache_key)
    if cached is not None:
        return cached

    client = get_http_client()
    params = {"map_id": str(map_id), "app_sn": "ys_obc", "lang": "en-us"}
    try:
        res = await client.get(HOYO_POINT_LIST, params=params, headers=HEADERS)
        if res.status_code != 200:
            raise HTTPException(status_code=502, detail="Failed to fetch map points.")
        raw_points = res.json().get("data", {}).get("point_list", [])
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"HoYoLAB Map Points unavailable: {exc}") from exc

    by_label: dict[int, list[tuple[int, float, float, int]]] = defaultdict(list)
    for p in raw_points:
        lid = int(p.get("label_id", 0))
        by_label[lid].append(
            (
                int(p["id"]),
                float(p["x_pos"]),
                float(p["y_pos"]),
                int(p.get("z_level", 0) or 0),
            )
        )

    result = dict(by_label)
    await cache.set(cache_key, result, ttl_seconds=MAP_TTL)
    return result


async def _get_points_index(
    map_id: int,
) -> dict[int, list[tuple[int, float, float, int]]]:
    cache_key = f"irminix:map:points_idx:{map_id}"
    cached = await cache.get(cache_key)
    if cached is not None:
        return cached

    task = _inflight_points.get(map_id)
    if task is None or task.done():
        task = asyncio.create_task(_fetch_points_index(map_id))
        _inflight_points[map_id] = task
    try:
        return await task
    finally:
        if _inflight_points.get(map_id) is task and task.done():
            _inflight_points.pop(map_id, None)


def _schedule_points_prefetch(map_id: int) -> None:
    task = _inflight_points.get(map_id)
    if task is None or task.done():
        _inflight_points[map_id] = asyncio.create_task(_fetch_points_index(map_id))


async def get_map_config(map_id: int = 2) -> MapConfigResponse:
    """Return map bounds, tile slices, anchors, and category tree immediately."""
    cache_key = f"irminix:map:config:{map_id}"
    cached = await cache.get(cache_key)
    if cached is not None:
        _schedule_points_prefetch(map_id)
        return cached

    client = get_http_client()
    params = {"map_id": str(map_id), "app_sn": "ys_obc", "lang": "en-us"}

    try:
        info_res, tree_res, anchor_res = await asyncio.gather(
            client.get(HOYO_MAP_INFO, params=params, headers=HEADERS),
            client.get(HOYO_LABEL_TREE, params=params, headers=HEADERS),
            client.get(HOYO_ANCHOR_LIST, params=params, headers=HEADERS),
        )
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Failed to reach HoYoLAB Map API: {exc}") from exc

    if info_res.status_code != 200 or tree_res.status_code != 200:
        raise HTTPException(status_code=502, detail="HoYoLAB Map API returned an unexpected status.")

    info_obj = info_res.json().get("data", {}).get("info", {})
    detail = json.loads(info_obj.get("detail", "{}"))
    origin = [float(x) for x in detail.get("origin", [0, 0])]
    total_size = [int(x) for x in detail.get("total_size", [2048, 2048])]
    raw_slices = detail.get("slices", [])
    slices = [[cell.get("url", "") for cell in row] for row in raw_slices]

    def parse_nodes(nodes: list[dict[str, Any]]) -> list[MapLabelNode]:
        parsed: list[MapLabelNode] = []
        for n in nodes:
            children = parse_nodes(n.get("children") or [])
            parsed.append(
                MapLabelNode(
                    id=int(n.get("id", 0)),
                    name=n.get("name", "Marker"),
                    icon=n.get("icon", ""),
                    count=int(n.get("point_count", 0) or 0),
                    children=children,
                )
            )
        return parsed

    raw_tree = tree_res.json().get("data", {}).get("tree", [])
    categories = parse_nodes(raw_tree)

    anchors: list[MapAnchor] = []
    if anchor_res.status_code == 200:
        for item in anchor_res.json().get("data", {}).get("list", []):
            lx = float(item.get("l_x", 0))
            rx = float(item.get("r_x", 0))
            ly = float(item.get("l_y", 0))
            ry = float(item.get("r_y", 0))
            anchors.append(
                MapAnchor(
                    id=str(item.get("id", "")),
                    name=item.get("name", "Region"),
                    x=(lx + rx) / 2,
                    y=(ly + ry) / 2,
                )
            )

    config = MapConfigResponse(
        mapId=map_id,
        name=info_obj.get("name", "Teyvat Interactive Map"),
        origin=origin,
        totalSize=total_size,
        slices=slices,
        categories=categories,
        anchors=anchors,
        totalPins=0,
    )

    await cache.set(cache_key, config, ttl_seconds=MAP_TTL)
    # Warm the 22MB point index asynchronously without blocking config response
    _schedule_points_prefetch(map_id)
    return config


async def get_map_points(map_id: int, label_ids: list[int]) -> MapPointsResponse:
    by_label = await _get_points_index(map_id)
    points: list[MapPoint] = []
    for lid in label_ids:
        for pid, x, y, z_level in by_label.get(lid, ()):
            points.append(MapPoint(id=pid, labelId=lid, x=x, y=y, zLevel=z_level))
    return MapPointsResponse(mapId=map_id, points=points)


async def get_map_point_detail(point_id: int, map_id: int = 2) -> MapPointDetail:
    cache_key = f"irminix:map:point:{map_id}:{point_id}"
    cached = await cache.get(cache_key)
    if cached is not None:
        return cached

    client = get_http_client()
    try:
        res = await client.get(
            HOYO_POINT_INFO,
            params={
                "point_id": str(point_id),
                "map_id": str(map_id),
                "app_sn": "ys_obc",
                "lang": "en-us",
            },
            headers=HEADERS,
        )
        if res.status_code == 200:
            info = res.json().get("data", {}).get("info", {})
            detail = MapPointDetail(
                id=point_id,
                labelId=int(info.get("label_id", 0)),
                content=info.get("content", "") or "",
                img=info.get("img", "") or "",
                authorName=info.get("author_name", "") or "",
            )
            await cache.set(cache_key, detail, ttl_seconds=POINT_DETAIL_TTL)
            return detail
    except Exception as exc:
        logger.debug(f"Point detail fetch failed for {point_id}: {exc}")

    return MapPointDetail(id=point_id, labelId=0)
