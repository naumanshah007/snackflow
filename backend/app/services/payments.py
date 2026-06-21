from fastapi import HTTPException, status
from sqlmodel import Session

from app.models import LedgerEntryType, Payment, Shop, User, utc_now
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


def void_payment(session: Session, payment_id: int, reason: str, user: User) -> Payment:
    """Void a wrongly-entered payment.

    The original payment subtracted its amount from the shop balance, so voiding
    adds the same amount back via a correcting ledger entry. The payment row is
    kept (marked voided) so the history and audit trail are preserved; the admin
    can then enter the correct payment.
    """
    payment = session.get(Payment, payment_id)
    if not payment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found")
    if payment.is_voided:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Payment is already voided")
    shop = session.get(Shop, payment.shop_id)
    if not shop:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shop not found")

    add_shop_ledger_entry(
        session,
        shop=shop,
        entry_type=LedgerEntryType.MANUAL_ADJUSTMENT,
        amount=payment.amount,  # reverse the original -amount
        reference_type="payment_void",
        reference_id=payment.id,
        user=user,
        notes=f"Voided payment #{payment.id}: {reason}",
    )
    old = {"is_voided": payment.is_voided, "amount": payment.amount}
    payment.is_voided = True
    payment.voided_by_id = user.id
    payment.voided_at = utc_now()
    payment.void_reason = reason
    write_audit(session, user, "VOID", "payment", payment.id, old, {"is_voided": True, "reason": reason})
    session.commit()
    session.refresh(payment)
    return payment
