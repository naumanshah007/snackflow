from datetime import date
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session, or_, select

from app.database import get_session
from app.dependencies import forbid_order_booker, get_current_user, require_roles, scoped_warehouse_id, username_exists
from app.models import (
    AuditLog,
    Expense,
    Product,
    ProductCategory,
    SKU,
    Shop,
    ShopLedger,
    ShopRateRule,
    ShopStatus,
    User,
    UserRole,
    Warehouse,
    WEEKDAYS,
    normalize_route_days,
    today_weekday,
    utc_now,
)
from app.schemas import (
    ExpenseCreate,
    ExpenseUpdate,
    ProductCreate,
    ProductUpdate,
    RateRuleCreate,
    RateRuleUpdate,
    ResetDataRequest,
    ShopApprovalRequest,
    ShopCreate,
    ShopUpdate,
    SKUCreate,
    SKUUpdate,
    UserCreate,
    UserRead,
    UserUpdate,
    WarehouseCreate,
    WarehouseUpdate,
)
from app.security import hash_password
from app.services.audit import model_snapshot, write_audit
from app.services.ledger import add_shop_ledger_entry
from app.models import LedgerEntryType

router = APIRouter(tags=["admin"])


def _paginate(query, offset: int, limit: int):
    return query.offset(offset).limit(limit)


def _apply_updates(obj: Any, payload: Any) -> dict[str, Any]:
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        if hasattr(obj, key):
            setattr(obj, key, value)
    if hasattr(obj, "updated_at"):
        obj.updated_at = utc_now()
    return data


def _get_or_create_category(session: Session, category_name: str | None) -> ProductCategory | None:
    if not category_name:
        return None
    category = session.exec(select(ProductCategory).where(ProductCategory.name == category_name)).first()
    if category:
        return category
    category = ProductCategory(name=category_name)
    session.add(category)
    session.flush()
    return category


@router.get("/users", response_model=list[UserRead])
def list_users(
    search: str | None = None,
    offset: int = 0,
    limit: int = Query(default=100, le=500),
    _: User = Depends(require_roles(UserRole.OWNER, UserRole.ACCOUNTANT)),
    session: Session = Depends(get_session),
):
    query = select(User)
    if search:
        query = query.where(or_(User.name.ilike(f"%{search}%"), User.username.ilike(f"%{search}%"), User.phone.ilike(f"%{search}%")))
    return session.exec(_paginate(query.order_by(User.id), offset, limit)).all()


@router.post("/users", response_model=UserRead)
def create_user(
    payload: UserCreate,
    current_user: User = Depends(require_roles(UserRole.OWNER)),
    session: Session = Depends(get_session),
):
    if username_exists(session, payload.username):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already exists")
    user = User(
        name=payload.name,
        username=payload.username,
        phone=payload.phone,
        hashed_password=hash_password(payload.password),
        role=payload.role,
        assigned_warehouse_id=payload.assigned_warehouse_id,
        route_days=normalize_route_days(payload.route_days),
        is_active=payload.is_active,
    )
    session.add(user)
    session.flush()
    write_audit(session, current_user, "CREATE", "user", user.id, None, model_snapshot(user))
    session.commit()
    session.refresh(user)
    return user


