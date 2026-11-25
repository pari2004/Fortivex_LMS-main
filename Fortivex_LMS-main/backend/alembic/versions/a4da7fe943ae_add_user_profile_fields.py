"""add user profile fields

Revision ID: a4da7fe943ae
Revises: f535260bda99
Create Date: 2026-10-13 05:56:48.716684

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a4da7fe943ae'
down_revision: Union[str, Sequence[str], None] = 'f535260bda99'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('users', sa.Column('phone_number', sa.String(length=50), nullable=True))
    op.add_column('users', sa.Column('bio', sa.String(length=1000), nullable=True))
    op.add_column('users', sa.Column('title', sa.String(length=100), nullable=True))
    op.add_column('users', sa.Column('avatar_url', sa.String(length=255), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('users', 'avatar_url')
    op.drop_column('users', 'title')
    op.drop_column('users', 'bio')
    op.drop_column('users', 'phone_number')
