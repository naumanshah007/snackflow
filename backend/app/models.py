from __future__ import annotations

from datetime import date, datetime
from enum import Enum
from typing import Any

from sqlalchemy import Column, JSON, UniqueConstraint
from sqlmodel import Field, SQLModel


def utc_now() -> datetime:
    return datetime.utcnow()


class UserRole(str, Enum):
    OWNER = "OWNER"
    WAREHOUSE_MANAGER = "WAREHOUSE_MANAGER"
    ORDER_BOOKER = "ORDER_BOOKER"
    ACCOUNTANT = "ACCOUNTANT"


# Canonical weekday names used for shop route days and order-booker working days.
WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def today_weekday() -> str:
    return date.today().strftime("%A")


def normalize_route_days(values: Any) -> list[str]:
    """Keep only valid weekday names, de-duplicated and ordered Mon..Sun."""
    if not values:
        return []
    if isinstance(values, str):
        values = [values]
    cleaned = {str(v).strip().capitalize() for v in values}
    return [day for day in WEEKDAYS if day in cleaned]


class MovementType(str, Enum):
    STOCK_IN = "STOCK_IN"
    SALE_OUT = "SALE_OUT"
    SALE_REVERSAL = "SALE_REVERSAL"
    RETURN_IN = "RETURN_IN"
    DAMAGE_OUT = "DAMAGE_OUT"
    MANUAL_ADJUSTMENT_IN = "MANUAL_ADJUSTMENT_IN"
    MANUAL_ADJUSTMENT_OUT = "MANUAL_ADJUSTMENT_OUT"
    TRANSFER_OUT = "TRANSFER_OUT"
    TRANSFER_IN = "TRANSFER_IN"


class LedgerEntryType(str, Enum):
    SALE_INVOICE = "SALE_INVOICE"
    PAYMENT_RECEIVED = "PAYMENT_RECEIVED"
    SALE_REVERSAL = "SALE_REVERSAL"
    RETURN_ADJUSTMENT = "RETURN_ADJUSTMENT"
    OPENING_BALANCE = "OPENING_BALANCE"
    MANUAL_ADJUSTMENT = "MANUAL_ADJUSTMENT"


class SaleStatus(str, Enum):
    DRAFT = "DRAFT"
    BOOKED = "BOOKED"
    DELIVERED = "DELIVERED"
    CONFIRMED = "CONFIRMED"
    CANCELLED = "CANCELLED"
    REVERSED = "REVERSED"
    PARTIALLY_RETURNED = "PARTIALLY_RETURNED"


class ShopStatus(str, Enum):
    ACTIVE = "ACTIVE"
    PENDING_APPROVAL = "PENDING_APPROVAL"
    REJECTED = "REJECTED"


class VisitStatus(str, Enum):
    SHOP_CLOSED = "SHOP_CLOSED"
    NO_ORDER = "NO_ORDER"
    OWNER_NOT_AVAILABLE = "OWNER_NOT_AVAILABLE"
    PAYMENT_ONLY = "PAYMENT_ONLY"
    ORDER_TAKEN = "ORDER_TAKEN"
    DELIVERY_DONE = "DELIVERY_DONE"


class ExpenseCategory(str, Enum):
    PETROL = "PETROL"
    VEHICLE_MAINTENANCE = "VEHICLE_MAINTENANCE"
    SALARIES = "SALARIES"
    RENT = "RENT"
    UTILITY_BILLS = "UTILITY_BILLS"
    LABOUR_CHARGES = "LABOUR_CHARGES"
    LOADING_UNLOADING = "LOADING_UNLOADING"
    MISCELLANEOUS = "MISCELLANEOUS"
    OTHER = "OTHER"


