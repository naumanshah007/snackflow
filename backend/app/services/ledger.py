from sqlmodel import Session

from app.models import LedgerEntryType, Shop, ShopLedger, User
from app.services.audit import write_audit


def add_shop_ledger_entry(
    session: Session,
    *,
    shop: Shop,
    entry_type: LedgerEntryType,
    amount: float,
    reference_type: str,
    reference_id: int | None,
    user: User | None,
    notes: str | None = None,
) -> ShopLedger:
    old_balance = shop.current_balance
    shop.current_balance = round(shop.current_balance + amount, 2)
    entry = ShopLedger(
        shop_id=shop.id,
        entry_type=entry_type,
        amount=round(amount, 2),
        running_balance=shop.current_balance,
        reference_type=reference_type,
        reference_id=reference_id,
        created_by_id=user.id if user else None,
        notes=notes,
    )
    session.add(entry)
    write_audit(
        session,
        user,
        action=entry_type.value,
        entity_type="shop_ledger",
        entity_id=shop.id,
        old_values={"current_balance": old_balance},
        new_values={"current_balance": shop.current_balance, "amount": amount},
    )
    return entry
