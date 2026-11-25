"""Safe, idempotent local-dev seed data.

Creates: the two real tenants this LMS serves (Empowers Academy, Medivex
AI), the roles needed to exercise RBAC (SUPER_ADMIN, ACADEMIC_ADMIN,
STUDENT), one admin + one student user per organization, one program per
organization, and one enrollment for each seeded student.

NOT executed in this environment — no local PostgreSQL is reachable here
(see docs/DATABASE_NOTES.md). Run it yourself once `alembic upgrade head`
has been applied to a real dev database:

    cd backend && .venv/Scripts/python scripts/seed_dev_data.py

Safety:
- Refuses to run when ENVIRONMENT=production (see app/core/config.py).
- Idempotent: re-running does not create duplicates or raise on existing
  unique-constrained rows — it looks up by natural key first.
- No real student/user data. Passwords are placeholder dev-only values
  read from SEED_ADMIN_PASSWORD / SEED_STUDENT_PASSWORD env vars, falling
  back to an obviously-fake default — never commit or reuse this value
  anywhere real.
"""

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from datetime import date

from app.core.config import get_settings
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.cohort import Cohort
from app.models.enrollment import Enrollment
from app.models.enums import (
    CohortStatus,
    EnrollmentStatus,
    MembershipStatus,
    OrganizationStatus,
    ProgramStatus,
    ActivityType,
)
from app.models.organization import Organization, OrganizationMembership
from app.models.program import Program
from app.models.curriculum import ProgramModule, Week, Lesson, Activity
from app.models.role import Role, UserRole
from app.models.student import Student
from app.models.user import User

DEV_ADMIN_PASSWORD = os.environ.get("SEED_ADMIN_PASSWORD", "admin123")
DEV_STUDENT_PASSWORD = os.environ.get("SEED_STUDENT_PASSWORD", "student123")

ORGANIZATIONS = [
    {
        "name": "Empowers Academy",
        "slug": "empowers-academy",
        "code": "EMPOWERS",
        "lms_domain": "lms.empowersacademy.com",
        # One representative example program per org — not an exhaustive
        # catalog, just enough real data to exercise Program/Cohort end to
        # end. Not read by application logic; safe to extend freely.
        "example_program": {
            "name": "AIML Full Stack Development",
            "code": "AIML-FSD",
            "description": "Full-stack development with applied AI/ML.",
        },
    },
    {
        "name": "Medivex AI",
        "slug": "medivex-ai",
        "code": "MEDIVEX",
        "lms_domain": "lms.medivexai.com",
        "example_program": {
            "name": "Clinical Research",
            "code": "CLIN-RESEARCH",
            "description": "Foundations of clinical research and trial operations.",
        },
    },
]

ROLES = [
    {"name": "SUPER_ADMIN", "description": "Full platform access across all organizations"},
    {"name": "ACADEMIC_ADMIN", "description": "Organization-level administrator"},
    {"name": "PROGRAM_MANAGER", "description": "Program and curriculum manager"},
    {"name": "TRAINER", "description": "Instructor or Trainer for cohorts"},
    {"name": "MENTOR", "description": "Mentor for students"},
    {"name": "STUDENT", "description": "Enrolled learner"},
]


def get_or_create(db, model, defaults=None, **lookup):
    instance = db.query(model).filter_by(**lookup).first()
    if instance:
        return instance, False
    instance = model(**lookup, **(defaults or {}))
    db.add(instance)
    db.flush()
    return instance, True


