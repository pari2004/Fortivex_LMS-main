"""Shared FastAPI dependencies: DB session re-export, current user, and a
minimal role-based authorization dependency.

MVP simplification, documented rather than hidden: full request-scoped
organization resolution (Host header -> organization_domains, per
ARCHITECTURE.md §3) is deferred. `require_roles` checks whether the user
holds the given role in *any* of their active organization memberships.
Once domain-based org resolution lands, this should be tightened to check
only the membership matching the request's resolved organization.
"""

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session, joinedload

from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.enums import MembershipStatus
from app.models.organization import OrganizationMembership
from app.models.role import UserRole
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

credentials_exception = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials",
    headers={"WWW-Authenticate": "Bearer"},
)


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    try:
        payload = decode_access_token(token)
    except jwt.PyJWTError:
        raise credentials_exception

    user_id = payload.get("sub")
    if user_id is None:
        raise credentials_exception

    user = (
        db.query(User)
        .options(
            joinedload(User.memberships).joinedload(OrganizationMembership.user_roles).joinedload(UserRole.role),
            joinedload(User.memberships).joinedload(OrganizationMembership.organization),
            joinedload(User.student_profiles),
        )
        .filter(User.id == int(user_id))
        .first()
    )
    if user is None:
        raise credentials_exception
    return user


def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Inactive user")
    return current_user


def get_user_roles(user: User) -> set[str]:
    """Every role name the user holds across their active organization
    memberships. Same "any active membership" MVP simplification as the
    module docstring above. Delegates to User.roles (app/models/user.py),
    which is also what UserRead exposes to the frontend."""
    return set(user.roles)


def get_user_organization_ids(user: User) -> set[int]:
    """Ids of every organization the user has an active membership in.
    Used to scope list/detail endpoints to what the caller can see, since
    request-scoped domain resolution (ARCHITECTURE.md §3) isn't built yet."""
    return {
        membership.organization_id
        for membership in user.memberships
        if membership.status == MembershipStatus.ACTIVE
    }


def is_super_admin(user: User) -> bool:
    return "SUPER_ADMIN" in get_user_roles(user)


def require_roles(*role_names: str):
    """Dependency factory: 403s unless the current user holds one of
    `role_names` via an active organization membership."""

    def dependency(current_user: User = Depends(get_current_active_user)) -> User:
        if not get_user_roles(current_user).intersection(role_names):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires one of roles: {', '.join(role_names)}",
            )
        return current_user

    return dependency
