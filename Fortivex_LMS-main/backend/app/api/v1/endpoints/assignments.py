import os
import shutil
from datetime import datetime, date
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session, joinedload

from app.api import deps
from app.models.curriculum import Activity, Lesson, Week, ProgramModule
from app.models.program import Program
from app.models.cohort import Cohort
from app.models.enrollment import Enrollment
from app.models.student import Student
from app.models.user import User
from app.models.progress import AssignmentSubmission, ActivityCompletion
from app.models.enums import ActivityType, EnrollmentStatus
from app.schemas.assignment import (
    AssignmentCreate,
    AssignmentResponse,
    StudentAssignmentResponse,
    SubmissionGradeRequest,
    AssignmentSubmissionDetail,
)
from app.services.achievements import record_student_activity_today
from app.services.notification_service import notify_students_for_new_assignment
from app.services.storage import MAX_FILE_SIZE_MB_ASSIGNMENT, get_storage_service

router = APIRouter(prefix="/assignments", tags=["assignments"])

ASSIGNMENT_STAFF_ROLES = [
    "SUPER_ADMIN",
    "ACADEMIC_ADMIN",
    "PROGRAM_MANAGER",
    "TRAINER",
    "INSTRUCTOR",
    "MENTOR",
    "LEAD_TRAINER",
    "PROGRAM_DIRECTOR",
]

ASSIGNMENT_UPLOAD_DIR = os.path.join("uploads", "assignments")
os.makedirs(ASSIGNMENT_UPLOAD_DIR, exist_ok=True)


def _compute_due_in_days(due_date_str: Optional[str]) -> int:
    if not due_date_str or not isinstance(due_date_str, str):
        return 0
    try:
        # Try YYYY-MM-DD
        d = datetime.strptime(due_date_str[:10], "%Y-%m-%d").date()
        return (d - date.today()).days
    except Exception:
        return 0


@router.get("", response_model=List[AssignmentResponse])
def get_all_assignments(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.require_roles(*ASSIGNMENT_STAFF_ROLES)),
):
    """List all curriculum assignments across programs for admin & instructors."""
    query = (
        db.query(Activity)
        .filter(Activity.activity_type == ActivityType.ASSIGNMENT)
        .join(Activity.lesson)
        .join(Lesson.week)
        .join(Week.program_module)
        .join(ProgramModule.program)
    )
    if not deps.is_super_admin(current_user):
        org_ids = deps.get_user_organization_ids(current_user)
        if not org_ids:
            return []
        query = query.filter(Program.organization_id.in_(org_ids))

    activities = query.options(
        joinedload(Activity.lesson)
        .joinedload(Lesson.week)
        .joinedload(Week.program_module)
        .joinedload(ProgramModule.program)
    ).all()

    result = []
    for a in activities:
        lesson = a.lesson
        week = lesson.week if lesson else None
        module = week.program_module if week else None
        program = module.program if module else None

        content = a.content if isinstance(a.content, dict) else {}
        due_date = content.get("due_date")

        # Submission counts
        subs = (
            db.query(AssignmentSubmission)
            .filter(AssignmentSubmission.activity_id == a.id)
            .all()
        )
        total_subs = len(subs)
        graded_subs = sum(1 for s in subs if s.status == "GRADED")
        pending_subs = total_subs - graded_subs

        result.append(
            AssignmentResponse(
                id=a.id,
                title=a.title,
                program_id=program.id if program else 0,
                program_name=program.name if program else "Unassigned Program",
                module_title=module.title if module else "General",
                week_title=week.title if week else "Week 1",
                lesson_id=lesson.id if lesson else 0,
                lesson_title=lesson.title if lesson else "General Lesson",
                description=content.get("description", ""),
                due_date=due_date,
                due_in_days=_compute_due_in_days(due_date),
                points=content.get("points", 100),
                rubric=content.get("rubric", []),
                submission_type=content.get("submission_type", "file"),
                submissions_count=total_subs,
                graded_count=graded_subs,
                pending_count=pending_subs,
                created_at=a.created_at.isoformat() if a.created_at else None,
            )
        )

    return result


