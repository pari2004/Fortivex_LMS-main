import json
from datetime import datetime, date, timedelta
from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Response
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session, selectinload, joinedload

from app.api import deps
from app.models.user import User
from app.models.program import Program
from app.models.cohort import Cohort
from app.models.student import Student
from app.models.organization import OrganizationMembership
from app.models.curriculum import ProgramModule, Week, Lesson, Activity
from app.models.enums import ActivityType, MembershipStatus, EnrollmentStatus
from app.models.enrollment import Enrollment
from app.schemas import curriculum as schemas
from app.core.redis import redis_client
from app.services.notification_service import (
    notify_students_for_new_assignment,
    notify_students_for_new_quiz,
)
from app.services.csv_quiz import parse_quiz_csv, SAMPLE_CSV_CONTENT

router = APIRouter()

CURRICULUM_EDITOR_ROLES = (
    "SUPER_ADMIN",
    "ACADEMIC_ADMIN",
    "PROGRAM_MANAGER",
    "INSTRUCTOR",
    "TRAINER",
    "LEAD_TRAINER",
    "PROGRAM_DIRECTOR",
    "MENTOR",
    "TEACHING_ASSISTANT",
)


def _check_program_access(
    program: Program,
    current_user: User,
    db: Session,
    require_editor: bool = False,
) -> None:
    if deps.is_super_admin(current_user):
        return

    org_ids = deps.get_user_organization_ids(current_user)
    if program.organization_id not in org_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized for this organization",
        )

    if not require_editor:
        user_roles = deps.get_user_roles(current_user)
        if not (user_roles & set(CURRICULUM_EDITOR_ROLES)):
            enrollments = (
                db.query(Enrollment)
                .options(joinedload(Enrollment.cohort).joinedload(Cohort.programs))
                .filter(Enrollment.student.has(user_id=current_user.id))
                .all()
            )
            enrolled_ids = set()
            for e in enrollments:
                if e.program_id:
                    enrolled_ids.add(e.program_id)
                if e.cohort:
                    for p in e.cohort.programs:
                        enrolled_ids.add(p.id)
            if program.id not in enrolled_ids:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not enrolled in this program",
                )


def _invalidate_curriculum_cache(program_id: int):
    if redis_client:
        redis_client.delete(f"curriculum:program:{program_id}")


