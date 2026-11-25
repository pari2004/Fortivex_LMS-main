from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.api.deps import (
    get_current_active_user,
    get_user_organization_ids,
    is_super_admin,
    require_roles,
)
from app.core.exceptions import NotFoundError, PermissionDeniedError
from app.db.session import get_db
from app.models.enums import StudentLifecycleStatus
from app.models.student import Student
from app.models.user import User
from app.schemas.student import StudentCreate, StudentRead

router = APIRouter(prefix="/students", tags=["students"])


@router.get("", response_model=list[StudentRead])
def list_students(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> list[Student]:
    """Scoped to the caller's organizations — see api/deps.py MVP note.
    SUPER_ADMIN sees every student."""
    query = db.query(Student)
    if not is_super_admin(current_user):
        org_ids = get_user_organization_ids(current_user)
        if not org_ids:
            return []
        query = query.filter(Student.organization_id.in_(org_ids))
    return query.order_by(Student.id).offset(skip).limit(min(limit, 200)).all()


@router.get("/{student_id}", response_model=StudentRead)
def get_student(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Student:
    student = db.get(Student, student_id)
    if student is None:
        raise NotFoundError("Student not found")
    if not is_super_admin(current_user) and student.organization_id not in get_user_organization_ids(current_user):
        raise PermissionDeniedError("Not a member of this organization")
    return student


@router.post("", response_model=StudentRead, status_code=201)
def create_student(
    payload: StudentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("SUPER_ADMIN", "ACADEMIC_ADMIN", "PROGRAM_MANAGER")),
) -> Student:
    if not is_super_admin(current_user) and payload.organization_id not in get_user_organization_ids(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this organization")
    student = Student(**payload.model_dump())
    db.add(student)
    db.commit()
    db.refresh(student)
    return student

from datetime import datetime, date, timedelta
from pydantic import BaseModel
from app.models.cohort import Cohort
from app.models.enrollment import Enrollment
from app.models.enums import ActivityType, EnrollmentStatus
from app.models.progress import ActivityCompletion, AssignmentSubmission, QuizAttempt
from app.models.curriculum import ProgramModule, Week, Lesson, Activity


class StudentNavCounts(BaseModel):
    pending_assignments: int = 0
    unattempted_quizzes: int = 0
    is_live_now: bool = False
    has_upcoming_live_today: bool = False
    upcoming_live_count: int = 0
    active_session_title: str | None = None


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


@router.get("/me/nav-counts", response_model=StudentNavCounts)
def get_student_nav_counts(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("STUDENT")),
) -> StudentNavCounts:
    """Fetch live navigation indicator counts for the authenticated student.
    Returns pending assignments, unattempted quizzes, and whether a live lecture is active now or today.
    """
    student = db.query(Student).filter(Student.user_id == current_user.id).first()
    if not student:
        return StudentNavCounts()

    enrollments = (
        db.query(Enrollment)
        .filter(
            Enrollment.student_id == student.id,
            Enrollment.status.in_([EnrollmentStatus.ENROLLED, EnrollmentStatus.ACTIVE]),
        )
        .all()
    )
    if not enrollments:
        return StudentNavCounts()

    cohort_ids = [e.cohort_id for e in enrollments if e.cohort_id is not None]
    program_ids = {e.program_id for e in enrollments if e.program_id}
    if cohort_ids:
        cohorts = (
            db.query(Cohort)
            .filter(Cohort.id.in_(cohort_ids))
            .options(joinedload(Cohort.programs))
            .all()
        )
        for c in cohorts:
            for p in c.programs:
                program_ids.add(p.id)

    if not program_ids:
        return StudentNavCounts()

    prog_id_list = list(program_ids)

    # 1. Pending assignments (assignments in enrolled programs minus student submissions)
    assignment_activities = (
        db.query(Activity.id)
        .join(Lesson, Lesson.id == Activity.lesson_id)
        .join(Week, Week.id == Lesson.week_id)
        .join(ProgramModule, ProgramModule.id == Week.program_module_id)
        .filter(
            Activity.activity_type == ActivityType.ASSIGNMENT,
            ProgramModule.program_id.in_(prog_id_list),
        )
        .all()
    )
    assignment_ids = {a[0] for a in assignment_activities}
    pending_assignments = 0
    if assignment_ids:
        submissions = (
            db.query(AssignmentSubmission.activity_id)
            .filter(
                AssignmentSubmission.student_id == student.id,
                AssignmentSubmission.activity_id.in_(list(assignment_ids)),
            )
            .all()
        )
        submitted_assignment_ids = {s[0] for s in submissions}
        pending_assignments = max(0, len(assignment_ids - submitted_assignment_ids))

    # 2. Unattempted quizzes (quizzes in enrolled programs minus student attempts)
    quiz_activities = (
        db.query(Activity.id)
        .join(Lesson, Lesson.id == Activity.lesson_id)
        .join(Week, Week.id == Lesson.week_id)
        .join(ProgramModule, ProgramModule.id == Week.program_module_id)
        .filter(
            Activity.activity_type == ActivityType.QUIZ,
            ProgramModule.program_id.in_(prog_id_list),
        )
        .all()
    )
    quiz_ids = {q[0] for q in quiz_activities}
    unattempted_quizzes = 0
    if quiz_ids:
        attempts = (
            db.query(QuizAttempt.activity_id)
            .filter(
                QuizAttempt.student_id == student.id,
                QuizAttempt.activity_id.in_(list(quiz_ids)),
            )
            .all()
        )
        attempted_quiz_ids = {a[0] for a in attempts}
        unattempted_quizzes = max(0, len(quiz_ids - attempted_quiz_ids))

    # 3. Live lectures (active right now or scheduled for today)
    live_activities = (
        db.query(Activity)
        .join(Lesson, Lesson.id == Activity.lesson_id)
        .join(Week, Week.id == Lesson.week_id)
        .join(ProgramModule, ProgramModule.id == Week.program_module_id)
        .filter(
            Activity.activity_type == ActivityType.LIVE_SESSION,
            ProgramModule.program_id.in_(prog_id_list),
        )
        .all()
    )

    is_live_now = False
    has_upcoming_live_today = False
    upcoming_live_count = 0
    active_session_title = None

    now = datetime.now()
    today = date.today()

    for act in live_activities:
        content = act.content if isinstance(act.content, dict) else {}
        start_str = content.get("start_time")
        end_str = content.get("end_time")
        if not start_str:
            continue

        start_dt = _parse_iso_datetime(start_str)
        if not start_dt:
            continue
        end_dt = _parse_iso_datetime(end_str) if end_str else None
        if not end_dt or end_dt <= start_dt:
            end_dt = start_dt + timedelta(hours=1)

        if start_dt <= now <= end_dt:
            is_live_now = True
            active_session_title = act.title
        elif start_dt > now:
            if start_dt.date() == today:
                has_upcoming_live_today = True
                upcoming_live_count += 1

    return StudentNavCounts(
        pending_assignments=pending_assignments,
        unattempted_quizzes=unattempted_quizzes,
        is_live_now=is_live_now,
        has_upcoming_live_today=has_upcoming_live_today,
        upcoming_live_count=upcoming_live_count,
        active_session_title=active_session_title,
    )


class ProgramProgress(BaseModel):
    enrollment_id: int
    program_id: int
    program_name: str
    cohort_name: str | None
    status: str
    progress_percentage: int

class StudentDashboardResponse(BaseModel):
    kpis: dict
    programs: list[ProgramProgress]
    upcoming_tasks: list[dict]

@router.get("/me/dashboard", response_model=StudentDashboardResponse)
def get_student_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("STUDENT"))
):
    student = db.query(Student).filter(Student.user_id == current_user.id).first()
    if not student:
        user_org_ids = get_user_organization_ids(current_user)
        org_id = user_org_ids[0] if user_org_ids else 1
        student = Student(
            user_id=current_user.id,
            organization_id=org_id,
            student_code=f"STU-{current_user.id:04d}",
            lifecycle_status=StudentLifecycleStatus.ENROLLMENT,
        )
        db.add(student)
        db.commit()
        db.refresh(student)

    enrollments = db.query(Enrollment).options(joinedload(Enrollment.program), joinedload(Enrollment.cohort)).filter(Enrollment.student_id == student.id).all()
    
    # Pre-fetch all completions
    completions = db.query(ActivityCompletion.activity_id).filter(ActivityCompletion.student_id == student.id).all()
    completed_ids = {c[0] for c in completions}

    active_courses = 0
    program_progress_list = []
    program_ids = [e.program_id for e in enrollments if e.program_id]
    program_activities: dict[int, set[int]] = {}
    if program_ids:
        act_rows = (
            db.query(ProgramModule.program_id, Activity.id)
            .join(Week, Week.program_module_id == ProgramModule.id)
            .join(Lesson, Lesson.week_id == Week.id)
            .join(Activity, Activity.lesson_id == Lesson.id)
            .filter(ProgramModule.program_id.in_(program_ids))
            .all()
        )
        for pid, aid in act_rows:
            program_activities.setdefault(pid, set()).add(aid)

    for e in enrollments:
        if e.status in ["ACTIVE", "ENROLLED"]:
            active_courses += 1

        prog_acts = program_activities.get(e.program_id, set())
        total_count = len(prog_acts)
        completed_count = len(prog_acts & completed_ids)
        progress_percentage = int((completed_count / total_count * 100)) if total_count > 0 else 0

        program_progress_list.append(ProgramProgress(
            enrollment_id=e.id,
            program_id=e.program_id or 0,
            program_name=e.program.name if e.program else "Enrolled Program",
            cohort_name=e.cohort.name if e.cohort else "Self-paced",
            status=e.status.value if hasattr(e.status, "value") else str(e.status),
            progress_percentage=progress_percentage
        ))

    hours_studied = len(completed_ids) * 1.5

    # Mock some upcoming tasks based on active programs
    upcoming_tasks = []
    for p in program_progress_list:
        if p.status in ["ACTIVE", "ENROLLED"]:
            upcoming_tasks.append({
                "title": f"Next Lesson in {p.program_name}",
                "date": "Coming up",
                "course": p.program_name,
                "color": "var(--primary)"
            })
            if len(upcoming_tasks) >= 3:
                break

    if not upcoming_tasks:
         upcoming_tasks = [
            {"title": "No upcoming tasks", "date": "-", "course": "Enjoy your free time", "color": "var(--success)"}
        ]

    return StudentDashboardResponse(
        kpis={
            "active_courses": active_courses,
            "lessons_completed": len(completed_ids),
            "programs_enrolled": len(program_progress_list),
            "hours_studied": f"{hours_studied}h"
        },
        programs=program_progress_list,
        upcoming_tasks=upcoming_tasks
    )
