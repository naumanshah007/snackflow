"""Tests for the 2026-06-15 client feedback fix pass.

Covers carton/packet conversion, carton cost exposure, weighted average cost,
order-booker shop registration with pending approval, payment collection
summary, and that the Distribution Control / Expenses API endpoints load.
"""

import pytest
from fastapi import HTTPException
from sqlmodel import select

from app.carton import carton_label, split_cartons, to_packets
from app.models import InventoryBalance, ShopStatus, UserRole
from app.routers.admin import create_shop, list_expenses, list_skus, set_shop_approval
from app.routers.sales import shop_collection_summary
from app.routers.stock import get_inventory, get_stock_ledger
from app.schemas import SaleCreate, SaleItemCreate, ShopApprovalRequest, ShopCreate, StockReceiptCreate, StockReceiptItemCreate
from app.services.sales import confirm_sale, create_sale
from app.services.stock import receive_stock

from test_core_logic import build_session, inventory_qty, receive_opening_stock, seed_minimum


# --- pure helpers -----------------------------------------------------------

def test_split_cartons_and_label():
    assert split_cartons(53, 24) == (2, 5)
    assert carton_label(53, 24) == "2 cartons + 5 packets"
    assert carton_label(48, 24) == "2 cartons"
    assert carton_label(5, 24) == "5 packets"
    assert to_packets(2, 5, 24) == 53


# --- carton conversion in sales --------------------------------------------

def test_sale_accepts_cartons_and_loose_packets_and_reduces_correct_stock():
    session = build_session()
    admin, booker, _, warehouse, _, sku, shop, _ = seed_minimum(session)
    receive_opening_stock(session, admin, warehouse, sku, cartons=4)  # 96 packets
    assert inventory_qty(session, warehouse, sku) == 96

    sale = create_sale(
        session,
        SaleCreate(
            shop_id=shop.id,
            warehouse_id=warehouse.id,
            items=[SaleItemCreate(sku_id=sku.id, cartons=2, loose_packets=3, sale_rate_per_carton=24 * 17)],
        ),
        booker,
    )
    item = sale_items(session, sale.id)[0]
    # 2 cartons * 24 + 3 = 51 packets, rate per carton 408 -> 17 per packet
    assert item.quantity_packets == 51
    assert item.sale_rate == 17
    confirm_sale(session, sale.id, booker)
    assert inventory_qty(session, warehouse, sku) == 96 - 51


def sale_items(session, sale_id):
    from app.models import SaleItem

    return session.exec(select(SaleItem).where(SaleItem.sale_id == sale_id)).all()


# --- carton conversion in stock receiving ----------------------------------

def test_receive_stock_supports_cartons_plus_loose_packets():
    session = build_session()
    admin, _, _, warehouse, _, sku, _, _ = seed_minimum(session)
    result = receive_stock(
        session,
        StockReceiptCreate(
            warehouse_id=warehouse.id,
            items=[
                StockReceiptItemCreate(
                    sku_id=sku.id,
                    quantity_received=1,
                    quantity_unit="carton",
                    loose_packets=5,
                    pack_quantity=24,
                    cost_per_packet=10,
                )
            ],
        ),
        admin,
    )
    assert inventory_qty(session, warehouse, sku) == 29
    assert isinstance(result, dict)
    assert "1 carton" in result["message"] or "1 cartons + 5 packets" in result["message"]
    assert result["balances"][0]["carton_label"] == "1 cartons + 5 packets"


# --- carton cost exposure ---------------------------------------------------

def test_sku_list_exposes_carton_cost_and_sale_rate():
    session = build_session()
    admin, *_ = seed_minimum(session)
    rows = list_skus(_=admin, session=session, limit=1000)
    row = rows[0]
    # seed sku: pack 24, cost 10, default 17, minimum 12
    assert row["cost_per_carton"] == 240
    assert row["default_sale_rate_per_carton"] == 408
    assert row["minimum_sale_rate_per_carton"] == 288


# --- weighted average cost --------------------------------------------------

def avg_cost(session, warehouse, sku):
    balance = session.exec(
        select(InventoryBalance).where(InventoryBalance.warehouse_id == warehouse.id, InventoryBalance.sku_id == sku.id)
    ).one()
    return balance.average_cost_per_packet


def receive_at_cost(session, admin, warehouse, sku, cartons, cost_per_packet):
    return receive_stock(
        session,
        StockReceiptCreate(
            warehouse_id=warehouse.id,
            items=[
                StockReceiptItemCreate(
                    sku_id=sku.id,
                    quantity_received=cartons,
                    quantity_unit="carton",
                    pack_quantity=sku.pack_quantity,
                    cost_per_packet=cost_per_packet,
                )
            ],
        ),
        admin,
    )


