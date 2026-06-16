from datetime import date, datetime, time, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlmodel import Session, select

from app.carton import carton_label, split_cartons
from app.database import get_session
from app.dependencies import get_current_user, scoped_warehouse_id
from app.models import Expense, InventoryBalance, Payment, Product, SKU, Sale, SaleItem, SaleReturnItem, SaleStatus, Shop, ShopVisit, User, UserRole, Warehouse

router = APIRouter(prefix="/reports", tags=["reports"])

RECOGNIZED_SALE_STATUSES = (SaleStatus.DELIVERED, SaleStatus.CONFIRMED, SaleStatus.PARTIALLY_RETURNED)


def _range(date_from: date | None, date_to: date | None) -> tuple[datetime, datetime]:
    start = datetime.combine(date_from or date.today(), time.min)
    end = datetime.combine(date_to or date.today(), time.max)
    return start, end


def _apply_sale_filters(query, user: User, warehouse_id: int | None, order_booker_id: int | None):
    scoped = scoped_warehouse_id(user, warehouse_id)
    if scoped:
        query = query.where(Sale.warehouse_id == scoped)
    if user.role == UserRole.ORDER_BOOKER:
        query = query.where(Sale.order_booker_id == user.id)
    elif order_booker_id:
        query = query.where(Sale.order_booker_id == order_booker_id)
    return query


def _recognized_sale_filter(query):
    return query.where(Sale.status.in_(RECOGNIZED_SALE_STATUSES))


def _net_item_metrics(session: Session, item: SaleItem) -> tuple[int, float, float]:
    returned = session.exec(select(func.sum(SaleReturnItem.quantity_packets)).where(SaleReturnItem.sale_item_id == item.id)).one()
    net_packets = max(item.quantity_packets - int(returned or 0), 0)
    amount = round(net_packets * item.sale_rate, 2)
    profit = round(net_packets * (item.sale_rate - item.cost_rate), 2)
    return net_packets, amount, profit


