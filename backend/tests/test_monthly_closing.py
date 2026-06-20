from datetime import date, datetime
from io import BytesIO
from zipfile import ZipFile

import pytest
from fastapi import HTTPException
from sqlmodel import Session, select

import app.services.monthly_closing as monthly_service
from app.models import (
    Expense,
    ExpenseCategory,
    InventoryBalance,
    MonthlyClosing,
    MonthlyInventoryOpeningBalance,
    MonthlyShopOpeningBalance,
    Product,
    Shop,
    ShopLedger,
    StockLedger,
    StockReceipt,
    User,
)
from app.schemas import PaymentCreate, SaleCreate, SaleItemCreate
from app.services.monthly_closing import (
    archive_monthly_closing,
    backup_checksum,
    build_monthly_preview,
    close_month,
    generate_monthly_backup,
    regenerate_backup_for_closing,
)
from app.services.payments import create_payment
from app.services.sales import confirm_sale, create_sale

from test_core_logic import build_session, receive_opening_stock, seed_minimum

MONTH = "2026-03"
MONTH_START = date(2026, 3, 1)
MONTH_END = date(2026, 3, 31)


@pytest.fixture(autouse=True)
def monthly_settings(monkeypatch):
    monkeypatch.setattr(monthly_service.settings, "monthly_archive_enabled", False)


def _build_monthly_fixture() -> tuple[Session, User, dict]:
    session = build_session()
    admin, booker, _, warehouse, _, sku, shop, _ = seed_minimum(session)
    receive_opening_stock(session, admin, warehouse, sku, cartons=2)
    receipt = session.exec(select(StockReceipt)).one()
    receipt.date_received = date(2026, 3, 5)
    session.add(receipt)

    sale = create_sale(
        session,
        SaleCreate(
            shop_id=shop.id,
            warehouse_id=warehouse.id,
            payment_received=20,
            items=[SaleItemCreate(sku_id=sku.id, quantity_packets=10, sale_rate=17)],
        ),
        booker,
    )
    confirm_sale(session, sale.id, booker)
    sale.sale_date = datetime(2026, 3, 15, 10, 0, 0)
    session.add(sale)

    payment = create_payment(session, PaymentCreate(shop_id=shop.id, amount=30, method="cash"), admin)
    payment.payment_date = datetime(2026, 3, 16, 11, 0, 0)
    session.add(payment)

    expense = Expense(
        expense_date=date(2026, 3, 20),
        category=ExpenseCategory.PETROL,
        amount=25,
        warehouse_id=warehouse.id,
        created_by_id=admin.id,
    )
    session.add(expense)

    for entry in session.exec(select(ShopLedger)).all():
        entry.occurred_at = datetime(2026, 3, 17, 12, 0, 0)
        session.add(entry)
    for entry in session.exec(select(StockLedger)).all():
        entry.occurred_at = datetime(2026, 3, 17, 12, 0, 0)
        session.add(entry)
    session.commit()
    session.refresh(shop)
    return session, admin, {"shop_id": shop.id, "warehouse_id": warehouse.id, "sku_id": sku.id}


def test_monthly_preview_calculates_sales_payments_and_expenses():
    session, _, _ = _build_monthly_fixture()

    preview = build_monthly_preview(session, MONTH)

    assert preview["total_sales"] == 170
    assert preview["sale_payments_received"] == 20
    assert preview["posted_payments_received"] == 30
    assert preview["payments_received"] == 50
    assert preview["expenses"] == 25
    assert preview["gross_profit"] == 70
    assert preview["net_profit"] == 45
    assert preview["total_outstanding_shop_balance"] == 120
    assert preview["transactions_to_archive"]["sales"] == 1


def test_backup_zip_contains_expected_csvs():
    session, admin, _ = _build_monthly_fixture()

    _, zip_bytes = generate_monthly_backup(session, MONTH, admin)

    with ZipFile(BytesIO(zip_bytes)) as archive:
        names = set(archive.namelist())
    assert {
        "sales.csv",
        "sale_items.csv",
        "payments.csv",
        "expenses.csv",
        "shop_ledger.csv",
        "stock_ledger.csv",
        "stock_receipts.csv",
        "inventory_balances.csv",
        "shops.csv",
        "skus.csv",
        "users_summary.csv",
        "monthly_summary.csv",
    }.issubset(names)


