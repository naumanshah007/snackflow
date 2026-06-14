from fastapi import HTTPException, status
from sqlmodel import Session, select

from app.models import (
    InventoryBalance,
    LastSaleRate,
    LedgerEntryType,
    MovementType,
    SKU,
    Sale,
    SaleItem,
    SaleReturn,
    SaleReturnItem,
    SaleStatus,
    Shop,
    ShopRateRule,
    User,
    UserRole,
    utc_now,
)
from app.schemas import ReverseSaleRequest, SaleCreate, SaleReturnCreate
from app.services.audit import write_audit
from app.services.ledger import add_shop_ledger_entry
from app.services.stock import apply_stock_movement, get_or_create_inventory


def _rate_rule(session: Session, shop_id: int, sku_id: int) -> ShopRateRule | None:
    return session.exec(
        select(ShopRateRule)
        .where(ShopRateRule.shop_id == shop_id, ShopRateRule.sku_id == sku_id, ShopRateRule.is_active == True)  # noqa: E712
        .order_by(ShopRateRule.effective_from.desc())
    ).first()


def _assert_sale_rate_allowed(session: Session, user: User, shop_id: int, sku: SKU, sale_rate: float) -> None:
    rule = _rate_rule(session, shop_id, sku.id)
    minimum_rate = rule.minimum_allowed_rate if rule and rule.minimum_allowed_rate else sku.minimum_sale_rate
    if sale_rate < minimum_rate and user.role not in {UserRole.OWNER, UserRole.ACCOUNTANT}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Sale rate {sale_rate} is below minimum allowed rate {minimum_rate} for SKU {sku.id}",
        )


def create_sale(session: Session, payload: SaleCreate, user: User) -> Sale:
    if not payload.items:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Sale requires at least one item")
    shop = session.get(Shop, payload.shop_id)
    if not shop or not shop.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shop not found or inactive")

    warehouse_id = payload.warehouse_id or shop.assigned_warehouse_id or user.assigned_warehouse_id
    if not warehouse_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Warehouse is required for sale")
    if user.role == UserRole.ORDER_BOOKER and user.assigned_warehouse_id != warehouse_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Order booker cannot sell from this warehouse")
    if user.role == UserRole.ORDER_BOOKER and shop.assigned_order_booker_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Shop is outside this order booker's assigned route")
    if shop.assigned_warehouse_id and shop.assigned_warehouse_id != warehouse_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Sale warehouse must match the shop's assigned warehouse")

    sale = Sale(
        shop_id=shop.id,
        order_booker_id=user.id,
        warehouse_id=warehouse_id,
        status=payload.status,
        discount=payload.discount,
        payment_received=payload.payment_received,
        notes=payload.notes,
    )
    session.add(sale)
    session.flush()

    gross_amount = 0.0
    cogs_amount = 0.0
    for line in payload.items:
        sku = session.get(SKU, line.sku_id)
        if not sku or not sku.is_active:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"SKU {line.sku_id} not found or inactive")
        _assert_sale_rate_allowed(session, user, shop.id, sku, line.sale_rate)
        inventory = get_or_create_inventory(session, warehouse_id, sku.id)
        cost_rate = inventory.average_cost_per_packet or sku.cost_price
        line_total = round(line.quantity_packets * line.sale_rate, 2)
        line_cost = round(line.quantity_packets * cost_rate, 2)
        item = SaleItem(
            sale_id=sale.id,
            sku_id=sku.id,
            quantity_packets=line.quantity_packets,
            pack_quantity=sku.pack_quantity,
            sale_rate=line.sale_rate,
            cost_rate=cost_rate,
            line_total=line_total,
            line_profit=round(line_total - line_cost, 2),
        )
        session.add(item)
        gross_amount += line_total
        cogs_amount += line_cost

    sale.gross_amount = round(gross_amount, 2)
    sale.net_amount = round(max(gross_amount - payload.discount, 0), 2)
    sale.pending_amount = round(max(sale.net_amount - payload.payment_received, 0), 2)
    sale.cogs_amount = round(cogs_amount, 2)
    sale.gross_profit = round(sale.net_amount - cogs_amount, 2)

    write_audit(session, user, "CREATE", "sale", sale.id, None, payload.model_dump())
    session.commit()
    session.refresh(sale)
    return sale


