from itertools import cycle

from sqlmodel import Session, select

from app.database import create_db_and_tables, engine
from app.models import (
    ExpenseCategory,
    Expense,
    Payment,
    Product,
    ProductCategory,
    SKU,
    Sale,
    Shop,
    ShopRateRule,
    User,
    UserRole,
    Warehouse,
)
from app.schemas import PaymentCreate, SaleCreate, SaleItemCreate, StockReceiptCreate, StockReceiptItemCreate
from app.security import hash_password
from app.services.payments import create_payment
from app.services.sales import confirm_sale, create_sale
from app.services.stock import receive_stock


PRODUCT_MATRIX = {
    "Chips": {"sizes": [20, 30, 50, 70, 100], "flavours": ["saltish", "masala", "BBQ", "yogurt and herb", "cheese"]},
    "Barbeta": {"sizes": [20, 30, 50, 100], "flavours": [None]},
    "Peri Peri": {"sizes": [20, 30, 50], "flavours": ["chatni chaska", "toofani mirch", "flamin hot"]},
    "Slanty": {"sizes": [20, 30, 50], "flavours": ["salty", "vege"]},
    "Nimco": {"sizes": [20, 50, 100], "flavours": [None]},
    "Unique Nimco": {"sizes": [20], "flavours": [None]},
    "Potato Stick": {"sizes": [20, 30, 50], "flavours": [None]},
    "Daal Mong": {"sizes": [20, 50], "flavours": [None]},
    "Peanut": {"sizes": [50], "flavours": [None]},
    "Corn Stick": {"sizes": [50], "flavours": [None]},
}


def get_or_create(session: Session, model, defaults: dict | None = None, **lookup):
    obj = session.exec(select(model).filter_by(**lookup)).first()
    if obj:
        return obj
    obj = model(**lookup, **(defaults or {}))
    session.add(obj)
    session.flush()
    return obj


