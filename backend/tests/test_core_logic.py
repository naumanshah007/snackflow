import pytest
from fastapi import HTTPException
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine, select

from app.models import (
    Expense,
    ExpenseCategory,
    InventoryBalance,
    LastSaleRate,
    LedgerEntryType,
    MovementType,
    Product,
    SKU,
    Sale,
    SaleItem,
    SaleStatus,
    Shop,
    ShopLedger,
    ShopRateRule,
    StockLedger,
    User,
    UserRole,
    Warehouse,
)
from app.routers.admin import get_rate_context
from app.routers.reports import daily_sales, item_sales, profit_report, shop_sales_report
from app.schemas import (
    PaymentCreate,
    ReverseSaleRequest,
    SaleCreate,
    SaleItemCreate,
    SaleReturnCreate,
    SaleReturnItemCreate,
    StockReceiptCreate,
    StockReceiptItemCreate,
)
from app.services.payments import create_payment
from app.services.sales import cancel_sale, confirm_sale, create_sale, return_sale_items, reverse_sale
from app.services.stock import receive_stock


def build_session():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    SQLModel.metadata.create_all(engine)
    return Session(engine)


def seed_minimum(session: Session):
    warehouse_1 = Warehouse(name="Warehouse 1")
    warehouse_2 = Warehouse(name="Warehouse 2")
    admin = User(name="Admin", username="admin", hashed_password="x", role=UserRole.OWNER)
    booker_1 = User(name="Booker 1", username="booker1", hashed_password="x", role=UserRole.ORDER_BOOKER)
    booker_2 = User(name="Booker 2", username="booker2", hashed_password="x", role=UserRole.ORDER_BOOKER)
    product = Product(name="Chips")
    session.add(warehouse_1)
    session.add(warehouse_2)
    session.add(admin)
    session.add(booker_1)
    session.add(booker_2)
    session.add(product)
    session.flush()
    booker_1.assigned_warehouse_id = warehouse_1.id
    booker_2.assigned_warehouse_id = warehouse_2.id
    sku = SKU(
        product_id=product.id,
        size_mrp=20,
        flavour="masala",
        pack_quantity=24,
        cost_price=10,
        default_sale_rate=17,
        minimum_sale_rate=12,
    )
    shop_1 = Shop(
        name="Test Shop 1",
        assigned_warehouse_id=warehouse_1.id,
        assigned_order_booker_id=booker_1.id,
        gps_latitude=31.5,
        gps_longitude=74.3,
    )
    shop_2 = Shop(name="Test Shop 2", assigned_warehouse_id=warehouse_2.id, assigned_order_booker_id=booker_2.id)
    session.add(sku)
    session.add(shop_1)
    session.add(shop_2)
    session.commit()
    return admin, booker_1, booker_2, warehouse_1, warehouse_2, sku, shop_1, shop_2


def receive_opening_stock(session: Session, admin: User, warehouse: Warehouse, sku: SKU, cartons: int = 2):
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
                    cost_per_packet=10,
                )
            ],
        ),
        admin,
    )


def make_sale(session: Session, booker: User, warehouse: Warehouse, sku: SKU, shop: Shop, qty: int = 10, payment: float = 50):
    return create_sale(
        session,
        SaleCreate(
            shop_id=shop.id,
            warehouse_id=warehouse.id,
            payment_received=payment,
            items=[SaleItemCreate(sku_id=sku.id, quantity_packets=qty, sale_rate=17)],
        ),
        booker,
    )


def inventory_qty(session: Session, warehouse: Warehouse, sku: SKU) -> int:
    balance = session.exec(select(InventoryBalance).where(InventoryBalance.warehouse_id == warehouse.id, InventoryBalance.sku_id == sku.id)).one()
    return balance.quantity_packets


def test_stock_receipt_converts_cartons_and_keeps_warehouse_stock_separate():
    session = build_session()
    admin, _, _, warehouse_1, warehouse_2, sku, _, _ = seed_minimum(session)

    receive_opening_stock(session, admin, warehouse_1, sku, cartons=2)
    receive_opening_stock(session, admin, warehouse_2, sku, cartons=1)

    assert inventory_qty(session, warehouse_1, sku) == 48
    assert inventory_qty(session, warehouse_2, sku) == 24


