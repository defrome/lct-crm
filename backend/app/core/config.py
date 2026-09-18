"""Application settings.

Everything is read from the environment (12-factor). There are no hardcoded
secrets or hosts in the codebase; `.env.example` documents every knob.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import computed_field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# `app.models.enums` is a leaf module (stdlib `enum` only), so importing it here
# keeps the setting typed without pulling the ORM into configuration.
from app.models.enums import IntegrationMode

# `test` is used by the test-server compose configuration.  Keep it distinct
# from local development while preserving the production-only auth safeguard.
Environment = Literal["local", "dev", "test", "staging", "production"]
AuthMode = Literal["dev", "keycloak"]
CacheBackend = Literal["redis"]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        # Both locations are read, the later one winning: `.env` next to the
        # backend when it is run on its own, and the repository root `.env`
        # that docker compose already uses — so a monorepo checkout needs one
        # file, not two copies that drift apart.
        env_file=("../.env", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # --- General -----------------------------------------------------------
    env: Environment = "local"
    debug: bool = False
    app_name: str = "CRM IT School"
    api_prefix: str = "/api/v1"
    log_level: str = "INFO"

    # --- Database ----------------------------------------------------------
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_user: str = "crm"
    postgres_password: str = "crm"
    postgres_db: str = "crm"
    db_echo: bool = False
    db_pool_size: int = 10
    db_max_overflow: int = 20

    # --- Auth --------------------------------------------------------------
    auth_mode: AuthMode = "dev"
    keycloak_issuer: str | None = None
    keycloak_audience: str | None = None
    keycloak_jwks_url: str | None = None

    # --- Imports -----------------------------------------------------------
    import_max_file_size: int = 20 * 1024 * 1024  # 20 MiB, per SPEC §6
    import_max_rows: int = 100_000
    # Minimal similarity (0..100) for suggesting an existing university as a
    # match for a slightly different spelling coming from Excel.
    import_fuzzy_threshold: int = 88

    # --- Integrations (SPEC-04) --------------------------------------------
    # `fixture` replays the JSON shipped in app/integrations/fixtures, so the
    # ingest path works before the customer provides the API contract.
    # A source whose URL is unset falls back to its fixture even in `http` mode.
    integrations_mode: IntegrationMode = IntegrationMode.FIXTURE
    lms_api_url: str | None = None
    lms_api_token: str | None = None
    website_api_url: str | None = None
    website_api_token: str | None = None
    integrations_timeout: float = 15.0
    # Hard cap on pages followed in one run — an unbounded cursor loop is one
    # misbehaving upstream away.
    integrations_page_limit: int = 100

    # --- Object storage ----------------------------------------------------
    object_storage_backend: Literal["minio", "memory"] = "minio"
    minio_endpoint: str = "localhost:9000"
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin"
    minio_secure: bool = False
    minio_bucket: str = "crm-files"

    # --- Cache and optional modules ---------------------------------------
    # A disabled cache is deliberately a no-op: it never becomes an offline
    # write queue and changing this setting does not alter business data.
    cache_enabled: bool = False
    cache_backend: CacheBackend = "redis"
    redis_url: str = "redis://localhost:6379/0"
    cache_ttl_seconds: int = 60
    feature_notifications_enabled: bool = False
    feature_external_channels_enabled: bool = False
    feature_chat_enabled: bool = False
    feature_cache_enabled: bool = False

    # --- Attachments -------------------------------------------------------
    # Stage attachments (FR-04), stored in object storage.
    attachment_max_file_size: int = 25 * 1024 * 1024  # 25 MiB

    # --- Pagination --------------------------------------------------------
    page_size_default: int = 50
    page_size_max: int = 200

    @computed_field  # type: ignore[prop-decorator]
    @property
    def database_url(self) -> str:
        """Async (asyncpg) DSN used by the application."""
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @computed_field  # type: ignore[prop-decorator]
    @property
    def sync_database_url(self) -> str:
        """Sync DSN — Alembic's `run_migrations_offline` and tooling use it."""
        return (
            f"postgresql://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @model_validator(mode="after")
    def _forbid_dev_auth_in_production(self) -> Settings:
        """SPEC §8: the debug-header auth stub must be impossible in production.

        Failing here means the process refuses to start, which is exactly what
        we want: a misconfigured deployment must not silently accept
        `X-Debug-User`.
        """
        if self.env == "production" and self.auth_mode != "keycloak":
            raise ValueError(
                "AUTH_MODE=dev is forbidden when ENV=production; set AUTH_MODE=keycloak"
            )
        if self.auth_mode == "keycloak" and not self.keycloak_issuer:
            raise ValueError("AUTH_MODE=keycloak requires KEYCLOAK_ISSUER to be set")
        if self.env == "production" and self.object_storage_backend != "minio":
            raise ValueError("OBJECT_STORAGE_BACKEND=memory is forbidden when ENV=production")
        if self.cache_ttl_seconds < 1:
            raise ValueError("CACHE_TTL_SECONDS must be at least 1")
        return self


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


settings: Settings = get_settings()