@router.post("", response_model=AssignmentResponse)
def create_assignment(
    payload: AssignmentCreate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.require_roles(*ASSIGNMENT_STAFF_ROLES)),
):
    """Create or assign a new assignment in a program."""
    program = db.query(Program).filter(Program.id == payload.program_id).first()
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    if not deps.is_super_admin(current_user) and program.organization_id not in deps.get_user_organization_ids(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized for this organization")

    target_lesson = None
    if payload.lesson_id:
        target_lesson = db.query(Lesson).filter(Lesson.id == payload.lesson_id).first()

    if not target_lesson:
        # Find first lesson or create default module/week/lesson hierarchy
        module = (
            db.query(ProgramModule)
            .filter(ProgramModule.program_id == program.id)
            .order_by(ProgramModule.order.asc())
            .first()
        )
        if not module:
            module = ProgramModule(
                program_id=program.id,
                title="Module 1: Core Curriculum",
                order=1,
            )
            db.add(module)
            db.flush()

        week = (
            db.query(Week)
            .filter(Week.program_module_id == module.id)
            .order_by(Week.order.asc())
            .first()
        )
        if not week:
            week = Week(
                program_module_id=module.id,
                title="Week 1: Fundamentals",
                week_number=1,
                order=1,
            )
            db.add(week)
            db.flush()

        lesson = (
            db.query(Lesson)
            .filter(Lesson.week_id == week.id)
            .order_by(Lesson.order.asc())
            .first()
        )
        if not lesson:
            lesson = Lesson(
                week_id=week.id,
                title="Assignments & Capstone",
                order=1,
            )
            db.add(lesson)
            db.flush()

        target_lesson = lesson

    content = {
        "description": payload.description,
        "due_date": payload.due_date,
        "points": payload.points,
        "rubric": payload.rubric or [],
        "submission_type": payload.submission_type,
    }

    activity = Activity(
        lesson_id=target_lesson.id,
        title=payload.title,
        activity_type=ActivityType.ASSIGNMENT,
        content=content,
        order=1,
    )
    db.add(activity)
    db.commit()
    db.refresh(activity)

    notify_students_for_new_assignment(
        db=db,
        program_id=program.id,
        assignment_title=activity.title,
        due_date=payload.due_date,
        activity_id=activity.id,
    )

    lesson = target_lesson
    week = lesson.week
    module = week.program_module

    return AssignmentResponse(
        id=activity.id,
        title=activity.title,
        program_id=program.id,
        program_name=program.name,
        module_title=module.title if module else "General",
        week_title=week.title if week else "Week 1",
        lesson_id=lesson.id,
        lesson_title=lesson.title,
        description=payload.description,
        due_date=payload.due_date,
        due_in_days=_compute_due_in_days(payload.due_date),
        points=payload.points,
        rubric=payload.rubric or [],
        submission_type=payload.submission_type,
        submissions_count=0,
        graded_count=0,
        pending_count=0,
        created_at=activity.created_at.isoformat() if activity.created_at else None,
    )


@router.delete("/{activity_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_assignment(
    activity_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.require_roles(*ASSIGNMENT_STAFF_ROLES)),
):
    """Delete an assignment activity."""
    activity = (
        db.query(Activity)
        .filter(Activity.id == activity_id, Activity.activity_type == ActivityType.ASSIGNMENT)
        .first()
    )
    if not activity:
        raise HTTPException(status_code=404, detail="Assignment not found")
    program = activity.lesson.week.program_module.program if (activity.lesson and activity.lesson.week and activity.lesson.week.program_module) else None
    if program and not deps.is_super_admin(current_user) and program.organization_id not in deps.get_user_organization_ids(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized for this organization")

    db.delete(activity)
    db.commit()


@router.get("/{activity_id}/submissions", response_model=List[AssignmentSubmissionDetail])
def get_assignment_submissions(
    activity_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.require_roles(*ASSIGNMENT_STAFF_ROLES)),
):
    """View all student submissions for a specific assignment."""
    activity = db.query(Activity).filter(Activity.id == activity_id).first()
    if not activity:
        raise HTTPException(status_code=404, detail="Assignment not found")
    program = activity.lesson.week.program_module.program if (activity.lesson and activity.lesson.week and activity.lesson.week.program_module) else None
    if program and not deps.is_super_admin(current_user) and program.organization_id not in deps.get_user_organization_ids(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized for this organization")

    submissions = (
        db.query(AssignmentSubmission)
        .filter(AssignmentSubmission.activity_id == activity_id)
        .options(
            joinedload(AssignmentSubmission.student).joinedload(Student.user),
            joinedload(AssignmentSubmission.graded_by),
        )
        .order_by(AssignmentSubmission.created_at.desc())
        .all()
    )

    result = []
    for s in submissions:
        student = s.student
        user = student.user if student else None
        graded_by = s.graded_by

        result.append(
            AssignmentSubmissionDetail(
                id=s.id,
                student_id=s.student_id,
                student_name=user.full_name if user else f"Student #{s.student_id}",
                student_email=user.email if user else "",
                student_code=student.student_code if student else None,
                submitted_at=s.created_at.strftime("%b %d, %Y %I:%M %p") if s.created_at else "",
                file_name=s.file_name,
                file_url=s.file_url,
                notes=s.notes,
                status=s.status,
                score=s.score,
                feedback=s.feedback,
                graded_at=s.graded_at.strftime("%b %d, %Y %I:%M %p") if s.graded_at else None,
                graded_by_name=graded_by.full_name if graded_by else None,
            )
        )

    return result


@router.post("/submissions/{submission_id}/grade", response_model=dict)
def grade_submission(
    submission_id: int,
    payload: SubmissionGradeRequest,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.require_roles(*ASSIGNMENT_STAFF_ROLES)),
):
    """Grade a student submission with score and feedback."""
    submission = (
        db.query(AssignmentSubmission)
        .filter(AssignmentSubmission.id == submission_id)
        .first()
    )
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    activity = db.query(Activity).filter(Activity.id == submission.activity_id).first()
    program = activity.lesson.week.program_module.program if (activity and activity.lesson and activity.lesson.week and activity.lesson.week.program_module) else None
    if program and not deps.is_super_admin(current_user) and program.organization_id not in deps.get_user_organization_ids(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized for this organization")

    submission.score = payload.score
    submission.feedback = payload.feedback
    submission.status = "GRADED"
    submission.graded_by_user_id = current_user.id
    submission.graded_at = datetime.utcnow()

    # Also record ActivityCompletion for student if not yet recorded
    existing_completion = (
        db.query(ActivityCompletion)
        .filter(
            ActivityCompletion.student_id == submission.student_id,
            ActivityCompletion.activity_id == submission.activity_id,
        )
        .first()
    )
    if not existing_completion:
        comp = ActivityCompletion(
            student_id=submission.student_id,
            activity_id=submission.activity_id,
        )
        db.add(comp)

    db.commit()
    db.refresh(submission)

    return {
        "success": True,
        "message": f"Submission graded successfully! Score: {submission.score}",
        "submission_id": submission.id,
        "status": submission.status,
    }


@router.get("/my-assignments", response_model=List[StudentAssignmentResponse])
def get_my_assignments(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.require_roles("STUDENT")),
):
    """Fetch all curriculum assignments for the student's enrolled programs with live DB status."""
    student = db.query(Student).filter(Student.user_id == current_user.id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found")

    enrollments = (
        db.query(Enrollment)
        .filter(
            Enrollment.student_id == student.id,
            Enrollment.status.in_([EnrollmentStatus.ENROLLED, EnrollmentStatus.ACTIVE]),
        )
        .all()
    )
    if not enrollments:
        return []

    # Get programs from enrollments and cohorts
    program_ids = set()
    for e in enrollments:
        if e.program_id:
            program_ids.add(e.program_id)
        if e.cohort_id:
            cohort = db.query(Cohort).filter(Cohort.id == e.cohort_id).first()
            if cohort:
                for p in cohort.programs:
                    program_ids.add(p.id)

    if not program_ids:
        return []

    # Query all activities of type ASSIGNMENT for these programs
    activities = (
        db.query(Activity)
        .join(Lesson, Lesson.id == Activity.lesson_id)
        .join(Week, Week.id == Lesson.week_id)
        .join(ProgramModule, ProgramModule.id == Week.program_module_id)
        .filter(
            Activity.activity_type == ActivityType.ASSIGNMENT,
            ProgramModule.program_id.in_(list(program_ids)),
        )
        .options(
            joinedload(Activity.lesson)
            .joinedload(Lesson.week)
            .joinedload(Week.program_module)
            .joinedload(ProgramModule.program)
        )
        .all()
    )

    # Query student submissions
    submissions = (
        db.query(AssignmentSubmission)
        .filter(AssignmentSubmission.student_id == student.id)
        .all()
    )
    sub_map = {s.activity_id: s for s in submissions}

    result = []
    for a in activities:
        lesson = a.lesson
        program = lesson.week.program_module.program if lesson and lesson.week and lesson.week.program_module else None
        content = a.content if isinstance(a.content, dict) else {}
        due_date = content.get("due_date")
        sub = sub_map.get(a.id)

        status_val = "pending"
        score_val = None
        feedback_val = None
        file_name_val = None
        file_url_val = None
        notes_val = None
        sub_id = None
        submitted_at_val = None

        if sub:
            status_val = "graded" if sub.status == "GRADED" else "submitted"
            score_val = sub.score
            feedback_val = sub.feedback
            file_name_val = sub.file_name
            file_url_val = sub.file_url
            notes_val = sub.notes
            sub_id = sub.id
            submitted_at_val = sub.created_at.strftime("%b %d, %Y") if sub.created_at else None

        result.append(
            StudentAssignmentResponse(
                id=a.id,
                title=a.title,
                program_id=program.id if program else 0,
                program_name=program.name if program else "Enrolled Program",
                lesson_id=lesson.id if lesson else 0,
                lesson_title=lesson.title if lesson else "Lesson",
                description=content.get("description", ""),
                due_date=due_date,
                due_in_days=_compute_due_in_days(due_date),
                points=content.get("points", 100),
                rubric=content.get("rubric", []),
                submission_type=content.get("submission_type", "file"),
                status=status_val,
                submission_id=sub_id,
                submitted_at=submitted_at_val,
                file_name=file_name_val,
                file_url=file_url_val,
                notes=notes_val,
                score=score_val,
                instructorFeedback=feedback_val,
            )
        )

    return result


@router.post("/{activity_id}/submit")
async def submit_assignment(
    activity_id: int,
    file: Optional[UploadFile] = File(None),
    notes: Optional[str] = Form(None),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.require_roles("STUDENT")),
):
    """Submit an assignment with file and/or notes."""
    student = db.query(Student).filter(Student.user_id == current_user.id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found")

    activity = (
        db.query(Activity)
        .filter(Activity.id == activity_id, Activity.activity_type == ActivityType.ASSIGNMENT)
        .first()
    )
    if not activity:
        raise HTTPException(status_code=404, detail="Assignment not found")

    file_name = None
    file_url = None

    if file and file.filename:
        storage_service = get_storage_service()
        file_url = await storage_service.upload_file(
            file=file,
            folder=f"assignments/{activity_id}/{student.id}",
            max_size_mb=MAX_FILE_SIZE_MB_ASSIGNMENT,
            user_id=current_user.id,
        )
        file_name = storage_service.sanitize_filename(file.filename)

    submission = (
        db.query(AssignmentSubmission)
        .filter(
            AssignmentSubmission.student_id == student.id,
            AssignmentSubmission.activity_id == activity_id,
        )
        .first()
    )

    if not submission:
        submission = AssignmentSubmission(
            student_id=student.id,
            activity_id=activity_id,
            file_name=file_name,
            file_url=file_url,
            notes=notes,
            status="SUBMITTED",
        )
        db.add(submission)
    else:
        if file_name:
            submission.file_name = file_name
            submission.file_url = file_url
        if notes is not None:
            submission.notes = notes
        submission.status = "SUBMITTED"

    # Also log completion & study streak
    completion = (
        db.query(ActivityCompletion)
        .filter(
            ActivityCompletion.student_id == student.id,
            ActivityCompletion.activity_id == activity_id,
        )
        .first()
    )
    if not completion:
        completion = ActivityCompletion(
            student_id=student.id,
            activity_id=activity_id,
        )
        db.add(completion)

    record_student_activity_today(db, student.id)

    db.commit()
    db.refresh(submission)

    return {
        "success": True,
        "message": "Assignment successfully submitted!",
        "submission_id": submission.id,
        "file_name": submission.file_name,
        "status": submission.status,
    }
