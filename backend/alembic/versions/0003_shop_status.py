"""shop approval status

Revision ID: 0003_shop_status
Revises: 0002_returns
Create Date: 2026-06-16

Adds Shop.status (ACTIVE / PENDING_APPROVAL / REJECTED) so order bookers can
register new shops on their own route that wait for admin approval. Guarded so
it is a no-op if 0001_initial's create_all already provisioned the column.
"""

from alembic import op
import sqlalchemy as sa

revision = "0003_shop_status"
down_revision = "0002_returns"
branch_labels = None
depends_on = None


def _has_column(table: str, column: str) -> bool:
    insp = sa.inspect(op.get_bind())
    return column in {col["name"] for col in insp.get_columns(table)}


def _has_index(table: str, index: str) -> bool:
    insp = sa.inspect(op.get_bind())
    return index in {ix["name"] for ix in insp.get_indexes(table)}


def upgrade() -> None:
    if not _has_column("shops", "status"):
        # ADD COLUMN with a server default works natively on SQLite and Postgres;
        # existing rows default to ACTIVE so nothing is hidden today.
        op.add_column("shops", sa.Column("status", sa.String(), nullable=False, server_default="ACTIVE"))
    if not _has_index("shops", "ix_shops_status"):
        op.create_index("ix_shops_status", "shops", ["status"])


def downgrade() -> None:
    if _has_index("shops", "ix_shops_status"):
        op.drop_index("ix_shops_status", table_name="shops")
    if _has_column("shops", "status"):
        op.drop_column("shops", "status")
