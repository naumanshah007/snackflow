from __future__ import annotations

import csv
import hashlib
import io
import json
import zipfile
from calendar import monthrange
from datetime import date, datetime, time, timedelta
from typing import Any

from fastapi import HTTPException, status
from fastapi.encoders import jsonable_encoder
from sqlmodel import Session, select

from app.config import settings
from app.models import (
    Expense,
    InventoryBalance,
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
    SaleStatus,
    Shop,
    ShopLedger,
    StockLedger,
    StockReceipt,
    StockReceiptItem,
    User,
    Warehouse,
    utc_now,
)
from app.services.audit import write_audit

RECOGNIZED_SALE_STATUSES = (SaleStatus.DELIVERED, SaleStatus.CONFIRMED, SaleStatus.PARTIALLY_RETURNED)
BACKUP_WARNING = "This action should only be done after downloading backup. It cannot be undone unless backup is restored."


def parse_month(month: str) -> tuple[date, date, datetime, datetime]:
    try:
        year_text, month_text = month.split("-", 1)
        year = int(year_text)
        month_number = int(month_text)
        last_day = monthrange(year, month_number)[1]
    except (ValueError, TypeError):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Month must be in YYYY-MM format")
    month_start = date(year, month_number, 1)
    month_end = date(year, month_number, last_day)
    return month_start, month_end, datetime.combine(month_start, time.min), datetime.combine(month_end, time.max)


def _next_month_start(month_end: date) -> date:
    return month_end + timedelta(days=1)


def _month_label(month_start: date) -> str:
    return month_start.strftime("%Y-%m")


def _round(value: float) -> float:
    return round(float(value or 0), 2)


def _model_rows(rows: list[Any], *, exclude: set[str] | None = None) -> list[dict[str, Any]]:
    excluded = exclude or set()
    return [{key: value for key, value in jsonable_encoder(row).items() if key not in excluded} for row in rows]


def _csv_bytes(rows: list[dict[str, Any]], columns: list[str]) -> bytes:
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=columns, extrasaction="ignore")
    writer.writeheader()
    for row in rows:
        encoded = {}
        for column in columns:
            value = row.get(column)
            if isinstance(value, (list, dict)):
                encoded[column] = json.dumps(value, ensure_ascii=False)
            else:
                encoded[column] = value
        writer.writerow(encoded)
    return buffer.getvalue().encode("utf-8-sig")


def _add_csv(zip_file: zipfile.ZipFile, filename: str, rows: list[dict[str, Any]], columns: list[str]) -> None:
    zip_info = zipfile.ZipInfo(filename, date_time=(1980, 1, 1, 0, 0, 0))
    zip_info.compress_type = zipfile.ZIP_DEFLATED
    zip_file.writestr(zip_info, _csv_bytes(rows, columns))


def backup_checksum(zip_bytes: bytes) -> str:
    return hashlib.sha256(zip_bytes).hexdigest()


def _sales_for_month(session: Session, start_dt: datetime, end_dt: datetime) -> list[Sale]:
    return session.exec(
        select(Sale)
        .where(Sale.sale_date >= start_dt, Sale.sale_date <= end_dt, Sale.status.in_(RECOGNIZED_SALE_STATUSES))
        .order_by(Sale.sale_date)
    ).all()


def _payments_for_month(session: Session, start_dt: datetime, end_dt: datetime) -> list[Payment]:
    return session.exec(select(Payment).where(Payment.payment_date >= start_dt, Payment.payment_date <= end_dt).order_by(Payment.payment_date)).all()


def _expenses_for_month(session: Session, month_start: date, month_end: date) -> list[Expense]:
    return session.exec(
        select(Expense)
        .where(Expense.expense_date >= month_start, Expense.expense_date <= month_end, Expense.is_deleted == False)  # noqa: E712
        .order_by(Expense.expense_date)
    ).all()