def test_booked_sale_does_not_reduce_stock_then_confirmation_reduces_and_creates_ledgers():
    session = build_session()
    admin, booker, _, warehouse, _, sku, shop, _ = seed_minimum(session)
    receive_opening_stock(session, admin, warehouse, sku)

    sale = make_sale(session, booker, warehouse, sku, shop)
    assert inventory_qty(session, warehouse, sku) == 48

    confirmed = confirm_sale(session, sale.id, booker)
    assert confirmed.status == SaleStatus.DELIVERED
    assert inventory_qty(session, warehouse, sku) == 38
    assert session.exec(select(StockLedger).where(StockLedger.reference_id == sale.id, StockLedger.movement_type == MovementType.SALE_OUT)).first()
    assert session.exec(select(ShopLedger).where(ShopLedger.reference_id == sale.id, ShopLedger.entry_type == LedgerEntryType.SALE_INVOICE)).first()
    item = session.exec(select(SaleItem).where(SaleItem.sale_id == sale.id)).one()
    assert item.cost_rate == 10
    assert confirmed.gross_profit == 70


def test_sale_cannot_confirm_with_insufficient_stock():
    session = build_session()
    _, booker, _, warehouse, _, sku, shop, _ = seed_minimum(session)
    sale = make_sale(session, booker, warehouse, sku, shop)
    with pytest.raises(HTTPException):
        confirm_sale(session, sale.id, booker)


def test_cancelled_sale_does_not_affect_stock():
    session = build_session()
    admin, booker, _, warehouse, _, sku, shop, _ = seed_minimum(session)
    receive_opening_stock(session, admin, warehouse, sku)
    sale = make_sale(session, booker, warehouse, sku, shop)
    cancel_sale(session, sale.id, booker)
    assert inventory_qty(session, warehouse, sku) == 48


def test_reversed_sale_adds_stock_back_adjusts_balance_and_cannot_reverse_twice():
    session = build_session()
    admin, booker, _, warehouse, _, sku, shop, _ = seed_minimum(session)
    receive_opening_stock(session, admin, warehouse, sku)
    sale = make_sale(session, booker, warehouse, sku, shop)
    confirm_sale(session, sale.id, booker)

    reversed_sale = reverse_sale(session, sale.id, ReverseSaleRequest(reason="Wrong entry"), admin)
    shop = session.get(Shop, shop.id)
    assert reversed_sale.status == SaleStatus.REVERSED
    assert reversed_sale.reversed_by_id == admin.id
    assert reversed_sale.reversed_at is not None
    assert inventory_qty(session, warehouse, sku) == 48
    assert shop.current_balance == 0
    with pytest.raises(HTTPException):
        reverse_sale(session, sale.id, ReverseSaleRequest(reason="Again"), admin)


def test_partial_return_adds_stock_back_adjusts_shop_balance_and_blocks_over_return():
    session = build_session()
    admin, booker, _, warehouse, _, sku, shop, _ = seed_minimum(session)
    receive_opening_stock(session, admin, warehouse, sku)
    sale = make_sale(session, booker, warehouse, sku, shop, qty=10, payment=0)
    confirm_sale(session, sale.id, booker)
    sale_item = session.exec(select(SaleItem).where(SaleItem.sale_id == sale.id)).one()

    returned = return_sale_items(
        session,
        sale.id,
        SaleReturnCreate(reason="Damaged item", items=[SaleReturnItemCreate(sale_item_id=sale_item.id, quantity_packets=4)]),
        admin,
    )
    shop = session.get(Shop, shop.id)
    assert returned.status == SaleStatus.PARTIALLY_RETURNED
    assert inventory_qty(session, warehouse, sku) == 42
    assert shop.current_balance == 102
    with pytest.raises(HTTPException):
        return_sale_items(
            session,
            sale.id,
            SaleReturnCreate(reason="Too many", items=[SaleReturnItemCreate(sale_item_id=sale_item.id, quantity_packets=7)]),
            admin,
        )


def test_reversing_partially_returned_sale_only_restocks_remaining_quantity():
    session = build_session()
    admin, booker, _, warehouse, _, sku, shop, _ = seed_minimum(session)
    receive_opening_stock(session, admin, warehouse, sku)
    sale = make_sale(session, booker, warehouse, sku, shop, qty=10, payment=0)
    confirm_sale(session, sale.id, booker)
    sale_item = session.exec(select(SaleItem).where(SaleItem.sale_id == sale.id)).one()

    return_sale_items(
        session,
        sale.id,
        SaleReturnCreate(reason="Damaged item", items=[SaleReturnItemCreate(sale_item_id=sale_item.id, quantity_packets=4)]),
        admin,
    )
    reverse_sale(session, sale.id, ReverseSaleRequest(reason="Reverse remainder"), admin)

    assert inventory_qty(session, warehouse, sku) == 48


