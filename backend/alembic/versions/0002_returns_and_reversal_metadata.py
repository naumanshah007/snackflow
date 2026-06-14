"""returns and reversal metadata

Revision ID: 0002_returns
Revises: 0001_initial
Create Date: 2026-06-14
"""

from alembic import op
import sqlalchemy as sa

revision = "0002_returns"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if op.get_bind().dialect.name == "sqlite":
        with op.batch_alter_table("sales") as batch_op:
            batch_op.add_column(sa.Column("reversed_by_id", sa.Integer(), nullable=True))
            batch_op.add_column(sa.Column("reversed_at", sa.DateTime(), nullable=True))
            batch_op.create_foreign_key("fk_sales_reversed_by_id_users", "users", ["reversed_by_id"], ["id"])
    else:
        op.add_column("sales", sa.Column("reversed_by_id", sa.Integer(), nullable=True))
        op.add_column("sales", sa.Column("reversed_at", sa.DateTime(), nullable=True))
        op.create_foreign_key("fk_sales_reversed_by_id_users", "sales", "users", ["reversed_by_id"], ["id"])

    op.create_table(
        "sale_returns",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("sale_id", sa.Integer(), nullable=False),
        sa.Column("return_date", sa.DateTime(), nullable=False),
        sa.Column("reason", sa.String(), nullable=False),
        sa.Column("returned_by_id", sa.Integer(), nullable=True),
        sa.Column("total_amount", sa.Float(), nullable=False),
        sa.Column("cogs_amount", sa.Float(), nullable=False),
        sa.Column("profit_amount", sa.Float(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["returned_by_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["sale_id"], ["sales.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_sale_returns_sale_id", "sale_returns", ["sale_id"])
    op.create_index("ix_sale_returns_return_date", "sale_returns", ["return_date"])
    op.create_index("ix_sale_returns_returned_by_id", "sale_returns", ["returned_by_id"])

    op.create_table(
        "sale_return_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("sale_return_id", sa.Integer(), nullable=False),
        sa.Column("sale_item_id", sa.Integer(), nullable=False),
        sa.Column("sku_id", sa.Integer(), nullable=False),
        sa.Column("quantity_packets", sa.Integer(), nullable=False),
        sa.Column("sale_rate", sa.Float(), nullable=False),
        sa.Column("cost_rate", sa.Float(), nullable=False),
        sa.Column("line_total", sa.Float(), nullable=False),
        sa.Column("line_profit", sa.Float(), nullable=False),
        sa.ForeignKeyConstraint(["sale_item_id"], ["sale_items.id"]),
        sa.ForeignKeyConstraint(["sale_return_id"], ["sale_returns.id"]),
        sa.ForeignKeyConstraint(["sku_id"], ["skus.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_sale_return_items_sale_return_id", "sale_return_items", ["sale_return_id"])
    op.create_index("ix_sale_return_items_sale_item_id", "sale_return_items", ["sale_item_id"])
    op.create_index("ix_sale_return_items_sku_id", "sale_return_items", ["sku_id"])


def downgrade() -> None:
    op.drop_index("ix_sale_return_items_sku_id", table_name="sale_return_items")
    op.drop_index("ix_sale_return_items_sale_item_id", table_name="sale_return_items")
    op.drop_index("ix_sale_return_items_sale_return_id", table_name="sale_return_items")
    op.drop_table("sale_return_items")
    op.drop_index("ix_sale_returns_returned_by_id", table_name="sale_returns")
    op.drop_index("ix_sale_returns_return_date", table_name="sale_returns")
    op.drop_index("ix_sale_returns_sale_id", table_name="sale_returns")
    op.drop_table("sale_returns")
    if op.get_bind().dialect.name == "sqlite":
        with op.batch_alter_table("sales") as batch_op:
            batch_op.drop_constraint("fk_sales_reversed_by_id_users", type_="foreignkey")
            batch_op.drop_column("reversed_at")
            batch_op.drop_column("reversed_by_id")
    else:
        op.drop_constraint("fk_sales_reversed_by_id_users", "sales", type_="foreignkey")
        op.drop_column("sales", "reversed_at")
        op.drop_column("sales", "reversed_by_id")
