"""Cohort endpoints. Same MVP scoping rule as programs.py: staff roles see
every cohort in their organization(s); a STUDENT-role user only sees
cohorts they actually have an enrollment in.
"""

from datetime import date
from sqlalchemy.exc import IntegrityError
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, selectinload

from app.api.deps import (
    get_current_active_user,
    get_user_organization_ids,
    get_user_roles,
    is_super_admin,
    require_roles,
)
from app.core.exceptions import NotFoundError, PermissionDeniedError
from app.db.session import get_db
from app.models.cohort import Cohort
from app.models.enrollment import Enrollment
from app.models.enums import CohortStatus
from app.models.program import Program
from app.models.user import User
from app.schemas.cohort import CohortCreate, CohortRead, CohortUpdate

router = APIRouter(prefix="/cohorts", tags=["cohorts"])

STAFF_ROLES = {"SUPER_ADMIN", "ACADEMIC_ADMIN", "PROGRAM_MANAGER", "TRAINER", "MENTOR"}


def _sync_cohort_status(cohort: Cohort, today: date) -> bool:
    """Sync cohort status based on its start/end dates if not manually cancelled.
    Returns True if status changed."""
    if cohort.status == CohortStatus.CANCELLED:
        return False

    new_status = cohort.status
    if cohort.end_date and cohort.end_date < today:
        new_status = CohortStatus.COMPLETED
    elif cohort.start_date <= today:
        if cohort.status == CohortStatus.UPCOMING:
            new_status = CohortStatus.ACTIVE
    elif cohort.start_date > today:
        if cohort.status == CohortStatus.ACTIVE:
            new_status = CohortStatus.UPCOMING

    if new_status != cohort.status:
        cohort.status = new_status
        return True
    return False


def _enrolled_cohort_ids(db: Session, current_user: User) -> set[int]:
    return {
        row[0]
        for row in db.query(Enrollment.cohort_id)
        .filter(Enrollment.student.has(user_id=current_user.id))
        .filter(Enrollment.cohort_id.isnot(None))
    }


@router.get("", response_model=list[CohortRead])
def list_cohorts(
    program_id: int | None = Query(default=None),
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> list[Cohort]:
    query = db.query(Cohort).options(selectinload(Cohort.programs))

    if is_super_admin(current_user):
        pass
    elif get_user_roles(current_user) & STAFF_ROLES:
        org_ids = get_user_organization_ids(current_user)
        if not org_ids:
            return []
        query = query.filter(Cohort.organization_id.in_(org_ids))
    else:
        cohort_ids = _enrolled_cohort_ids(db, current_user)
        if not cohort_ids:
            return []
        query = query.filter(Cohort.id.in_(cohort_ids))

    if program_id is not None:
        query = query.filter(Cohort.programs.any(id=program_id))

    results = query.order_by(Cohort.id).offset(skip).limit(min(limit, 200)).all()
    today = date.today()
    changed = False
    for cohort in results:
        if _sync_cohort_status(cohort, today):
            changed = True
    if changed:
        try:
            db.commit()
        except Exception:
            db.rollback()

    return results


@router.get("/{cohort_id}", response_model=CohortRead)
def get_cohort(
    cohort_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Cohort:
    cohort = db.get(Cohort, cohort_id)
    if cohort is None:
        raise NotFoundError("Cohort not found")

    if is_super_admin(current_user):
        pass
    elif get_user_roles(current_user) & STAFF_ROLES:
        if cohort.organization_id not in get_user_organization_ids(current_user):
            raise PermissionDeniedError("Not a member of this organization")
    elif cohort.id not in _enrolled_cohort_ids(db, current_user):
        raise PermissionDeniedError("Not enrolled in this cohort")

    if _sync_cohort_status(cohort, date.today()):
        try:
            db.commit()
            db.refresh(cohort)
        except Exception:
            db.rollback()

    return cohort


@router.post("", response_model=CohortRead, status_code=201)
def create_cohort(
    payload: CohortCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("SUPER_ADMIN", "ACADEMIC_ADMIN", "PROGRAM_MANAGER")),
) -> Cohort:
    if not is_super_admin(current_user) and payload.organization_id not in get_user_organization_ids(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this organization")

    programs = db.query(Program).filter(Program.id.in_(payload.program_ids)).all()
    for program in programs:
        if program.organization_id != payload.organization_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="All programs must belong to the same organization",
            )

    cohort_data = payload.model_dump(exclude={"program_ids"})
    today = date.today()
    if payload.status == CohortStatus.UPCOMING or payload.status is None:
        if payload.end_date and payload.end_date < today:
            cohort_data["status"] = CohortStatus.COMPLETED
        elif payload.start_date <= today:
            cohort_data["status"] = CohortStatus.ACTIVE
        else:
            cohort_data["status"] = CohortStatus.UPCOMING

    cohort = Cohort(**cohort_data, programs=programs)
    db.add(cohort)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A cohort with this code already exists for this program",
        )
    db.refresh(cohort)
    return cohort