def confirm_sale(session: Session, sale_id: int, user: User) -> Sale:
    sale = session.get(Sale, sale_id)
    if not sale:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sale not found")
    if sale.status in {SaleStatus.DELIVERED, SaleStatus.CONFIRMED}:
        return sale
    if sale.status in {SaleStatus.CANCELLED, SaleStatus.REVERSED, SaleStatus.PARTIALLY_RETURNED}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Cannot confirm {sale.status.value} sale")
    if user.role == UserRole.ORDER_BOOKER and user.assigned_warehouse_id != sale.warehouse_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sale is outside your warehouse")
    shop = session.get(Shop, sale.shop_id)
    if not shop:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shop not found")
    if user.role == UserRole.ORDER_BOOKER and shop.assigned_order_booker_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Shop is outside this order booker's assigned route")
    if shop.assigned_warehouse_id and shop.assigned_warehouse_id != sale.warehouse_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Sale warehouse does not match shop warehouse")

    items = session.exec(select(SaleItem).where(SaleItem.sale_id == sale.id)).all()
    if not items:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Sale has no items")
    for item in items:
        sku = session.get(SKU, item.sku_id)
        if not sku or not sku.is_active:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"SKU {item.sku_id} not found or inactive")
        if item.quantity_packets <= 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid quantity for SKU {item.sku_id}")
        balance = session.exec(
            select(InventoryBalance).where(
                InventoryBalance.warehouse_id == sale.warehouse_id,
                InventoryBalance.sku_id == item.sku_id,
            )
        ).first()
        if not balance or balance.quantity_packets < item.quantity_packets:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient stock for SKU {item.sku_id}",
            )

    for item in items:
        apply_stock_movement(
            session,
            warehouse_id=sale.warehouse_id,
            sku_id=item.sku_id,
            quantity_packets=-item.quantity_packets,
            movement_type=MovementType.SALE_OUT,
            reference_type="sale",
            reference_id=sale.id,
            cost_rate=item.cost_rate,
            user=user,
            notes=f"Delivered sale #{sale.id}",
        )
        last_rate = session.exec(
            select(LastSaleRate).where(LastSaleRate.shop_id == sale.shop_id, LastSaleRate.sku_id == item.sku_id)
        ).first()
        if last_rate:
            last_rate.rate = item.sale_rate
            last_rate.sale_id = sale.id
            last_rate.sale_date = sale.sale_date
            last_rate.updated_at = utc_now()
        else:
            session.add(LastSaleRate(shop_id=sale.shop_id, sku_id=item.sku_id, sale_id=sale.id, rate=item.sale_rate, sale_date=sale.sale_date))

    add_shop_ledger_entry(
        session,
        shop=shop,
        entry_type=LedgerEntryType.SALE_INVOICE,
        amount=sale.net_amount,
        reference_type="sale",
        reference_id=sale.id,
        user=user,
        notes=f"Sale invoice #{sale.id}",
    )
    if sale.payment_received > 0:
        add_shop_ledger_entry(
            session,
            shop=shop,
            entry_type=LedgerEntryType.PAYMENT_RECEIVED,
            amount=-sale.payment_received,
            reference_type="sale_payment",
            reference_id=sale.id,
            user=user,
            notes=f"Payment received against sale #{sale.id}",
        )

    old_status = sale.status
    sale.status = SaleStatus.DELIVERED
    sale.updated_at = utc_now()
    write_audit(session, user, "CONFIRM", "sale", sale.id, {"status": old_status}, {"status": sale.status})
    session.commit()
    session.refresh(sale)
    return sale


def cancel_sale(session: Session, sale_id: int, user: User) -> Sale:
    sale = session.get(Sale, sale_id)
    if not sale:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sale not found")
    if sale.status in {SaleStatus.DELIVERED, SaleStatus.CONFIRMED, SaleStatus.PARTIALLY_RETURNED}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Delivered sales must be reversed, not cancelled")
    old_status = sale.status
    sale.status = SaleStatus.CANCELLED
    sale.updated_at = utc_now()
    write_audit(session, user, "CANCEL", "sale", sale.id, {"status": old_status}, {"status": sale.status})
    session.commit()
    session.refresh(sale)
    return sale


def reverse_sale(session: Session, sale_id: int, payload: ReverseSaleRequest, user: User) -> Sale:
    sale = session.get(Sale, sale_id)
    if not sale:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sale not found")
    if sale.status == SaleStatus.REVERSED:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Sale is already reversed")
    if sale.status not in {SaleStatus.DELIVERED, SaleStatus.CONFIRMED, SaleStatus.PARTIALLY_RETURNED}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only delivered sales can be reversed")

    items = session.exec(select(SaleItem).where(SaleItem.sale_id == sale.id)).all()
    for item in items:
        quantity_to_reverse = item.quantity_packets - _previous_returned_quantity(session, item.id)
        if quantity_to_reverse <= 0:
            continue
        apply_stock_movement(
            session,
            warehouse_id=sale.warehouse_id,
            sku_id=item.sku_id,
            quantity_packets=quantity_to_reverse,
            movement_type=MovementType.SALE_REVERSAL,
            reference_type="sale_reversal",
            reference_id=sale.id,
            cost_rate=item.cost_rate,
            user=user,
            notes=payload.reason,
        )

    shop = session.get(Shop, sale.shop_id)
    add_shop_ledger_entry(
        session,
        shop=shop,
        entry_type=LedgerEntryType.SALE_REVERSAL,
        amount=-(sale.net_amount - sale.payment_received),
        reference_type="sale_reversal",
        reference_id=sale.id,
        user=user,
        notes=payload.reason,
    )
    old_status = sale.status
    sale.status = SaleStatus.REVERSED
    sale.reversal_reason = payload.reason
    sale.reversed_by_id = user.id
    sale.reversed_at = utc_now()
    sale.updated_at = utc_now()
    write_audit(session, user, "REVERSE", "sale", sale.id, {"status": old_status}, {"status": sale.status, "reason": payload.reason})
    session.commit()
    session.refresh(sale)
    return sale


