import pytest
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel, Session, create_engine, select

import app.models  # noqa: F401
import app.seed as seed_module
from app.models import User, UserRole, Warehouse
from app.security import hash_password, verify_password


@pytest.fixture(autouse=True)
def clear_seed_env(monkeypatch):
    for name in (
        "SNACKFLOW_DEMO_SEED",
        "ENVIRONMENT",
        "INITIAL_ADMIN_USERNAME",
        "INITIAL_ADMIN_PASSWORD",
    ):
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setattr(seed_module.settings, "environment", "production")
    monkeypatch.setattr(seed_module.settings, "snackflow_demo_seed", False)
    monkeypatch.setattr(seed_module.settings, "initial_admin_username", None)
    monkeypatch.setattr(seed_module.settings, "initial_admin_password", None)


@pytest.fixture(name="seed_engine")
def seed_engine_fixture(monkeypatch):
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    SQLModel.metadata.create_all(engine)
    monkeypatch.setattr(seed_module, "engine", engine)
    monkeypatch.setattr(seed_module, "create_db_and_tables", lambda: SQLModel.metadata.create_all(engine))
    yield engine
    SQLModel.metadata.drop_all(engine)


def _user(session: Session, username: str) -> User:
    user = session.exec(select(User).where(User.username == username)).one()
    return user


def _create_existing_demo_users(engine) -> None:
    with Session(engine) as session:
        warehouse_1 = Warehouse(name="Warehouse 1")
        warehouse_2 = Warehouse(name="Warehouse 2")
        session.add(warehouse_1)
        session.add(warehouse_2)
        session.flush()
        session.add_all(
            [
                User(name="Admin", username="admin", hashed_password=hash_password("custom-admin"), role=UserRole.OWNER),
                User(
                    name="Booker 1",
                    username="booker1",
                    hashed_password=hash_password("custom-booker1"),
                    role=UserRole.ORDER_BOOKER,
                    assigned_warehouse_id=warehouse_1.id,
                ),
                User(
                    name="Booker 2",
                    username="booker2",
                    hashed_password=hash_password("custom-booker2"),
                    role=UserRole.ORDER_BOOKER,
                    assigned_warehouse_id=warehouse_2.id,
                ),
            ]
        )
        session.commit()


def test_demo_mode_resets_demo_passwords(seed_engine, monkeypatch):
    _create_existing_demo_users(seed_engine)
    monkeypatch.setenv("SNACKFLOW_DEMO_SEED", "true")

    seed_module.seed()

    with Session(seed_engine) as session:
        admin = _user(session, "admin")
        booker_1 = _user(session, "booker1")
        booker_2 = _user(session, "booker2")
        assert verify_password("admin123", admin.hashed_password)
        assert verify_password("booker123", booker_1.hashed_password)
        assert verify_password("booker123", booker_2.hashed_password)
        assert not verify_password("custom-admin", admin.hashed_password)
        assert not verify_password("custom-booker1", booker_1.hashed_password)
        assert not verify_password("custom-booker2", booker_2.hashed_password)


def test_production_mode_preserves_existing_passwords(seed_engine, monkeypatch):
    _create_existing_demo_users(seed_engine)
    monkeypatch.setenv("ENVIRONMENT", "production")

    seed_module.seed()

    with Session(seed_engine) as session:
        admin = _user(session, "admin")
        booker_1 = _user(session, "booker1")
        booker_2 = _user(session, "booker2")
        assert verify_password("custom-admin", admin.hashed_password)
        assert verify_password("custom-booker1", booker_1.hashed_password)
        assert verify_password("custom-booker2", booker_2.hashed_password)
        assert not verify_password("admin123", admin.hashed_password)
        assert not verify_password("booker123", booker_1.hashed_password)
        assert not verify_password("booker123", booker_2.hashed_password)


def test_production_mode_creates_initial_admin_from_env_only(seed_engine, monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("INITIAL_ADMIN_USERNAME", "owner")
    monkeypatch.setenv("INITIAL_ADMIN_PASSWORD", "very-secure-admin-password")

    seed_module.seed()

    with Session(seed_engine) as session:
        users = session.exec(select(User).order_by(User.id)).all()
        assert len(users) == 1
        assert users[0].username == "owner"
        assert users[0].role == UserRole.OWNER
        assert verify_password("very-secure-admin-password", users[0].hashed_password)