@router.get("/programs/{program_id}/curriculum", response_model=List[schemas.ProgramModule])
def read_program_curriculum(
    program_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Get the full curriculum tree (Modules -> Weeks -> Lessons -> Activities) for a given program.
    """
    program = db.query(Program).filter(Program.id == program_id).first()
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")

    _check_program_access(program, current_user, db, require_editor=False)

    cache_key = f"curriculum:program:{program_id}"
    if redis_client:
        cached_data = redis_client.get(cache_key)
        if cached_data:
            return JSONResponse(content=json.loads(cached_data))

    modules = db.query(ProgramModule).options(
        selectinload(ProgramModule.weeks).selectinload(Week.lessons).selectinload(Lesson.activities)
    ).filter(
        ProgramModule.program_id == program_id
    ).order_by(ProgramModule.order).all()

    if redis_client:
        redis_client.setex(
            cache_key,
            3600,  # 1 hour cache
            json.dumps(jsonable_encoder(modules)),
        )

    return modules


# --- Program Modules ---

@router.post("/programs/{program_id}/modules", response_model=schemas.ProgramModule, status_code=status.HTTP_201_CREATED)
def create_program_module(
    program_id: int,
    module_in: schemas.ProgramModuleCreate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.require_roles(*CURRICULUM_EDITOR_ROLES)),
) -> Any:
    """
    Create a new program module.
    """
    program = db.query(Program).filter(Program.id == program_id).first()
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")

    _check_program_access(program, current_user, db, require_editor=True)

    module = ProgramModule(
        program_id=program_id,
        title=module_in.title,
        description=module_in.description,
        order=module_in.order,
    )
    db.add(module)
    db.commit()
    db.refresh(module)
    _invalidate_curriculum_cache(program_id)
    return module


@router.delete("/modules/{module_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_program_module(
    module_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.require_roles(*CURRICULUM_EDITOR_ROLES)),
) -> None:
    """
    Delete a program module.
    """
    module = db.query(ProgramModule).filter(ProgramModule.id == module_id).first()
    if not module:
        raise HTTPException(status_code=404, detail="Program module not found")

    _check_program_access(module.program, current_user, db, require_editor=True)

    program_id = module.program_id
    db.delete(module)
    db.commit()
    _invalidate_curriculum_cache(program_id)


@router.put("/modules/{module_id}", response_model=schemas.ProgramModule)
def update_program_module(
    module_id: int,
    module_in: schemas.ProgramModuleUpdate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.require_roles(*CURRICULUM_EDITOR_ROLES)),
) -> Any:
    module = db.query(ProgramModule).filter(ProgramModule.id == module_id).first()
    if not module:
        raise HTTPException(status_code=404, detail="Program module not found")

    _check_program_access(module.program, current_user, db, require_editor=True)

    update_data = module_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(module, field, value)
    db.commit()
    db.refresh(module)
    _invalidate_curriculum_cache(module.program_id)
    return module


# --- Weeks ---

@router.post("/modules/{module_id}/weeks", response_model=schemas.Week, status_code=status.HTTP_201_CREATED)
def create_week(
    module_id: int,
    week_in: schemas.WeekCreate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.require_roles(*CURRICULUM_EDITOR_ROLES)),
) -> Any:
    module = db.query(ProgramModule).filter(ProgramModule.id == module_id).first()
    if not module:
        raise HTTPException(status_code=404, detail="Program module not found")

    _check_program_access(module.program, current_user, db, require_editor=True)

    week = Week(
        program_module_id=module_id,
        title=week_in.title,
        week_number=week_in.week_number,
        order=week_in.order,
    )
    db.add(week)
    db.commit()
    db.refresh(week)
    _invalidate_curriculum_cache(module.program_id)
    return week


@router.put("/weeks/{week_id}", response_model=schemas.Week)
def update_week(
    week_id: int,
    week_in: schemas.WeekUpdate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.require_roles(*CURRICULUM_EDITOR_ROLES)),
) -> Any:
    week = db.query(Week).filter(Week.id == week_id).first()
    if not week:
        raise HTTPException(status_code=404, detail="Week not found")

    _check_program_access(week.program_module.program, current_user, db, require_editor=True)

    update_data = week_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(week, field, value)
    db.commit()
    db.refresh(week)
    _invalidate_curriculum_cache(week.program_module.program_id)
    return week


@router.delete("/weeks/{week_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_week(
    week_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.require_roles(*CURRICULUM_EDITOR_ROLES)),
) -> None:
    week = db.query(Week).filter(Week.id == week_id).first()
    if not week:
        raise HTTPException(status_code=404, detail="Week not found")

    _check_program_access(week.program_module.program, current_user, db, require_editor=True)

    program_id = week.program_module.program_id
    db.delete(week)
    db.commit()
    _invalidate_curriculum_cache(program_id)


# --- Lessons ---

@router.post("/weeks/{week_id}/lessons", response_model=schemas.Lesson, status_code=status.HTTP_201_CREATED)
def create_lesson(
    week_id: int,
    lesson_in: schemas.LessonCreate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.require_roles(*CURRICULUM_EDITOR_ROLES)),
) -> Any:
    week = db.query(Week).filter(Week.id == week_id).first()
    if not week:
        raise HTTPException(status_code=404, detail="Week not found")

    _check_program_access(week.program_module.program, current_user, db, require_editor=True)

    lesson = Lesson(
        week_id=week_id,
        title=lesson_in.title,
        description=lesson_in.description,
        order=lesson_in.order,
    )
    db.add(lesson)
    db.commit()
    db.refresh(lesson)
    _invalidate_curriculum_cache(week.program_module.program_id)
    return lesson


@router.put("/lessons/{lesson_id}", response_model=schemas.Lesson)
def update_lesson(
    lesson_id: int,
    lesson_in: schemas.LessonUpdate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.require_roles(*CURRICULUM_EDITOR_ROLES)),
) -> Any:
    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    _check_program_access(lesson.week.program_module.program, current_user, db, require_editor=True)

    update_data = lesson_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(lesson, field, value)
    db.commit()
    db.refresh(lesson)
    _invalidate_curriculum_cache(lesson.week.program_module.program_id)
    return lesson


@router.delete("/lessons/{lesson_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_lesson(
    lesson_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.require_roles(*CURRICULUM_EDITOR_ROLES)),
) -> None:
    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    _check_program_access(lesson.week.program_module.program, current_user, db, require_editor=True)

    program_id = lesson.week.program_module.program_id
    db.delete(lesson)
    db.commit()
    _invalidate_curriculum_cache(program_id)


# --- Activities ---

@router.post("/lessons/{lesson_id}/activities", response_model=schemas.Activity, status_code=status.HTTP_201_CREATED)
def create_activity(
    lesson_id: int,
    activity_in: schemas.ActivityCreate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.require_roles(*CURRICULUM_EDITOR_ROLES)),
) -> Any:
    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    _check_program_access(lesson.week.program_module.program, current_user, db, require_editor=True)

    activity = Activity(
        lesson_id=lesson_id,
        title=activity_in.title,
        activity_type=activity_in.activity_type,
        content=activity_in.content,
        order=activity_in.order,
    )
    db.add(activity)
    db.commit()
    db.refresh(activity)

    program_id = lesson.week.program_module.program_id
    if activity.activity_type == ActivityType.QUIZ:
        notify_students_for_new_quiz(
            db=db,
            program_id=program_id,
            quiz_title=activity.title,
            activity_id=activity.id,
        )
    elif activity.activity_type == ActivityType.ASSIGNMENT:
        due_val = activity.content.get("due_date") if isinstance(activity.content, dict) else None
        notify_students_for_new_assignment(
            db=db,
            program_id=program_id,
            assignment_title=activity.title,
            due_date=due_val,
            activity_id=activity.id,
        )

    _invalidate_curriculum_cache(program_id)
    return activity


@router.put("/activities/{activity_id}", response_model=schemas.Activity)
def update_activity(
    activity_id: int,
    activity_in: schemas.ActivityUpdate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.require_roles(*CURRICULUM_EDITOR_ROLES)),
) -> Any:
    activity = db.query(Activity).filter(Activity.id == activity_id).first()
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")

    _check_program_access(activity.lesson.week.program_module.program, current_user, db, require_editor=True)

    update_data = activity_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(activity, field, value)
    db.commit()
    db.refresh(activity)
    _invalidate_curriculum_cache(activity.lesson.week.program_module.program_id)
    return activity


@router.delete("/activities/{activity_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_activity(
    activity_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.require_roles(*CURRICULUM_EDITOR_ROLES)),
) -> None:
    activity = db.query(Activity).filter(Activity.id == activity_id).first()
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")

    _check_program_access(activity.lesson.week.program_module.program, current_user, db, require_editor=True)

    program_id = activity.lesson.week.program_module.program_id
    db.delete(activity)
    db.commit()
    _invalidate_curriculum_cache(program_id)


@router.get("/quizzes", response_model=List[dict])
def get_all_quizzes(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.require_roles(*CURRICULUM_EDITOR_ROLES)),
):
    """
    Get all quizzes across programs for the user's organization(s).
    """
    query = db.query(Activity).filter(Activity.activity_type == ActivityType.QUIZ)

    if not deps.is_super_admin(current_user):
        org_ids = deps.get_user_organization_ids(current_user)
        if not org_ids:
            return []
        query = (
            query.join(Activity.lesson)
            .join(Lesson.week)
            .join(Week.program_module)
            .join(ProgramModule.program)
            .filter(Program.organization_id.in_(org_ids))
        )

    quizzes = query.options(
        joinedload(Activity.lesson)
        .joinedload(Lesson.week)
        .joinedload(Week.program_module)
        .joinedload(ProgramModule.program)
    ).all()

    result = []
    for q in quizzes:
        lesson = q.lesson
        week = lesson.week if lesson else None
        module = week.program_module if week else None
        program = module.program if module else None

        result.append({
            "id": q.id,
            "title": q.title,
            "lesson_id": q.lesson_id,
            "lesson_title": lesson.title if lesson else "Unknown",
            "week_title": week.title if week else "Unknown",
            "module_title": module.title if module else "Unknown",
            "program_id": program.id if program else None,
            "program_name": program.name if program else "Unknown",
            "question_count": len(q.content.get("questions", [])) if (q.content and isinstance(q.content, dict)) else 0,
        })

    return result


@router.post("/quizzes/parse-csv")
@router.post("/curriculum/quizzes/parse-csv")
async def parse_quiz_csv_file(
    file: UploadFile = File(...),
    current_user: User = Depends(deps.require_roles(*CURRICULUM_EDITOR_ROLES)),
):
    """
    Parse an uploaded CSV file containing quiz questions.
    Returns list of parsed and validated questions.
    """
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are supported.")

    content = await file.read()
    text = content.decode("utf-8", errors="replace")

    try:
        questions = parse_quiz_csv(text)
        return {
            "questions": [q.model_dump() for q in questions],
            "count": len(questions),
            "filename": file.filename,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse CSV: {str(e)}")


@router.get("/quizzes/sample-csv")
def download_sample_quiz_csv(
    current_user: User = Depends(deps.get_current_active_user),
):
    """
    Download a sample CSV template for bulk quiz questions import.
    """
    return Response(
        content=SAMPLE_CSV_CONTENT,
        media_type="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=fortivex_quiz_template.csv"
        },
    )


def _parse_iso_datetime(dt_str: str | None) -> datetime | None:
    if not dt_str or not isinstance(dt_str, str):
        return None
    try:
        clean = dt_str.replace("Z", "+00:00")
        dt = datetime.fromisoformat(clean)
        if dt.tzinfo is not None:
            dt = dt.astimezone().replace(tzinfo=None)
        return dt
    except Exception:
        for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M"):
            try:
                return datetime.strptime(dt_str[:19], fmt)
            except Exception:
                continue
    return None


@router.get("/curriculum/live-status")
@router.get("/live/status")
def get_live_session_status(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> dict:
    """Fetch real-time live session status across programs accessible to the authenticated user."""
    active_memberships = [
        m for m in (current_user.memberships or [])
        if getattr(m, "status", None) == MembershipStatus.ACTIVE
    ]
    is_super_admin = any(
        r.role and r.role.name == "SUPER_ADMIN"
        for m in active_memberships
        for r in (m.user_roles or [])
    ) or getattr(current_user, "is_superuser", False)

    org_ids = [m.organization_id for m in active_memberships if getattr(m, "organization_id", None)]

    prog_query = db.query(Program.id)
    if not is_super_admin:
        if org_ids:
            prog_query = prog_query.filter(Program.organization_id.in_(org_ids))
        else:
            student = db.query(Student).filter(Student.user_id == current_user.id).first()
            if student:
                enrollments = (
                    db.query(Enrollment)
                    .filter(
                        Enrollment.student_id == student.id,
                        Enrollment.status.in_([EnrollmentStatus.ENROLLED, EnrollmentStatus.ACTIVE]),
                    )
                    .all()
                )
                p_ids = [e.program_id for e in enrollments if e.program_id]
                c_ids = [e.cohort_id for e in enrollments if e.cohort_id]
                if c_ids:
                    cohorts = db.query(Cohort).filter(Cohort.id.in_(c_ids)).options(joinedload(Cohort.programs)).all()
                    for c in cohorts:
                        for p in c.programs:
                            p_ids.append(p.id)
                if p_ids:
                    prog_query = prog_query.filter(Program.id.in_(p_ids))
                else:
                    return {
                        "is_live_now": False,
                        "live_today": 0,
                        "active_count": 0,
                        "active_title": None,
                        "sessions": [],
                    }
            else:
                return {
                    "is_live_now": False,
                    "live_today": 0,
                    "active_count": 0,
                    "active_title": None,
                    "sessions": [],
                }

    accessible_prog_ids = [p[0] for p in prog_query.all()]
    if not accessible_prog_ids:
        return {
            "is_live_now": False,
            "live_today": 0,
            "active_count": 0,
            "active_title": None,
            "sessions": [],
        }

    live_activities = (
        db.query(Activity)
        .join(Lesson, Lesson.id == Activity.lesson_id)
        .join(Week, Week.id == Lesson.week_id)
        .join(ProgramModule, ProgramModule.id == Week.program_module_id)
        .filter(
            Activity.activity_type == ActivityType.LIVE_SESSION,
            ProgramModule.program_id.in_(accessible_prog_ids),
        )
        .all()
    )

    now = datetime.now()
    today = date.today()
    is_live_now = False
    active_count = 0
    live_today = 0
    active_title = None
    session_list = []

    for act in live_activities:
        content = act.content if isinstance(act.content, dict) else {}
        start_str = content.get("start_time")
        end_str = content.get("end_time")
        if not start_str:
            continue

        session_list.append({
            "id": act.id,
            "title": act.title,
            "start_time": start_str,
            "end_time": end_str,
        })

        start_dt = _parse_iso_datetime(start_str)
        if not start_dt:
            continue
        end_dt = _parse_iso_datetime(end_str) if end_str else None
        if not end_dt or end_dt <= start_dt:
            end_dt = start_dt + timedelta(hours=1)

        if start_dt <= now <= end_dt:
            is_live_now = True
            active_count += 1
            if not active_title:
                active_title = act.title
        elif start_dt > now and start_dt.date() == today:
            live_today += 1

    return {
        "is_live_now": is_live_now,
        "live_today": live_today,
        "active_count": active_count,
        "active_title": active_title,
        "sessions": session_list,
    }
