"""route days for shops and order bookers

Revision ID: 0004_route_days
Revises: 0003_shop_status
Create Date: 2026-06-20

Adds ``Shop.route_days`` and ``User.route_days`` (JSON lists of weekday names)
so admins can plan weekly routes and the mobile order booker can see "Today's
Route". Guarded so it is a no-op if 0001_initial's create_all already
provisioned the columns (see the alembic-create-all gotcha).
"""

from alembic import op
import sqlalchemy as sa

revision = "0004_route_days"
down_revision = "0003_shop_status"
branch_labels = None
depends_on = None


def _has_column(table: str, column: str) -> bool:
    insp = sa.inspect(op.get_bind())
    return column in {col["name"] for col in insp.get_columns(table)}


def upgrade() -> None:
    # Existing rows default to an empty JSON list so nothing is hidden today.
    if not _has_column("shops", "route_days"):
        op.add_column("shops", sa.Column("route_days", sa.JSON(), nullable=False, server_default="[]"))
    if not _has_column("users", "route_days"):
        op.add_column("users", sa.Column("route_days", sa.JSON(), nullable=False, server_default="[]"))


def downgrade() -> None:
    if _has_column("users", "route_days"):
        op.drop_column("users", "route_days")
    if _has_column("shops", "route_days"):
        op.drop_column("shops", "route_days")
