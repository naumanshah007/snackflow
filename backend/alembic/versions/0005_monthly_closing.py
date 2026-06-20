"""monthly closing and carry-forward balances

Revision ID: 0005_monthly_closing
Revises: 0004_route_days
Create Date: 2026-06-20
"""

from alembic import op
import sqlalchemy as sa

revision = "0005_monthly_closing"
down_revision = "0004_route_days"
branch_labels = None
depends_on = None


def _has_table(table: str) -> bool:
    return sa.inspect(op.get_bind()).has_table(table)


def upgrade() -> None:
    if not _has_table("monthly_closings"):
        op.create_table(
            "monthly_closings",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("month_start", sa.Date(), nullable=False),
            sa.Column("month_end", sa.Date(), nullable=False),
            sa.Column("status", sa.String(length=40), nullable=False),
            sa.Column("closed_by_id", sa.Integer(), nullable=True),
            sa.Column("closed_at", sa.DateTime(), nullable=True),
            sa.Column("backup_filename", sa.String(length=255), nullable=True),
            sa.Column("backup_reference", sa.String(), nullable=True),
            sa.Column("backup_checksum", sa.String(length=64), nullable=True),
            sa.Column("backup_generated_at", sa.DateTime(), nullable=True),
            sa.Column("summary_totals", sa.JSON(), server_default="{}", nullable=False),
            sa.Column("carry_forward_summary", sa.JSON(), server_default="{}", nullable=False),
            sa.Column("archive_status", sa.String(length=40), nullable=False),
            sa.Column("archive_requested_at", sa.DateTime(), nullable=True),
            sa.Column("archived_at", sa.DateTime(), nullable=True),
            sa.Column("archive_note", sa.String(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["closed_by_id"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("month_start", name="uq_monthly_closings_month_start"),
        )
        op.create_index("ix_monthly_closings_month_start", "monthly_closings", ["month_start"])
        op.create_index("ix_monthly_closings_month_end", "monthly_closings", ["month_end"])
        op.create_index("ix_monthly_closings_status", "monthly_closings", ["status"])
        op.create_index("ix_monthly_closings_closed_by_id", "monthly_closings", ["closed_by_id"])
        op.create_index("ix_monthly_closings_closed_at", "monthly_closings", ["closed_at"])
        op.create_index("ix_monthly_closings_archive_status", "monthly_closings", ["archive_status"])

    if not _has_table("monthly_shop_opening_balances"):
        op.create_table(
            "monthly_shop_opening_balances",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("monthly_closing_id", sa.Integer(), nullable=False),
            sa.Column("month_start", sa.Date(), nullable=False),
            sa.Column("shop_id", sa.Integer(), nullable=False),
            sa.Column("opening_balance", sa.Float(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["monthly_closing_id"], ["monthly_closings.id"]),
            sa.ForeignKeyConstraint(["shop_id"], ["shops.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("monthly_closing_id", "shop_id", name="uq_monthly_shop_opening_closing_shop"),
        )
        op.create_index("ix_monthly_shop_opening_balances_monthly_closing_id", "monthly_shop_opening_balances", ["monthly_closing_id"])
        op.create_index("ix_monthly_shop_opening_balances_month_start", "monthly_shop_opening_balances", ["month_start"])
        op.create_index("ix_monthly_shop_opening_balances_shop_id", "monthly_shop_opening_balances", ["shop_id"])

    if not _has_table("monthly_inventory_opening_balances"):
        op.create_table(
            "monthly_inventory_opening_balances",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("monthly_closing_id", sa.Integer(), nullable=False),
            sa.Column("month_start", sa.Date(), nullable=False),
            sa.Column("warehouse_id", sa.Integer(), nullable=False),
            sa.Column("sku_id", sa.Integer(), nullable=False),
            sa.Column("opening_quantity_packets", sa.Integer(), nullable=False),
            sa.Column("opening_average_cost_per_packet", sa.Float(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["monthly_closing_id"], ["monthly_closings.id"]),
            sa.ForeignKeyConstraint(["warehouse_id"], ["warehouses.id"]),
            sa.ForeignKeyConstraint(["sku_id"], ["skus.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("monthly_closing_id", "warehouse_id", "sku_id", name="uq_monthly_inventory_opening_closing_wh_sku"),
        )
        op.create_index("ix_monthly_inventory_opening_balances_monthly_closing_id", "monthly_inventory_opening_balances", ["monthly_closing_id"])
        op.create_index("ix_monthly_inventory_opening_balances_month_start", "monthly_inventory_opening_balances", ["month_start"])
        op.create_index("ix_monthly_inventory_opening_balances_warehouse_id", "monthly_inventory_opening_balances", ["warehouse_id"])
        op.create_index("ix_monthly_inventory_opening_balances_sku_id", "monthly_inventory_opening_balances", ["sku_id"])


def downgrade() -> None:
    if _has_table("monthly_inventory_opening_balances"):
        op.drop_table("monthly_inventory_opening_balances")
    if _has_table("monthly_shop_opening_balances"):
        op.drop_table("monthly_shop_opening_balances")
    if _has_table("monthly_closings"):
        op.drop_table("monthly_closings")
