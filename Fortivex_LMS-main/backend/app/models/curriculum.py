"""Curriculum models: ProgramModule -> Week -> Lesson -> Activity."""

from typing import TYPE_CHECKING, Optional

from sqlalchemy import ForeignKey, String, Text, Integer, JSON
from sqlalchemy import Enum as SqlEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.models.enums import ActivityType

if TYPE_CHECKING:
    from app.models.program import Program

class ProgramModule(Base, TimestampMixin):
    __tablename__ = "program_modules"

    id: Mapped[int] = mapped_column(primary_key=True)
    program_id: Mapped[int] = mapped_column(
        ForeignKey("programs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    order: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    program: Mapped["Program"] = relationship(back_populates="program_modules")
    weeks: Mapped[list["Week"]] = relationship(back_populates="program_module", cascade="all, delete-orphan")

class Week(Base, TimestampMixin):
    __tablename__ = "weeks"

    id: Mapped[int] = mapped_column(primary_key=True)
    program_module_id: Mapped[int] = mapped_column(
        ForeignKey("program_modules.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    week_number: Mapped[int] = mapped_column(Integer, nullable=False)
    order: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    program_module: Mapped["ProgramModule"] = relationship(back_populates="weeks")
    lessons: Mapped[list["Lesson"]] = relationship(back_populates="week", cascade="all, delete-orphan")

class Lesson(Base, TimestampMixin):
    __tablename__ = "lessons"

    id: Mapped[int] = mapped_column(primary_key=True)
    week_id: Mapped[int] = mapped_column(
        ForeignKey("weeks.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    order: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    week: Mapped["Week"] = relationship(back_populates="lessons")
    activities: Mapped[list["Activity"]] = relationship(back_populates="lesson", cascade="all, delete-orphan")

class Activity(Base, TimestampMixin):
    __tablename__ = "activities"

    id: Mapped[int] = mapped_column(primary_key=True)
    lesson_id: Mapped[int] = mapped_column(
        ForeignKey("lessons.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    activity_type: Mapped[ActivityType] = mapped_column(
        SqlEnum(ActivityType, name="activity_type_enum"), nullable=False
    )
    content: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    order: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    lesson: Mapped["Lesson"] = relationship(back_populates="activities")
