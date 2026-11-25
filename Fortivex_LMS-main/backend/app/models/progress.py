from datetime import date, datetime
from sqlalchemy import ForeignKey, UniqueConstraint, JSON, Integer, Date, DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

class ActivityCompletion(Base, TimestampMixin):
    __tablename__ = "activity_completions"
    __table_args__ = (UniqueConstraint("student_id", "activity_id", name="uq_student_activity"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    activity_id: Mapped[int] = mapped_column(ForeignKey("activities.id", ondelete="CASCADE"), nullable=False, index=True)

    student = relationship("Student")
    activity = relationship("Activity")

class QuizAttempt(Base, TimestampMixin):
    __tablename__ = "quiz_attempts"
    
    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    activity_id: Mapped[int] = mapped_column(ForeignKey("activities.id", ondelete="CASCADE"), nullable=False, index=True)
    
    score: Mapped[int] = mapped_column(nullable=False)
    total_questions: Mapped[int] = mapped_column(nullable=False)
    answers_json: Mapped[dict] = mapped_column(JSON, nullable=False)

    student = relationship("Student")
    activity = relationship("Activity")


class StudentStreak(Base, TimestampMixin):
    __tablename__ = "student_streaks"

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(
        ForeignKey("students.id", ondelete="CASCADE"), unique=True, nullable=False, index=True
    )
    current_streak: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    longest_streak: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_activity_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    # Weekly streak freeze / save allowance (1 per student per week)
    streak_freeze_count: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    last_freeze_replenished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    total_freezes_used: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_freeze_used_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    student = relationship("Student")
    freeze_logs = relationship("StudentStreakFreezeLog", back_populates="streak", cascade="all, delete-orphan")


class StudentStreakFreezeLog(Base, TimestampMixin):
    __tablename__ = "student_streak_freeze_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    streak_id: Mapped[int] = mapped_column(
        ForeignKey("student_streaks.id", ondelete="CASCADE"), nullable=False, index=True
    )
    student_id: Mapped[int] = mapped_column(
        ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True
    )
    saved_date: Mapped[date] = mapped_column(Date, nullable=False)
    reason: Mapped[str] = mapped_column(String(50), default="WEEKLY_PROTECTION", nullable=False)

    streak = relationship("StudentStreak", back_populates="freeze_logs")
    student = relationship("Student")


class AssignmentSubmission(Base, TimestampMixin):
    __tablename__ = "assignment_submissions"

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(
        ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True
    )
    activity_id: Mapped[int] = mapped_column(
        ForeignKey("activities.id", ondelete="CASCADE"), nullable=False, index=True
    )
    file_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    file_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="SUBMITTED", nullable=False)  # "SUBMITTED", "GRADED"
    score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    feedback: Mapped[str | None] = mapped_column(Text, nullable=True)
    graded_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    graded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    student = relationship("Student")
    activity = relationship("Activity")
    graded_by = relationship("User", foreign_keys=[graded_by_user_id])