def build_monthly_preview(session: Session, month: str) -> dict[str, Any]:
    month_start, month_end, start_dt, end_dt = parse_month(month)
    sales = _sales_for_month(session, start_dt, end_dt)
    sale_ids = [sale.id for sale in sales if sale.id is not None]
    sale_items = session.exec(select(SaleItem).where(SaleItem.sale_id.in_(sale_ids))).all() if sale_ids else []
    payments = _payments_for_month(session, start_dt, end_dt)
    expenses = _expenses_for_month(session, month_start, month_end)
    shop_ledger = session.exec(select(ShopLedger).where(ShopLedger.occurred_at >= start_dt, ShopLedger.occurred_at <= end_dt)).all()
    stock_ledger = session.exec(select(StockLedger).where(StockLedger.occurred_at >= start_dt, StockLedger.occurred_at <= end_dt)).all()
    stock_receipts = session.exec(select(StockReceipt).where(StockReceipt.date_received >= month_start, StockReceipt.date_received <= month_end)).all()

    gross_profit = _round(sum(sale.gross_profit for sale in sales))
    expenses_total = _round(sum(expense.amount for expense in expenses))
    sale_payments = _round(sum(sale.payment_received for sale in sales))
    posted_payments = _round(sum(payment.amount for payment in payments))

    warehouse_stock: dict[int, dict[str, Any]] = {}
    for balance in session.exec(select(InventoryBalance)).all():
        warehouse = session.get(Warehouse, balance.warehouse_id)
        row = warehouse_stock.setdefault(
            balance.warehouse_id,
            {
                "warehouse_id": balance.warehouse_id,
                "warehouse_name": warehouse.name if warehouse else f"Warehouse {balance.warehouse_id}",
                "sku_count": 0,
                "closing_packets": 0,
                "stock_value": 0.0,
            },
        )
        row["sku_count"] += 1
        row["closing_packets"] += balance.quantity_packets
        row["stock_value"] = _round(row["stock_value"] + balance.quantity_packets * balance.average_cost_per_packet)

    transaction_counts = {
        "sales": len(sales),
        "sale_items": len(sale_items),
        "payments": len(payments),
        "expenses": len(expenses),
        "shop_ledger": len(shop_ledger),
        "stock_ledger": len(stock_ledger),
        "stock_receipts": len(stock_receipts),
    }

    summary = {
        "month": _month_label(month_start),
        "month_start": month_start.isoformat(),
        "month_end": month_end.isoformat(),
        "total_sales": _round(sum(sale.net_amount for sale in sales)),
        "sale_payments_received": sale_payments,
        "posted_payments_received": posted_payments,
        "payments_received": _round(sale_payments + posted_payments),
        "expenses": expenses_total,
        "gross_profit": gross_profit,
        "net_profit": _round(gross_profit - expenses_total),
        "total_outstanding_shop_balance": _round(sum(shop.current_balance for shop in session.exec(select(Shop)).all())),
        "warehouse_closing_stock": sorted(warehouse_stock.values(), key=lambda item: item["warehouse_name"]),
        "transactions_to_archive": transaction_counts,
        "transaction_count_total": sum(transaction_counts.values()),
        "warning": BACKUP_WARNING,
    }
    return summary