class ProductCategory(SQLModel, table=True):
    __tablename__ = "product_categories"

    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(index=True, unique=True, max_length=120)
    is_active: bool = True
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class Warehouse(SQLModel, table=True):
    __tablename__ = "warehouses"

    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(index=True, max_length=120)
    address: str | None = None
    manager: str | None = None
    phone: str | None = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(max_length=160)
    phone: str | None = None
    username: str = Field(index=True, unique=True, max_length=120)
    hashed_password: str
    role: UserRole = Field(default=UserRole.ORDER_BOOKER)
    assigned_warehouse_id: int | None = Field(default=None, foreign_key="warehouses.id")
    # Working/route days an order booker is in the field, e.g. ["Monday", "Thursday"].
    route_days: list[str] = Field(default_factory=list, sa_column=Column(JSON, nullable=False, server_default="[]"))
    is_active: bool = True
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class Product(SQLModel, table=True):
    __tablename__ = "products"

    id: int | None = Field(default=None, primary_key=True)
    category_id: int | None = Field(default=None, foreign_key="product_categories.id")
    name: str = Field(index=True, max_length=160)
    description: str | None = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class SKU(SQLModel, table=True):
    __tablename__ = "skus"

    id: int | None = Field(default=None, primary_key=True)
    product_id: int = Field(foreign_key="products.id", index=True)
    size_mrp: float = Field(index=True)
    flavour: str | None = Field(default=None, index=True, max_length=120)
    pack_quantity: int = Field(default=24, ge=1)
    unit_type: str = Field(default="packet", max_length=40)
    cost_price: float = Field(default=0, ge=0)
    default_sale_rate: float = Field(default=0, ge=0)
    minimum_sale_rate: float = Field(default=0, ge=0)
    sku_code: str | None = Field(default=None, index=True, max_length=80)
    low_stock_threshold: int = Field(default=50)
    is_active: bool = True
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class Shop(SQLModel, table=True):
    __tablename__ = "shops"

    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(index=True, max_length=180)
    owner_name: str | None = None
    phone: str | None = None
    alternate_phone: str | None = None
    address: str | None = None
    area_route: str | None = Field(default=None, index=True)
    gps_latitude: float | None = None
    gps_longitude: float | None = None
    assigned_warehouse_id: int | None = Field(default=None, foreign_key="warehouses.id")
    assigned_order_booker_id: int | None = Field(default=None, foreign_key="users.id")
    # Weekly route days this shop is visited on, e.g. ["Monday", "Thursday"].
    route_days: list[str] = Field(default_factory=list, sa_column=Column(JSON, nullable=False, server_default="[]"))
    credit_limit: float | None = None
    opening_balance: float = 0
    current_balance: float = 0
    notes: str | None = None
    status: ShopStatus = Field(default=ShopStatus.ACTIVE, index=True)
    is_active: bool = True
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class ShopRateRule(SQLModel, table=True):
    __tablename__ = "shop_rate_rules"

    id: int | None = Field(default=None, primary_key=True)
    shop_id: int = Field(foreign_key="shops.id", index=True)
    sku_id: int = Field(foreign_key="skus.id", index=True)
    fixed_sale_rate: float = Field(ge=0)
    minimum_allowed_rate: float = Field(default=0, ge=0)
    effective_from: date = Field(default_factory=date.today)
    is_active: bool = True
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class LastSaleRate(SQLModel, table=True):
    __tablename__ = "last_sale_rates"
    __table_args__ = (UniqueConstraint("shop_id", "sku_id", name="uq_last_sale_shop_sku"),)

    id: int | None = Field(default=None, primary_key=True)
    shop_id: int = Field(foreign_key="shops.id", index=True)
    sku_id: int = Field(foreign_key="skus.id", index=True)
    sale_id: int | None = Field(default=None, foreign_key="sales.id")
    rate: float = Field(ge=0)
    sale_date: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class StockReceipt(SQLModel, table=True):
    __tablename__ = "stock_receipts"

    id: int | None = Field(default=None, primary_key=True)
    date_received: date = Field(default_factory=date.today, index=True)
    warehouse_id: int = Field(foreign_key="warehouses.id", index=True)
    supplier_name: str | None = None
    reference_number: str | None = None
    notes: str | None = None
    created_by_id: int | None = Field(default=None, foreign_key="users.id")
    created_at: datetime = Field(default_factory=utc_now)


class StockReceiptItem(SQLModel, table=True):
    __tablename__ = "stock_receipt_items"

    id: int | None = Field(default=None, primary_key=True)
    stock_receipt_id: int = Field(foreign_key="stock_receipts.id", index=True)
    sku_id: int = Field(foreign_key="skus.id", index=True)
    quantity_received: int = Field(gt=0)
    quantity_unit: str = Field(default="carton", max_length=40)
    pack_quantity: int = Field(default=24, gt=0)
    quantity_packets: int = Field(gt=0)
    cost_per_carton: float = Field(default=0, ge=0)
    cost_per_packet: float = Field(default=0, ge=0)


