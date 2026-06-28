"""Persistence + refetch workflows reported in the 2026-06-20 client retest.

These cover the data round-trips that were reported as "saved but not shown
later": shops, stock receiving / inventory, SKU and shop rate rules. Each test
writes through the API and then re-reads through a *fresh* request to prove the
record is persisted and returned again (the equivalent of switching tabs or
refreshing the browser).
"""

from app.tests.conftest import auth_headers


def test_shop_create_persists_and_is_listed(client, seed_ids):
    headers = auth_headers(client, "admin", "admin123")
    payload = {
        "name": "New Corner Shop",
        "owner_name": "Bilal",
        "area_route": "Route C",
        "assigned_warehouse_id": seed_ids["warehouse"],
        "assigned_order_booker_id": seed_ids["booker"],
        "route_days": ["Monday", "Friday"],
        "opening_balance": 0,
    }
    created = client.post("/shops", json=payload, headers=headers)
    assert created.status_code == 200, created.text
    shop_id = created.json()["id"]

    # Re-read as if the page was refreshed.
    listed = client.get("/shops", headers=headers).json()
    names = {shop["name"] for shop in listed}
    assert "New Corner Shop" in names
    match = next(shop for shop in listed if shop["id"] == shop_id)
    assert match["route_days"] == ["Monday", "Friday"]


def test_order_booker_shop_is_pending_and_visible(client, seed_ids):
    booker_headers = auth_headers(client, "booker1", "booker123")
    created = client.post("/shops", json={"name": "Booker Shop"}, headers=booker_headers)
    assert created.status_code == 200, created.text
    assert created.json()["status"] == "PENDING_APPROVAL"

    # Visible to the booker who created it...
    booker_view = client.get("/shops", headers=booker_headers).json()
    assert any(shop["name"] == "Booker Shop" and shop["status"] == "PENDING_APPROVAL" for shop in booker_view)

    # ...and to the admin (active + pending both shown, no status filter).
    admin_view = client.get("/shops", headers=auth_headers(client, "admin", "admin123")).json()
    assert any(shop["name"] == "Booker Shop" and shop["status"] == "PENDING_APPROVAL" for shop in admin_view)


def test_stock_receipt_updates_inventory_and_history(client, seed_ids):
    headers = auth_headers(client, "admin", "admin123")
    receipt = client.post(
        "/stock-receipts",
        json={
            "warehouse_id": seed_ids["warehouse"],
            "supplier_name": "ACME",
            "items": [
                {
                    "sku_id": seed_ids["sku"],
                    "quantity_received": 100,
                    "quantity_unit": "carton",
                    "pack_quantity": 20,
                    "cost_per_carton": 1600,
                }
            ],
        },
        headers=headers,
    )
    assert receipt.status_code == 200, receipt.text

    # Inventory reflects the 100 cartons (100 * 20 = 2000 packets) on re-read.
    inventory = client.get("/inventory", headers=headers).json()
    row = next(r for r in inventory if r["sku_id"] == seed_ids["sku"])
    assert row["available_packets"] == 2000
    assert row["cartons"] == 100
    assert row["average_cost_per_carton"] == 1600

    # Receipt history shows the receipt with cartons + cost/carton + warehouse.
    receipts = client.get("/stock-receipts", headers=headers).json()
    assert len(receipts) == 1
    assert receipts[0]["warehouse_name"] == "Test Depot"
    item = receipts[0]["items"][0]
    assert item["quantity_received"] == 100
    assert item["cost_per_carton"] == 1600


