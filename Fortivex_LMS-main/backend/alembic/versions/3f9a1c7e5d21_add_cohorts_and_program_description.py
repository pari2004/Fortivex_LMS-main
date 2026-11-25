"""add cohorts, program description, enrollment cohort_id

Revision ID: 3f9a1c7e5d21
Revises: 227197e91239
Create Date: 2026-09-25 00:00:00.000000

Written by hand from app/models/cohort.py, app/models/program.py, and
app/models/enrollment.py, and verified by actually running
`alembic upgrade head` against a real (locally-provisioned) PostgreSQL
instance this session — see docs/BACKEND_STATUS.md for how.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '3f9a1c7e5d21'
down_revision: Union[str, Sequence[str], None] = '227197e91239'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    cohort_status = postgresql.ENUM("UPCOMING", "ACTIVE", "COMPLETED", "CANCELLED", name="cohort_status")

    op.add_column("programs", sa.Column("description", sa.Text(), nullable=True))

    op.create_table(
        "cohorts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("program_id", sa.Integer(), sa.ForeignKey("programs.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "organization_id", sa.Integer(), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("status", cohort_status, nullable=False, server_default="UPCOMING"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("program_id", "code", name="uq_cohort_program_code"),
    )
    op.create_index("ix_cohorts_program_id", "cohorts", ["program_id"])
    op.create_index("ix_cohorts_organization_id", "cohorts", ["organization_id"])

    op.add_column("enrollments", sa.Column("cohort_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_enrollments_cohort_id", "enrollments", "cohorts", ["cohort_id"], ["id"], ondelete="SET NULL"
    )
    op.create_index("ix_enrollments_cohort_id", "enrollments", ["cohort_id"])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("ix_enrollments_cohort_id", table_name="enrollments")
    op.drop_constraint("fk_enrollments_cohort_id", "enrollments", type_="foreignkey")
    op.drop_column("enrollments", "cohort_id")

    op.drop_index("ix_cohorts_organization_id", table_name="cohorts")
    op.drop_index("ix_cohorts_program_id", table_name="cohorts")
    op.drop_table("cohorts")

    op.drop_column("programs", "description")

    postgresql.ENUM(name="cohort_status").drop(op.get_bind(), checkfirst=True)