def test_backup_metadata_is_stored_without_relying_on_local_disk():
    session, admin, _ = _build_monthly_fixture()

    closing, zip_bytes = generate_monthly_backup(session, MONTH, admin)
    regenerated_bytes, regenerated_checksum = regenerate_backup_for_closing(session, closing)

    assert closing.backup_filename.startswith("monthly-closing-2026-03-")
    assert closing.backup_reference == "database-regenerated-on-download"
    assert closing.backup_checksum == backup_checksum(zip_bytes)
    assert regenerated_checksum == closing.backup_checksum
    assert regenerated_bytes == zip_bytes


def test_closing_carries_forward_shop_balances():
    session, admin, ids = _build_monthly_fixture()
    closing, _ = generate_monthly_backup(session, MONTH, admin)

    close_month(session, month=None, closing_id=closing.id, user=admin)

    row = session.exec(select(MonthlyShopOpeningBalance).where(MonthlyShopOpeningBalance.shop_id == ids["shop_id"])).one()
    assert row.month_start == date(2026, 4, 1)
    assert row.opening_balance == 120


def test_closing_carries_forward_inventory_balances():
    session, admin, ids = _build_monthly_fixture()
    closing, _ = generate_monthly_backup(session, MONTH, admin)

    close_month(session, month=None, closing_id=closing.id, user=admin)

    row = session.exec(
        select(MonthlyInventoryOpeningBalance).where(
            MonthlyInventoryOpeningBalance.warehouse_id == ids["warehouse_id"],
            MonthlyInventoryOpeningBalance.sku_id == ids["sku_id"],
        )
    ).one()
    assert row.month_start == date(2026, 4, 1)
    assert row.opening_quantity_packets == 38


def test_closing_does_not_delete_products_shops_or_users():
    session, admin, _ = _build_monthly_fixture()
    before = {
        "products": len(session.exec(select(Product)).all()),
        "shops": len(session.exec(select(Shop)).all()),
        "users": len(session.exec(select(User)).all()),
    }
    closing, _ = generate_monthly_backup(session, MONTH, admin)

    close_month(session, month=None, closing_id=closing.id, user=admin)

    assert len(session.exec(select(Product)).all()) == before["products"]
    assert len(session.exec(select(Shop)).all()) == before["shops"]
    assert len(session.exec(select(User)).all()) == before["users"]


def test_archive_cannot_run_before_backup():
    session, admin, _ = _build_monthly_fixture()
    closing = MonthlyClosing(month_start=MONTH_START, month_end=MONTH_END)
    session.add(closing)
    session.commit()
    session.refresh(closing)

    with pytest.raises(HTTPException) as exc:
        archive_monthly_closing(session, closing.id, admin, confirm_downloaded_backup=True)

    assert exc.value.status_code == 400


def test_archive_does_not_remove_current_balances_when_disabled():
    session, admin, ids = _build_monthly_fixture()
    closing, _ = generate_monthly_backup(session, MONTH, admin)
    close_month(session, month=None, closing_id=closing.id, user=admin)
    shop_before = session.get(Shop, ids["shop_id"]).current_balance
    inventory_before = session.exec(
        select(InventoryBalance).where(InventoryBalance.warehouse_id == ids["warehouse_id"], InventoryBalance.sku_id == ids["sku_id"])
    ).one().quantity_packets

    with pytest.raises(HTTPException) as exc:
        archive_monthly_closing(session, closing.id, admin, confirm_downloaded_backup=True)

    assert exc.value.status_code == 403
    assert session.get(Shop, ids["shop_id"]).current_balance == shop_before
    assert (
        session.exec(select(InventoryBalance).where(InventoryBalance.warehouse_id == ids["warehouse_id"], InventoryBalance.sku_id == ids["sku_id"]))
        .one()
        .quantity_packets
        == inventory_before
    )


def test_user_password_hashes_are_not_included_in_export():
    session, admin, _ = _build_monthly_fixture()

    _, zip_bytes = generate_monthly_backup(session, MONTH, admin)

    with ZipFile(BytesIO(zip_bytes)) as archive:
        users_csv = archive.read("users_summary.csv").decode("utf-8-sig")
    assert "hashed_password" not in users_csv
    assert "password" not in users_csv
    assert "admin" in users_csv
