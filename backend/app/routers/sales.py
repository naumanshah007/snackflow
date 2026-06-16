from datetime import date, datetime, time

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session, select

from app.carton import carton_label, split_cartons
from app.database import get_session
from app.dependencies import get_current_user, scoped_warehouse_id
from app.models import Payment, Product, SKU, Sale, SaleItem, SaleReturn, SaleReturnItem, SaleStatus, Shop, ShopVisit, User, UserRole, Warehouse
from app.schemas import PaymentCreate, ReverseSaleRequest, SaleCreate, SaleReturnCreate, SaleUpdate, VisitCreate
from app.services.payments import create_payment
from app.services.sales import cancel_sale, confirm_sale, create_sale, return_sale_items, reverse_sale
from app.services.audit import model_snapshot, write_audit
from app.models import utc_now

router = APIRouter(tags=["sales"])


def _sale_row(session: Session, sale: Sale) -> dict:
    shop = session.get(Shop, sale.shop_id)
    warehouse = session.get(Warehouse, sale.warehouse_id)
    data = sale.model_dump()
    data["shop_name"] = shop.name if shop else ""
    data["warehouse_name"] = warehouse.name if warehouse else ""
    data["items"] = []
    for item in session.exec(select(SaleItem).where(SaleItem.sale_id == sale.id)).all():
        sku = session.get(SKU, item.sku_id)
        product = session.get(Product, sku.product_id) if sku else None
        item_data = item.model_dump()
        item_data["sku_name"] = f"{product.name if product else ''} Rs {sku.size_mrp:g} {sku.flavour or ''}".strip() if sku else ""
        pack_quantity = item.pack_quantity or 1
        cartons, loose = split_cartons(item.quantity_packets, pack_quantity)
        item_data["cartons"] = cartons
        item_data["loose_packets"] = loose
        item_data["carton_label"] = carton_label(item.quantity_packets, pack_quantity)
        item_data["sale_rate_per_carton"] = round(item.sale_rate * pack_quantity, 2)
        data["items"].append(item_data)
    data["returns"] = []
    for sale_return in session.exec(select(SaleReturn).where(SaleReturn.sale_id == sale.id).order_by(SaleReturn.return_date.desc())).all():
        return_data = sale_return.model_dump()
        return_data["items"] = [item.model_dump() for item in session.exec(select(SaleReturnItem).where(SaleReturnItem.sale_return_id == sale_return.id)).all()]
        data["returns"].append(return_data)
    return data


