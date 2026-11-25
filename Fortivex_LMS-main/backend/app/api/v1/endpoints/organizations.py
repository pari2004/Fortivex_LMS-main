"""Organization endpoints, supporting listing, detailed stats, and Super Admin organization management."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import distinct, func
from sqlalchemy.orm import Session

from app.api.deps import (
    get_current_active_user,
    get_user_organization_ids,
    is_super_admin,
    require_roles,
)
from app.db.session import get_db
from app.models.enums import MembershipStatus
from app.models.organization import Organization, OrganizationMembership
from app.models.program import Program
from app.models.role import Role, UserRole
from app.models.student import Student
from app.models.user import User
from app.schemas.organization import (
    OrganizationCreate,
    OrganizationRead,
    OrganizationUpdate,
)

router = APIRouter(prefix="/organizations", tags=["organizations"])


def populate_org_stats(db: Session, org: Organization) -> OrganizationRead:
    admin_count = (
        db.query(OrganizationMembership)
        .join(UserRole, UserRole.organization_membership_id == OrganizationMembership.id)
        .join(Role, Role.id == UserRole.role_id)
        .filter(
            OrganizationMembership.organization_id == org.id,
            Role.name.in_(["ACADEMIC_ADMIN", "PROGRAM_MANAGER"]),
        )
        .distinct(OrganizationMembership.user_id)
        .count()
    )
    instructor_count = (
        db.query(OrganizationMembership)
        .join(UserRole, UserRole.organization_membership_id == OrganizationMembership.id)
        .join(Role, Role.id == UserRole.role_id)
        .filter(
            OrganizationMembership.organization_id == org.id,
            Role.name == "TRAINER",
        )
        .distinct(OrganizationMembership.user_id)
        .count()
    )
    student_count = db.query(Student).filter(Student.organization_id == org.id).count()
    program_count = db.query(Program).filter(Program.organization_id == org.id).count()

    read_data = OrganizationRead.model_validate(org)
    read_data.total_admins = admin_count
    read_data.total_instructors = instructor_count
    read_data.total_students = student_count
    read_data.total_programs = program_count
    return read_data


@router.get("", response_model=list[OrganizationRead])
def list_organizations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> list[OrganizationRead]:
    if is_super_admin(current_user):
        orgs = db.query(Organization).order_by(Organization.id).all()
    else:
        org_ids = get_user_organization_ids(current_user)
        if not org_ids:
            return []
        orgs = db.query(Organization).filter(Organization.id.in_(org_ids)).order_by(Organization.id).all()

    if not orgs:
        return []

    org_ids = [o.id for o in orgs]

    admin_counts = dict(
        db.query(OrganizationMembership.organization_id, func.count(distinct(OrganizationMembership.user_id)))
        .join(UserRole, UserRole.organization_membership_id == OrganizationMembership.id)
        .join(Role, Role.id == UserRole.role_id)
        .filter(OrganizationMembership.organization_id.in_(org_ids), Role.name.in_(["ACADEMIC_ADMIN", "PROGRAM_MANAGER"]))
        .group_by(OrganizationMembership.organization_id)
        .all()
    )
    instructor_counts = dict(
        db.query(OrganizationMembership.organization_id, func.count(distinct(OrganizationMembership.user_id)))
        .join(UserRole, UserRole.organization_membership_id == OrganizationMembership.id)
        .join(Role, Role.id == UserRole.role_id)
        .filter(OrganizationMembership.organization_id.in_(org_ids), Role.name == "TRAINER")
        .group_by(OrganizationMembership.organization_id)
        .all()
    )
    student_counts = dict(
        db.query(Student.organization_id, func.count(Student.id))
        .filter(Student.organization_id.in_(org_ids))
        .group_by(Student.organization_id)
        .all()
    )
    program_counts = dict(
        db.query(Program.organization_id, func.count(Program.id))
        .filter(Program.organization_id.in_(org_ids))
        .group_by(Program.organization_id)
        .all()
    )

    results = []
    for org in orgs:
        read_data = OrganizationRead.model_validate(org)
        read_data.total_admins = admin_counts.get(org.id, 0)
        read_data.total_instructors = instructor_counts.get(org.id, 0)
        read_data.total_students = student_counts.get(org.id, 0)
        read_data.total_programs = program_counts.get(org.id, 0)
        results.append(read_data)

    return results


@router.get("/{organization_id}", response_model=OrganizationRead)
def get_organization(
    organization_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> OrganizationRead:
    organization = db.get(Organization, organization_id)
    if organization is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")

    if not is_super_admin(current_user) and organization_id not in get_user_organization_ids(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized for this organization")

    return populate_org_stats(db, organization)


@router.post("", response_model=OrganizationRead, status_code=status.HTTP_201_CREATED)
def create_organization(
    payload: OrganizationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("SUPER_ADMIN")),
) -> OrganizationRead:
    if db.query(Organization).filter(Organization.slug == payload.slug.strip().lower()).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An organization with this slug already exists")
    if db.query(Organization).filter(Organization.code == payload.code.strip().upper()).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An organization with this code already exists")

    org = Organization(
        name=payload.name.strip(),
        slug=payload.slug.strip().lower(),
        code=payload.code.strip().upper(),
        status=payload.status,
        primary_domain=payload.primary_domain.strip() if payload.primary_domain else None,
        lms_domain=payload.lms_domain.strip() if payload.lms_domain else None,
        brand_config=payload.brand_config or {},
    )
    db.add(org)
    db.flush()

    # Automatically add current Super Admin membership to the new organization
    super_role = db.query(Role).filter(Role.name == "SUPER_ADMIN").first()
    membership = OrganizationMembership(
        user_id=current_user.id,
        organization_id=org.id,
        status=MembershipStatus.ACTIVE,
    )
    db.add(membership)
    db.flush()
    if super_role:
        db.add(UserRole(organization_membership_id=membership.id, role_id=super_role.id))

    db.commit()
    db.refresh(org)
    return populate_org_stats(db, org)


@router.patch("/{organization_id}", response_model=OrganizationRead)
def update_organization(
    organization_id: int,
    payload: OrganizationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("SUPER_ADMIN", "ACADEMIC_ADMIN", "PROGRAM_MANAGER")),
) -> OrganizationRead:
    org = db.get(Organization, organization_id)
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")

    super_admin = is_super_admin(current_user)
    if not super_admin and organization_id not in get_user_organization_ids(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized for this organization")

    if payload.name is not None:
        org.name = payload.name.strip()
    if payload.slug is not None:
        if not super_admin:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only Super Admins can update organization slug")
        slug_val = payload.slug.strip().lower()
        slug_check = db.query(Organization).filter(Organization.slug == slug_val, Organization.id != org.id).first()
        if slug_check:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Slug already in use")
        org.slug = slug_val
    if payload.code is not None:
        if not super_admin:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only Super Admins can update organization code")
        code_val = payload.code.strip().upper()
        code_check = db.query(Organization).filter(Organization.code == code_val, Organization.id != org.id).first()
        if code_check:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Code already in use")
        org.code = code_val
    if payload.primary_domain is not None:
        org.primary_domain = payload.primary_domain.strip() if payload.primary_domain else None
    if payload.lms_domain is not None:
        org.lms_domain = payload.lms_domain.strip() if payload.lms_domain else None
    if payload.status is not None:
        if not super_admin:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only Super Admins can update organization status")
        org.status = payload.status
    if payload.brand_config is not None:
        merged_brand = dict(org.brand_config or {})
        merged_brand.update(payload.brand_config)
        org.brand_config = merged_brand

    db.commit()
    db.refresh(org)
    return populate_org_stats(db, org)

