"""Enrollment endpoints.

MVP scoping rule (documented, same shape as organizations.py/students.py):
staff roles (SUPER_ADMIN/ACADEMIC_ADMIN/PROGRAM_MANAGER/TRAINER/MENTOR) see
every enrollment in the organizations they belong to (all organizations for
SUPER_ADMIN); everyone else sees only enrollments on their own student
record(s), which is what a STUDENT-role dashboard needs.
"""

from sqlalchemy.exc import IntegrityError
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.api.deps import (
    get_current_active_user,
    get_user_organization_ids,
    get_user_roles,
    is_super_admin,
    require_roles,
)
from app.core.exceptions import NotFoundError
from app.db.session import get_db
from app.models.cohort import Cohort
from app.models.enrollment import Enrollment
from app.models.program import Program
from app.models.student import Student
from app.models.user import User
from app.schemas.enrollment import EnrollmentCreate, EnrollmentRead

router = APIRouter(prefix="/enrollments", tags=["enrollments"])

STAFF_ROLES = {"SUPER_ADMIN", "ACADEMIC_ADMIN", "PROGRAM_MANAGER", "TRAINER", "MENTOR"}


@router.get("", response_model=list[EnrollmentRead])
def list_enrollments(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> list[Enrollment]:
    query = db.query(Enrollment).options(joinedload(Enrollment.program), joinedload(Enrollment.cohort))

    if is_super_admin(current_user):
        pass
    elif get_user_roles(current_user) & STAFF_ROLES:
        org_ids = get_user_organization_ids(current_user)
        if not org_ids:
            return []
        query = query.filter(Enrollment.organization_id.in_(org_ids))
    else:
        student_ids = [s.id for s in db.query(Student.id).filter(Student.user_id == current_user.id)]
        if not student_ids:
            return []
        query = query.filter(Enrollment.student_id.in_(student_ids))

    return query.order_by(Enrollment.id).offset(skip).limit(min(limit, 200)).all()


@router.post("", response_model=EnrollmentRead, status_code=201)
def create_enrollment(
    payload: EnrollmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("SUPER_ADMIN", "ACADEMIC_ADMIN", "PROGRAM_MANAGER")),
) -> Enrollment:
    if not is_super_admin(current_user) and payload.organization_id not in get_user_organization_ids(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this organization")

    student = db.get(Student, payload.student_id)
    if student is None:
        raise NotFoundError("Student not found")

    program = db.get(Program, payload.program_id)
    if program is None:
        raise NotFoundError("Program not found")

    if student.organization_id != payload.organization_id or program.organization_id != payload.organization_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Student, program, and organization_id must all belong to the same organization",
        )

    if payload.cohort_id is not None:
        cohort = db.get(Cohort, payload.cohort_id)
        if cohort is None:
            raise NotFoundError("Cohort not found")
        if payload.program_id not in cohort.program_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="cohort_id must belong to program_id",
            )

    enrollment = Enrollment(**payload.model_dump())
    db.add(enrollment)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Student is already enrolled in this program",
        )
    db.refresh(enrollment)
    return enrollment