@router.get("/sales")
def list_sales(
    date_from: date | None = None,
    date_to: date | None = None,
    warehouse_id: int | None = None,
    shop_id: int | None = None,
    order_booker_id: int | None = None,
    status_filter: SaleStatus | None = None,
    offset: int = 0,
    limit: int = Query(default=200, le=1000),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    query = select(Sale)
    scoped = scoped_warehouse_id(current_user, warehouse_id)
    if scoped:
        query = query.where(Sale.warehouse_id == scoped)
    if current_user.role == UserRole.ORDER_BOOKER:
        query = query.where(Sale.order_booker_id == current_user.id)
    elif order_booker_id:
        query = query.where(Sale.order_booker_id == order_booker_id)
    if shop_id:
        query = query.where(Sale.shop_id == shop_id)
    if status_filter:
        query = query.where(Sale.status == status_filter)
    if date_from:
        query = query.where(Sale.sale_date >= datetime.combine(date_from, time.min))
    if date_to:
        query = query.where(Sale.sale_date <= datetime.combine(date_to, time.max))
    sales = session.exec(query.order_by(Sale.sale_date.desc()).offset(offset).limit(limit)).all()
    return [_sale_row(session, sale) for sale in sales]


@router.post("/sales")
def post_sale(payload: SaleCreate, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    return create_sale(session, payload, current_user)


@router.get("/sales/{sale_id}")
def get_sale(sale_id: int, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    sale = session.get(Sale, sale_id)
    if not sale:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sale not found")
    if current_user.role == UserRole.ORDER_BOOKER and sale.order_booker_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sale is outside your scope")
    return _sale_row(session, sale)


@router.put("/sales/{sale_id}")
def update_sale(sale_id: int, payload: SaleUpdate, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    sale = session.get(Sale, sale_id)
    if not sale:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sale not found")
    if sale.status == SaleStatus.DELIVERED and payload.status and payload.status != sale.status:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Delivered sales must use reversal flow")
    old = model_snapshot(sale)
    if payload.status is not None:
        sale.status = payload.status
    if payload.notes is not None:
        sale.notes = payload.notes
    sale.updated_at = utc_now()
    write_audit(session, current_user, "UPDATE", "sale", sale.id, old, model_snapshot(sale))
    session.commit()
    session.refresh(sale)
    return sale


@router.post("/sales/{sale_id}/confirm")
def confirm(sale_id: int, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    return confirm_sale(session, sale_id, current_user)


@router.post("/sales/{sale_id}/cancel")
def cancel(sale_id: int, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    return cancel_sale(session, sale_id, current_user)


@router.post("/sales/{sale_id}/reverse")
def reverse(
    sale_id: int,
    payload: ReverseSaleRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    return reverse_sale(session, sale_id, payload, current_user)


@router.post("/sales/{sale_id}/return")
def partial_return(
    sale_id: int,
    payload: SaleReturnCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    return return_sale_items(session, sale_id, payload, current_user)


@router.post("/payments")
def post_payment(payload: PaymentCreate, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    return create_payment(session, payload, current_user)


@router.get("/payments")
def list_payments(
    shop_id: int | None = None,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    query = select(Payment)
    if shop_id:
        query = query.where(Payment.shop_id == shop_id)
    payments = session.exec(query.order_by(Payment.payment_date.desc()).limit(500)).all()
    return payments


@router.get("/shops/{shop_id}/payments")
def shop_payments(shop_id: int, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    return session.exec(select(Payment).where(Payment.shop_id == shop_id).order_by(Payment.payment_date.desc())).all()


@router.get("/shops/{shop_id}/collection-summary")
def shop_collection_summary(shop_id: int, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    """Carton-era collection view for order bookers: previous balance, today's
    bill, total payable, collected today, remaining balance and last payment."""
    shop = session.get(Shop, shop_id)
    if not shop:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shop not found")
    if current_user.role == UserRole.ORDER_BOOKER and shop.assigned_order_booker_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Shop is outside your route")

    today_start = datetime.combine(date.today(), time.min)
    today_end = datetime.combine(date.today(), time.max)

    today_sales = session.exec(
        select(Sale).where(
            Sale.shop_id == shop_id,
            Sale.sale_date >= today_start,
            Sale.sale_date <= today_end,
            Sale.status.in_([SaleStatus.DELIVERED, SaleStatus.CONFIRMED, SaleStatus.PARTIALLY_RETURNED]),
        )
    ).all()
    today_bill = round(sum(s.net_amount for s in today_sales), 2)

    today_payments = session.exec(
        select(Payment).where(Payment.shop_id == shop_id, Payment.payment_date >= today_start, Payment.payment_date <= today_end)
    ).all()
    collected_today = round(sum(p.amount for p in today_payments), 2)

    last_payment = session.exec(
        select(Payment).where(Payment.shop_id == shop_id).order_by(Payment.payment_date.desc())
    ).first()

    remaining_balance = round(shop.current_balance, 2)
    previous_balance = round(remaining_balance - today_bill + collected_today, 2)
    return {
        "shop_id": shop.id,
        "shop_name": shop.name,
        "previous_balance": previous_balance,
        "today_bill": today_bill,
        "total_payable": round(previous_balance + today_bill, 2),
        "collected_today": collected_today,
        "remaining_balance": remaining_balance,
        "last_payment_amount": last_payment.amount if last_payment else None,
        "last_payment_date": last_payment.payment_date if last_payment else None,
    }


@router.post("/shop-visits")
def create_visit(payload: VisitCreate, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    visit = ShopVisit(
        shop_id=payload.shop_id,
        order_booker_id=current_user.id,
        status=payload.status,
        gps_latitude=payload.gps_latitude,
        gps_longitude=payload.gps_longitude,
        notes=payload.notes,
    )
    session.add(visit)
    session.flush()
    write_audit(session, current_user, "CREATE", "shop_visit", visit.id, None, model_snapshot(visit))
    session.commit()
    session.refresh(visit)
    return visit


@router.get("/shop-visits")
def list_visits(
    shop_id: int | None = None,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    query = select(ShopVisit)
    if current_user.role == UserRole.ORDER_BOOKER:
        query = query.where(ShopVisit.order_booker_id == current_user.id)
    if shop_id:
        query = query.where(ShopVisit.shop_id == shop_id)
    return session.exec(query.order_by(ShopVisit.visited_at.desc()).limit(500)).all()
