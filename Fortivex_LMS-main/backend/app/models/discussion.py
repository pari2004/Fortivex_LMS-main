from datetime import datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.organization import Organization
    from app.models.program import Program
    from app.models.user import User


class DiscussionThread(Base, TimestampMixin):
    """Community Q&A and technical discussion threads scoped to organization."""

    __tablename__ = "discussion_threads"

    id: Mapped[int] = mapped_column(primary_key=True)
    organization_id: Mapped[int] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    author_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    program_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("programs.id", ondelete="SET NULL"), nullable=True, index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    tags: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    upvotes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    has_verified_answer: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    organization: Mapped["Organization"] = relationship()
    author: Mapped["User"] = relationship()
    program: Mapped[Optional["Program"]] = relationship()
    replies: Mapped[List["DiscussionReply"]] = relationship(
        back_populates="thread",
        cascade="all, delete-orphan",
        order_by="DiscussionReply.created_at.asc()",
    )


class DiscussionReply(Base, TimestampMixin):
    """Responses and peer insights for a discussion thread."""

    __tablename__ = "discussion_replies"

    id: Mapped[int] = mapped_column(primary_key=True)
    thread_id: Mapped[int] = mapped_column(
        ForeignKey("discussion_threads.id", ondelete="CASCADE"), nullable=False, index=True
    )
    author_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    thread: Mapped["DiscussionThread"] = relationship(back_populates="replies")
    author: Mapped["User"] = relationship()


class DiscussionUpvote(Base, TimestampMixin):
    """Tracks per-user upvotes on discussion threads to prevent double upvoting."""

    __tablename__ = "discussion_upvotes"
    __table_args__ = (
        UniqueConstraint("thread_id", "user_id", name="uq_discussion_thread_user_upvote"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    thread_id: Mapped[int] = mapped_column(
        ForeignKey("discussion_threads.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    thread: Mapped["DiscussionThread"] = relationship()
    user: Mapped["User"] = relationship()

