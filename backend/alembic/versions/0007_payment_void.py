"""payment void / correction metadata

Revision ID: 0007_payment_void
Revises: 0006_monthly_closing_checksum
Create Date: 2026-06-21

Adds void metadata to payments so a wrongly-entered payment can be voided (not
deleted), reversing its effect on the shop balance while preserving history.
Guarded so it is a no-op if 0001_initial's create_all already provisioned the
columns (see the alembic-create-all gotcha).
"""

from alembic import op
import sqlalchemy as sa

revision = "0007_payment_void"
down_revision = "0006_monthly_closing_checksum"
branch_labels = None
depends_on = None


def _has_column(table: str, column: str) -> bool:
    insp = sa.inspect(op.get_bind())
    return column in {col["name"] for col in insp.get_columns(table)}


def _has_index(table: str, index: str) -> bool:
    insp = sa.inspect(op.get_bind())
    return index in {ix["name"] for ix in insp.get_indexes(table)}


def upgrade() -> None:
    if not _has_column("payments", "is_voided"):
        op.add_column("payments", sa.Column("is_voided", sa.Boolean(), nullable=False, server_default=sa.false()))
    if not _has_column("payments", "voided_by_id"):
        op.add_column("payments", sa.Column("voided_by_id", sa.Integer(), nullable=True))
    if not _has_column("payments", "voided_at"):
        op.add_column("payments", sa.Column("voided_at", sa.DateTime(), nullable=True))
    if not _has_column("payments", "void_reason"):
        op.add_column("payments", sa.Column("void_reason", sa.String(), nullable=True))
    if not _has_index("payments", "ix_payments_is_voided"):
        op.create_index("ix_payments_is_voided", "payments", ["is_voided"])


def downgrade() -> None:
    if _has_index("payments", "ix_payments_is_voided"):
        op.drop_index("ix_payments_is_voided", table_name="payments")
    for column in ("void_reason", "voided_at", "voided_by_id", "is_voided"):
        if _has_column("payments", column):
            op.drop_column("payments", column)