def _backup_datasets(session: Session, month: str, summary: dict[str, Any]) -> dict[str, tuple[list[dict[str, Any]], list[str]]]:
    month_start, month_end, start_dt, end_dt = parse_month(month)
    sales = _sales_for_month(session, start_dt, end_dt)
    sale_ids = [sale.id for sale in sales if sale.id is not None]
    sale_items = session.exec(select(SaleItem).where(SaleItem.sale_id.in_(sale_ids)).order_by(SaleItem.id)).all() if sale_ids else []
    sale_returns = session.exec(select(SaleReturn).where(SaleReturn.sale_id.in_(sale_ids)).order_by(SaleReturn.return_date)).all() if sale_ids else []
    sale_return_ids = [row.id for row in sale_returns if row.id is not None]
    sale_return_items = (
        session.exec(select(SaleReturnItem).where(SaleReturnItem.sale_return_id.in_(sale_return_ids)).order_by(SaleReturnItem.id)).all()
        if sale_return_ids
        else []
    )
    payments = _payments_for_month(session, start_dt, end_dt)
    expenses = _expenses_for_month(session, month_start, month_end)
    shop_ledger = session.exec(select(ShopLedger).where(ShopLedger.occurred_at >= start_dt, ShopLedger.occurred_at <= end_dt).order_by(ShopLedger.occurred_at)).all()
    stock_ledger = session.exec(select(StockLedger).where(StockLedger.occurred_at >= start_dt, StockLedger.occurred_at <= end_dt).order_by(StockLedger.occurred_at)).all()
    receipts = session.exec(select(StockReceipt).where(StockReceipt.date_received >= month_start, StockReceipt.date_received <= month_end).order_by(StockReceipt.date_received)).all()
    receipt_ids = [receipt.id for receipt in receipts if receipt.id is not None]
    receipt_items = (
        session.exec(select(StockReceiptItem).where(StockReceiptItem.stock_receipt_id.in_(receipt_ids)).order_by(StockReceiptItem.id)).all()
        if receipt_ids
        else []
    )
    users = session.exec(select(User).order_by(User.id)).all()
    user_rows = _model_rows(users, exclude={"hashed_password"})
    summary_rows = [
        {
            "month": summary["month"],
            "month_start": summary["month_start"],
            "month_end": summary["month_end"],
            "total_sales": summary["total_sales"],
            "payments_received": summary["payments_received"],
            "sale_payments_received": summary["sale_payments_received"],
            "posted_payments_received": summary["posted_payments_received"],
            "expenses": summary["expenses"],
            "gross_profit": summary["gross_profit"],
            "net_profit": summary["net_profit"],
            "total_outstanding_shop_balance": summary["total_outstanding_shop_balance"],
            "transaction_count_total": summary["transaction_count_total"],
            "transactions_to_archive": summary["transactions_to_archive"],
            "warehouse_closing_stock": summary["warehouse_closing_stock"],
        }
    ]

    return {
        "sales.csv": (_model_rows(sales), ["id", "sale_date", "shop_id", "order_booker_id", "warehouse_id", "status", "gross_amount", "discount", "net_amount", "payment_received", "pending_amount", "cogs_amount", "gross_profit", "notes", "created_at", "updated_at"]),
        "sale_items.csv": (_model_rows(sale_items), ["id", "sale_id", "sku_id", "quantity_packets", "pack_quantity", "sale_rate", "cost_rate", "line_total", "line_profit"]),
        "sale_returns.csv": (_model_rows(sale_returns), ["id", "sale_id", "return_date", "reason", "returned_by_id", "total_amount", "cogs_amount", "profit_amount", "created_at"]),
        "sale_return_items.csv": (_model_rows(sale_return_items), ["id", "sale_return_id", "sale_item_id", "sku_id", "quantity_packets", "sale_rate", "cost_rate", "line_total", "line_profit"]),
        "payments.csv": (_model_rows(payments), ["id", "payment_date", "shop_id", "amount", "method", "reference_number", "notes", "created_by_id", "created_at"]),
        "expenses.csv": (_model_rows(expenses), ["id", "expense_date", "category", "amount", "warehouse_id", "order_booker_id", "description", "is_deleted", "created_by_id", "created_at", "updated_at"]),
        "shop_ledger.csv": (_model_rows(shop_ledger), ["id", "occurred_at", "shop_id", "entry_type", "amount", "running_balance", "reference_type", "reference_id", "created_by_id", "notes"]),
        "stock_ledger.csv": (_model_rows(stock_ledger), ["id", "occurred_at", "warehouse_id", "sku_id", "movement_type", "quantity_packets", "reference_type", "reference_id", "cost_rate", "created_by_id", "notes"]),
        "stock_receipts.csv": (_model_rows(receipts), ["id", "date_received", "warehouse_id", "supplier_name", "reference_number", "notes", "created_by_id", "created_at"]),
        "stock_receipt_items.csv": (_model_rows(receipt_items), ["id", "stock_receipt_id", "sku_id", "quantity_received", "quantity_unit", "pack_quantity", "quantity_packets", "cost_per_carton", "cost_per_packet"]),
        "inventory_balances.csv": (_model_rows(session.exec(select(InventoryBalance).order_by(InventoryBalance.warehouse_id, InventoryBalance.sku_id)).all()), ["id", "warehouse_id", "sku_id", "quantity_packets", "average_cost_per_packet", "updated_at"]),
        "shops.csv": (_model_rows(session.exec(select(Shop).order_by(Shop.id)).all()), ["id", "name", "owner_name", "phone", "alternate_phone", "address", "area_route", "gps_latitude", "gps_longitude", "assigned_warehouse_id", "assigned_order_booker_id", "route_days", "credit_limit", "opening_balance", "current_balance", "notes", "status", "is_active", "created_at", "updated_at"]),
        "skus.csv": (_model_rows(session.exec(select(SKU).order_by(SKU.id)).all()), ["id", "product_id", "size_mrp", "flavour", "pack_quantity", "unit_type", "cost_price", "default_sale_rate", "minimum_sale_rate", "sku_code", "low_stock_threshold", "is_active", "created_at", "updated_at"]),
        "products.csv": (_model_rows(session.exec(select(Product).order_by(Product.id)).all()), ["id", "category_id", "name", "description", "is_active", "created_at", "updated_at"]),
        "product_categories.csv": (_model_rows(session.exec(select(ProductCategory).order_by(ProductCategory.id)).all()), ["id", "name", "is_active", "created_at", "updated_at"]),
        "warehouses.csv": (_model_rows(session.exec(select(Warehouse).order_by(Warehouse.id)).all()), ["id", "name", "address", "manager", "phone", "is_active", "created_at", "updated_at"]),
        "users_summary.csv": (user_rows, ["id", "name", "username", "phone", "role", "assigned_warehouse_id", "route_days", "is_active", "created_at"]),
        "monthly_summary.csv": (summary_rows, ["month", "month_start", "month_end", "total_sales", "payments_received", "sale_payments_received", "posted_payments_received", "expenses", "gross_profit", "net_profit", "total_outstanding_shop_balance", "transaction_count_total", "transactions_to_archive", "warehouse_closing_stock"]),
    }