def main() -> None:
    settings = get_settings()
    if settings.is_production:
        raise SystemExit("Refusing to seed: ENVIRONMENT=production. This script is dev-only.")

    db = SessionLocal()
    try:
        roles = {}
        for role_def in ROLES:
            role, _ = get_or_create(db, Role, name=role_def["name"], defaults={"description": role_def["description"]})
            roles[role_def["name"]] = role

        # Seed global Platform Super Admin
        super_admin_email = "superadmin@fortivex.com"
        super_admin_user, _ = get_or_create(
            db,
            User,
            email=super_admin_email,
            defaults={
                "hashed_password": hash_password(DEV_ADMIN_PASSWORD),
                "full_name": "Fortivex Super Admin",
                "phone_number": "+1 (555) 000-0001",
                "title": "Platform Super Administrator",
                "bio": "Cross-organization administrative access managing platform configuration, institutions, and academic directors.",
                "is_active": True,
            },
        )

        for org_def in ORGANIZATIONS:
            organization, _ = get_or_create(
                db,
                Organization,
                slug=org_def["slug"],
                defaults={
                    "name": org_def["name"],
                    "code": org_def["code"],
                    "status": OrganizationStatus.ACTIVE,
                    "lms_domain": org_def["lms_domain"],
                    "brand_config": {},
                },
            )

            # Grant Super Admin membership and role in this org
            super_membership, _ = get_or_create(
                db,
                OrganizationMembership,
                user_id=super_admin_user.id,
                organization_id=organization.id,
                defaults={"status": MembershipStatus.ACTIVE},
            )
            get_or_create(
                db,
                UserRole,
                organization_membership_id=super_membership.id,
                role_id=roles["SUPER_ADMIN"].id,
            )

            program, _ = get_or_create(
                db,
                Program,
                organization_id=organization.id,
                code="FOUNDATION",
                defaults={"name": f"{org_def['name']} Foundation Program", "status": ProgramStatus.ACTIVE},
            )

            admin_email = f"admin@{org_def['code'].lower()}.com"
            admin_user, admin_created = get_or_create(
                db,
                User,
                email=admin_email,
                defaults={
                    "hashed_password": hash_password(DEV_ADMIN_PASSWORD),
                    "full_name": f"{org_def['name']} Admin",
                    "phone_number": "+1 (555) 998-1122" if org_def["code"] == "EMPOWERS" else "+1 (555) 887-2233",
                    "title": "Academic Program Administrator",
                    "bio": f"Managing programs, student operations, and instructor allocations at {org_def['name']}.",
                    "is_active": True,
                },
            )
            admin_membership, _ = get_or_create(
                db,
                OrganizationMembership,
                user_id=admin_user.id,
                organization_id=organization.id,
                defaults={"status": MembershipStatus.ACTIVE},
            )
            get_or_create(
                db,
                UserRole,
                organization_membership_id=admin_membership.id,
                role_id=roles["ACADEMIC_ADMIN"].id,
            )

            student_email = f"student@{org_def['code'].lower()}.com"
            student_user, _ = get_or_create(
                db,
                User,
                email=student_email,
                defaults={
                    "hashed_password": hash_password(DEV_STUDENT_PASSWORD),
                    "full_name": f"{org_def['name']} Sample Student",
                    "phone_number": "+1 (555) 234-5678" if org_def["code"] == "EMPOWERS" else "+1 (555) 345-6789",
                    "title": "Enrolled Academy Scholar",
                    "bio": f"Pursuing certified coursework and capstone projects in {org_def['name']}.",
                    "is_active": True,
                },
            )
            student_membership, _ = get_or_create(
                db,
                OrganizationMembership,
                user_id=student_user.id,
                organization_id=organization.id,
                defaults={"status": MembershipStatus.ACTIVE},
            )
            get_or_create(
                db,
                UserRole,
                organization_membership_id=student_membership.id,
                role_id=roles["STUDENT"].id,
            )

            instructor_email = f"instructor@{org_def['code'].lower()}.com"
            instructor_user, _ = get_or_create(
                db,
                User,
                email=instructor_email,
                defaults={
                    "hashed_password": hash_password(DEV_ADMIN_PASSWORD),
                    "full_name": f"{org_def['name']} Instructor",
                    "phone_number": "+1 (555) 876-5432" if org_def["code"] == "EMPOWERS" else "+1 (555) 765-4321",
                    "title": "Lead Cohort Instructor & Mentor",
                    "bio": f"Guiding cohort students through curriculum modules and live sessions at {org_def['name']}.",
                    "is_active": True,
                },
            )
            instructor_membership, _ = get_or_create(
                db,
                OrganizationMembership,
                user_id=instructor_user.id,
                organization_id=organization.id,
                defaults={"status": MembershipStatus.ACTIVE},
            )
            get_or_create(
                db,
                UserRole,
                organization_membership_id=instructor_membership.id,
                role_id=roles["TRAINER"].id,
            )

            student, _ = get_or_create(
                db,
                Student,
                user_id=student_user.id,
                organization_id=organization.id,
                defaults={"student_code": f"{org_def['code']}-0001"},
            )

            get_or_create(
                db,
                Enrollment,
                student_id=student.id,
                program_id=program.id,
                defaults={"organization_id": organization.id, "status": EnrollmentStatus.ENROLLED},
            )

            example = org_def["example_program"]
            example_program, _ = get_or_create(
                db,
                Program,
                organization_id=organization.id,
                code=example["code"],
                defaults={
                    "name": example["name"],
                    "description": example["description"],
                    "status": ProgramStatus.ACTIVE,
                },
            )
            example_cohort, _ = get_or_create(
                db,
                Cohort,
                organization_id=organization.id,
                code="2026-JAN",
                defaults={
                    "name": f"{example['name']} — Jan 2026 Cohort",
                    "start_date": date(2026, 1, 15),
                    "status": CohortStatus.ACTIVE,
                },
            )
            if example_program not in example_cohort.programs:
                example_cohort.programs.append(example_program)
                db.add(example_cohort)

            enrollment, _ = get_or_create(
                db,
                Enrollment,
                student_id=student.id,
                program_id=example_program.id,
                defaults={
                    "organization_id": organization.id,
                    "cohort_id": example_cohort.id,
                    "status": EnrollmentStatus.ENROLLED,
                },
            )
            if not enrollment.cohort_id:
                enrollment.cohort_id = example_cohort.id

            # Seed Curriculum for example_program
            module, _ = get_or_create(
                db,
                ProgramModule,
                program_id=example_program.id,
                title="Module 1: Fundamentals",
                defaults={"description": "Introduction to the program", "order": 1}
            )
            
            week, _ = get_or_create(
                db,
                Week,
                program_module_id=module.id,
                week_number=1,
                defaults={"title": "Week 1: Getting Started", "order": 1}
            )
            
            lesson, _ = get_or_create(
                db,
                Lesson,
                week_id=week.id,
                title="Lesson 1: Introduction",
                defaults={"description": "Welcome to the course", "order": 1}
            )
            
            get_or_create(
                db,
                Activity,
                lesson_id=lesson.id,
                title="Welcome Video",
                defaults={
                    "activity_type": ActivityType.VIDEO,
                    "content": {"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"},
                    "order": 1
                }
            )
            
            get_or_create(
                db,
                Activity,
                lesson_id=lesson.id,
                title="Course Syllabus",
                defaults={
                    "activity_type": ActivityType.READING,
                    "content": {"text": "Please read the syllabus carefully before proceeding."},
                    "order": 2
                }
            )

            asg_title = (
                "Deep Neural Network Optimization & Backpropagation"
                if org_def["code"] == "EMPOWERS"
                else "Clinical Trial Protocol & GCP Compliance Analysis"
            )
            asg_desc = (
                "Implement custom gradient descent with the Adam optimizer from scratch in PyTorch. Benchmark convergence rates across 3 standard computer vision datasets and document loss trajectories."
                if org_def["code"] == "EMPOWERS"
                else "Review the attached Phase III clinical trial protocol. Conduct a formal Good Clinical Practice (GCP) compliance audit report identifying patient consent safeguards and safety monitoring metrics."
            )
            asg_rubric = (
                [
                    {"criterion": "Mathematical Accuracy & Loss Curves", "weight": "40%"},
                    {"criterion": "Clean Modular Code Architecture", "weight": "30%"},
                    {"criterion": "Benchmark Report & Insights", "weight": "30%"},
                ]
                if org_def["code"] == "EMPOWERS"
                else [
                    {"criterion": "GCP Protocol Compliance Accuracy", "weight": "40%"},
                    {"criterion": "Safety Metric Assessment", "weight": "30%"},
                    {"criterion": "Audit Recommendations & Report Clarity", "weight": "30%"},
                ]
            )

            get_or_create(
                db,
                Activity,
                lesson_id=lesson.id,
                title=asg_title,
                defaults={
                    "activity_type": ActivityType.ASSIGNMENT,
                    "content": {
                        "description": asg_desc,
                        "due_date": "2026-10-25",
                        "points": 100,
                        "rubric": asg_rubric,
                        "submission_type": "file",
                    },
                    "order": 3,
                },
            )

            print(f"Seeded {org_def['name']}: admin={admin_email}, student={student_email}")

        db.commit()
        print("Seed complete.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
