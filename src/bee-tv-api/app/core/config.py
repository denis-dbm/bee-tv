"""Application settings, sourced from environment variables (12-factor)."""

from functools import lru_cache

from pydantic import AliasChoices, Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="BEE_", env_file=".env", extra="ignore", populate_by_name=True
    )

    app_name: str = "Bee TV API"
    log_level: str = "INFO"
    database_url: str = "mysql+asyncmy://beetv:beetv@localhost:3306/beetv"

    catalog_base_url: str = "https://api.tvmaze.com"
    catalog_timeout_seconds: float = 5.0
    catalog_max_attempts: int = 3
    catalog_cache_ttl_seconds: float = 300.0
    catalog_cache_max_entries: int = 1024

    insight_api_base_url: str = "https://router.huggingface.co/v1"
    insight_api_token: SecretStr | None = Field(
        default=None,
        validation_alias=AliasChoices("BEE_INSIGHT_API_TOKEN", "HF_TOKEN"),
    )
    insight_model: str = "meta-llama/Llama-3.1-8B-Instruct"
    insight_timeout_seconds: float = 20.0
    insight_cache_ttl_seconds: float = 3600.0
    insight_max_comments: int = 20

    circuit_breaker_failure_threshold: int = 3
    circuit_breaker_reset_seconds: float = 30.0


@lru_cache
def get_settings() -> Settings:
    return Settings()