def test_reports_exclude_reversed_sales_and_net_partial_returns():
    session = build_session()
    admin, booker, _, warehouse, _, sku, shop, _ = seed_minimum(session)
    receive_opening_stock(session, admin, warehouse, sku)

    reversed_sale = make_sale(session, booker, warehouse, sku, shop, qty=10, payment=0)
    confirm_sale(session, reversed_sale.id, booker)
    reverse_sale(session, reversed_sale.id, ReverseSaleRequest(reason="Wrong sale"), admin)

    partial_sale = make_sale(session, booker, warehouse, sku, shop, qty=12, payment=0)
    confirm_sale(session, partial_sale.id, booker)
    sale_item = session.exec(select(SaleItem).where(SaleItem.sale_id == partial_sale.id)).one()
    return_sale_items(
        session,
        partial_sale.id,
        SaleReturnCreate(reason="Damaged item", items=[SaleReturnItemCreate(sale_item_id=sale_item.id, quantity_packets=5)]),
        admin,
    )

    daily_rows = daily_sales(warehouse_id=warehouse.id, current_user=admin, session=session)
    assert {row["id"] for row in daily_rows} == {partial_sale.id}
    item_rows = item_sales(warehouse_id=warehouse.id, current_user=admin, session=session)
    assert item_rows[0]["packets"] == 7
    assert item_rows[0]["amount"] == 119
    assert item_rows[0]["profit"] == 49
    profit = profit_report(warehouse_id=warehouse.id, current_user=admin, session=session)
    assert profit["gross_profit"] == 49
    shop_rows = shop_sales_report(warehouse_id=warehouse.id, current_user=admin, session=session)
    assert shop_rows[0]["sales"] == 119
    assert shop_rows[0]["sale_count"] == 1


def test_payment_reduces_shop_pending_balance():
    session = build_session()
    admin, _, _, _, _, _, shop, _ = seed_minimum(session)
    shop.current_balance = 500
    session.add(shop)
    session.commit()

    payment = create_payment(session, PaymentCreate(shop_id=shop.id, amount=125, method="cash"), admin)
    shop = session.get(Shop, shop.id)
    assert payment.amount == 125
    assert shop.current_balance == 375


def test_fixed_rate_and_last_sale_rate_are_returned_for_shop_sku():
    session = build_session()
    admin, booker, _, warehouse, _, sku, shop, _ = seed_minimum(session)
    session.add(ShopRateRule(shop_id=shop.id, sku_id=sku.id, fixed_sale_rate=16, minimum_allowed_rate=14))
    session.commit()
    context = get_rate_context(shop.id, sku.id, admin, session)
    assert context["fixed_sale_rate"] == 16

    receive_opening_stock(session, admin, warehouse, sku)
    sale = make_sale(session, booker, warehouse, sku, shop)
    confirm_sale(session, sale.id, booker)
    assert session.exec(select(LastSaleRate).where(LastSaleRate.shop_id == shop.id, LastSaleRate.sku_id == sku.id)).one().rate == 17
    context = get_rate_context(shop.id, sku.id, admin, session)
    assert context["last_sale_rate"] == 17


def test_order_booker_cannot_sell_from_other_warehouse_or_other_route():
    session = build_session()
    _, booker_1, _, warehouse_1, warehouse_2, sku, shop_1, shop_2 = seed_minimum(session)
    with pytest.raises(HTTPException):
        create_sale(
            session,
            SaleCreate(shop_id=shop_1.id, warehouse_id=warehouse_2.id, items=[SaleItemCreate(sku_id=sku.id, quantity_packets=1, sale_rate=17)]),
            booker_1,
        )
    with pytest.raises(HTTPException):
        create_sale(
            session,
            SaleCreate(shop_id=shop_2.id, warehouse_id=warehouse_1.id, items=[SaleItemCreate(sku_id=sku.id, quantity_packets=1, sale_rate=17)]),
            booker_1,
        )


def test_expense_reduces_net_profit_report_and_item_sales_report_counts_quantities():
    session = build_session()
    admin, booker, _, warehouse, _, sku, shop, _ = seed_minimum(session)
    receive_opening_stock(session, admin, warehouse, sku)
    sale = make_sale(session, booker, warehouse, sku, shop, qty=5, payment=20)
    confirm_sale(session, sale.id, booker)
    session.add(Expense(category=ExpenseCategory.PETROL, amount=10, warehouse_id=warehouse.id, created_by_id=admin.id))
    session.commit()

    profit = profit_report(warehouse_id=warehouse.id, current_user=admin, session=session)
    assert profit["gross_profit"] == 35
    assert profit["net_profit"] == 25
    rows = item_sales(warehouse_id=warehouse.id, current_user=admin, session=session)
    assert rows[0]["packets"] == 5


def test_gps_coordinates_are_saved_on_shop_model():
    session = build_session()
    *_, shop, _ = seed_minimum(session)
    assert shop.gps_latitude == 31.5
    assert shop.gps_longitude == 74.3