class InventoryBalance(SQLModel, table=True):
    __tablename__ = "inventory_balances"
    __table_args__ = (UniqueConstraint("warehouse_id", "sku_id", name="uq_inventory_warehouse_sku"),)

    id: int | None = Field(default=None, primary_key=True)
    warehouse_id: int = Field(foreign_key="warehouses.id", index=True)
    sku_id: int = Field(foreign_key="skus.id", index=True)
    quantity_packets: int = 0
    average_cost_per_packet: float = 0
    updated_at: datetime = Field(default_factory=utc_now)


class StockLedger(SQLModel, table=True):
    __tablename__ = "stock_ledger"

    id: int | None = Field(default=None, primary_key=True)
    occurred_at: datetime = Field(default_factory=utc_now, index=True)
    warehouse_id: int = Field(foreign_key="warehouses.id", index=True)
    sku_id: int = Field(foreign_key="skus.id", index=True)
    movement_type: MovementType = Field(index=True)
    quantity_packets: int
    reference_type: str | None = Field(default=None, index=True)
    reference_id: int | None = Field(default=None, index=True)
    cost_rate: float = 0
    created_by_id: int | None = Field(default=None, foreign_key="users.id")
    notes: str | None = None


class Sale(SQLModel, table=True):
    __tablename__ = "sales"

    id: int | None = Field(default=None, primary_key=True)
    sale_date: datetime = Field(default_factory=utc_now, index=True)
    shop_id: int = Field(foreign_key="shops.id", index=True)
    order_booker_id: int | None = Field(default=None, foreign_key="users.id", index=True)
    warehouse_id: int = Field(foreign_key="warehouses.id", index=True)
    status: SaleStatus = Field(default=SaleStatus.BOOKED, index=True)
    gross_amount: float = 0
    discount: float = 0
    net_amount: float = 0
    payment_received: float = 0
    pending_amount: float = 0
    cogs_amount: float = 0
    gross_profit: float = 0
    notes: str | None = None
    reversal_reason: str | None = None
    reversed_by_id: int | None = Field(default=None, foreign_key="users.id")
    reversed_at: datetime | None = None
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class SaleItem(SQLModel, table=True):
    __tablename__ = "sale_items"

    id: int | None = Field(default=None, primary_key=True)
    sale_id: int = Field(foreign_key="sales.id", index=True)
    sku_id: int = Field(foreign_key="skus.id", index=True)
    quantity_packets: int = Field(gt=0)
    pack_quantity: int = Field(default=24, gt=0)
    sale_rate: float = Field(ge=0)
    cost_rate: float = Field(default=0, ge=0)
    line_total: float = 0
    line_profit: float = 0


class SaleReturn(SQLModel, table=True):
    __tablename__ = "sale_returns"

    id: int | None = Field(default=None, primary_key=True)
    sale_id: int = Field(foreign_key="sales.id", index=True)
    return_date: datetime = Field(default_factory=utc_now, index=True)
    reason: str
    returned_by_id: int | None = Field(default=None, foreign_key="users.id", index=True)
    total_amount: float = 0
    cogs_amount: float = 0
    profit_amount: float = 0
    created_at: datetime = Field(default_factory=utc_now)


class SaleReturnItem(SQLModel, table=True):
    __tablename__ = "sale_return_items"

    id: int | None = Field(default=None, primary_key=True)
    sale_return_id: int = Field(foreign_key="sale_returns.id", index=True)
    sale_item_id: int = Field(foreign_key="sale_items.id", index=True)
    sku_id: int = Field(foreign_key="skus.id", index=True)
    quantity_packets: int = Field(gt=0)
    sale_rate: float = Field(ge=0)
    cost_rate: float = Field(default=0, ge=0)
    line_total: float = 0
    line_profit: float = 0


class ShopLedger(SQLModel, table=True):
    __tablename__ = "shop_ledger"

    id: int | None = Field(default=None, primary_key=True)
    occurred_at: datetime = Field(default_factory=utc_now, index=True)
    shop_id: int = Field(foreign_key="shops.id", index=True)
    entry_type: LedgerEntryType = Field(index=True)
    amount: float
    running_balance: float
    reference_type: str | None = Field(default=None, index=True)
    reference_id: int | None = Field(default=None, index=True)
    created_by_id: int | None = Field(default=None, foreign_key="users.id")
    notes: str | None = None


class Payment(SQLModel, table=True):
    __tablename__ = "payments"

    id: int | None = Field(default=None, primary_key=True)
    payment_date: datetime = Field(default_factory=utc_now, index=True)
    shop_id: int = Field(foreign_key="shops.id", index=True)
    amount: float = Field(gt=0)
    method: str = Field(default="cash", max_length=60)
    reference_number: str | None = None
    notes: str | None = None
    created_by_id: int | None = Field(default=None, foreign_key="users.id")
    created_at: datetime = Field(default_factory=utc_now)


