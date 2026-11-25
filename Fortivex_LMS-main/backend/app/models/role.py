"""Role, and the two join tables that connect roles to permissions and to
users (scoped through organization_memberships, per ARCHITECTURE.md §5)."""

from typing import TYPE_CHECKING, Optional

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.organization import OrganizationMembership
    from app.models.permission import Permission


class Role(Base, TimestampMixin):
    """Catalog of roles: SUPER_ADMIN, ACADEMIC_ADMIN, PROGRAM_MANAGER,
    TRAINER, MENTOR, LAB_ADMIN, CAREER_TEAM, FINANCE_ADMIN, STUDENT."""

    __tablename__ = "roles"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False, unique=True, index=True)
    description: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    permission_links: Mapped[list["RolePermission"]] = relationship(
        back_populates="role", cascade="all, delete-orphan"
    )
    user_links: Mapped[list["UserRole"]] = relationship(back_populates="role", cascade="all, delete-orphan")


class RolePermission(Base, TimestampMixin):
    __tablename__ = "role_permissions"
    __table_args__ = (UniqueConstraint("role_id", "permission_id", name="uq_role_permission"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    role_id: Mapped[int] = mapped_column(ForeignKey("roles.id", ondelete="CASCADE"), nullable=False, index=True)
    permission_id: Mapped[int] = mapped_column(
        ForeignKey("permissions.id", ondelete="CASCADE"), nullable=False, index=True
    )

    role: Mapped["Role"] = relationship(back_populates="permission_links")
    permission: Mapped["Permission"] = relationship(back_populates="role_links")


class UserRole(Base, TimestampMixin):
    """A role granted to a user for one specific organization_membership."""

    __tablename__ = "user_roles"
    __table_args__ = (
        UniqueConstraint("organization_membership_id", "role_id", name="uq_user_role_membership"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    organization_membership_id: Mapped[int] = mapped_column(
        ForeignKey("organization_memberships.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role_id: Mapped[int] = mapped_column(ForeignKey("roles.id", ondelete="CASCADE"), nullable=False, index=True)

    membership: Mapped["OrganizationMembership"] = relationship(back_populates="user_roles")
    role: Mapped["Role"] = relationship(back_populates="user_links")
