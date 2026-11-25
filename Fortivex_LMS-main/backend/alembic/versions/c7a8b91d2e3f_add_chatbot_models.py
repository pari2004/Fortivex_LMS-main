"""Add ChatbotDailyUsage and ChatbotMessage models

Revision ID: c7a8b91d2e3f
Revises: f535260bda99
Create Date: 2026-10-10 11:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c7a8b91d2e3f'
down_revision: Union[str, Sequence[str], None] = 'f535260bda99'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema to include chatbot tables."""
    op.create_table(
        'chatbot_daily_usages',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('organization_id', sa.Integer(), nullable=False),
        sa.Column('usage_date', sa.Date(), nullable=False),
        sa.Column('seconds_used', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('last_heartbeat_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'usage_date', name='uq_chatbot_daily_usage_user_date')
    )
    op.create_index(op.f('ix_chatbot_daily_usages_organization_id'), 'chatbot_daily_usages', ['organization_id'], unique=False)
    op.create_index(op.f('ix_chatbot_daily_usages_usage_date'), 'chatbot_daily_usages', ['usage_date'], unique=False)
    op.create_index(op.f('ix_chatbot_daily_usages_user_id'), 'chatbot_daily_usages', ['user_id'], unique=False)

    op.create_table(
        'chatbot_messages',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('organization_id', sa.Integer(), nullable=False),
        sa.Column('session_id', sa.String(length=64), nullable=False),
        sa.Column('role', sa.String(length=20), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('seconds_spent', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_chatbot_messages_created_at'), 'chatbot_messages', ['created_at'], unique=False)
    op.create_index(op.f('ix_chatbot_messages_organization_id'), 'chatbot_messages', ['organization_id'], unique=False)
    op.create_index(op.f('ix_chatbot_messages_session_id'), 'chatbot_messages', ['session_id'], unique=False)
    op.create_index(op.f('ix_chatbot_messages_user_id'), 'chatbot_messages', ['user_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema to remove chatbot tables."""
    op.drop_index(op.f('ix_chatbot_messages_user_id'), table_name='chatbot_messages')
    op.drop_index(op.f('ix_chatbot_messages_session_id'), table_name='chatbot_messages')
    op.drop_index(op.f('ix_chatbot_messages_organization_id'), table_name='chatbot_messages')
    op.drop_index(op.f('ix_chatbot_messages_created_at'), table_name='chatbot_messages')
    op.drop_table('chatbot_messages')

    op.drop_index(op.f('ix_chatbot_daily_usages_user_id'), table_name='chatbot_daily_usages')
    op.drop_index(op.f('ix_chatbot_daily_usages_usage_date'), table_name='chatbot_daily_usages')
    op.drop_index(op.f('ix_chatbot_daily_usages_organization_id'), table_name='chatbot_daily_usages')
    op.drop_table('chatbot_daily_usages')
