"""monthly closing backup checksum

Revision ID: 0006_monthly_closing_checksum
Revises: 0005_monthly_closing
Create Date: 2026-06-20
"""

from alembic import op
import sqlalchemy as sa

revision = "0006_monthly_closing_checksum"
down_revision = "0005_monthly_closing"
branch_labels = None
depends_on = None


def _has_table(table: str) -> bool:
    return sa.inspect(op.get_bind()).has_table(table)


def _has_column(table: str, column: str) -> bool:
    return any(item["name"] == column for item in sa.inspect(op.get_bind()).get_columns(table))


def upgrade() -> None:
    if _has_table("monthly_closings") and not _has_column("monthly_closings", "backup_checksum"):
        op.add_column("monthly_closings", sa.Column("backup_checksum", sa.String(length=64), nullable=True))


def downgrade() -> None:
    if _has_table("monthly_closings") and _has_column("monthly_closings", "backup_checksum"):
        op.drop_column("monthly_closings", "backup_checksum")
