"""add_discussion_tables

Revision ID: c8e31b90d5f2
Revises: b7e21a89c4d1
Create Date: 2026-11-11 13:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c8e31b90d5f2'
down_revision: Union[str, Sequence[str], None] = 'b7e21a89c4d1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. discussion_threads
    op.create_table(
        'discussion_threads',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('organization_id', sa.Integer(), nullable=False),
        sa.Column('author_id', sa.Integer(), nullable=False),
        sa.Column('program_id', sa.Integer(), nullable=True),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('tags', sa.JSON(), server_default='[]', nullable=False),
        sa.Column('upvotes', sa.Integer(), server_default='0', nullable=False),
        sa.Column('has_verified_answer', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['author_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['program_id'], ['programs.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_discussion_threads_organization_id'), 'discussion_threads', ['organization_id'], unique=False)
    op.create_index(op.f('ix_discussion_threads_author_id'), 'discussion_threads', ['author_id'], unique=False)
    op.create_index(op.f('ix_discussion_threads_program_id'), 'discussion_threads', ['program_id'], unique=False)

    # 2. discussion_replies
    op.create_table(
        'discussion_replies',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('thread_id', sa.Integer(), nullable=False),
        sa.Column('author_id', sa.Integer(), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('is_verified', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['thread_id'], ['discussion_threads.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['author_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_discussion_replies_thread_id'), 'discussion_replies', ['thread_id'], unique=False)
    op.create_index(op.f('ix_discussion_replies_author_id'), 'discussion_replies', ['author_id'], unique=False)

    # 3. discussion_upvotes
    op.create_table(
        'discussion_upvotes',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('thread_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['thread_id'], ['discussion_threads.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('thread_id', 'user_id', name='uq_discussion_thread_user_upvote'),
    )
    op.create_index(op.f('ix_discussion_upvotes_thread_id'), 'discussion_upvotes', ['thread_id'], unique=False)
    op.create_index(op.f('ix_discussion_upvotes_user_id'), 'discussion_upvotes', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_table('discussion_upvotes')
    op.drop_table('discussion_replies')
    op.drop_table('discussion_threads')

