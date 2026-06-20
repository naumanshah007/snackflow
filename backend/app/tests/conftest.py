"""Shared test fixtures.

Each test runs against a fresh in-memory SQLite database with a small seeded
fixture set (admin owner, an order booker, a warehouse, a product + SKU and one
active shop). The FastAPI ``get_session`` dependency is overridden so the app
and the test share the same engine/connection.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

import app.models  # noqa: F401  ensure models are registered on metadata
from app.database import get_session
from app.main import app
from app.models import Product, SKU, Shop, ShopStatus, User, UserRole, Warehouse
from app.security import hash_password


@pytest.fixture(name="engine")
def engine_fixture():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    yield engine
    SQLModel.metadata.drop_all(engine)


@pytest.fixture(name="seed_ids")
def seed_fixture(engine):
    ids: dict[str, int] = {}
    with Session(engine) as session:
        warehouse = Warehouse(name="Test Depot")
        session.add(warehouse)
        session.flush()

        admin = User(name="Owner", username="admin", hashed_password=hash_password("admin123"), role=UserRole.OWNER)
        booker = User(
            name="Booker One",
            username="booker1",
            hashed_password=hash_password("booker123"),
            role=UserRole.ORDER_BOOKER,
            assigned_warehouse_id=warehouse.id,
            route_days=["Monday", "Wednesday"],
        )
        manager = User(
            name="WM",
            username="wm1",
            hashed_password=hash_password("wm123"),
            role=UserRole.WAREHOUSE_MANAGER,
            assigned_warehouse_id=warehouse.id,
        )
        session.add_all([admin, booker, manager])
        session.flush()

        product = Product(name="Chips")
        session.add(product)
        session.flush()
        sku = SKU(product_id=product.id, size_mrp=140, pack_quantity=20, cost_price=80, default_sale_rate=110, minimum_sale_rate=100)
        session.add(sku)
        session.flush()

        shop = Shop(
            name="Al Madina Store",
            assigned_warehouse_id=warehouse.id,
            assigned_order_booker_id=booker.id,
            status=ShopStatus.ACTIVE,
            route_days=["Monday"],
        )
        session.add(shop)
        session.flush()

        ids.update(
            warehouse=warehouse.id,
            admin=admin.id,
            booker=booker.id,
            manager=manager.id,
            product=product.id,
            sku=sku.id,
            shop=shop.id,
        )
        session.commit()
    return ids


@pytest.fixture(name="client")
def client_fixture(engine):
    def override_get_session():
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_session] = override_get_session
    # Intentionally not used as a context manager: the lifespan/startup event
    # runs create_db_and_tables() against the real engine and would create a
    # stray snackflow.db file. Tests use the overridden in-memory engine instead.
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()


def auth_headers(client: TestClient, username: str, password: str) -> dict[str, str]:
    response = client.post("/auth/login", data={"username": username, "password": password})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}