@router.patch("/{cohort_id}", response_model=CohortRead)
def update_cohort(
    cohort_id: int,
    payload: CohortUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("SUPER_ADMIN", "ACADEMIC_ADMIN", "PROGRAM_MANAGER")),
) -> Cohort:
    cohort = db.get(Cohort, cohort_id)
    if cohort is None:
        raise NotFoundError("Cohort not found")
    if not is_super_admin(current_user) and cohort.organization_id not in get_user_organization_ids(current_user):
        raise PermissionDeniedError("Not a member of this organization")

    update_data = payload.model_dump(exclude_unset=True)
    if "program_ids" in update_data:
        program_ids = update_data.pop("program_ids")
        if program_ids is not None:
            programs = db.query(Program).filter(Program.id.in_(program_ids)).all()
            cohort.programs = programs

    for field, value in update_data.items():
        setattr(cohort, field, value)

    if "status" not in update_data:
        _sync_cohort_status(cohort, date.today())

    db.commit()
    db.refresh(cohort)
    return cohort


@router.post("/{cohort_id}/programs/{program_id}", status_code=status.HTTP_200_OK)
def assign_program_to_cohort(
    cohort_id: int,
    program_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("SUPER_ADMIN", "ACADEMIC_ADMIN", "PROGRAM_MANAGER")),
) -> dict:
    cohort = db.get(Cohort, cohort_id)
    program = db.get(Program, program_id)
    if not cohort or not program:
        raise NotFoundError("Cohort or Program not found")
    if not is_super_admin(current_user) and cohort.organization_id not in get_user_organization_ids(current_user):
        raise PermissionDeniedError("Not a member of this organization")
    
    if program not in cohort.programs:
        cohort.programs.append(program)
        db.commit()
    return {"status": "success"}

@router.delete("/{cohort_id}/programs/{program_id}", status_code=status.HTTP_204_NO_CONTENT)
def unassign_program_from_cohort(
    cohort_id: int,
    program_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("SUPER_ADMIN", "ACADEMIC_ADMIN", "PROGRAM_MANAGER")),
) -> None:
    cohort = db.get(Cohort, cohort_id)
    program = db.get(Program, program_id)
    if not cohort or not program:
        raise NotFoundError("Cohort or Program not found")
    if not is_super_admin(current_user) and cohort.organization_id not in get_user_organization_ids(current_user):
        raise PermissionDeniedError("Not a member of this organization")
    
    if program in cohort.programs:
        cohort.programs.remove(program)
        db.commit()

@router.delete("/{cohort_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_cohort(
    cohort_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("SUPER_ADMIN", "ACADEMIC_ADMIN", "PROGRAM_MANAGER")),
) -> None:
    cohort = db.get(Cohort, cohort_id)
    if cohort is None:
        raise NotFoundError("Cohort not found")
    if not is_super_admin(current_user) and cohort.organization_id not in get_user_organization_ids(current_user):
        raise PermissionDeniedError("Not a member of this organization")

    db.delete(cohort)
    db.commit()
