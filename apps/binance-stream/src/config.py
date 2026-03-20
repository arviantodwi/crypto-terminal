"""
Application settings loaded from environment variables / .env file via pydantic-settings.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    cors_origins: list[str] = ["http://localhost:3000"]
    log_level: str = "INFO"
    host: str = "0.0.0.0"
    port: int = 3001
    binance_api_key: str = ""
    binance_api_secret: str = ""
    database_url: str = ""


settings = Settings()
