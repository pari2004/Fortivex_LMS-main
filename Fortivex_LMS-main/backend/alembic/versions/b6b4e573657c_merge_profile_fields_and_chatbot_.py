"""merge profile fields and chatbot migrations

Revision ID: b6b4e573657c
Revises: a4da7fe943ae, c7a8b91d2e3f
Create Date: 2026-10-13 07:27:11.852893

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b6b4e573657c'
down_revision: Union[str, Sequence[str], None] = ('a4da7fe943ae', 'c7a8b91d2e3f')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
