from typing import TYPE_CHECKING

from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.models.enums import MembershipStatus

if TYPE_CHECKING:
    from app.models.organization import OrganizationMembership
    from app.models.student import Student


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    phone_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    bio: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    title: Mapped[str | None] = mapped_column(String(100), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    github_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    linkedin_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    portfolio_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    must_change_password: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)

    memberships: Mapped[list["OrganizationMembership"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    student_profiles: Mapped[list["Student"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )

    @property
    def roles(self) -> list[str]:
        """Every role name held across active organization memberships.
        Single source of truth for app.api.deps.get_user_roles and for
        UserRead's `roles` field (so the frontend can gate UI on role
        without a second round trip)."""
        names = {
            user_role.role.name
            for membership in self.memberships
            if membership.status == MembershipStatus.ACTIVE
            for user_role in membership.user_roles
        }
        return sorted(names)

    @property
    def organizations(self) -> list[dict]:
        """Summary of active organization memberships and roles within each."""
        orgs = []
        for membership in self.memberships:
            if membership.status == MembershipStatus.ACTIVE and membership.organization:
                orgs.append({
                    "id": membership.organization.id,
                    "name": membership.organization.name,
                    "code": membership.organization.code,
                    "roles": sorted([ur.role.name for ur in membership.user_roles]),
                })
        return orgs
