from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    GEMINI_API_KEY: Optional[str] = None
    FRONTEND_URL: str = "http://localhost:5173"
    ENVIRONMENT: str = "development"
    ENKA_USER_AGENT: str = "Irminsul/1.0 (Genshin Build Codex)"
    GENSHIN_API_BASE: str = "https://gi.yatta.moe/api/v2/en"
    YATTA_ASSET_BASE: str = "https://gi.yatta.moe/assets/UI"
    ENKA_API_BASE: str = "https://enka.network/api"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
