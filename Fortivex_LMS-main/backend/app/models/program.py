"""Program: the course/program a student can be enrolled in, scoped to one
organization. Cohorts (running instances of a program) live underneath it —
see app/models/cohort.py. Deeper curriculum structure (Program Module ->
Week -> Lesson -> Activity, ARCHITECTURE.md §6) is still out of scope for
today's Program+Cohort foundation work.
"""

from typing import TYPE_CHECKING, Optional

from sqlalchemy import ForeignKey, String, Text, UniqueConstraint
from sqlalchemy import Enum as SqlEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.models.enums import ProgramStatus

if TYPE_CHECKING:
    from app.models.cohort import Cohort
    from app.models.enrollment import Enrollment
    from app.models.organization import Organization
    from app.models.curriculum import ProgramModule
    from app.models.document import ProgramDocument


class Program(Base, TimestampMixin):
    __tablename__ = "programs"
    __table_args__ = (UniqueConstraint("organization_id", "code", name="uq_program_org_code"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    organization_id: Mapped[int] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[ProgramStatus] = mapped_column(
        SqlEnum(ProgramStatus, name="program_status"),
        nullable=False,
        default=ProgramStatus.ACTIVE,
    )

    organization: Mapped["Organization"] = relationship(back_populates="programs")
    enrollments: Mapped[list["Enrollment"]] = relationship(
        back_populates="program", cascade="all, delete-orphan"
    )
    cohorts: Mapped[list["Cohort"]] = relationship(
        secondary="program_cohorts", back_populates="programs"
    )
    program_modules: Mapped[list["ProgramModule"]] = relationship(back_populates="program", cascade="all, delete-orphan")
    documents: Mapped[list["ProgramDocument"]] = relationship(back_populates="program", cascade="all, delete-orphan")
