from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, or_, select

from app.database import get_session
from app.dependencies import assert_warehouse_scope, forbid_order_booker, get_current_user, require_roles, scoped_warehouse_id
from app.carton import carton_label, split_cartons
from app.models import InventoryBalance, MovementType, Product, SKU, StockLedger, StockReceipt, StockReceiptItem, User, UserRole, Warehouse
from app.schemas import StockAdjustmentCreate, StockReceiptCreate, SupplierReturnCreate
from app.services.stock import adjust_stock, receive_stock, return_stock_to_supplier

router = APIRouter(tags=["stock"])


@router.post("/stock-receipts")
def create_stock_receipt(
    payload: StockReceiptCreate,
    current_user: User = Depends(require_roles(UserRole.OWNER, UserRole.WAREHOUSE_MANAGER)),
    session: Session = Depends(get_session),
):
    assert_warehouse_scope(current_user, payload.warehouse_id)
    return receive_stock(session, payload, current_user)


@router.get("/stock-receipts")
def list_stock_receipts(
    warehouse_id: int | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    forbid_order_booker(current_user)
    query = select(StockReceipt)
    scoped = scoped_warehouse_id(current_user, warehouse_id)
    if scoped:
        query = query.where(StockReceipt.warehouse_id == scoped)
    if date_from:
        query = query.where(StockReceipt.date_received >= date_from)
    if date_to:
        query = query.where(StockReceipt.date_received <= date_to)
    receipts = session.exec(query.order_by(StockReceipt.date_received.desc())).all()
    result = []
    for receipt in receipts:
        data = receipt.model_dump()
        data["warehouse_name"] = session.get(Warehouse, receipt.warehouse_id).name if receipt.warehouse_id else ""
        data["items"] = [item.model_dump() for item in session.exec(select(StockReceiptItem).where(StockReceiptItem.stock_receipt_id == receipt.id)).all()]
        result.append(data)
    return result


@router.get("/inventory")
def get_inventory(
    warehouse_id: int | None = None,
    product_id: int | None = None,
    size_mrp: float | None = None,
    flavour: str | None = None,
    low_stock_only: bool = False,
    search: str | None = None,
    offset: int = 0,
    limit: int = Query(default=500, le=1000),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    query = select(InventoryBalance)
    scoped = scoped_warehouse_id(current_user, warehouse_id)
    if scoped:
        query = query.where(InventoryBalance.warehouse_id == scoped)
    balances = session.exec(query.offset(offset).limit(limit)).all()
    rows = []
    for balance in balances:
        sku = session.get(SKU, balance.sku_id)
        if not sku:
            continue
        product = session.get(Product, sku.product_id)
        warehouse = session.get(Warehouse, balance.warehouse_id)
        if product_id and sku.product_id != product_id:
            continue
        if size_mrp and sku.size_mrp != size_mrp:
            continue
        if flavour and (sku.flavour or "").lower() != flavour.lower():
            continue
        display_name = f"{product.name if product else ''} Rs {sku.size_mrp:g} {sku.flavour or ''} - {sku.pack_quantity} Pack".strip()
        if search and search.lower() not in display_name.lower():
            continue
        if low_stock_only and balance.quantity_packets > sku.low_stock_threshold:
            continue
        pack_quantity = sku.pack_quantity or 1
        cartons = balance.quantity_packets // pack_quantity
        loose_packets = balance.quantity_packets % pack_quantity
        rows.append(
            {
                "warehouse_id": balance.warehouse_id,
                "warehouse_name": warehouse.name if warehouse else "",
                "sku_id": sku.id,
                "sku_name": display_name,
                "product_name": product.name if product else "",
                "size_mrp": sku.size_mrp,
                "flavour": sku.flavour,
                "pack_quantity": pack_quantity,
                "available_packets": balance.quantity_packets,
                "cartons": cartons,
                "loose_packets": loose_packets,
                "carton_label": carton_label(balance.quantity_packets, pack_quantity),
                "low_stock": balance.quantity_packets <= sku.low_stock_threshold,
                "low_stock_threshold": sku.low_stock_threshold,
            }
        )
        if current_user.role != UserRole.ORDER_BOOKER:
            rows[-1].update(
                {
                    "average_cost_per_packet": round(balance.average_cost_per_packet, 2),
                    "average_cost_per_carton": round(balance.average_cost_per_packet * pack_quantity, 2),
                    "stock_value": round(balance.quantity_packets * balance.average_cost_per_packet, 2),
                }
            )
    return rows


@router.get("/stock-ledger")
def get_stock_ledger(
    warehouse_id: int | None = None,
    sku_id: int | None = None,
    search: str | None = None,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    forbid_order_booker(current_user)
    query = select(StockLedger)
    scoped = scoped_warehouse_id(current_user, warehouse_id)
    if scoped:
        query = query.where(StockLedger.warehouse_id == scoped)
    if sku_id:
        query = query.where(StockLedger.sku_id == sku_id)
    rows = session.exec(query.order_by(StockLedger.occurred_at.desc()).limit(1000)).all()
    result = []
    for row in rows:
        sku = session.get(SKU, row.sku_id)
        product = session.get(Product, sku.product_id) if sku else None
        warehouse = session.get(Warehouse, row.warehouse_id)
        sku_name = f"{product.name if product else ''} Rs {sku.size_mrp:g} {sku.flavour or ''}".strip() if sku else ""
        if search and search.lower() not in sku_name.lower():
            continue
        pack_quantity = sku.pack_quantity if sku else 1
        cartons, loose_packets = split_cartons(row.quantity_packets, pack_quantity)
        data = row.model_dump()
        data["sku_name"] = sku_name
        data["warehouse_name"] = warehouse.name if warehouse else ""
        data["pack_quantity"] = pack_quantity
        data["cartons"] = cartons
        data["loose_packets"] = loose_packets
        data["carton_label"] = carton_label(row.quantity_packets, pack_quantity)
        data["cost_per_carton"] = round(row.cost_rate * pack_quantity, 2)
        result.append(data)
    return result


@router.post("/stock-adjustments")
def create_stock_adjustment(
    payload: StockAdjustmentCreate,
    current_user: User = Depends(require_roles(UserRole.OWNER, UserRole.WAREHOUSE_MANAGER)),
    session: Session = Depends(get_session),
):
    assert_warehouse_scope(current_user, payload.warehouse_id)
    return adjust_stock(session, payload, current_user)


@router.post("/stock-returns")
def create_supplier_return(
    payload: SupplierReturnCreate,
    current_user: User = Depends(require_roles(UserRole.OWNER, UserRole.WAREHOUSE_MANAGER)),
    session: Session = Depends(get_session),
):
    """Record expired / damaged stock returned to the supplier (company)."""
    assert_warehouse_scope(current_user, payload.warehouse_id)
    return return_stock_to_supplier(session, payload, current_user)


@router.get("/stock-returns")
def list_supplier_returns(
    warehouse_id: int | None = None,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Recent supplier returns, read from the stock ledger (carton-first)."""
    forbid_order_booker(current_user)
    query = select(StockLedger).where(StockLedger.movement_type == MovementType.SUPPLIER_RETURN_OUT)
    scoped = scoped_warehouse_id(current_user, warehouse_id)
    if scoped:
        query = query.where(StockLedger.warehouse_id == scoped)
    rows = session.exec(query.order_by(StockLedger.occurred_at.desc()).limit(500)).all()
    result = []
    for row in rows:
        sku = session.get(SKU, row.sku_id)
        product = session.get(Product, sku.product_id) if sku else None
        warehouse = session.get(Warehouse, row.warehouse_id)
        pack_quantity = sku.pack_quantity if sku else 1
        returned_packets = abs(row.quantity_packets)
        result.append(
            {
                "id": row.id,
                "date": row.occurred_at,
                "warehouse_name": warehouse.name if warehouse else "",
                "sku_name": f"{product.name if product else ''} Rs {sku.size_mrp:g} {sku.flavour or ''}".strip() if sku else "",
                "pack_quantity": pack_quantity,
                "returned_packets": returned_packets,
                "carton_label": carton_label(returned_packets, pack_quantity),
                "notes": row.notes,
            }
        )
    return result