class Expense(SQLModel, table=True):
    __tablename__ = "expenses"

    id: int | None = Field(default=None, primary_key=True)
    expense_date: date = Field(default_factory=date.today, index=True)
    category: ExpenseCategory = Field(index=True)
    amount: float = Field(gt=0)
    warehouse_id: int | None = Field(default=None, foreign_key="warehouses.id", index=True)
    order_booker_id: int | None = Field(default=None, foreign_key="users.id", index=True)
    description: str | None = None
    is_deleted: bool = False
    created_by_id: int | None = Field(default=None, foreign_key="users.id")
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class ShopVisit(SQLModel, table=True):
    __tablename__ = "shop_visits"

    id: int | None = Field(default=None, primary_key=True)
    visited_at: datetime = Field(default_factory=utc_now, index=True)
    shop_id: int = Field(foreign_key="shops.id", index=True)
    order_booker_id: int | None = Field(default=None, foreign_key="users.id", index=True)
    status: VisitStatus = Field(index=True)
    gps_latitude: float | None = None
    gps_longitude: float | None = None
    notes: str | None = None
    created_at: datetime = Field(default_factory=utc_now)


class AuditLog(SQLModel, table=True):
    __tablename__ = "audit_logs"

    id: int | None = Field(default=None, primary_key=True)
    user_id: int | None = Field(default=None, foreign_key="users.id", index=True)
    action: str = Field(index=True, max_length=120)
    entity_type: str = Field(index=True, max_length=120)
    entity_id: int | None = Field(default=None, index=True)
    old_values: dict[str, Any] | None = Field(default=None, sa_column=Column(JSON, nullable=True))
    new_values: dict[str, Any] | None = Field(default=None, sa_column=Column(JSON, nullable=True))
    ip_device: str | None = None
    created_at: datetime = Field(default_factory=utc_now, index=True)


class MonthlyClosing(SQLModel, table=True):
    __tablename__ = "monthly_closings"
    __table_args__ = (UniqueConstraint("month_start", name="uq_monthly_closings_month_start"),)

    id: int | None = Field(default=None, primary_key=True)
    month_start: date = Field(index=True)
    month_end: date = Field(index=True)
    status: str = Field(default="BACKUP_PENDING", index=True, max_length=40)
    closed_by_id: int | None = Field(default=None, foreign_key="users.id", index=True)
    closed_at: datetime | None = Field(default=None, index=True)
    backup_filename: str | None = Field(default=None, max_length=255)
    backup_reference: str | None = None
    backup_checksum: str | None = Field(default=None, max_length=64)
    backup_generated_at: datetime | None = None
    summary_totals: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON, nullable=False, server_default="{}"))
    carry_forward_summary: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON, nullable=False, server_default="{}"))
    archive_status: str = Field(default="NOT_ARCHIVED", index=True, max_length=40)
    archive_requested_at: datetime | None = None
    archived_at: datetime | None = None
    archive_note: str | None = None
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class MonthlyShopOpeningBalance(SQLModel, table=True):
    __tablename__ = "monthly_shop_opening_balances"
    __table_args__ = (UniqueConstraint("monthly_closing_id", "shop_id", name="uq_monthly_shop_opening_closing_shop"),)

    id: int | None = Field(default=None, primary_key=True)
    monthly_closing_id: int = Field(foreign_key="monthly_closings.id", index=True)
    month_start: date = Field(index=True)
    shop_id: int = Field(foreign_key="shops.id", index=True)
    opening_balance: float = 0
    created_at: datetime = Field(default_factory=utc_now)


class MonthlyInventoryOpeningBalance(SQLModel, table=True):
    __tablename__ = "monthly_inventory_opening_balances"
    __table_args__ = (UniqueConstraint("monthly_closing_id", "warehouse_id", "sku_id", name="uq_monthly_inventory_opening_closing_wh_sku"),)

    id: int | None = Field(default=None, primary_key=True)
    monthly_closing_id: int = Field(foreign_key="monthly_closings.id", index=True)
    month_start: date = Field(index=True)
    warehouse_id: int = Field(foreign_key="warehouses.id", index=True)
    sku_id: int = Field(foreign_key="skus.id", index=True)
    opening_quantity_packets: int = 0
    opening_average_cost_per_packet: float = 0
    created_at: datetime = Field(default_factory=utc_now)