def build_backup_zip_bytes(session: Session, month: str) -> tuple[bytes, dict[str, Any]]:
    summary = build_monthly_preview(session, month)
    datasets = _backup_datasets(session, month, summary)
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as zip_file:
        for filename, (rows, columns) in sorted(datasets.items()):
            _add_csv(zip_file, filename, rows, columns)
    return buffer.getvalue(), summary


def generate_monthly_backup(session: Session, month: str, user: User) -> tuple[MonthlyClosing, bytes]:
    month_start, month_end, _, _ = parse_month(month)
    existing = session.exec(select(MonthlyClosing).where(MonthlyClosing.month_start == month_start)).first()
    if existing and existing.closed_at:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This month is already closed")

    zip_bytes, summary = build_backup_zip_bytes(session, month)
    timestamp = utc_now().strftime("%Y%m%d%H%M%S")
    filename = f"monthly-closing-{_month_label(month_start)}-{timestamp}.zip"

    closing = existing or MonthlyClosing(month_start=month_start, month_end=month_end)
    closing.status = "BACKUP_GENERATED"
    closing.backup_filename = filename
    closing.backup_reference = "database-regenerated-on-download"
    closing.backup_checksum = backup_checksum(zip_bytes)
    closing.backup_generated_at = utc_now()
    closing.summary_totals = summary
    closing.updated_at = utc_now()
    session.add(closing)
    session.flush()
    write_audit(session, user, "GENERATE_BACKUP", "monthly_closing", closing.id, None, {"month": _month_label(month_start), "backup_filename": filename})
    session.commit()
    session.refresh(closing)
    return closing, zip_bytes


def regenerate_backup_for_closing(session: Session, closing: MonthlyClosing) -> tuple[bytes, str]:
    zip_bytes, _ = build_backup_zip_bytes(session, _month_label(closing.month_start))
    return zip_bytes, backup_checksum(zip_bytes)


