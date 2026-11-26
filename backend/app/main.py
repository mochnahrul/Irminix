import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from app.api.auth import router as auth_router
from app.api.routes import router as archive_router
from app.core.cache import cache
from app.core.config import settings
from app.core.http import close_http_client
from app.services.catalog_service import get_all_characters
from app.services.database_service import _get_gear_recommendations
from app.services.planner_service import _get_character_material_map

logger = logging.getLogger(__name__)


async def _warm_startup_caches() -> None:
    """Warm slow upstream indexes in background so first user navigation is instant."""
    try:
        await get_all_characters()
        await asyncio.gather(
            _get_gear_recommendations(),
            _get_character_material_map(),
            return_exceptions=True,
        )
    except asyncio.CancelledError:
        pass
    except Exception as exc:
        logger.debug(f"Startup cache warmup skipped: {exc}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    warmup_task = asyncio.create_task(_warm_startup_caches())
    try:
        yield
    finally:
        warmup_task.cancel()
        await close_http_client()
        await cache.clear()


app = FastAPI(
    title="Irminix API",
    description="Genshin Impact Build Guide, Enka.Network UID Showcase, and AI Build Advisor (Stateless / No DB)",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(GZipMiddleware, minimum_size=1000)

origins = list({
    settings.FRONTEND_URL.rstrip("/"),
    "http://localhost:5173",
    "http://127.0.0.1:5173",
})

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(archive_router)
app.include_router(auth_router)


@app.get("/health", tags=["Health"])
async def health_check():
    return {
        "status": "healthy",
        "service": "irminsul-backend",
        "version": "1.0.0",
        "storage": "in-memory-ttl-cache",
        "cache": cache.stats(),
    }
