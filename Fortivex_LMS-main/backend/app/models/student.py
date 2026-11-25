from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy import Enum as SqlEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.models.enums import StudentLifecycleStatus

if TYPE_CHECKING:
    from app.models.enrollment import Enrollment
    from app.models.organization import Organization
    from app.models.user import User


class Student(Base, TimestampMixin):
    """A user's student record within one organization.

    student_profiles (extended profile fields from ARCHITECTURE.md §8) is
    deferred — not needed for today's foundation.
    """

    __tablename__ = "students"
    __table_args__ = (UniqueConstraint("user_id", "organization_id", name="uq_student_user_org"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    organization_id: Mapped[int] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    student_code: Mapped[str] = mapped_column(String(50), nullable=False, unique=True, index=True)
    lifecycle_status: Mapped[StudentLifecycleStatus] = mapped_column(
        SqlEnum(StudentLifecycleStatus, name="student_lifecycle_status"),
        nullable=False,
        default=StudentLifecycleStatus.ENROLLMENT,
    )

    user: Mapped["User"] = relationship(back_populates="student_profiles")
    organization: Mapped["Organization"] = relationship(back_populates="students")
    enrollments: Mapped[list["Enrollment"]] = relationship(
        back_populates="student", cascade="all, delete-orphan"
    )