def _closing_for_close(session: Session, month: str | None, closing_id: int | None) -> MonthlyClosing:
    closing = session.get(MonthlyClosing, closing_id) if closing_id else None
    if not closing and month:
        month_start, _, _, _ = parse_month(month)
        closing = session.exec(select(MonthlyClosing).where(MonthlyClosing.month_start == month_start)).first()
    if not closing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Generate backup before closing this month")
    return closing


def close_month(session: Session, *, month: str | None, closing_id: int | None, user: User) -> MonthlyClosing:
    closing = _closing_for_close(session, month, closing_id)
    if not closing.backup_generated_at or not closing.backup_filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Generate and download backup before closing this month")
    if closing.closed_at:
        return closing

    next_month_start = _next_month_start(closing.month_end)
    shop_count = 0
    for shop in session.exec(select(Shop).where(Shop.is_active == True).order_by(Shop.id)).all():  # noqa: E712
        exists = session.exec(
            select(MonthlyShopOpeningBalance).where(MonthlyShopOpeningBalance.monthly_closing_id == closing.id, MonthlyShopOpeningBalance.shop_id == shop.id)
        ).first()
        if not exists:
            session.add(MonthlyShopOpeningBalance(monthly_closing_id=closing.id, month_start=next_month_start, shop_id=shop.id, opening_balance=shop.current_balance))
            shop_count += 1

    inventory_count = 0
    for balance in session.exec(select(InventoryBalance).order_by(InventoryBalance.warehouse_id, InventoryBalance.sku_id)).all():
        exists = session.exec(
            select(MonthlyInventoryOpeningBalance).where(
                MonthlyInventoryOpeningBalance.monthly_closing_id == closing.id,
                MonthlyInventoryOpeningBalance.warehouse_id == balance.warehouse_id,
                MonthlyInventoryOpeningBalance.sku_id == balance.sku_id,
            )
        ).first()
        if not exists:
            session.add(
                MonthlyInventoryOpeningBalance(
                    monthly_closing_id=closing.id,
                    month_start=next_month_start,
                    warehouse_id=balance.warehouse_id,
                    sku_id=balance.sku_id,
                    opening_quantity_packets=balance.quantity_packets,
                    opening_average_cost_per_packet=balance.average_cost_per_packet,
                )
            )
            inventory_count += 1

    closing.status = "CLOSED"
    closing.closed_by_id = user.id
    closing.closed_at = utc_now()
    closing.carry_forward_summary = {
        "next_month_start": next_month_start.isoformat(),
        "shop_opening_balances_created": shop_count,
        "inventory_opening_balances_created": inventory_count,
    }
    closing.updated_at = utc_now()
    session.add(closing)
    write_audit(session, user, "CLOSE", "monthly_closing", closing.id, None, closing.carry_forward_summary)
    session.commit()
    session.refresh(closing)
    return closing


def archive_monthly_closing(session: Session, closing_id: int, user: User, *, confirm_downloaded_backup: bool, note: str | None = None) -> MonthlyClosing:
    closing = session.get(MonthlyClosing, closing_id)
    if not closing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Monthly closing not found")
    if not closing.backup_generated_at or not closing.backup_filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Generate backup before archive")
    if not closing.closed_at:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Close the month before archive")
    if not confirm_downloaded_backup:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=BACKUP_WARNING)
    if not settings.monthly_archive_enabled:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Archive/delete is Phase 2 and is disabled by default")

    closing.archive_status = "ARCHIVE_REQUESTED"
    closing.archive_requested_at = utc_now()
    closing.archive_note = note
    closing.updated_at = utc_now()
    session.add(closing)
    write_audit(session, user, "ARCHIVE_REQUESTED", "monthly_closing", closing.id, None, {"note": note})
    session.commit()
    session.refresh(closing)
    return closing


def list_monthly_closings(session: Session) -> list[MonthlyClosing]:
    return session.exec(select(MonthlyClosing).order_by(MonthlyClosing.month_start.desc())).all()
