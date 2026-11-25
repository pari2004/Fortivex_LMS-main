"""Program endpoints.

MVP scoping rule (same shape as organizations.py/students.py/
enrollments.py): staff roles (SUPER_ADMIN/ACADEMIC_ADMIN/PROGRAM_MANAGER/
TRAINER/MENTOR) see every program in the organizations they belong to (all
organizations for SUPER_ADMIN). A STUDENT-role (or any user holding no
staff role) only sees programs they actually have an enrollment in — per
today's brief, "students should only see programs/cohorts related to their
enrollment".
"""

from sqlalchemy.exc import IntegrityError
from fastapi import APIRouter, Depends, HTTPException, Query, status, UploadFile, File, Form, Response
from sqlalchemy.orm import Session, joinedload
import os
import shutil
import uuid

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
from app.models.program import Program
from app.models.user import User
from app.models.curriculum import Activity, Lesson, Week, ProgramModule
from app.models.enums import ActivityType
from app.services.storage import get_storage_service
from app.models.document import ProgramDocument
from app.schemas.program import ProgramCreate, ProgramRead, ProgramUpdate
from app.schemas.document import ProgramDocument as ProgramDocumentSchema, ProgramDocumentUpdate

router = APIRouter(prefix="/programs", tags=["programs"])

STAFF_ROLES = {
    "SUPER_ADMIN",
    "ACADEMIC_ADMIN",
    "PROGRAM_MANAGER",
    "INSTRUCTOR",
    "TRAINER",
    "LEAD_TRAINER",
    "MENTOR",
}


def _enrolled_program_ids(db: Session, current_user: User) -> set[int]:
    enrollments = (
        db.query(Enrollment)
        .options(joinedload(Enrollment.cohort).joinedload(Cohort.programs))
        .filter(Enrollment.student.has(user_id=current_user.id))
        .all()
    )
    pids = set()
    for e in enrollments:
        if e.program_id:
            pids.add(e.program_id)
        if e.cohort:
            for p in e.cohort.programs:
                pids.add(p.id)
    return pids


@router.get("", response_model=list[ProgramRead])
def list_programs(
    organization_id: int | None = Query(default=None),
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> list[Program]:
    query = db.query(Program)

    if is_super_admin(current_user):
        pass
    elif get_user_roles(current_user) & STAFF_ROLES:
        org_ids = get_user_organization_ids(current_user)
        if not org_ids:
            return []
        query = query.filter(Program.organization_id.in_(org_ids))
    else:
        program_ids = _enrolled_program_ids(db, current_user)
        if not program_ids:
            return []
        query = query.filter(Program.id.in_(program_ids))

    if organization_id is not None:
        query = query.filter(Program.organization_id == organization_id)

    return query.order_by(Program.id).offset(skip).limit(min(limit, 200)).all()


@router.get("/documents/all")
def list_all_accessible_documents(
    organization_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> list[dict]:
    """List all program documents and curriculum lesson files accessible to the current user."""
    query = db.query(Program)

    if is_super_admin(current_user):
        pass
    elif get_user_roles(current_user) & STAFF_ROLES:
        org_ids = get_user_organization_ids(current_user)
        if not org_ids:
            return []
        query = query.filter(Program.organization_id.in_(org_ids))
    else:
        program_ids = _enrolled_program_ids(db, current_user)
        if not program_ids:
            return []
        query = query.filter(Program.id.in_(program_ids))

    if organization_id is not None:
        query = query.filter(Program.organization_id == organization_id)

    accessible_programs = query.all()
    if not accessible_programs:
        return []

    prog_map = {p.id: p for p in accessible_programs}
    pids = list(prog_map.keys())

    results: list[dict] = []

    # 1. Fetch direct ProgramDocument records
    program_docs = (
        db.query(ProgramDocument)
        .filter(ProgramDocument.program_id.in_(pids))
        .order_by(ProgramDocument.id.desc())
        .all()
    )

    for doc in program_docs:
        prog = prog_map.get(doc.program_id)
        results.append({
            "id": doc.id,
            "document_id": doc.id,
            "program_id": doc.program_id,
            "program_name": prog.name if prog else "General Program",
            "program_code": prog.code if prog else "",
            "title": doc.title,
            "file_url": doc.file_url,
            "use_for_quiz": bool(doc.use_for_quiz),
            "source": "PROGRAM_DOCUMENT",
            "created_at": doc.created_at.isoformat() if getattr(doc, "created_at", None) else None,
            "updated_at": doc.updated_at.isoformat() if getattr(doc, "updated_at", None) else None,
        })

    # 2. Fetch Curriculum Activity document files (PDF/READING)
    curriculum_activities = (
        db.query(Activity, ProgramModule.program_id)
        .join(Lesson, Lesson.id == Activity.lesson_id)
        .join(Week, Week.id == Lesson.week_id)
        .join(ProgramModule, ProgramModule.id == Week.program_module_id)
        .filter(
            Activity.activity_type.in_([ActivityType.PDF, ActivityType.READING]),
            ProgramModule.program_id.in_(pids),
        )
        .order_by(Activity.id.desc())
        .all()
    )

    for act, prog_id in curriculum_activities:
        content = act.content if isinstance(act.content, dict) else {}
        file_url = content.get("url")
        if not file_url:
            continue
        prog = prog_map.get(prog_id)
        results.append({
            "id": f"act-{act.id}",
            "activity_id": act.id,
            "program_id": prog_id,
            "program_name": prog.name if prog else "Curriculum Program",
            "program_code": prog.code if prog else "",
            "title": act.title,
            "file_url": file_url,
            "use_for_quiz": False,
            "source": "CURRICULUM_ACTIVITY",
            "created_at": act.created_at.isoformat() if getattr(act, "created_at", None) else None,
            "updated_at": act.updated_at.isoformat() if getattr(act, "updated_at", None) else None,
        })

    return results


@router.get("/{program_id}", response_model=ProgramRead)
def get_program(
    program_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Program:
    program = db.get(Program, program_id)
    if program is None:
        raise NotFoundError("Program not found")

    if is_super_admin(current_user):
        return program

    if get_user_roles(current_user) & STAFF_ROLES:
        if program.organization_id not in get_user_organization_ids(current_user):
            raise PermissionDeniedError("Not a member of this organization")
        return program

    if program.id not in _enrolled_program_ids(db, current_user):
        raise PermissionDeniedError("Not enrolled in this program")
    return program


@router.post("", response_model=ProgramRead, status_code=201)
def create_program(
    payload: ProgramCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("SUPER_ADMIN", "ACADEMIC_ADMIN", "PROGRAM_MANAGER")),
) -> Program:
    if not is_super_admin(current_user) and payload.organization_id not in get_user_organization_ids(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this organization")

    program = Program(**payload.model_dump())
    db.add(program)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A program with this code already exists for this organization",
        )
    db.refresh(program)
    return program


@router.patch("/{program_id}", response_model=ProgramRead)
def update_program(
    program_id: int,
    payload: ProgramUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("SUPER_ADMIN", "ACADEMIC_ADMIN", "PROGRAM_MANAGER")),
) -> Program:
    program = db.get(Program, program_id)
    if program is None:
        raise NotFoundError("Program not found")
    if not is_super_admin(current_user) and program.organization_id not in get_user_organization_ids(current_user):
        raise PermissionDeniedError("Not a member of this organization")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(program, field, value)

    db.commit()
    db.refresh(program)
    return program

@router.delete("/{program_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_program(
    program_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("SUPER_ADMIN", "ACADEMIC_ADMIN", "PROGRAM_MANAGER")),
) -> None:
    program = db.get(Program, program_id)
    if program is None:
        raise NotFoundError("Program not found")
    if not is_super_admin(current_user) and program.organization_id not in get_user_organization_ids(current_user):
        raise PermissionDeniedError("Not a member of this organization")

    db.delete(program)
    db.commit()


