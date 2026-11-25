"""Cohort: a running instance of a Program (its own start/end dates and
status), so one Program can have multiple Cohorts without duplicating the
Program itself. Per ARCHITECTURE.md §6. organization_id is denormalized
onto this row (same pattern as Student/Enrollment) since org-scoped
queries are the common case.

Trainer/mentor assignment and detailed scheduling are deliberately not
modeled yet — ARCHITECTURE.md only mentions them parenthetically, with no
concrete schema, and today's brief scopes this to Program+Cohort. Not
over-engineered ahead of an actual requirement.
"""

from datetime import date
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Date, ForeignKey, String, Table, Column, Integer, UniqueConstraint
from sqlalchemy import Enum as SqlEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.models.enums import CohortStatus

if TYPE_CHECKING:
    from app.models.enrollment import Enrollment
    from app.models.organization import Organization
    from app.models.program import Program


program_cohorts = Table(
    "program_cohorts",
    Base.metadata,
    Column("program_id", Integer, ForeignKey("programs.id", ondelete="CASCADE"), primary_key=True),
    Column("cohort_id", Integer, ForeignKey("cohorts.id", ondelete="CASCADE"), primary_key=True),
)


class Cohort(Base, TimestampMixin):
    __tablename__ = "cohorts"
    __table_args__ = (UniqueConstraint("organization_id", "code", name="uq_cohort_org_code"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    organization_id: Mapped[int] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    status: Mapped[CohortStatus] = mapped_column(
        SqlEnum(CohortStatus, name="cohort_status"),
        nullable=False,
        default=CohortStatus.UPCOMING,
    )

    programs: Mapped[list["Program"]] = relationship(secondary=program_cohorts, back_populates="cohorts")
    organization: Mapped["Organization"] = relationship()
    enrollments: Mapped[list["Enrollment"]] = relationship(back_populates="cohort")

    @property
    def program_ids(self) -> list[int]:
        return [p.id for p in self.programs]
