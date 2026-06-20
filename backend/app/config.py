from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "sqlite:///./snackflow.db"
    postgres_url: str | None = None
    postgres_url_non_pooling: str | None = None
    database_url_unpooled: str | None = None
    jwt_secret: str = "dev-secret-change-me"
    jwt_expiry_minutes: int = 720
    backend_cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    auto_create_tables: bool = True
    auto_seed_demo: bool = False
    environment: str = "production"
    snackflow_demo_seed: bool = False
    initial_admin_username: str | None = None
    initial_admin_password: str | None = None
    monthly_archive_enabled: bool = False

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @property
    def cors_origins(self) -> list[str]:
        if self.backend_cors_origins.strip() == "*":
            return ["*"]
        return [item.strip() for item in self.backend_cors_origins.split(",") if item.strip()]

    @property
    def effective_database_url(self) -> str:
        url = self.database_url
        if url.startswith("sqlite"):
            url = self.postgres_url or self.postgres_url_non_pooling or self.database_url_unpooled or url
        if url.startswith("postgres://"):
            return f"postgresql://{url.removeprefix('postgres://')}"
        return url


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
