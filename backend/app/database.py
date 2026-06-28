import logging
from collections.abc import Generator

from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from app.config import settings

logger = logging.getLogger(__name__)

database_url = settings.effective_database_url
connect_args = {"check_same_thread": False} if database_url.startswith("sqlite") else {}
engine_kwargs = {}
if database_url == "sqlite://":
    engine_kwargs["poolclass"] = StaticPool

engine = create_engine(database_url, connect_args=connect_args, **engine_kwargs)


def assert_persistent_database_for_non_development() -> None:
    environment = settings.environment.strip().lower()
    if not database_url.startswith("sqlite") or environment == "development":
        return

    message = (
        "Unsafe SnackFlow database configuration: effective_database_url resolved to SQLite "
        f"while ENVIRONMENT is {settings.environment!r}. Serverless SQLite storage is ephemeral "
        "and can make production data appear to reset. Set POSTGRES_URL, "
        "POSTGRES_URL_NON_POOLING, DATABASE_URL_UNPOOLED, or DATABASE_URL to a persistent "
        "PostgreSQL connection string, or set ENVIRONMENT=development for local SQLite use."
    )
    logger.critical(message)
    raise RuntimeError(message)


def create_db_and_tables() -> None:
    assert_persistent_database_for_non_development()
    import app.models  # noqa: F401

    SQLModel.metadata.create_all(engine)


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session
