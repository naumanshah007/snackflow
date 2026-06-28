from app.tests.conftest import auth_headers


INTERNAL_KEYS = {
    "average_cost_per_packet",
    "average_cost_per_carton",
    "stock_value",
    "cost_price",
    "cost_per_carton",
    "minimum_sale_rate",
    "minimum_sale_rate_per_carton",
    "cogs_amount",
    "gross_profit",
    "cost_rate",
    "line_profit",
    "profit_amount",
}


def _receive_stock(client, seed_ids, admin_headers):
    response = client.post(
        "/stock-receipts",
        json={
            "warehouse_id": seed_ids["warehouse"],
            "items": [
                {
                    "sku_id": seed_ids["sku"],
                    "quantity_received": 10,
                    "quantity_unit": "carton",
                    "pack_quantity": 20,
                    "cost_per_carton": 1600,
                }
            ],
        },
        headers=admin_headers,
    )
    assert response.status_code == 200, response.text


def _assert_no_internal_keys(value):
    if isinstance(value, dict):
        assert not (set(value) & INTERNAL_KEYS), value
        for child in value.values():
            _assert_no_internal_keys(child)
    elif isinstance(value, list):
        for item in value:
            _assert_no_internal_keys(item)


def test_order_booker_admin_and_finance_endpoints_are_blocked(client, seed_ids):
    headers = auth_headers(client, "booker1", "booker123")

    blocked_paths = [
        "/reports/dashboard",
        "/stock-ledger",
        "/monthly-closing",
        "/expenses",
        "/users",
        "/reset-data",
        "/stock-returns",
        f"/shops/{seed_ids['shop']}/ledger",
    ]
    for path in blocked_paths:
        if path == "/reset-data":
            response = client.post(path, json={"scope": "transactions", "confirm": "RESET"}, headers=headers)
        else:
            response = client.get(path, headers=headers)
        assert response.status_code == 403, path


def test_order_booker_inventory_and_sku_responses_hide_internal_costs(client, seed_ids):
    admin = auth_headers(client, "admin", "admin123")
    _receive_stock(client, seed_ids, admin)
    booker = auth_headers(client, "booker1", "booker123")

    inventory = client.get("/inventory", headers=booker)
    assert inventory.status_code == 200, inventory.text
    assert inventory.json()
    _assert_no_internal_keys(inventory.json())

    skus = client.get("/skus", headers=booker)
    assert skus.status_code == 200, skus.text
    assert skus.json()
    _assert_no_internal_keys(skus.json())


def test_order_booker_sales_and_mobile_summary_hide_internal_costs(client, seed_ids):
    admin = auth_headers(client, "admin", "admin123")
    _receive_stock(client, seed_ids, admin)
    booker = auth_headers(client, "booker1", "booker123")

    sale = client.post(
        "/sales",
        json={
            "shop_id": seed_ids["shop"],
            "warehouse_id": seed_ids["warehouse"],
            "items": [{"sku_id": seed_ids["sku"], "quantity_packets": 5, "sale_rate": 110}],
        },
        headers=booker,
    )
    assert sale.status_code == 200, sale.text
    _assert_no_internal_keys(sale.json())

    listed = client.get("/sales", headers=booker)
    assert listed.status_code == 200, listed.text
    assert listed.json()
    _assert_no_internal_keys(listed.json())

    summary = client.get(f"/shops/{seed_ids['shop']}/collection-summary", headers=booker)
    assert summary.status_code == 200, summary.text
    _assert_no_internal_keys(summary.json())


def test_owner_still_sees_cost_and_profit_fields(client, seed_ids):
    admin = auth_headers(client, "admin", "admin123")
    _receive_stock(client, seed_ids, admin)

    inventory = client.get("/inventory", headers=admin).json()
    assert "average_cost_per_carton" in inventory[0]
    assert "stock_value" in inventory[0]

    sale = client.post(
        "/sales",
        json={
            "shop_id": seed_ids["shop"],
            "warehouse_id": seed_ids["warehouse"],
            "items": [{"sku_id": seed_ids["sku"], "quantity_packets": 5, "sale_rate": 110}],
        },
        headers=admin,
    )
    assert sale.status_code == 200, sale.text
    body = sale.json()
    assert "cogs_amount" in body
    assert "gross_profit" in body
    assert "cost_rate" in body["items"][0]


def test_pending_shop_http_approval_workflow_and_booker_cannot_approve(client, seed_ids):
    booker = auth_headers(client, "booker1", "booker123")
    created = client.post(
        "/shops",
        json={"name": "Pending HTTP Shop", "assigned_warehouse_id": 999, "route_days": ["Monday"], "gps_latitude": 31.5, "gps_longitude": 74.3},
        headers=booker,
    )
    assert created.status_code == 200, created.text
    shop = created.json()
    assert shop["status"] == "PENDING_APPROVAL"
    assert shop["assigned_warehouse_id"] == seed_ids["warehouse"]
    assert shop["assigned_order_booker_id"] == seed_ids["booker"]

    assert client.post(f"/shops/{shop['id']}/approval", json={"status": "ACTIVE"}, headers=booker).status_code == 403

    admin = auth_headers(client, "admin", "admin123")
    pending = client.get("/shops?status_filter=PENDING_APPROVAL", headers=admin)
    assert pending.status_code == 200, pending.text
    assert any(row["id"] == shop["id"] for row in pending.json())

    sale_before_approval = client.post(
        "/sales",
        json={
            "shop_id": shop["id"],
            "warehouse_id": seed_ids["warehouse"],
            "items": [{"sku_id": seed_ids["sku"], "quantity_packets": 1, "sale_rate": 110}],
        },
        headers=booker,
    )
    assert sale_before_approval.status_code == 400

    approved = client.post(f"/shops/{shop['id']}/approval", json={"status": "ACTIVE"}, headers=admin)
    assert approved.status_code == 200, approved.text
    assert approved.json()["status"] == "ACTIVE"
    active = client.get("/shops?status_filter=ACTIVE", headers=admin)
    assert any(row["id"] == shop["id"] for row in active.json())
