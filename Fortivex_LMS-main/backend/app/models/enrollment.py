"""Enrollment: connects Student + Program + (optional) Cohort + Organization
+ a lifecycle status. `organization_id` is denormalized onto this row
(same pattern as Student) rather than derived via student/program joins,
since org-scoped queries are the common case (ARCHITECTURE.md §3-4).

cohort_id is nullable: a student can be enrolled in a program before (or
without ever being) assigned to a specific running cohort — this mirrors
students.lifecycle_status's own COHORT_ASSIGNMENT step happening after
ENROLLMENT.
"""

from typing import TYPE_CHECKING, Optional

from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy import Enum as SqlEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.models.enums import EnrollmentStatus

if TYPE_CHECKING:
    from app.models.cohort import Cohort
    from app.models.organization import Organization
    from app.models.program import Program
    from app.models.student import Student


class Enrollment(Base, TimestampMixin):
    __tablename__ = "enrollments"
    __table_args__ = (
        UniqueConstraint("student_id", "program_id", name="uq_enrollment_student_program"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(
        ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True
    )
    program_id: Mapped[int] = mapped_column(
        ForeignKey("programs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    cohort_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("cohorts.id", ondelete="SET NULL"), nullable=True, index=True
    )
    organization_id: Mapped[int] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status: Mapped[EnrollmentStatus] = mapped_column(
        SqlEnum(EnrollmentStatus, name="enrollment_status"),
        nullable=False,
        default=EnrollmentStatus.ENROLLED,
    )

    student: Mapped["Student"] = relationship(back_populates="enrollments")
    program: Mapped["Program"] = relationship(back_populates="enrollments")
    cohort: Mapped[Optional["Cohort"]] = relationship(back_populates="enrollments")
    organization: Mapped["Organization"] = relationship(back_populates="enrollments")