@router.put("/users/{user_id}", response_model=UserRead)
def update_user(
    user_id: int,
    payload: UserUpdate,
    current_user: User = Depends(require_roles(UserRole.OWNER)),
    session: Session = Depends(get_session),
):
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if payload.username and username_exists(session, payload.username, user_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already exists")
    old = model_snapshot(user)
    data = payload.model_dump(exclude_unset=True)
    # Always remove "password" from the field map: it maps to hashed_password, so
    # setattr(user, "password", ...) would raise. A non-empty value resets the
    # password; a blank/omitted value leaves the current password unchanged.
    new_password = data.pop("password", None)
    if isinstance(new_password, str):
        new_password = new_password.strip()
    if new_password:
        user.hashed_password = hash_password(new_password)
    if "route_days" in data:
        data["route_days"] = normalize_route_days(data["route_days"])
    for key, value in data.items():
        setattr(user, key, value)
    user.updated_at = utc_now()
    session.add(user)
    write_audit(session, current_user, "UPDATE", "user", user.id, old, model_snapshot(user))
    session.commit()
    session.refresh(user)
    return user


@router.delete("/users/{user_id}")
def deactivate_user(
    user_id: int,
    current_user: User = Depends(require_roles(UserRole.OWNER)),
    session: Session = Depends(get_session),
):
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    old = model_snapshot(user)
    user.is_active = False
    user.updated_at = utc_now()
    write_audit(session, current_user, "DEACTIVATE", "user", user.id, old, model_snapshot(user))
    session.commit()
    return {"message": "User deactivated"}


@router.get("/warehouses")
def list_warehouses(
    search: str | None = None,
    offset: int = 0,
    limit: int = Query(default=100, le=500),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    query = select(Warehouse)
    warehouse_id = scoped_warehouse_id(current_user, None)
    if warehouse_id:
        query = query.where(Warehouse.id == warehouse_id)
    if search:
        query = query.where(or_(Warehouse.name.ilike(f"%{search}%"), Warehouse.address.ilike(f"%{search}%")))
    return session.exec(_paginate(query.order_by(Warehouse.id), offset, limit)).all()


@router.post("/warehouses")
def create_warehouse(
    payload: WarehouseCreate,
    current_user: User = Depends(require_roles(UserRole.OWNER)),
    session: Session = Depends(get_session),
):
    warehouse = Warehouse(**payload.model_dump())
    session.add(warehouse)
    session.flush()
    write_audit(session, current_user, "CREATE", "warehouse", warehouse.id, None, model_snapshot(warehouse))
    session.commit()
    session.refresh(warehouse)
    return warehouse


@router.put("/warehouses/{warehouse_id}")
def update_warehouse(
    warehouse_id: int,
    payload: WarehouseUpdate,
    current_user: User = Depends(require_roles(UserRole.OWNER, UserRole.WAREHOUSE_MANAGER)),
    session: Session = Depends(get_session),
):
    warehouse = session.get(Warehouse, warehouse_id)
    if not warehouse:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Warehouse not found")
    old = model_snapshot(warehouse)
    _apply_updates(warehouse, payload)
    write_audit(session, current_user, "UPDATE", "warehouse", warehouse.id, old, model_snapshot(warehouse))
    session.commit()
    session.refresh(warehouse)
    return warehouse


@router.get("/product-categories")
def list_categories(session: Session = Depends(get_session), _: User = Depends(get_current_user)):
    return session.exec(select(ProductCategory).order_by(ProductCategory.name)).all()


@router.get("/products")
def list_products(
    search: str | None = None,
    offset: int = 0,
    limit: int = Query(default=100, le=500),
    _: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    query = select(Product)
    if search:
        query = query.where(Product.name.ilike(f"%{search}%"))
    return session.exec(_paginate(query.order_by(Product.name), offset, limit)).all()


@router.post("/products")
def create_product(
    payload: ProductCreate,
    current_user: User = Depends(require_roles(UserRole.OWNER)),
    session: Session = Depends(get_session),
):
    category = _get_or_create_category(session, payload.category_name)
    product = Product(
        name=payload.name,
        category_id=payload.category_id or (category.id if category else None),
        description=payload.description,
        is_active=payload.is_active,
    )
    session.add(product)
    session.flush()
    write_audit(session, current_user, "CREATE", "product", product.id, None, model_snapshot(product))
    session.commit()
    session.refresh(product)
    return product


@router.put("/products/{product_id}")
def update_product(
    product_id: int,
    payload: ProductUpdate,
    current_user: User = Depends(require_roles(UserRole.OWNER)),
    session: Session = Depends(get_session),
):
    product = session.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    old = model_snapshot(product)
    category = _get_or_create_category(session, payload.category_name)
    data = payload.model_dump(exclude_unset=True, exclude={"category_name"})
    if category:
        data["category_id"] = category.id
    for key, value in data.items():
        setattr(product, key, value)
    product.updated_at = utc_now()
    write_audit(session, current_user, "UPDATE", "product", product.id, old, model_snapshot(product))
    session.commit()
    session.refresh(product)
    return product


@router.get("/skus")
def list_skus(
    search: str | None = None,
    product_id: int | None = None,
    offset: int = 0,
    limit: int = Query(default=200, le=1000),
    _: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    current_user = _
    query = select(SKU)
    if product_id:
        query = query.where(SKU.product_id == product_id)
    if search:
        product_ids = [p.id for p in session.exec(select(Product).where(Product.name.ilike(f"%{search}%"))).all()]
        query = query.where(or_(SKU.flavour.ilike(f"%{search}%"), SKU.sku_code.ilike(f"%{search}%"), SKU.product_id.in_(product_ids)))
    skus = session.exec(_paginate(query.order_by(SKU.product_id, SKU.size_mrp), offset, limit)).all()
    result = []
    for sku in skus:
        product = session.get(Product, sku.product_id)
        data = model_snapshot(sku)
        data["product_name"] = product.name if product else ""
        data["display_name"] = f"{data['product_name']} Rs {sku.size_mrp:g} {sku.flavour or ''} - {sku.pack_quantity} Pack".strip()
        pack = sku.pack_quantity or 1
        # Carton-first pricing: the business sells in cartons, packets are stored internally.
        data["cost_per_carton"] = round(sku.cost_price * pack, 2)
        data["default_sale_rate_per_carton"] = round(sku.default_sale_rate * pack, 2)
        data["minimum_sale_rate_per_carton"] = round(sku.minimum_sale_rate * pack, 2)
        if current_user.role == UserRole.ORDER_BOOKER:
            for internal_key in ("cost_price", "cost_per_carton", "minimum_sale_rate", "minimum_sale_rate_per_carton"):
                data.pop(internal_key, None)
        result.append(data)
    return result


@router.post("/skus")
def create_sku(
    payload: SKUCreate,
    current_user: User = Depends(require_roles(UserRole.OWNER)),
    session: Session = Depends(get_session),
):
    if not session.get(Product, payload.product_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    sku = SKU(**payload.model_dump())
    session.add(sku)
    session.flush()
    write_audit(session, current_user, "CREATE", "sku", sku.id, None, model_snapshot(sku))
    session.commit()
    session.refresh(sku)
    return sku


@router.put("/skus/{sku_id}")
def update_sku(
    sku_id: int,
    payload: SKUUpdate,
    current_user: User = Depends(require_roles(UserRole.OWNER)),
    session: Session = Depends(get_session),
):
    sku = session.get(SKU, sku_id)
    if not sku:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="SKU not found")
    old = model_snapshot(sku)
    _apply_updates(sku, payload)
    write_audit(session, current_user, "UPDATE", "sku", sku.id, old, model_snapshot(sku))
    session.commit()
    session.refresh(sku)
    return sku


@router.get("/skus/{sku_id}/history")
def sku_history(
    sku_id: int,
    _: User = Depends(require_roles(UserRole.OWNER, UserRole.ACCOUNTANT)),
    session: Session = Depends(get_session),
):
    return session.exec(
        select(AuditLog)
        .where(AuditLog.entity_type == "sku", AuditLog.entity_id == sku_id)
        .order_by(AuditLog.created_at.desc())
    ).all()


@router.get("/shops")
def list_shops(
    search: str | None = None,
    warehouse_id: int | None = None,
    order_booker_id: int | None = None,
    status_filter: ShopStatus | None = None,
    route_day: str | None = None,
    offset: int = 0,
    limit: int = Query(default=200, le=1000),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    query = select(Shop)
    scoped = scoped_warehouse_id(current_user, warehouse_id)
    if scoped:
        query = query.where(Shop.assigned_warehouse_id == scoped)
    if current_user.role == UserRole.ORDER_BOOKER:
        query = query.where(Shop.assigned_order_booker_id == current_user.id)
    elif order_booker_id:
        query = query.where(Shop.assigned_order_booker_id == order_booker_id)
    if status_filter:
        query = query.where(Shop.status == status_filter)
    if search:
        query = query.where(or_(Shop.name.ilike(f"%{search}%"), Shop.owner_name.ilike(f"%{search}%"), Shop.area_route.ilike(f"%{search}%")))
    shops = session.exec(_paginate(query.order_by(Shop.name), offset, limit)).all()
    # route_days is a JSON column, so filter in Python for portable SQLite/Postgres behaviour.
    if route_day:
        wanted = route_day.strip().capitalize()
        shops = [shop for shop in shops if wanted in (shop.route_days or [])]
    return shops


@router.get("/shops-by-route-day")
def shops_by_route_day(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Group active shops by route day for a simple weekly route plan view.

    Shops with no route days are surfaced under ``Unassigned`` so they are never
    silently hidden from the plan.
    """
    query = select(Shop).where(Shop.is_active == True)  # noqa: E712
    scoped = scoped_warehouse_id(current_user, None)
    if scoped:
        query = query.where(Shop.assigned_warehouse_id == scoped)
    if current_user.role == UserRole.ORDER_BOOKER:
        query = query.where(Shop.assigned_order_booker_id == current_user.id)
    shops = session.exec(query.order_by(Shop.name)).all()

    buckets: dict[str, list[dict]] = {day: [] for day in WEEKDAYS}
    buckets["Unassigned"] = []
    for shop in shops:
        days = shop.route_days or []
        entry = {
            "id": shop.id,
            "name": shop.name,
            "area_route": shop.area_route,
            "status": shop.status,
            "assigned_order_booker_id": shop.assigned_order_booker_id,
        }
        if not days:
            buckets["Unassigned"].append(entry)
        for day in days:
            if day in buckets:
                buckets[day].append(entry)
    return {
        "today": today_weekday(),
        "days": [{"day": day, "shops": buckets[day]} for day in WEEKDAYS] + [{"day": "Unassigned", "shops": buckets["Unassigned"]}],
    }


@router.get("/my-route")
def my_route(
    day: str | None = None,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Today's route for the current order booker: active assigned shops whose
    route day matches today (or the requested ``day``)."""
    target_day = (day or today_weekday()).strip().capitalize()
    query = select(Shop).where(Shop.is_active == True, Shop.status == ShopStatus.ACTIVE)  # noqa: E712
    if current_user.role == UserRole.ORDER_BOOKER:
        query = query.where(Shop.assigned_order_booker_id == current_user.id)
    shops = session.exec(query.order_by(Shop.name)).all()
    route_shops = [shop for shop in shops if target_day in (shop.route_days or [])]
    return {
        "day": target_day,
        "count": len(route_shops),
        "shops": [
            {
                "id": shop.id,
                "name": shop.name,
                "owner_name": shop.owner_name,
                "phone": shop.phone,
                "area_route": shop.area_route,
                "address": shop.address,
                "current_balance": shop.current_balance,
                "gps_latitude": shop.gps_latitude,
                "gps_longitude": shop.gps_longitude,
                "route_days": shop.route_days or [],
            }
            for shop in route_shops
        ],
    }


@router.post("/shops")
def create_shop(
    payload: ShopCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    if current_user.role not in {UserRole.OWNER, UserRole.ORDER_BOOKER}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    data = payload.model_dump()
    data["route_days"] = normalize_route_days(data.get("route_days"))
    if current_user.role == UserRole.ORDER_BOOKER:
        # Order bookers can register new shops on their own route only. The shop
        # is scoped to their warehouse + themselves and waits for admin approval.
        if not current_user.assigned_warehouse_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Order booker has no assigned warehouse")
        data["assigned_warehouse_id"] = current_user.assigned_warehouse_id
        data["assigned_order_booker_id"] = current_user.id
        shop = Shop(**data, current_balance=0, status=ShopStatus.PENDING_APPROVAL)
    else:
        shop = Shop(**data, current_balance=0, status=ShopStatus.ACTIVE)
    session.add(shop)
    session.flush()
    if payload.opening_balance:
        add_shop_ledger_entry(
            session,
            shop=shop,
            entry_type=LedgerEntryType.OPENING_BALANCE,
            amount=payload.opening_balance,
            reference_type="opening_balance",
            reference_id=shop.id,
            user=current_user,
            notes="Opening balance",
        )
    write_audit(session, current_user, "CREATE", "shop", shop.id, None, model_snapshot(shop))
    session.commit()
    session.refresh(shop)
    return shop


@router.get("/shops/{shop_id}")
def get_shop(shop_id: int, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    shop = session.get(Shop, shop_id)
    if not shop:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shop not found")
    if current_user.role == UserRole.ORDER_BOOKER and shop.assigned_order_booker_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Shop is outside your route")
    return shop


@router.put("/shops/{shop_id}")
def update_shop(
    shop_id: int,
    payload: ShopUpdate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    if current_user.role not in {UserRole.OWNER, UserRole.ORDER_BOOKER}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    shop = session.get(Shop, shop_id)
    if not shop:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shop not found")
    data = payload.model_dump(exclude_unset=True)
    if current_user.role == UserRole.ORDER_BOOKER:
        # Order bookers may edit their own shop details but cannot self-approve
        # or reassign the shop to another warehouse/booker.
        if shop.assigned_order_booker_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Shop is outside your route")
        for protected in ("status", "assigned_warehouse_id", "assigned_order_booker_id"):
            data.pop(protected, None)
    if "route_days" in data:
        data["route_days"] = normalize_route_days(data["route_days"])
    old = model_snapshot(shop)
    for key, value in data.items():
        if hasattr(shop, key):
            setattr(shop, key, value)
    shop.updated_at = utc_now()
    write_audit(session, current_user, "UPDATE", "shop", shop.id, old, model_snapshot(shop))
    session.commit()
    session.refresh(shop)
    return shop


@router.post("/shops/{shop_id}/approval")
def set_shop_approval(
    shop_id: int,
    payload: ShopApprovalRequest,
    current_user: User = Depends(require_roles(UserRole.OWNER, UserRole.ACCOUNTANT)),
    session: Session = Depends(get_session),
):
    shop = session.get(Shop, shop_id)
    if not shop:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shop not found")
    old = model_snapshot(shop)
    shop.status = payload.status
    # A rejected shop is also deactivated so it never appears in sale pickers.
    shop.is_active = payload.status != ShopStatus.REJECTED
    if payload.notes:
        shop.notes = (f"{shop.notes}\n" if shop.notes else "") + payload.notes
    shop.updated_at = utc_now()
    write_audit(session, current_user, "APPROVAL", "shop", shop.id, old, model_snapshot(shop))
    session.commit()
    session.refresh(shop)
    return shop


@router.get("/shops/{shop_id}/ledger")
def shop_ledger(
    shop_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    forbid_order_booker(current_user)
    return session.exec(select(ShopLedger).where(ShopLedger.shop_id == shop_id).order_by(ShopLedger.occurred_at.desc())).all()


@router.get("/shops/{shop_id}/last-rates")
def shop_last_rates(shop_id: int, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    from app.models import LastSaleRate

    shop = session.get(Shop, shop_id)
    if current_user.role == UserRole.ORDER_BOOKER and (not shop or shop.assigned_order_booker_id != current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Shop is outside your route")
    rates = session.exec(select(LastSaleRate).where(LastSaleRate.shop_id == shop_id)).all()
    result = []
    for rate in rates:
        sku = session.get(SKU, rate.sku_id)
        product = session.get(Product, sku.product_id) if sku else None
        result.append(
            {
                "shop_id": shop_id,
                "sku_id": rate.sku_id,
                "rate": rate.rate,
                "sale_date": rate.sale_date,
                "sku_name": f"{product.name if product else ''} Rs {sku.size_mrp:g} {sku.flavour or ''}".strip() if sku else "",
            }
        )
    return result


@router.get("/rates")
def list_rates(
    shop_id: int | None = None,
    sku_id: int | None = None,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    forbid_order_booker(current_user)
    query = select(ShopRateRule)
    if shop_id:
        query = query.where(ShopRateRule.shop_id == shop_id)
    if sku_id:
        query = query.where(ShopRateRule.sku_id == sku_id)
    return session.exec(query.order_by(ShopRateRule.effective_from.desc())).all()


@router.post("/rates")
def create_rate(
    payload: RateRuleCreate,
    current_user: User = Depends(require_roles(UserRole.OWNER)),
    session: Session = Depends(get_session),
):
    rate = ShopRateRule(**payload.model_dump())
    session.add(rate)
    session.flush()
    write_audit(session, current_user, "CREATE", "rate_rule", rate.id, None, model_snapshot(rate))
    session.commit()
    session.refresh(rate)
    return rate


@router.put("/rates/{rate_id}")
def update_rate(
    rate_id: int,
    payload: RateRuleUpdate,
    current_user: User = Depends(require_roles(UserRole.OWNER)),
    session: Session = Depends(get_session),
):
    rate = session.get(ShopRateRule, rate_id)
    if not rate:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rate rule not found")
    old = model_snapshot(rate)
    _apply_updates(rate, payload)
    write_audit(session, current_user, "UPDATE", "rate_rule", rate.id, old, model_snapshot(rate))
    session.commit()
    session.refresh(rate)
    return rate


@router.get("/rates/{rate_id}/history")
def rate_history(rate_id: int, _: User = Depends(require_roles(UserRole.OWNER, UserRole.ACCOUNTANT)), session: Session = Depends(get_session)):
    return session.exec(
        select(AuditLog).where(AuditLog.entity_type == "rate_rule", AuditLog.entity_id == rate_id).order_by(AuditLog.created_at.desc())
    ).all()


@router.get("/rates/shop/{shop_id}/sku/{sku_id}")
def get_rate_context(shop_id: int, sku_id: int, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    from app.models import LastSaleRate

    sku = session.get(SKU, sku_id)
    shop = session.get(Shop, shop_id)
    if current_user.role == UserRole.ORDER_BOOKER and (not shop or shop.assigned_order_booker_id != current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Shop is outside your route")
    fixed = session.exec(
        select(ShopRateRule)
        .where(ShopRateRule.shop_id == shop_id, ShopRateRule.sku_id == sku_id, ShopRateRule.is_active == True)  # noqa: E712
        .order_by(ShopRateRule.effective_from.desc())
    ).first()
    last = session.exec(select(LastSaleRate).where(LastSaleRate.shop_id == shop_id, LastSaleRate.sku_id == sku_id)).first()
    data = {
        "sku_id": sku_id,
        "shop_id": shop_id,
        "default_sale_rate": sku.default_sale_rate if sku else 0,
        "minimum_sale_rate": fixed.minimum_allowed_rate if fixed else (sku.minimum_sale_rate if sku else 0),
        "fixed_sale_rate": fixed.fixed_sale_rate if fixed else None,
        "last_sale_rate": last.rate if last else None,
    }
    if current_user.role == UserRole.ORDER_BOOKER:
        data.pop("minimum_sale_rate", None)
    return data


@router.get("/expenses")
def list_expenses(
    date_from: date | None = None,
    date_to: date | None = None,
    warehouse_id: int | None = None,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    forbid_order_booker(current_user)
    query = select(Expense).where(Expense.is_deleted == False)  # noqa: E712
    scoped = scoped_warehouse_id(current_user, warehouse_id)
    if scoped:
        query = query.where(Expense.warehouse_id == scoped)
    if date_from:
        query = query.where(Expense.expense_date >= date_from)
    if date_to:
        query = query.where(Expense.expense_date <= date_to)
    return session.exec(query.order_by(Expense.expense_date.desc())).all()


@router.post("/expenses")
def create_expense(
    payload: ExpenseCreate,
    current_user: User = Depends(require_roles(UserRole.OWNER, UserRole.ACCOUNTANT, UserRole.WAREHOUSE_MANAGER)),
    session: Session = Depends(get_session),
):
    expense = Expense(**payload.model_dump(), created_by_id=current_user.id)
    session.add(expense)
    session.flush()
    write_audit(session, current_user, "CREATE", "expense", expense.id, None, model_snapshot(expense))
    session.commit()
    session.refresh(expense)
    return expense


@router.put("/expenses/{expense_id}")
def update_expense(
    expense_id: int,
    payload: ExpenseUpdate,
    current_user: User = Depends(require_roles(UserRole.OWNER, UserRole.ACCOUNTANT)),
    session: Session = Depends(get_session),
):
    expense = session.get(Expense, expense_id)
    if not expense or expense.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Expense not found")
    old = model_snapshot(expense)
    _apply_updates(expense, payload)
    write_audit(session, current_user, "UPDATE", "expense", expense.id, old, model_snapshot(expense))
    session.commit()
    session.refresh(expense)
    return expense


@router.delete("/expenses/{expense_id}")
def delete_expense(
    expense_id: int,
    current_user: User = Depends(require_roles(UserRole.OWNER, UserRole.ACCOUNTANT)),
    session: Session = Depends(get_session),
):
    expense = session.get(Expense, expense_id)
    if not expense:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Expense not found")
    old = model_snapshot(expense)
    expense.is_deleted = True
    expense.updated_at = utc_now()
    write_audit(session, current_user, "VOID", "expense", expense.id, old, model_snapshot(expense))
    session.commit()
    return {"message": "Expense voided"}


@router.post("/reset-data")
def reset_data_endpoint(
    payload: ResetDataRequest,
    current_user: User = Depends(require_roles(UserRole.OWNER)),
    session: Session = Depends(get_session),
):
    """Clear demo/test data so the owner can start fresh. Owner only; requires
    an explicit ``confirm: "RESET"`` so it cannot fire accidentally."""
    from app.services.maintenance import reset_data

    if payload.confirm != "RESET":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Type RESET to confirm clearing data')
    return reset_data(session, payload.scope, current_user)


@router.get("/audit-logs")
def audit_logs(
    entity_type: str | None = None,
    entity_id: int | None = None,
    offset: int = 0,
    limit: int = Query(default=100, le=500),
    _: User = Depends(require_roles(UserRole.OWNER, UserRole.ACCOUNTANT)),
    session: Session = Depends(get_session),
):
    query = select(AuditLog)
    if entity_type:
        query = query.where(AuditLog.entity_type == entity_type)
    if entity_id:
        query = query.where(AuditLog.entity_id == entity_id)
    return session.exec(_paginate(query.order_by(AuditLog.created_at.desc()), offset, limit)).all()
