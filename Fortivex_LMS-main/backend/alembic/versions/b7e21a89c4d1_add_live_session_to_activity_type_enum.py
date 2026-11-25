"""Add LIVE_SESSION to activity_type_enum

Revision ID: b7e21a89c4d1
Revises: fa12b3c4d5e6
Create Date: 2026-11-11 11:55:00.000000

"""
from typing import Sequence, Union
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'b7e21a89c4d1'
down_revision: Union[str, Sequence[str], None] = 'fa12b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE activity_type_enum ADD VALUE IF NOT EXISTS 'LIVE_SESSION'")


def downgrade() -> None:
    pass
