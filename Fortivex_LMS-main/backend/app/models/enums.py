"""Shared enum types used across models.

Kept separate so the same Python enum class (and the same underlying
Postgres ENUM type, where two columns intentionally share one) isn't
redefined in multiple places.
"""

import enum


class OrganizationStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"


class MembershipStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"


class StudentLifecycleStatus(str, enum.Enum):
    """Full lifecycle per docs/ARCHITECTURE.md §7.

    MVP scope only stores this status — no admissions workflow is built
    against LEAD..PAYMENT here (see ARCHITECTURE.md §7 and §11: that may
    belong to the separate CRM project, pending confirmation). Students
    created by this application start at ENROLLMENT.
    """

    LEAD = "LEAD"
    APPLICATION = "APPLICATION"
    ADMISSION = "ADMISSION"
    PAYMENT = "PAYMENT"
    ENROLLMENT = "ENROLLMENT"
    COHORT_ASSIGNMENT = "COHORT_ASSIGNMENT"
    ORIENTATION = "ORIENTATION"
    ACTIVE = "ACTIVE"
    COMPLETED = "COMPLETED"
    ALUMNI = "ALUMNI"


class ProgramStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"


class EnrollmentStatus(str, enum.Enum):
    """Per today's LOGIN->...->ENROLLMENT->PROGRAM brief. Deliberately just
    these four values for MVP — no waitlist/deferred states yet."""

    ENROLLED = "ENROLLED"
    ACTIVE = "ACTIVE"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class CohortStatus(str, enum.Enum):
    """A cohort's own lifecycle, independent of individual enrollment
    status — per ARCHITECTURE.md §6, a cohort is "a running instance of a
    program"."""

    UPCOMING = "UPCOMING"
    ACTIVE = "ACTIVE"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class ActivityType(str, enum.Enum):
    VIDEO = "VIDEO"
    READING = "READING"
    PDF = "PDF"
    QUIZ = "QUIZ"
    CODING_EXERCISE = "CODING_EXERCISE"
    PRACTICE_LAB = "PRACTICE_LAB"
    HEALTHCARE_CASE_STUDY = "HEALTHCARE_CASE_STUDY"
    DATA_ANALYSIS = "DATA_ANALYSIS"
    ASSIGNMENT = "ASSIGNMENT"
    PROJECT = "PROJECT"
    CAPSTONE = "CAPSTONE"
    INTERVIEW_PREPARATION = "INTERVIEW_PREPARATION"
    LIVE_SESSION = "LIVE_SESSION"
    OTHER = "OTHER"