@router.post("/{program_id}/documents", response_model=ProgramDocumentSchema)
async def upload_program_document(
    program_id: int,
    title: str = Form(...),
    use_for_quiz: bool = Form(True),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("SUPER_ADMIN", "ACADEMIC_ADMIN", "PROGRAM_MANAGER", "INSTRUCTOR", "TRAINER", "LEAD_TRAINER", "MENTOR")),
):
    program = db.get(Program, program_id)
    if not program:
        raise NotFoundError("Program not found")
    if not is_super_admin(current_user) and program.organization_id not in get_user_organization_ids(current_user):
        raise PermissionDeniedError("Not a member of this organization")

    # save file securely via storage service (S3)
    storage_service = get_storage_service()
    file_url = await storage_service.upload_file(
        file=file,
        folder=f"programs/{program_id}/documents",
        max_size_mb=50,
        user_id=current_user.id,
    )
    
    doc = ProgramDocument(
        program_id=program_id,
        title=title,
        use_for_quiz=use_for_quiz,
        file_url=file_url
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


@router.get("/{program_id}/documents", response_model=list[ProgramDocumentSchema])
def list_program_documents(
    program_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    program = db.get(Program, program_id)
    if not program:
        raise NotFoundError("Program not found")
        
    if is_super_admin(current_user):
        pass
    elif get_user_roles(current_user) & STAFF_ROLES:
        if program.organization_id not in get_user_organization_ids(current_user):
            raise PermissionDeniedError("Not a member of this organization")
    else:
        if program.id not in _enrolled_program_ids(db, current_user):
            raise PermissionDeniedError("Not enrolled in this program")
            
    docs = db.query(ProgramDocument).filter(ProgramDocument.program_id == program_id).all()
    return docs


@router.patch("/documents/{document_id}", response_model=ProgramDocumentSchema)
def update_program_document(
    document_id: int,
    payload: ProgramDocumentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("SUPER_ADMIN", "ACADEMIC_ADMIN", "PROGRAM_MANAGER", "INSTRUCTOR", "TRAINER", "LEAD_TRAINER", "MENTOR")),
):
    doc = db.get(ProgramDocument, document_id)
    if not doc:
        raise NotFoundError("Document not found")
        
    program = db.get(Program, doc.program_id)
    if not is_super_admin(current_user) and program.organization_id not in get_user_organization_ids(current_user):
        raise PermissionDeniedError("Not a member of this organization")
        
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(doc, field, value)
        
    db.commit()
    db.refresh(doc)
    return doc


@router.delete("/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_program_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("SUPER_ADMIN", "ACADEMIC_ADMIN", "PROGRAM_MANAGER", "INSTRUCTOR", "TRAINER", "LEAD_TRAINER", "MENTOR")),
):
    doc = db.get(ProgramDocument, document_id)
    if not doc:
        raise NotFoundError("Document not found")
        
    program = db.get(Program, doc.program_id)
    if not is_super_admin(current_user) and program.organization_id not in get_user_organization_ids(current_user):
        raise PermissionDeniedError("Not a member of this organization")

    db.delete(doc)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

