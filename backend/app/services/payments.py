from fastapi import HTTPException, status
from sqlmodel import Session

from app.models import LedgerEntryType, Payment, Shop, User
from app.schemas import PaymentCreate
from app.services.audit import write_audit
from app.services.ledger import add_shop_ledger_entry


def create_payment(session: Session, payload: PaymentCreate, user: User) -> Payment:
    shop = session.get(Shop, payload.shop_id)
    if not shop or not shop.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shop not found or inactive")
    payment = Payment(
        shop_id=payload.shop_id,
        amount=payload.amount,
        method=payload.method,
        reference_number=payload.reference_number,
        notes=payload.notes,
        created_by_id=user.id,
    )
    session.add(payment)
    session.flush()
    add_shop_ledger_entry(
        session,
        shop=shop,
        entry_type=LedgerEntryType.PAYMENT_RECEIVED,
        amount=-payload.amount,
        reference_type="payment",
        reference_id=payment.id,
        user=user,
        notes=payload.notes,
    )
    write_audit(session, user, "CREATE", "payment", payment.id, None, payload.model_dump())
    session.commit()
    session.refresh(payment)
    return payment
