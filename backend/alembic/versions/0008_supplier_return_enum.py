"""supplier return movement enum value

Revision ID: 0008_supplier_return_enum
Revises: 0007_payment_void
Create Date: 2026-06-21
"""

from alembic import op

revision = "0008_supplier_return_enum"
down_revision = "0007_payment_void"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if op.get_bind().dialect.name != "postgresql":
        return

    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'movementtype') THEN
                EXECUTE 'ALTER TYPE movementtype ADD VALUE IF NOT EXISTS ''SUPPLIER_RETURN_OUT''';
            END IF;
        END
        $$;
        """
    )


def downgrade() -> None:
    # PostgreSQL does not support removing enum values safely in-place.
    pass
