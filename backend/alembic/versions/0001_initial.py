"""initial schema

Revision ID: 0001_initial
Revises:
Create Date: 2026-06-14
"""

from alembic import op
from sqlmodel import SQLModel

import app.models  # noqa: F401

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    SQLModel.metadata.create_all(bind=op.get_bind())


def downgrade() -> None:
    SQLModel.metadata.drop_all(bind=op.get_bind())
