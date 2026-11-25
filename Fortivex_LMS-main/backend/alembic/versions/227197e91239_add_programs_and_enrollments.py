"""add programs and enrollments

Revision ID: 227197e91239
Revises: 2bf55b701959
Create Date: 2026-09-24 00:00:00.000000

NOTE: written by hand from app/models/program.py and app/models/enrollment.py,
same constraint as the initial migration — no local PostgreSQL instance is
available in this environment (see docs/DATABASE_NOTES.md). Not executed
against a real database yet. Run `alembic upgrade head` against a real
Postgres instance and review the result before considering this verified.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '227197e91239'
down_revision: Union[str, Sequence[str], None] = '2bf55b701959'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    program_status = postgresql.ENUM("ACTIVE", "INACTIVE", name="program_status")
    enrollment_status = postgresql.ENUM(
        "ENROLLED", "ACTIVE", "COMPLETED", "CANCELLED", name="enrollment_status"
    )

    op.create_table(
        "programs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "organization_id", sa.Integer(), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("status", program_status, nullable=False, server_default="ACTIVE"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("organization_id", "code", name="uq_program_org_code"),
    )
    op.create_index("ix_programs_organization_id", "programs", ["organization_id"])

    op.create_table(
        "enrollments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("students.id", ondelete="CASCADE"), nullable=False),
        sa.Column("program_id", sa.Integer(), sa.ForeignKey("programs.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "organization_id", sa.Integer(), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("status", enrollment_status, nullable=False, server_default="ENROLLED"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("student_id", "program_id", name="uq_enrollment_student_program"),
    )
    op.create_index("ix_enrollments_student_id", "enrollments", ["student_id"])
    op.create_index("ix_enrollments_program_id", "enrollments", ["program_id"])
    op.create_index("ix_enrollments_organization_id", "enrollments", ["organization_id"])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table("enrollments")
    op.drop_table("programs")

    postgresql.ENUM(name="enrollment_status").drop(op.get_bind(), checkfirst=True)
    postgresql.ENUM(name="program_status").drop(op.get_bind(), checkfirst=True)
