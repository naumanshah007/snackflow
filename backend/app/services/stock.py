from fastapi import HTTPException, status
from sqlmodel import Session, select

from app.models import (
    InventoryBalance,
    MovementType,
    SKU,
    StockLedger,
    StockReceipt,
    StockReceiptItem,
    User,
    utc_now,
)
from app.schemas import StockAdjustmentCreate, StockReceiptCreate
from app.services.audit import write_audit


def get_or_create_inventory(session: Session, warehouse_id: int, sku_id: int) -> InventoryBalance:
    balance = session.exec(
        select(InventoryBalance).where(
            InventoryBalance.warehouse_id == warehouse_id,
            InventoryBalance.sku_id == sku_id,
        )
    ).first()
    if balance:
        return balance
    balance = InventoryBalance(warehouse_id=warehouse_id, sku_id=sku_id)
    session.add(balance)
    session.flush()
    return balance


def apply_stock_movement(
    session: Session,
    *,
    warehouse_id: int,
    sku_id: int,
    quantity_packets: int,
    movement_type: MovementType,
    reference_type: str,
    reference_id: int | None,
    cost_rate: float,
    user: User | None,
    notes: str | None = None,
    allow_negative: bool = False,
) -> InventoryBalance:
    balance = get_or_create_inventory(session, warehouse_id, sku_id)
    previous_quantity = balance.quantity_packets

    if quantity_packets > 0:
        previous_value = balance.quantity_packets * balance.average_cost_per_packet
        incoming_value = quantity_packets * cost_rate
        new_quantity = balance.quantity_packets + quantity_packets
        balance.average_cost_per_packet = (previous_value + incoming_value) / new_quantity if new_quantity else 0
    else:
        new_quantity = balance.quantity_packets + quantity_packets
        if new_quantity < 0 and not allow_negative:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient stock for SKU {sku_id} in warehouse {warehouse_id}",
            )

    balance.quantity_packets = new_quantity
    balance.updated_at = utc_now()
    ledger = StockLedger(
        warehouse_id=warehouse_id,
        sku_id=sku_id,
        movement_type=movement_type,
        quantity_packets=quantity_packets,
        reference_type=reference_type,
        reference_id=reference_id,
        cost_rate=cost_rate,
        created_by_id=user.id if user else None,
        notes=notes,
    )
    session.add(ledger)
    write_audit(
        session,
        user,
        action=movement_type.value,
        entity_type="inventory_balance",
        entity_id=balance.id,
        old_values={"quantity_packets": previous_quantity},
        new_values={"quantity_packets": new_quantity, "sku_id": sku_id, "warehouse_id": warehouse_id},
    )
    return balance


def receive_stock(session: Session, payload: StockReceiptCreate, user: User) -> StockReceipt:
    if not payload.items:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Stock receipt requires at least one item")

    receipt = StockReceipt(
        date_received=payload.date_received,
        warehouse_id=payload.warehouse_id,
        supplier_name=payload.supplier_name,
        reference_number=payload.reference_number,
        notes=payload.notes,
        created_by_id=user.id,
    )
    session.add(receipt)
    session.flush()

    for line in payload.items:
        sku = session.get(SKU, line.sku_id)
        if not sku or not sku.is_active:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"SKU {line.sku_id} not found or inactive")

        pack_quantity = line.pack_quantity or sku.pack_quantity
        quantity_packets = line.quantity_received * pack_quantity if line.quantity_unit.lower() in {"carton", "bundle"} else line.quantity_received
        if quantity_packets <= 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Received quantity must be positive")

        cost_per_packet = line.cost_per_packet
        cost_per_carton = line.cost_per_carton
        if cost_per_packet is None and cost_per_carton is not None:
            cost_per_packet = cost_per_carton / pack_quantity
        if cost_per_carton is None and cost_per_packet is not None:
            cost_per_carton = cost_per_packet * pack_quantity
        if cost_per_packet is None:
            cost_per_packet = sku.cost_price
        if cost_per_carton is None:
            cost_per_carton = cost_per_packet * pack_quantity

        item = StockReceiptItem(
            stock_receipt_id=receipt.id,
            sku_id=sku.id,
            quantity_received=line.quantity_received,
            quantity_unit=line.quantity_unit,
            pack_quantity=pack_quantity,
            quantity_packets=quantity_packets,
            cost_per_carton=cost_per_carton,
            cost_per_packet=cost_per_packet,
        )
        session.add(item)
        apply_stock_movement(
            session,
            warehouse_id=payload.warehouse_id,
            sku_id=sku.id,
            quantity_packets=quantity_packets,
            movement_type=MovementType.STOCK_IN,
            reference_type="stock_receipt",
            reference_id=receipt.id,
            cost_rate=cost_per_packet,
            user=user,
            notes=payload.notes,
        )

    write_audit(session, user, "CREATE", "stock_receipt", receipt.id, None, payload.model_dump())
    session.commit()
    session.refresh(receipt)
    return receipt


def adjust_stock(session: Session, payload: StockAdjustmentCreate, user: User) -> InventoryBalance:
    if payload.quantity_packets == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Adjustment quantity cannot be zero")

    movement_type = MovementType.MANUAL_ADJUSTMENT_IN if payload.quantity_packets > 0 else MovementType.MANUAL_ADJUSTMENT_OUT
    balance = get_or_create_inventory(session, payload.warehouse_id, payload.sku_id)
    result = apply_stock_movement(
        session,
        warehouse_id=payload.warehouse_id,
        sku_id=payload.sku_id,
        quantity_packets=payload.quantity_packets,
        movement_type=movement_type,
        reference_type="stock_adjustment",
        reference_id=None,
        cost_rate=balance.average_cost_per_packet,
        user=user,
        notes=payload.notes,
    )
    session.commit()
    session.refresh(result)
    return result
