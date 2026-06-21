"""Admin data-reset ("Start Fresh") so the owner can clear demo/test data.

Scopes:
  - "transactions": clear all sales, stock, payments, ledgers, visits, expenses
    and reset every shop balance to its opening balance. Keeps master data
    (warehouses, products, SKUs, shops, rate rules, users).
  - "transactions_and_shops": the above plus shops and shop rate rules.
  - "all": also clears products, SKUs, categories and warehouses, keeping only
    the login users (so the owner rebuilds everything from scratch).

Audit logs are never deleted; a RESET entry is always appended for traceability.
"""

from fastapi import HTTPException, status
from sqlmodel import Session, select

from app.models import (
    Expense,
    InventoryBalance,
    LastSaleRate,
    MonthlyClosing,
    MonthlyInventoryOpeningBalance,
    MonthlyShopOpeningBalance,
    Payment,
    Product,
    ProductCategory,
    SKU,
    Sale,
    SaleItem,
    SaleReturn,
    SaleReturnItem,
    Shop,
    ShopLedger,
    ShopRateRule,
    ShopVisit,
    StockLedger,
    StockReceipt,
    StockReceiptItem,
    User,
    Warehouse,
    utc_now,
)
from app.services.audit import write_audit

VALID_SCOPES = {"transactions", "transactions_and_shops", "all"}

# Transactional tables, ordered children-first so the delete is FK-safe.
_TRANSACTION_MODELS = [
    MonthlyShopOpeningBalance,
    MonthlyInventoryOpeningBalance,
    MonthlyClosing,
    SaleReturnItem,
    SaleReturn,
    SaleItem,
    Sale,
    Payment,
    ShopLedger,
    ShopVisit,
    LastSaleRate,
    StockLedger,
    StockReceiptItem,
    StockReceipt,
    InventoryBalance,
    Expense,
]


def _delete_all(session: Session, model) -> int:
    rows = session.exec(select(model)).all()
    for row in rows:
        session.delete(row)
    return len(rows)


def reset_data(session: Session, scope: str, user: User) -> dict:
    if scope not in VALID_SCOPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unknown reset scope '{scope}'")

    cleared: dict[str, int] = {}
    for model in _TRANSACTION_MODELS:
        cleared[model.__tablename__] = _delete_all(session, model)

    if scope == "transactions":
        # Keep shops but reset their running balances back to opening balance.
        for shop in session.exec(select(Shop)).all():
            shop.current_balance = shop.opening_balance or 0
            shop.updated_at = utc_now()
            session.add(shop)
    else:
        cleared[ShopRateRule.__tablename__] = _delete_all(session, ShopRateRule)
        cleared[Shop.__tablename__] = _delete_all(session, Shop)

    if scope == "all":
        cleared[SKU.__tablename__] = _delete_all(session, SKU)
        cleared[Product.__tablename__] = _delete_all(session, Product)
        cleared[ProductCategory.__tablename__] = _delete_all(session, ProductCategory)
        cleared[Warehouse.__tablename__] = _delete_all(session, Warehouse)
        # Detach users from the warehouses we just removed.
        for u in session.exec(select(User)).all():
            if u.assigned_warehouse_id is not None:
                u.assigned_warehouse_id = None
                session.add(u)

    write_audit(session, user, "RESET", "system", None, None, {"scope": scope, "cleared": cleared})
    session.commit()
    return {"scope": scope, "cleared": cleared, "message": f"Data reset complete ({scope})."}