def test_stock_receipt_survives_second_receipt(client, seed_ids):
    """Two receipts accumulate rather than the second hiding the first."""
    headers = auth_headers(client, "admin", "admin123")
    body = {
        "warehouse_id": seed_ids["warehouse"],
        "items": [{"sku_id": seed_ids["sku"], "quantity_received": 10, "quantity_unit": "carton", "pack_quantity": 20, "cost_per_carton": 1600}],
    }
    assert client.post("/stock-receipts", json=body, headers=headers).status_code == 200
    assert client.post("/stock-receipts", json=body, headers=headers).status_code == 200

    inventory = client.get("/inventory", headers=headers).json()
    row = next(r for r in inventory if r["sku_id"] == seed_ids["sku"])
    assert row["cartons"] == 20


def test_shop_rate_rule_persists(client, seed_ids):
    headers = auth_headers(client, "admin", "admin123")
    created = client.post(
        "/rates",
        json={
            "shop_id": seed_ids["shop"],
            "sku_id": seed_ids["sku"],
            "fixed_sale_rate": 115,
            "minimum_allowed_rate": 105,
            "effective_from": "2026-06-20",
        },
        headers=headers,
    )
    assert created.status_code == 200, created.text

    rates = client.get("/rates", headers=headers).json()
    assert any(r["shop_id"] == seed_ids["shop"] and r["fixed_sale_rate"] == 115 for r in rates)

    # Filtered re-read (as the rate context picker does) still finds it.
    context = client.get(f"/rates/shop/{seed_ids['shop']}/sku/{seed_ids['sku']}", headers=headers).json()
    assert context["fixed_sale_rate"] == 115


def test_user_responses_never_expose_password(client, seed_ids):
    headers = auth_headers(client, "admin", "admin123")

    listed = client.get("/users", headers=headers).json()
    assert listed, "expected seeded users"
    for user in listed:
        assert "hashed_password" not in user
        assert "password" not in user

    created = client.post(
        "/users",
        json={"name": "New Booker", "username": "newbooker", "password": "secret123", "role": "ORDER_BOOKER"},
        headers=headers,
    )
    assert created.status_code == 200, created.text
    body = created.json()
    assert "hashed_password" not in body and "password" not in body
    new_id = body["id"]

    # The set password still works for login (proves it was stored, just not returned).
    assert client.post("/auth/login", data={"username": "newbooker", "password": "secret123"}).status_code == 200

    updated = client.put(f"/users/{new_id}", json={"phone": "0300"}, headers=headers).json()
    assert "hashed_password" not in updated and "password" not in updated


def test_admin_can_reset_user_password(client, seed_ids):
    headers = auth_headers(client, "admin", "admin123")

    # A blank/omitted password leaves the existing one intact.
    client.put(f"/users/{seed_ids['booker']}", json={"phone": "0301", "password": None}, headers=headers)
    assert client.post("/auth/login", data={"username": "booker1", "password": "booker123"}).status_code == 200
    client.put(f"/users/{seed_ids['booker']}", json={"password": ""}, headers=headers)
    assert client.post("/auth/login", data={"username": "booker1", "password": "booker123"}).status_code == 200

    # Admin sets a new password; the new one works and the old one stops working.
    updated = client.put(f"/users/{seed_ids['booker']}", json={"password": "fresh456"}, headers=headers)
    assert updated.status_code == 200, updated.text
    assert "hashed_password" not in updated.json()
    assert client.post("/auth/login", data={"username": "booker1", "password": "fresh456"}).status_code == 200
    assert client.post("/auth/login", data={"username": "booker1", "password": "booker123"}).status_code == 401


def test_sku_rate_update_persists(client, seed_ids):
    headers = auth_headers(client, "admin", "admin123")
    updated = client.put(
        f"/skus/{seed_ids['sku']}",
        json={"default_sale_rate": 120, "cost_price": 85},
        headers=headers,
    )
    assert updated.status_code == 200, updated.text

    skus = client.get("/skus", headers=headers).json()
    row = next(s for s in skus if s["id"] == seed_ids["sku"])
    assert row["default_sale_rate"] == 120
    # Carton-first derived field recomputed from the persisted per-packet rate.
    assert row["default_sale_rate_per_carton"] == 120 * 20
