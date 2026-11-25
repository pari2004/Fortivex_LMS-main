"""add github linkedin portfolio to users

Revision ID: fa12b3c4d5e6
Revises: d9a6b4d89d6f
Create Date: 2026-10-17 16:49:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'fa12b3c4d5e6'
down_revision: Union[str, Sequence[str], None] = 'd9a6b4d89d6f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema to add social and portfolio links."""
    op.add_column('users', sa.Column('github_url', sa.String(length=255), nullable=True))
    op.add_column('users', sa.Column('linkedin_url', sa.String(length=255), nullable=True))
    op.add_column('users', sa.Column('portfolio_url', sa.String(length=255), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('users', 'portfolio_url')
    op.drop_column('users', 'linkedin_url')
    op.drop_column('users', 'github_url')
