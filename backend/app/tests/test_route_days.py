"""Route-day workflows: shop/booker route days, filtering, Today's Route."""

from app.models import today_weekday
from app.tests.conftest import auth_headers


def test_shop_route_days_round_trip(client, seed_ids):
    headers = auth_headers(client, "admin", "admin123")
    updated = client.put(
        f"/shops/{seed_ids['shop']}",
        json={"route_days": ["tuesday", "FRIDAY", "Friday", "notaday"]},
        headers=headers,
    )
    assert updated.status_code == 200, updated.text
    # Normalised: deduped, valid-only, ordered Mon..Sun.
    assert updated.json()["route_days"] == ["Tuesday", "Friday"]

    listed = client.get("/shops", headers=headers).json()
    match = next(shop for shop in listed if shop["id"] == seed_ids["shop"])
    assert match["route_days"] == ["Tuesday", "Friday"]


def test_booker_working_days_round_trip(client, seed_ids):
    headers = auth_headers(client, "admin", "admin123")
    updated = client.put(
        f"/users/{seed_ids['booker']}",
        json={"route_days": ["Monday", "Thursday"]},
        headers=headers,
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["route_days"] == ["Monday", "Thursday"]

    users = client.get("/users", headers=headers).json()
    match = next(user for user in users if user["id"] == seed_ids["booker"])
    assert match["route_days"] == ["Monday", "Thursday"]


def test_shops_route_day_filter(client, seed_ids):
    headers = auth_headers(client, "admin", "admin123")
    # Seed shop has route_days ["Monday"]. Add another on Tuesday.
    client.post(
        "/shops",
        json={"name": "Tuesday Shop", "assigned_warehouse_id": seed_ids["warehouse"], "route_days": ["Tuesday"]},
        headers=headers,
    )
    monday = client.get("/shops?route_day=Monday", headers=headers).json()
    assert {shop["name"] for shop in monday} == {"Al Madina Store"}
    tuesday = client.get("/shops?route_day=Tuesday", headers=headers).json()
    assert {shop["name"] for shop in tuesday} == {"Tuesday Shop"}


def test_my_route_returns_todays_shops(client, seed_ids):
    headers = auth_headers(client, "booker1", "booker123")
    today = today_weekday()
    # Put the seed shop on today's route so it should appear.
    admin = auth_headers(client, "admin", "admin123")
    client.put(f"/shops/{seed_ids['shop']}", json={"route_days": [today]}, headers=admin)

    route = client.get("/my-route", headers=headers).json()
    assert route["day"] == today
    assert any(shop["id"] == seed_ids["shop"] for shop in route["shops"])

    # A day with no matching shop returns an empty route.
    other_day = "Sunday" if today != "Sunday" else "Saturday"
    empty = client.get(f"/my-route?day={other_day}", headers=headers).json()
    assert empty["count"] == 0


def test_shops_by_route_day_groups_unassigned(client, seed_ids):
    headers = auth_headers(client, "admin", "admin123")
    # Shop with no route days should fall under "Unassigned".
    client.post("/shops", json={"name": "No Route Shop", "assigned_warehouse_id": seed_ids["warehouse"]}, headers=headers)
    grouped = client.get("/shops-by-route-day", headers=headers).json()
    days = {entry["day"]: entry["shops"] for entry in grouped["days"]}
    assert "Unassigned" in days
    assert any(shop["name"] == "No Route Shop" for shop in days["Unassigned"])
    assert any(shop["name"] == "Al Madina Store" for shop in days["Monday"])
