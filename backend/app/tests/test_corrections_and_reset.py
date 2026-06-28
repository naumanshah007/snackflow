"""2026-06-21 client feedback: payment void, supplier (expiry) returns, data reset."""

from app.tests.conftest import auth_headers


def _receive(client, seed_ids, headers, cartons=100):
    return client.post(
        "/stock-receipts",
        json={
            "warehouse_id": seed_ids["warehouse"],
            "items": [{"sku_id": seed_ids["sku"], "quantity_received": cartons, "quantity_unit": "carton", "pack_quantity": 20, "cost_per_carton": 1600}],
        },
        headers=headers,
    )


# --- Payment void / correction ---------------------------------------------

def test_void_payment_restores_balance(client, seed_ids):
    headers = auth_headers(client, "admin", "admin123")
    pay = client.post("/payments", json={"shop_id": seed_ids["shop"], "amount": 500, "method": "cash"}, headers=headers)
    assert pay.status_code == 200, pay.text
    payment_id = pay.json()["id"]

    summary = client.get(f"/shops/{seed_ids['shop']}/collection-summary", headers=headers).json()
    assert summary["collected_today"] == 500
    assert summary["remaining_balance"] == -500  # opening 0 minus the 500 paid

    voided = client.post(f"/payments/{payment_id}/void", json={"reason": "wrong amount entered"}, headers=headers)
    assert voided.status_code == 200, voided.text
    assert voided.json()["is_voided"] is True

    after = client.get(f"/shops/{seed_ids['shop']}/collection-summary", headers=headers).json()
    assert after["collected_today"] == 0
    assert after["remaining_balance"] == 0  # balance restored


def test_void_payment_twice_fails(client, seed_ids):
    headers = auth_headers(client, "admin", "admin123")
    payment_id = client.post("/payments", json={"shop_id": seed_ids["shop"], "amount": 100}, headers=headers).json()["id"]
    assert client.post(f"/payments/{payment_id}/void", json={"reason": "dup"}, headers=headers).status_code == 200
    assert client.post(f"/payments/{payment_id}/void", json={"reason": "dup"}, headers=headers).status_code == 400


def test_order_booker_cannot_void_payment(client, seed_ids):
    admin = auth_headers(client, "admin", "admin123")
    payment_id = client.post("/payments", json={"shop_id": seed_ids["shop"], "amount": 100}, headers=admin).json()["id"]
    booker = auth_headers(client, "booker1", "booker123")
    assert client.post(f"/payments/{payment_id}/void", json={"reason": "not allowed"}, headers=booker).status_code == 403


def test_corrected_payment_after_void(client, seed_ids):
    headers = auth_headers(client, "admin", "admin123")
    wrong = client.post("/payments", json={"shop_id": seed_ids["shop"], "amount": 5000}, headers=headers).json()
    client.post(f"/payments/{wrong['id']}/void", json={"reason": "typo, should be 500"}, headers=headers)
    client.post("/payments", json={"shop_id": seed_ids["shop"], "amount": 500}, headers=headers)
    summary = client.get(f"/shops/{seed_ids['shop']}/collection-summary", headers=headers).json()
    assert summary["collected_today"] == 500
    assert summary["remaining_balance"] == -500


# --- Supplier / expiry returns ---------------------------------------------

def test_supplier_return_reduces_inventory(client, seed_ids):
    headers = auth_headers(client, "admin", "admin123")
    assert _receive(client, seed_ids, headers, cartons=100).status_code == 200

    returned = client.post(
        "/stock-returns",
        json={
            "warehouse_id": seed_ids["warehouse"],
            "supplier_name": "ACME",
            "reason": "expired stock",
            "items": [{"sku_id": seed_ids["sku"], "quantity_received": 10, "quantity_unit": "carton", "pack_quantity": 20}],
        },
        headers=headers,
    )
    assert returned.status_code == 200, returned.text

    inventory = client.get("/inventory", headers=headers).json()
    row = next(r for r in inventory if r["sku_id"] == seed_ids["sku"])
    assert row["cartons"] == 90  # 100 received - 10 returned

    listed = client.get("/stock-returns", headers=headers).json()
    assert len(listed) == 1
    assert listed[0]["carton_label"] == "10 cartons"


def test_supplier_return_cannot_exceed_stock(client, seed_ids):
    headers = auth_headers(client, "admin", "admin123")
    _receive(client, seed_ids, headers, cartons=5)
    over = client.post(
        "/stock-returns",
        json={
            "warehouse_id": seed_ids["warehouse"],
            "reason": "expired",
            "items": [{"sku_id": seed_ids["sku"], "quantity_received": 50, "quantity_unit": "carton", "pack_quantity": 20}],
        },
        headers=headers,
    )
    assert over.status_code == 400


# --- Data reset ("Start Fresh") --------------------------------------------

def test_reset_transactions_keeps_master_data(client, seed_ids):
    headers = auth_headers(client, "admin", "admin123")
    _receive(client, seed_ids, headers, cartons=50)
    client.post("/payments", json={"shop_id": seed_ids["shop"], "amount": 300}, headers=headers)

    reset = client.post("/reset-data", json={"scope": "transactions", "confirm": "RESET"}, headers=headers)
    assert reset.status_code == 200, reset.text

    assert client.get("/inventory", headers=headers).json() == []
    assert client.get("/stock-receipts", headers=headers).json() == []
    assert client.get("/payments", headers=headers).json() == []
    # Master data kept; shop balance reset to opening (0).
    shops = client.get("/shops", headers=headers).json()
    assert any(s["id"] == seed_ids["shop"] for s in shops)
    assert next(s for s in shops if s["id"] == seed_ids["shop"])["current_balance"] == 0
    assert len(client.get("/skus", headers=headers).json()) == 1


def test_reset_all_keeps_only_users(client, seed_ids):
    headers = auth_headers(client, "admin", "admin123")
    reset = client.post("/reset-data", json={"scope": "all", "confirm": "RESET"}, headers=headers)
    assert reset.status_code == 200, reset.text

    assert client.get("/skus", headers=headers).json() == []
    assert client.get("/products", headers=headers).json() == []
    assert client.get("/warehouses", headers=headers).json() == []
    assert client.get("/shops", headers=headers).json() == []
    # Users survive and can still log in.
    assert client.post("/auth/login", data={"username": "admin", "password": "admin123"}).status_code == 200


def test_reset_requires_confirmation_and_owner(client, seed_ids):
    admin = auth_headers(client, "admin", "admin123")
    assert client.post("/reset-data", json={"scope": "transactions", "confirm": "nope"}, headers=admin).status_code == 400

    booker = auth_headers(client, "booker1", "booker123")
    assert client.post("/reset-data", json={"scope": "transactions", "confirm": "RESET"}, headers=booker).status_code == 403


def test_reset_delete_order_handles_sale_rate_foreign_key():
    from app.models import LastSaleRate, Sale
    from app.services.maintenance import _TRANSACTION_MODELS

    assert _TRANSACTION_MODELS.index(LastSaleRate) < _TRANSACTION_MODELS.index(Sale)
