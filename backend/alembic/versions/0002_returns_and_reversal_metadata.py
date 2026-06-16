"""returns and reversal metadata

Revision ID: 0002_returns
Revises: 0001_initial
Create Date: 2026-06-14

Note: 0001_initial builds the full current schema via
``SQLModel.metadata.create_all``. These incremental operations are therefore
guarded so the chain runs cleanly whether or not the objects already exist.
"""

from alembic import op
import sqlalchemy as sa

revision = "0002_returns"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def _has_column(table: str, column: str) -> bool:
    insp = sa.inspect(op.get_bind())
    return column in {col["name"] for col in insp.get_columns(table)}


def _has_table(table: str) -> bool:
    return sa.inspect(op.get_bind()).has_table(table)


def upgrade() -> None:
    is_sqlite = op.get_bind().dialect.name == "sqlite"

    if not _has_column("sales", "reversed_by_id"):
        op.add_column("sales", sa.Column("reversed_by_id", sa.Integer(), nullable=True))
        op.add_column("sales", sa.Column("reversed_at", sa.DateTime(), nullable=True))
        if not is_sqlite:
            op.create_foreign_key("fk_sales_reversed_by_id_users", "sales", "users", ["reversed_by_id"], ["id"])

    if not _has_table("sale_returns"):
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

    if not _has_table("sale_return_items"):
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
    if _has_table("sale_return_items"):
        op.drop_table("sale_return_items")
    if _has_table("sale_returns"):
        op.drop_table("sale_returns")
    if _has_column("sales", "reversed_by_id"):
        if op.get_bind().dialect.name != "sqlite":
            op.drop_constraint("fk_sales_reversed_by_id_users", "sales", type_="foreignkey")
        op.drop_column("sales", "reversed_at")
        op.drop_column("sales", "reversed_by_id")
