"""Organization + organization_memberships.

Per docs/ARCHITECTURE.md §3-4: one shared schema, every tenant-scoped row
carries organization_id (directly or transitively). organization_domains
and the full brand_config shape are deferred past today's foundation scope
(brand_config is kept as a JSONB column so it can be populated later
without a migration).
"""

from typing import TYPE_CHECKING, Optional

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy import Enum as SqlEnum
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.models.enums import MembershipStatus, OrganizationStatus

if TYPE_CHECKING:
    from app.models.enrollment import Enrollment
    from app.models.program import Program
    from app.models.role import UserRole
    from app.models.student import Student
    from app.models.user import User


class Organization(Base, TimestampMixin):
    __tablename__ = "organizations"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), nullable=False, unique=True, index=True)
    code: Mapped[str] = mapped_column(String(20), nullable=False, unique=True)
    status: Mapped[OrganizationStatus] = mapped_column(
        SqlEnum(OrganizationStatus, name="organization_status"),
        nullable=False,
        default=OrganizationStatus.ACTIVE,
    )
    primary_domain: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    lms_domain: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    brand_config: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    memberships: Mapped[list["OrganizationMembership"]] = relationship(
        back_populates="organization", cascade="all, delete-orphan"
    )
    students: Mapped[list["Student"]] = relationship(
        back_populates="organization", cascade="all, delete-orphan"
    )
    programs: Mapped[list["Program"]] = relationship(
        back_populates="organization", cascade="all, delete-orphan"
    )
    enrollments: Mapped[list["Enrollment"]] = relationship(
        back_populates="organization", cascade="all, delete-orphan"
    )


class OrganizationMembership(Base, TimestampMixin):
    """Links a user to an organization. Roles are granted per-membership,
    not directly on the user, so one account can hold different roles (or
    none) in each organization it belongs to (ARCHITECTURE.md §5)."""

    __tablename__ = "organization_memberships"
    __table_args__ = (UniqueConstraint("user_id", "organization_id", name="uq_membership_user_org"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    organization_id: Mapped[int] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status: Mapped[MembershipStatus] = mapped_column(
        SqlEnum(MembershipStatus, name="membership_status"),
        nullable=False,
        default=MembershipStatus.ACTIVE,
    )

    user: Mapped["User"] = relationship(back_populates="memberships")
    organization: Mapped["Organization"] = relationship(back_populates="memberships")
    user_roles: Mapped[list["UserRole"]] = relationship(
        back_populates="membership", cascade="all, delete-orphan"
    )