def test_first_receipt_sets_average_cost():
    session = build_session()
    admin, _, _, warehouse, _, sku, _, _ = seed_minimum(session)
    receive_at_cost(session, admin, warehouse, sku, cartons=1, cost_per_packet=10)
    assert avg_cost(session, warehouse, sku) == 10


def test_second_receipt_with_different_cost_updates_weighted_average():
    session = build_session()
    admin, _, _, warehouse, _, sku, _, _ = seed_minimum(session)
    receive_at_cost(session, admin, warehouse, sku, cartons=1, cost_per_packet=10)  # 24 @ 10
    receive_at_cost(session, admin, warehouse, sku, cartons=1, cost_per_packet=20)  # 24 @ 20
    # (24*10 + 24*20) / 48 = 15
    assert avg_cost(session, warehouse, sku) == 15


def test_sale_does_not_change_average_cost():
    session = build_session()
    admin, booker, _, warehouse, _, sku, shop, _ = seed_minimum(session)
    receive_at_cost(session, admin, warehouse, sku, cartons=2, cost_per_packet=10)
    before = avg_cost(session, warehouse, sku)
    sale = create_sale(
        session,
        SaleCreate(shop_id=shop.id, warehouse_id=warehouse.id, items=[SaleItemCreate(sku_id=sku.id, quantity_packets=10, sale_rate=17)]),
        booker,
    )
    confirm_sale(session, sale.id, booker)
    assert avg_cost(session, warehouse, sku) == before == 10


# --- order booker shop registration + approval -----------------------------

def test_order_booker_new_shop_is_scoped_and_pending_approval():
    session = build_session()
    _, booker_1, _, warehouse_1, warehouse_2, _, _, _ = seed_minimum(session)
    # Booker tries to register a shop in warehouse_2 but is forced to their own.
    shop = create_shop(
        ShopCreate(name="New Booker Shop", assigned_warehouse_id=warehouse_2.id),
        booker_1,
        session,
    )
    assert shop.assigned_warehouse_id == warehouse_1.id
    assert shop.assigned_order_booker_id == booker_1.id
    assert shop.status == ShopStatus.PENDING_APPROVAL


def test_admin_can_approve_pending_shop():
    session = build_session()
    admin, booker_1, _, warehouse_1, _, _, _, _ = seed_minimum(session)
    shop = create_shop(ShopCreate(name="Pending Shop"), booker_1, session)
    assert shop.status == ShopStatus.PENDING_APPROVAL
    approved = set_shop_approval(shop.id, ShopApprovalRequest(status=ShopStatus.ACTIVE), admin, session)
    assert approved.status == ShopStatus.ACTIVE
    assert approved.is_active is True


def test_admin_created_shop_is_active_immediately():
    session = build_session()
    admin, *_ = seed_minimum(session)
    shop = create_shop(ShopCreate(name="Admin Shop"), admin, session)
    assert shop.status == ShopStatus.ACTIVE


# --- payment collection summary --------------------------------------------

def test_collection_summary_reports_balance_breakdown():
    session = build_session()
    admin, booker, _, warehouse, _, sku, shop, _ = seed_minimum(session)
    receive_opening_stock(session, admin, warehouse, sku)
    sale = create_sale(
        session,
        SaleCreate(shop_id=shop.id, warehouse_id=warehouse.id, payment_received=0, items=[SaleItemCreate(sku_id=sku.id, quantity_packets=10, sale_rate=17)]),
        booker,
    )
    confirm_sale(session, sale.id, booker)  # bills 170
    summary = shop_collection_summary(shop.id, admin, session)
    assert summary["today_bill"] == 170
    assert summary["remaining_balance"] == 170
    assert summary["total_payable"] == 170


# --- Distribution Control + Expenses endpoints load ------------------------

def test_distribution_control_and_expense_endpoints_load():
    session = build_session()
    admin, _, _, warehouse, _, sku, _, _ = seed_minimum(session)
    receive_opening_stock(session, admin, warehouse, sku)

    inventory = get_inventory(current_user=admin, session=session, limit=1000)
    assert inventory and "carton_label" in inventory[0]
    assert "cartons" in inventory[0] and "average_cost_per_carton" in inventory[0]

    ledger = get_stock_ledger(current_user=admin, session=session)
    assert ledger and "carton_label" in ledger[0] and "cost_per_carton" in ledger[0]

    expenses = list_expenses(current_user=admin, session=session)
    assert isinstance(expenses, list)
