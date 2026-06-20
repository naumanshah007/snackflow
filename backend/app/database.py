from collections.abc import Generator

from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from app.config import settings

database_url = settings.effective_database_url
connect_args = {"check_same_thread": False} if database_url.startswith("sqlite") else {}
engine_kwargs = {}
if database_url == "sqlite://":
    engine_kwargs["poolclass"] = StaticPool

engine = create_engine(database_url, connect_args=connect_args, **engine_kwargs)


def create_db_and_tables() -> None:
    import app.models  # noqa: F401

    SQLModel.metadata.create_all(engine)


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session