def seed() -> None:
    create_db_and_tables()
    with Session(engine) as session:
        warehouse_1 = get_or_create(session, Warehouse, name="Warehouse 1", defaults={"address": "Main distribution depot", "manager": "Warehouse Manager 1"})
        warehouse_2 = get_or_create(session, Warehouse, name="Warehouse 2", defaults={"address": "Secondary distribution depot", "manager": "Warehouse Manager 2"})

        admin = get_or_create(
            session,
            User,
            username="admin",
            defaults={
                "name": "Owner Admin",
                "phone": "03000000000",
                "hashed_password": hash_password("admin123"),
                "role": UserRole.OWNER,
            },
        )
        booker_1 = get_or_create(
            session,
            User,
            username="booker1",
            defaults={
                "name": "Booker 1",
                "phone": "03000000001",
                "hashed_password": hash_password("booker123"),
                "role": UserRole.ORDER_BOOKER,
                "assigned_warehouse_id": warehouse_1.id,
            },
        )
        booker_2 = get_or_create(
            session,
            User,
            username="booker2",
            defaults={
                "name": "Booker 2",
                "phone": "03000000002",
                "hashed_password": hash_password("booker123"),
                "role": UserRole.ORDER_BOOKER,
                "assigned_warehouse_id": warehouse_2.id,
            },
        )

        category = get_or_create(session, ProductCategory, name="Snacks")
        pack_cycle = cycle([12, 18, 20, 24, 26])
        seeded_skus: list[SKU] = []
        for product_name, config in PRODUCT_MATRIX.items():
            product = get_or_create(session, Product, name=product_name, defaults={"category_id": category.id})
            for size in config["sizes"]:
                for flavour in config["flavours"]:
                    exists = session.exec(
                        select(SKU).where(SKU.product_id == product.id, SKU.size_mrp == size, SKU.flavour == flavour)
                    ).first()
                    if exists:
                        seeded_skus.append(exists)
                        continue
                    pack_quantity = next(pack_cycle)
                    sku = SKU(
                        product_id=product.id,
                        size_mrp=size,
                        flavour=flavour,
                        pack_quantity=pack_quantity,
                        cost_price=round(size * 0.62, 2),
                        default_sale_rate=round(size * 0.82, 2),
                        minimum_sale_rate=round(size * 0.72, 2),
                        sku_code=f"{product_name[:3].upper().replace(' ', '')}-{size}-{(flavour or 'STD')[:3].upper()}",
                        low_stock_threshold=pack_quantity * 2,
                    )
                    session.add(sku)
                    session.flush()
                    seeded_skus.append(sku)

        shops = [
            Shop(
                name="Al Madina Store",
                owner_name="Rashid",
                phone="03001234567",
                area_route="Route A",
                address="Main Market",
                gps_latitude=31.5204,
                gps_longitude=74.3587,
                assigned_warehouse_id=warehouse_1.id,
                assigned_order_booker_id=booker_1.id,
                opening_balance=1500,
                current_balance=1500,
            ),
            Shop(
                name="City Super Mart",
                owner_name="Kamran",
                phone="03007654321",
                area_route="Route B",
                address="Commercial Area",
                gps_latitude=31.4504,
                gps_longitude=74.3001,
                assigned_warehouse_id=warehouse_2.id,
                assigned_order_booker_id=booker_2.id,
                opening_balance=500,
                current_balance=500,
            ),
        ]
        for shop in shops:
            existing = session.exec(select(Shop).where(Shop.name == shop.name)).first()
            if not existing:
                session.add(shop)
        session.commit()

        first_shop = session.exec(select(Shop).where(Shop.name == "Al Madina Store")).first()
        if first_shop and seeded_skus:
            existing_rate = session.exec(select(ShopRateRule).where(ShopRateRule.shop_id == first_shop.id, ShopRateRule.sku_id == seeded_skus[0].id)).first()
            if not existing_rate:
                session.add(ShopRateRule(shop_id=first_shop.id, sku_id=seeded_skus[0].id, fixed_sale_rate=18, minimum_allowed_rate=16))
                session.commit()

        # Keep seed idempotent by checking whether inventory already exists through stock receipts.
        from app.models import StockReceipt

        if not session.exec(select(StockReceipt)).first():
            sample_items = [
                StockReceiptItemCreate(sku_id=sku.id, quantity_received=8, quantity_unit="carton", pack_quantity=sku.pack_quantity, cost_per_packet=sku.cost_price)
                for sku in seeded_skus[:12]
            ]
            receive_stock(
                session,
                StockReceiptCreate(
                    warehouse_id=warehouse_1.id,
                    supplier_name="Opening Stock",
                    reference_number="OPEN-W1",
                    items=sample_items,
                ),
                admin,
            )
            sample_items_2 = [
                StockReceiptItemCreate(sku_id=sku.id, quantity_received=6, quantity_unit="carton", pack_quantity=sku.pack_quantity, cost_per_packet=sku.cost_price)
                for sku in seeded_skus[12:24]
            ]
            receive_stock(
                session,
                StockReceiptCreate(
                    warehouse_id=warehouse_2.id,
                    supplier_name="Opening Stock",
                    reference_number="OPEN-W2",
                    items=sample_items_2,
                ),
                admin,
            )

        first_shop = session.exec(select(Shop).where(Shop.name == "Al Madina Store")).first()
        if first_shop and seeded_skus and not session.exec(select(Sale)).first():
            sample_sale = create_sale(
                session,
                SaleCreate(
                    shop_id=first_shop.id,
                    warehouse_id=warehouse_1.id,
                    payment_received=50,
                    notes="Sample delivered sale from seed data",
                    items=[SaleItemCreate(sku_id=seeded_skus[0].id, quantity_packets=6, sale_rate=seeded_skus[0].default_sale_rate)],
                ),
                booker_1,
            )
            confirm_sale(session, sample_sale.id, booker_1)

        if first_shop and not session.exec(select(Payment)).first():
            create_payment(session, PaymentCreate(shop_id=first_shop.id, amount=100, method="cash", notes="Sample recovery payment"), admin)

        if not session.exec(select(Expense)).first():
            session.add(Expense(category=ExpenseCategory.PETROL, amount=750, description="Sample petrol expense", warehouse_id=warehouse_1.id, created_by_id=admin.id))
            session.commit()

        print("Seed complete: admin/admin123, booker1/booker123, booker2/booker123")


if __name__ == "__main__":
    seed()