def _previous_returned_quantity(session: Session, sale_item_id: int) -> int:
    rows = session.exec(select(SaleReturnItem).where(SaleReturnItem.sale_item_id == sale_item_id)).all()
    return sum(row.quantity_packets for row in rows)


def return_sale_items(session: Session, sale_id: int, payload: SaleReturnCreate, user: User) -> Sale:
    sale = session.get(Sale, sale_id)
    if not sale:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sale not found")
    if sale.status not in {SaleStatus.DELIVERED, SaleStatus.CONFIRMED, SaleStatus.PARTIALLY_RETURNED}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only delivered sales can receive returns")
    if not payload.items:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Return requires at least one item")
    if user.role == UserRole.ORDER_BOOKER and user.assigned_warehouse_id != sale.warehouse_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sale is outside your warehouse")

    shop = session.get(Shop, sale.shop_id)
    if not shop:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shop not found")
    if user.role == UserRole.ORDER_BOOKER and shop.assigned_order_booker_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Shop is outside this order booker's assigned route")

    sale_return = SaleReturn(sale_id=sale.id, reason=payload.reason, returned_by_id=user.id)
    session.add(sale_return)
    session.flush()

    total_amount = 0.0
    cogs_amount = 0.0
    profit_amount = 0.0
    for line in payload.items:
        sale_item = session.get(SaleItem, line.sale_item_id)
        if not sale_item or sale_item.sale_id != sale.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Sale item {line.sale_item_id} not found for this sale")
        previously_returned = _previous_returned_quantity(session, sale_item.id)
        remaining = sale_item.quantity_packets - previously_returned
        if line.quantity_packets > remaining:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Return quantity for sale item {sale_item.id} exceeds remaining sold quantity {remaining}",
            )

        line_total = round(line.quantity_packets * sale_item.sale_rate, 2)
        line_cost = round(line.quantity_packets * sale_item.cost_rate, 2)
        line_profit = round(line_total - line_cost, 2)
        session.add(
            SaleReturnItem(
                sale_return_id=sale_return.id,
                sale_item_id=sale_item.id,
                sku_id=sale_item.sku_id,
                quantity_packets=line.quantity_packets,
                sale_rate=sale_item.sale_rate,
                cost_rate=sale_item.cost_rate,
                line_total=line_total,
                line_profit=line_profit,
            )
        )
        apply_stock_movement(
            session,
            warehouse_id=sale.warehouse_id,
            sku_id=sale_item.sku_id,
            quantity_packets=line.quantity_packets,
            movement_type=MovementType.RETURN_IN,
            reference_type="sale_return",
            reference_id=sale_return.id,
            cost_rate=sale_item.cost_rate,
            user=user,
            notes=payload.reason,
        )
        total_amount += line_total
        cogs_amount += line_cost
        profit_amount += line_profit

    sale_return.total_amount = round(total_amount, 2)
    sale_return.cogs_amount = round(cogs_amount, 2)
    sale_return.profit_amount = round(profit_amount, 2)

    add_shop_ledger_entry(
        session,
        shop=shop,
        entry_type=LedgerEntryType.RETURN_ADJUSTMENT,
        amount=-sale_return.total_amount,
        reference_type="sale_return",
        reference_id=sale_return.id,
        user=user,
        notes=payload.reason,
    )

    old_values = {
        "status": sale.status,
        "gross_amount": sale.gross_amount,
        "net_amount": sale.net_amount,
        "pending_amount": sale.pending_amount,
        "cogs_amount": sale.cogs_amount,
        "gross_profit": sale.gross_profit,
    }
    sale.gross_amount = round(max(sale.gross_amount - sale_return.total_amount, 0), 2)
    sale.net_amount = round(max(sale.net_amount - sale_return.total_amount, 0), 2)
    sale.pending_amount = round(max(sale.pending_amount - sale_return.total_amount, 0), 2)
    sale.cogs_amount = round(max(sale.cogs_amount - sale_return.cogs_amount, 0), 2)
    sale.gross_profit = round(sale.gross_profit - sale_return.profit_amount, 2)
    sale.status = SaleStatus.PARTIALLY_RETURNED
    sale.updated_at = utc_now()
    write_audit(session, user, "RETURN", "sale", sale.id, old_values, {"return_id": sale_return.id, "amount": sale_return.total_amount})
    session.commit()
    session.refresh(sale)
    return sale
