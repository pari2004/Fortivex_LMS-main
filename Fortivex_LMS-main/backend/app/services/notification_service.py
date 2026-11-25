"""Notification service handling creation, dispatching, and bulk notifications."""

import logging
from typing import Optional
from sqlalchemy.orm import Session

from app.models.enrollment import Enrollment
from app.models.notification import Notification
from app.models.program import Program
from app.models.student import Student

logger = logging.getLogger(__name__)


def create_notification(
    db: Session,
    user_id: int,
    title: str,
    message: str,
    type: str = "SYSTEM",
    organization_id: Optional[int] = None,
    link_url: Optional[str] = None,
) -> Notification:
    """Create a single user notification."""
    notification = Notification(
        user_id=user_id,
        organization_id=organization_id,
        title=title.strip(),
        message=message.strip(),
        type=type,
        link_url=link_url,
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)
    return notification


def notify_students_for_new_assignment(
    db: Session,
    program_id: int,
    assignment_title: str,
    due_date: Optional[str] = None,
    activity_id: Optional[int] = None,
) -> int:
    """
    Notify all students enrolled in the given program that a new assignment has been posted.
    """
    try:
        program = db.get(Program, program_id)
        if not program:
            logger.warning(f"Program {program_id} not found when dispatching assignment notifications")
            return 0

        enrollments = (
            db.query(Enrollment)
            .join(Student, Student.id == Enrollment.student_id)
            .filter(Enrollment.program_id == program_id)
            .all()
        )

        user_ids = {e.student.user_id for e in enrollments if e.student and e.student.user_id}
        if not user_ids:
            logger.info(f"No enrolled students found to notify for program {program_id}")
            return 0

        due_text = f" Due date: {due_date}." if due_date else ""
        msg = f"A new assignment '{assignment_title}' has been published in {program.name}.{due_text}"

        count = 0
        for uid in user_ids:
            notif = Notification(
                user_id=uid,
                organization_id=program.organization_id,
                title=f"New Assignment: {assignment_title}",
                message=msg,
                type="ASSIGNMENT",
                link_url="/student/assignments",
            )
            db.add(notif)
            count += 1

        db.commit()
        logger.info(f"Dispatched {count} assignment notifications for '{assignment_title}' (Program {program_id})")
        return count
    except Exception as exc:
        db.rollback()
        logger.error(f"Failed to dispatch assignment notifications: {exc}", exc_info=True)
        return 0


def notify_students_for_new_quiz(
    db: Session,
    program_id: int,
    quiz_title: str,
    activity_id: Optional[int] = None,
) -> int:
    """
    Notify all students enrolled in the given program that a new quiz has been published.
    """
    try:
        program = db.get(Program, program_id)
        if not program:
            logger.warning(f"Program {program_id} not found when dispatching quiz notifications")
            return 0

        enrollments = (
            db.query(Enrollment)
            .join(Student, Student.id == Enrollment.student_id)
            .filter(Enrollment.program_id == program_id)
            .all()
        )

        user_ids = {e.student.user_id for e in enrollments if e.student and e.student.user_id}
        if not user_ids:
            logger.info(f"No enrolled students found to notify for program {program_id}")
            return 0

        msg = f"A new knowledge check quiz '{quiz_title}' is now available in {program.name}."

        count = 0
        for uid in user_ids:
            notif = Notification(
                user_id=uid,
                organization_id=program.organization_id,
                title=f"New Quiz: {quiz_title}",
                message=msg,
                type="QUIZ",
                link_url="/student/quizzes",
            )
            db.add(notif)
            count += 1

        db.commit()
        logger.info(f"Dispatched {count} quiz notifications for '{quiz_title}' (Program {program_id})")
        return count
    except Exception as exc:
        db.rollback()
        logger.error(f"Failed to dispatch quiz notifications: {exc}", exc_info=True)
        return 0