@router.get("/dashboard")
def dashboard(
    date_from: date | None = None,
    date_to: date | None = None,
    warehouse_id: int | None = None,
    order_booker_id: int | None = None,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    start, end = _range(date_from, date_to)
    sale_query = _recognized_sale_filter(select(Sale).where(Sale.sale_date >= start, Sale.sale_date <= end))
    sales = session.exec(_apply_sale_filters(sale_query, current_user, warehouse_id, order_booker_id)).all()

    expense_query = select(Expense).where(Expense.is_deleted == False, Expense.expense_date >= start.date(), Expense.expense_date <= end.date())  # noqa: E712
    scoped = scoped_warehouse_id(current_user, warehouse_id)
    if scoped:
        expense_query = expense_query.where(Expense.warehouse_id == scoped)
    expenses = session.exec(expense_query).all()

    total_sales = round(sum(s.net_amount for s in sales), 2)
    cash_received = round(sum(s.payment_received for s in sales), 2)
    pending_added = round(sum(s.pending_amount for s in sales), 2)
    gross_profit = round(sum(s.gross_profit for s in sales), 2)
    expenses_total = round(sum(e.amount for e in expenses), 2)

    top_products: dict[str, dict] = {}
    for sale in sales:
        for item in session.exec(select(SaleItem).where(SaleItem.sale_id == sale.id)).all():
            net_packets, amount, _ = _net_item_metrics(session, item)
            if net_packets <= 0:
                continue
            sku = session.get(SKU, item.sku_id)
            product = session.get(Product, sku.product_id) if sku else None
            name = product.name if product else f"SKU {item.sku_id}"
            current = top_products.setdefault(name, {"name": name, "packets": 0, "amount": 0})
            current["packets"] += net_packets
            current["amount"] += amount

    low_stock = []
    inventory_query = select(InventoryBalance)
    if scoped:
        inventory_query = inventory_query.where(InventoryBalance.warehouse_id == scoped)
    for balance in session.exec(inventory_query).all():
        sku = session.get(SKU, balance.sku_id)
        if sku and balance.quantity_packets <= sku.low_stock_threshold:
            product = session.get(Product, sku.product_id)
            warehouse = session.get(Warehouse, balance.warehouse_id)
            low_stock.append(
                {
                    "warehouse_name": warehouse.name if warehouse else "",
                    "sku_name": f"{product.name if product else ''} Rs {sku.size_mrp:g} {sku.flavour or ''}".strip(),
                    "available_packets": balance.quantity_packets,
                    "threshold": sku.low_stock_threshold,
                }
            )

    performance: dict[str, dict] = {}
    for sale in sales:
        user = session.get(User, sale.order_booker_id) if sale.order_booker_id else None
        name = user.name if user else "Unassigned"
        row = performance.setdefault(name, {"name": name, "sales": 0, "cash": 0, "profit": 0})
        row["sales"] += sale.net_amount
        row["cash"] += sale.payment_received
        row["profit"] += sale.gross_profit

    return {
        "total_sales": total_sales,
        "cash_received": cash_received,
        "pending_added": pending_added,
        "total_outstanding": round(sum(shop.current_balance for shop in session.exec(select(Shop)).all()), 2),
        "gross_profit": gross_profit,
        "expenses": expenses_total,
        "net_profit": round(gross_profit - expenses_total, 2),
        "sale_count": len(sales),
        "low_stock_count": len(low_stock),
        "top_products": sorted(top_products.values(), key=lambda item: item["amount"], reverse=True)[:8],
        "low_stock": low_stock[:12],
        "order_booker_performance": list(performance.values()),
        "warehouse_stock_value": [
            {
                "warehouse_id": warehouse.id,
                "warehouse_name": warehouse.name,
                "stock_value": round(
                    sum(
                        balance.quantity_packets * balance.average_cost_per_packet
                        for balance in session.exec(select(InventoryBalance).where(InventoryBalance.warehouse_id == warehouse.id)).all()
                    ),
                    2,
                ),
            }
            for warehouse in session.exec(select(Warehouse)).all()
        ],
    }


@router.get("/daily-sales")
def daily_sales(
    date_from: date | None = None,
    date_to: date | None = None,
    warehouse_id: int | None = None,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    start, end = _range(date_from, date_to)
    query = _recognized_sale_filter(select(Sale).where(Sale.sale_date >= start, Sale.sale_date <= end))
    sales = session.exec(_apply_sale_filters(query, current_user, warehouse_id, None).order_by(Sale.sale_date.desc())).all()
    return [
        {
            "id": s.id,
            "date": s.sale_date.date().isoformat(),
            "shop_id": s.shop_id,
            "warehouse_id": s.warehouse_id,
            "status": s.status,
            "sales": s.net_amount,
            "cash": s.payment_received,
            "pending": s.pending_amount,
            "profit": s.gross_profit,
        }
        for s in sales
    ]


@router.get("/item-sales")
def item_sales(
    date_from: date | None = None,
    date_to: date | None = None,
    warehouse_id: int | None = None,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    start, end = _range(date_from, date_to)
    sales = session.exec(
        _apply_sale_filters(_recognized_sale_filter(select(Sale).where(Sale.sale_date >= start, Sale.sale_date <= end)), current_user, warehouse_id, None)
    ).all()
    rows: dict[int, dict[str, float | int]] = {}
    for sale in sales:
        for item in session.exec(select(SaleItem).where(SaleItem.sale_id == sale.id)).all():
            net_packets, amount, profit = _net_item_metrics(session, item)
            if net_packets <= 0:
                continue
            row = rows.setdefault(item.sku_id, {"packets": 0, "amount": 0.0, "profit": 0.0})
            row["packets"] += net_packets
            row["amount"] += amount
            row["profit"] += profit
    result = []
    for sku_id, row in rows.items():
        sku = session.get(SKU, sku_id)
        product = session.get(Product, sku.product_id) if sku else None
        pack_quantity = sku.pack_quantity if sku else 1
        packets = int(row["packets"])
        cartons, loose = split_cartons(packets, pack_quantity)
        result.append(
            {
                "sku_id": sku_id,
                "sku_name": f"{product.name if product else ''} Rs {sku.size_mrp:g} {sku.flavour or ''}".strip() if sku else "",
                "pack_quantity": pack_quantity,
                "cartons": cartons,
                "loose_packets": loose,
                "carton_label": carton_label(packets, pack_quantity),
                "packets": packets,
                "amount": round(float(row["amount"]), 2),
                "profit": round(float(row["profit"]), 2),
            }
        )
    return result


@router.get("/shop-balances")
def shop_balances(
    warehouse_id: int | None = None,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    query = select(Shop)
    scoped = scoped_warehouse_id(current_user, warehouse_id)
    if scoped:
        query = query.where(Shop.assigned_warehouse_id == scoped)
    if current_user.role == UserRole.ORDER_BOOKER:
        query = query.where(Shop.assigned_order_booker_id == current_user.id)
    shops = session.exec(query.order_by(Shop.current_balance.desc())).all()
    return [
        {
            "shop_id": shop.id,
            "shop_name": shop.name,
            "area_route": shop.area_route,
            "warehouse_id": shop.assigned_warehouse_id,
            "order_booker_id": shop.assigned_order_booker_id,
            "balance": shop.current_balance,
        }
        for shop in shops
    ]


@router.get("/order-booker")
def order_booker_report(
    date_from: date | None = None,
    date_to: date | None = None,
    warehouse_id: int | None = None,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    start, end = _range(date_from, date_to)
    sales = session.exec(
        _apply_sale_filters(_recognized_sale_filter(select(Sale).where(Sale.sale_date >= start, Sale.sale_date <= end)), current_user, warehouse_id, None)
    ).all()
    rows: dict[int | None, dict] = {}
    for sale in sales:
        user = session.get(User, sale.order_booker_id) if sale.order_booker_id else None
        row = rows.setdefault(sale.order_booker_id, {"order_booker": user.name if user else "Unassigned", "sales": 0, "cash": 0, "pending": 0, "visits": 0})
        row["sales"] += sale.net_amount
        row["cash"] += sale.payment_received
        row["pending"] += sale.pending_amount
    return list(rows.values())


@router.get("/shop-sales")
def shop_sales_report(
    date_from: date | None = None,
    date_to: date | None = None,
    warehouse_id: int | None = None,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    start, end = _range(date_from, date_to)
    sales = session.exec(
        _apply_sale_filters(_recognized_sale_filter(select(Sale).where(Sale.sale_date >= start, Sale.sale_date <= end)), current_user, warehouse_id, None)
    ).all()
    rows: dict[int, dict] = {}
    for sale in sales:
        shop = session.get(Shop, sale.shop_id)
        row = rows.setdefault(
            sale.shop_id,
            {"shop_id": sale.shop_id, "shop_name": shop.name if shop else "", "sales": 0, "cash": 0, "pending": 0, "profit": 0, "sale_count": 0},
        )
        row["sales"] += sale.net_amount
        row["cash"] += sale.payment_received
        row["pending"] += sale.pending_amount
        row["profit"] += sale.gross_profit
        row["sale_count"] += 1
    return list(rows.values())


@router.get("/inventory")
def inventory_report(current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    from app.routers.stock import get_inventory

    return get_inventory(limit=1000, current_user=current_user, session=session)


@router.get("/profit")
def profit_report(
    date_from: date | None = None,
    date_to: date | None = None,
    warehouse_id: int | None = None,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    start, end = _range(date_from, date_to)
    sales = session.exec(
        _apply_sale_filters(_recognized_sale_filter(select(Sale).where(Sale.sale_date >= start, Sale.sale_date <= end)), current_user, warehouse_id, None)
    ).all()
    expense_query = select(Expense).where(Expense.is_deleted == False, Expense.expense_date >= start.date(), Expense.expense_date <= end.date())  # noqa: E712
    scoped = scoped_warehouse_id(current_user, warehouse_id)
    if scoped:
        expense_query = expense_query.where(Expense.warehouse_id == scoped)
    expenses = session.exec(expense_query).all()
    sales_amount = sum(s.net_amount for s in sales)
    cogs = sum(s.cogs_amount for s in sales)
    gross_profit = sum(s.gross_profit for s in sales)
    expenses_total = sum(e.amount for e in expenses)
    return {
        "sales_amount": round(sales_amount, 2),
        "cost_of_goods_sold": round(cogs, 2),
        "gross_profit": round(gross_profit, 2),
        "expenses": round(expenses_total, 2),
        "net_profit": round(gross_profit - expenses_total, 2),
        "cash_received": round(sum(s.payment_received for s in sales), 2),
        "credit_pending": round(sum(s.pending_amount for s in sales), 2),
    }


@router.get("/expenses")
def expense_report(
    date_from: date | None = None,
    date_to: date | None = None,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    start, end = _range(date_from, date_to)
    rows = session.exec(
        select(Expense.category, func.sum(Expense.amount))
        .where(Expense.is_deleted == False, Expense.expense_date >= start.date(), Expense.expense_date <= end.date())  # noqa: E712
        .group_by(Expense.category)
    ).all()
    return [{"category": category, "amount": round(float(amount or 0), 2)} for category, amount in rows]


@router.get("/payment-recovery")
def payment_recovery_report(
    date_from: date | None = None,
    date_to: date | None = None,
    warehouse_id: int | None = None,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    start, end = _range(date_from, date_to)
    query = select(Payment).where(Payment.payment_date >= start, Payment.payment_date <= end)
    payments = session.exec(query.order_by(Payment.payment_date.desc())).all()
    scoped = scoped_warehouse_id(current_user, warehouse_id)
    rows = []
    for payment in payments:
        shop = session.get(Shop, payment.shop_id)
        if not shop:
            continue
        if scoped and shop.assigned_warehouse_id != scoped:
            continue
        if current_user.role == UserRole.ORDER_BOOKER and shop.assigned_order_booker_id != current_user.id:
            continue
        rows.append(
            {
                "payment_id": payment.id,
                "date": payment.payment_date.date().isoformat(),
                "shop_id": shop.id,
                "shop_name": shop.name,
                "amount": payment.amount,
                "method": payment.method,
                "reference_number": payment.reference_number,
            }
        )
    return rows


@router.get("/shop-visits")
def shop_visit_report(
    date_from: date | None = None,
    date_to: date | None = None,
    warehouse_id: int | None = None,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    start, end = _range(date_from, date_to)
    visits = session.exec(select(ShopVisit).where(ShopVisit.visited_at >= start, ShopVisit.visited_at <= end).order_by(ShopVisit.visited_at.desc())).all()
    scoped = scoped_warehouse_id(current_user, warehouse_id)
    rows = []
    for visit in visits:
        shop = session.get(Shop, visit.shop_id)
        booker = session.get(User, visit.order_booker_id) if visit.order_booker_id else None
        if not shop:
            continue
        if scoped and shop.assigned_warehouse_id != scoped:
            continue
        if current_user.role == UserRole.ORDER_BOOKER and visit.order_booker_id != current_user.id:
            continue
        rows.append(
            {
                "visit_id": visit.id,
                "date": visit.visited_at.date().isoformat(),
                "shop_name": shop.name,
                "order_booker": booker.name if booker else "",
                "status": visit.status,
                "notes": visit.notes,
                "gps_latitude": visit.gps_latitude,
                "gps_longitude": visit.gps_longitude,
            }
        )
    return rows


@router.get("/low-stock")
def low_stock_report(current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    from app.routers.stock import get_inventory

    return get_inventory(low_stock_only=True, limit=1000, current_user=current_user, session=session)
