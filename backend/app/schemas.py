from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.models import ExpenseCategory, SaleStatus, UserRole, VisitStatus


class TokenRead(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6)


class UserCreate(BaseModel):
    name: str
    username: str
    password: str = Field(min_length=4)
    phone: str | None = None
    role: UserRole = UserRole.ORDER_BOOKER
    assigned_warehouse_id: int | None = None
    is_active: bool = True


class UserUpdate(BaseModel):
    name: str | None = None
    username: str | None = None
    password: str | None = None
    phone: str | None = None
    role: UserRole | None = None
    assigned_warehouse_id: int | None = None
    is_active: bool | None = None


class UserRead(BaseModel):
    id: int
    name: str
    username: str
    phone: str | None
    role: UserRole
    assigned_warehouse_id: int | None
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class WarehouseCreate(BaseModel):
    name: str
    address: str | None = None
    manager: str | None = None
    phone: str | None = None
    is_active: bool = True


class WarehouseUpdate(BaseModel):
    name: str | None = None
    address: str | None = None
    manager: str | None = None
    phone: str | None = None
    is_active: bool | None = None


class ProductCreate(BaseModel):
    name: str
    category_id: int | None = None
    category_name: str | None = None
    description: str | None = None
    is_active: bool = True


class ProductUpdate(BaseModel):
    name: str | None = None
    category_id: int | None = None
    category_name: str | None = None
    description: str | None = None
    is_active: bool | None = None


class SKUCreate(BaseModel):
    product_id: int
    size_mrp: float = Field(ge=0)
    flavour: str | None = None
    pack_quantity: int = Field(default=24, gt=0)
    unit_type: str = "packet"
    cost_price: float = Field(default=0, ge=0)
    default_sale_rate: float = Field(default=0, ge=0)
    minimum_sale_rate: float = Field(default=0, ge=0)
    sku_code: str | None = None
    low_stock_threshold: int = 50
    is_active: bool = True


class SKUUpdate(BaseModel):
    product_id: int | None = None
    size_mrp: float | None = Field(default=None, ge=0)
    flavour: str | None = None
    pack_quantity: int | None = Field(default=None, gt=0)
    unit_type: str | None = None
    cost_price: float | None = Field(default=None, ge=0)
    default_sale_rate: float | None = Field(default=None, ge=0)
    minimum_sale_rate: float | None = Field(default=None, ge=0)
    sku_code: str | None = None
    low_stock_threshold: int | None = None
    is_active: bool | None = None


class ShopCreate(BaseModel):
    name: str
    owner_name: str | None = None
    phone: str | None = None
    alternate_phone: str | None = None
    address: str | None = None
    area_route: str | None = None
    gps_latitude: float | None = None
    gps_longitude: float | None = None
    assigned_warehouse_id: int | None = None
    assigned_order_booker_id: int | None = None
    credit_limit: float | None = None
    opening_balance: float = 0
    notes: str | None = None
    is_active: bool = True


class ShopUpdate(BaseModel):
    name: str | None = None
    owner_name: str | None = None
    phone: str | None = None
    alternate_phone: str | None = None
    address: str | None = None
    area_route: str | None = None
    gps_latitude: float | None = None
    gps_longitude: float | None = None
    assigned_warehouse_id: int | None = None
    assigned_order_booker_id: int | None = None
    credit_limit: float | None = None
    opening_balance: float | None = None
    notes: str | None = None
    is_active: bool | None = None


class RateRuleCreate(BaseModel):
    shop_id: int
    sku_id: int
    fixed_sale_rate: float = Field(ge=0)
    minimum_allowed_rate: float = Field(default=0, ge=0)
    effective_from: date = Field(default_factory=date.today)
    is_active: bool = True


class RateRuleUpdate(BaseModel):
    shop_id: int | None = None
    sku_id: int | None = None
    fixed_sale_rate: float | None = Field(default=None, ge=0)
    minimum_allowed_rate: float | None = Field(default=None, ge=0)
    effective_from: date | None = None
    is_active: bool | None = None


class StockReceiptItemCreate(BaseModel):
    sku_id: int
    quantity_received: int = Field(gt=0)
    quantity_unit: str = "carton"
    pack_quantity: int | None = Field(default=None, gt=0)
    cost_per_carton: float | None = Field(default=None, ge=0)
    cost_per_packet: float | None = Field(default=None, ge=0)


class StockReceiptCreate(BaseModel):
    date_received: date = Field(default_factory=date.today)
    warehouse_id: int
    supplier_name: str | None = None
    reference_number: str | None = None
    notes: str | None = None
    items: list[StockReceiptItemCreate]


class StockAdjustmentCreate(BaseModel):
    warehouse_id: int
    sku_id: int
    quantity_packets: int
    notes: str | None = None


class SaleItemCreate(BaseModel):
    sku_id: int
    quantity_packets: int = Field(gt=0)
    sale_rate: float = Field(ge=0)


class SaleCreate(BaseModel):
    shop_id: int
    warehouse_id: int | None = None
    status: SaleStatus = SaleStatus.BOOKED
    discount: float = Field(default=0, ge=0)
    payment_received: float = Field(default=0, ge=0)
    notes: str | None = None
    items: list[SaleItemCreate]


class SaleUpdate(BaseModel):
    status: SaleStatus | None = None
    notes: str | None = None


class ReverseSaleRequest(BaseModel):
    reason: str


class SaleReturnItemCreate(BaseModel):
    sale_item_id: int
    quantity_packets: int = Field(gt=0)


class SaleReturnCreate(BaseModel):
    reason: str
    items: list[SaleReturnItemCreate]


class PaymentCreate(BaseModel):
    shop_id: int
    amount: float = Field(gt=0)
    method: str = "cash"
    reference_number: str | None = None
    notes: str | None = None


class ExpenseCreate(BaseModel):
    expense_date: date = Field(default_factory=date.today)
    category: ExpenseCategory
    amount: float = Field(gt=0)
    warehouse_id: int | None = None
    order_booker_id: int | None = None
    description: str | None = None


class ExpenseUpdate(BaseModel):
    expense_date: date | None = None
    category: ExpenseCategory | None = None
    amount: float | None = Field(default=None, gt=0)
    warehouse_id: int | None = None
    order_booker_id: int | None = None
    description: str | None = None


class VisitCreate(BaseModel):
    shop_id: int
    status: VisitStatus
    gps_latitude: float | None = None
    gps_longitude: float | None = None
    notes: str | None = None


class AuditLogRead(BaseModel):
    id: int
    user_id: int | None
    action: str
    entity_type: str
    entity_id: int | None
    old_values: dict[str, Any] | None
    new_values: dict[str, Any] | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
