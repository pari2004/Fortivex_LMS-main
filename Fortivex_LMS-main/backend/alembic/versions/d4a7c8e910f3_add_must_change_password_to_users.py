"""add must_change_password to users

Revision ID: d4a7c8e910f3
Revises: c8e31b90d5f2
Create Date: 2026-11-13 18:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d4a7c8e910f3"
down_revision: Union[str, Sequence[str], None] = "c8e31b90d5f2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("must_change_password", sa.Boolean(), server_default="false", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("users", "must_change_password")

