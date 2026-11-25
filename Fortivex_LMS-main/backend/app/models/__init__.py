"""Import every model here so Alembic autogenerate and Base.metadata see them all."""

from app.models.cohort import Cohort
from app.models.enrollment import Enrollment
from app.models.organization import Organization, OrganizationMembership
from app.models.permission import Permission
from app.models.program import Program
from app.models.role import Role, RolePermission, UserRole
from app.models.student import Student
from app.models.user import User
from app.models.curriculum import ProgramModule, Week, Lesson, Activity
from app.models.progress import (
    ActivityCompletion,
    QuizAttempt,
    StudentStreak,
    StudentStreakFreezeLog,
    AssignmentSubmission,
)
from app.models.document import ProgramDocument
from app.models.chatbot import ChatbotDailyUsage, ChatbotMessage
from app.models.notification import Notification
from app.models.discussion import DiscussionThread, DiscussionReply, DiscussionUpvote

__all__ = [
    "Cohort",
    "Enrollment",
    "Organization",
    "OrganizationMembership",
    "Permission",
    "Program",
    "Role",
    "RolePermission",
    "UserRole",
    "Student",
    "User",
    "ProgramModule",
    "Week",
    "Lesson",
    "Activity",
    "ProgramDocument",
    "QuizAttempt",
    "StudentStreak",
    "StudentStreakFreezeLog",
    "AssignmentSubmission",
    "ChatbotDailyUsage",
    "ChatbotMessage",
    "Notification",
    "DiscussionThread",
    "DiscussionReply",
    "DiscussionUpvote",
]
