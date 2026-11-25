from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from app.api.deps import (
    get_current_active_user,
    get_user_organization_ids,
    is_super_admin,
    require_roles,
)
from app.core.security import hash_password, verify_password
from app.db.session import get_db
from app.models.cohort import Cohort
from app.models.curriculum import Activity, Lesson, ProgramModule, Week
from app.models.enrollment import Enrollment
from app.models.enums import MembershipStatus, StudentLifecycleStatus
from app.models.organization import Organization, OrganizationMembership
from app.models.program import Program
from app.models.progress import ActivityCompletion, QuizAttempt
from app.models.role import Role, UserRole
from app.models.student import Student
from app.models.user import User
from app.schemas.user import (
    AdminProfileData,
    AssignOrganizationPayload,
    BulkUserCreateRequest,
    BulkUserCreateResponse,
    BulkUserItemResult,
    FullProfileResponse,
    InstructorCohortInfo,
    InstructorProfileData,
    PasswordChangeRequest,
    ProfileOrganizationInfo,
    StudentProfileData,
    StudentProfileEnrollment,
    UserCreate,
    UserRead,
    UserUpdate,
)

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserRead)
def read_own_profile(current_user: User = Depends(get_current_active_user)) -> User:
    return current_user


@router.patch("/me", response_model=UserRead)
def update_own_profile(
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> User:
    if payload.full_name is not None:
        current_user.full_name = payload.full_name.strip()
    if payload.phone_number is not None:
        current_user.phone_number = payload.phone_number.strip() if payload.phone_number else None
    if payload.bio is not None:
        current_user.bio = payload.bio.strip() if payload.bio else None
    if payload.title is not None:
        current_user.title = payload.title.strip() if payload.title else None
    if payload.avatar_url is not None:
        current_user.avatar_url = payload.avatar_url.strip() if payload.avatar_url else None
    if payload.github_url is not None:
        current_user.github_url = payload.github_url.strip() if payload.github_url else None
    if payload.linkedin_url is not None:
        current_user.linkedin_url = payload.linkedin_url.strip() if payload.linkedin_url else None
    if payload.portfolio_url is not None:
        current_user.portfolio_url = payload.portfolio_url.strip() if payload.portfolio_url else None

    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/me/change-password", status_code=status.HTTP_200_OK)
def change_password(
    payload: PasswordChangeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> dict:
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password does not match",
        )
    current_user.hashed_password = hash_password(payload.new_password)
    current_user.must_change_password = False
    db.commit()
    return {"detail": "Password updated successfully"}


@router.post("/me/dismiss-password-prompt", status_code=status.HTTP_200_OK)
def dismiss_password_prompt(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> dict:
    current_user.must_change_password = False
    db.commit()
    return {"detail": "Password change prompt dismissed"}


@router.get("/me/profile", response_model=FullProfileResponse)
def get_full_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> FullProfileResponse:
    # 1. Organizations
    org_map: dict[int, ProfileOrganizationInfo] = {}
    for m in current_user.memberships:
        if m.status == MembershipStatus.ACTIVE and m.organization:
            org = m.organization
            roles_in_org = [ur.role.name for ur in m.user_roles]
            if org.id not in org_map:
                org_map[org.id] = ProfileOrganizationInfo(
                    id=org.id,
                    name=org.name,
                    slug=org.slug,
                    code=org.code,
                    primary_domain=org.primary_domain,
                    lms_domain=org.lms_domain,
                    roles=roles_in_org,
                )
            else:
                combined = sorted(list(set(org_map[org.id].roles + roles_in_org)))
                org_map[org.id].roles = combined
    organizations = list(org_map.values())
    org_ids = [org.id for org in organizations]

    # 2. Student data
    student_profile = None
    if "STUDENT" in current_user.roles or len(current_user.student_profiles) > 0:
        student = db.query(Student).filter(Student.user_id == current_user.id).first()
        if student:
            enrollments = (
                db.query(Enrollment)
                .options(joinedload(Enrollment.program), joinedload(Enrollment.cohort))
                .filter(Enrollment.student_id == student.id)
                .all()
            )
            completions = (
                db.query(ActivityCompletion.activity_id)
                .filter(ActivityCompletion.student_id == student.id)
                .all()
            )
            completed_ids = {c[0] for c in completions}

            enrollment_items: list[StudentProfileEnrollment] = []
            active_programs_count = 0
            for e in enrollments:
                if e.status.value in ["ACTIVE", "ENROLLED"]:
                    active_programs_count += 1

                total_acts = (
                    db.query(Activity.id)
                    .join(Lesson)
                    .join(Week)
                    .join(ProgramModule)
                    .filter(ProgramModule.program_id == e.program_id)
                    .all()
                )
                t_count = len(total_acts)
                c_count = sum(1 for a in total_acts if a[0] in completed_ids)
                pct = int((c_count / t_count * 100)) if t_count > 0 else 0

                enrollment_items.append(
                    StudentProfileEnrollment(
                        id=e.id,
                        program_id=e.program_id,
                        program_name=e.program.name if e.program else "Program",
                        program_code=e.program.code if e.program else "",
                        cohort_id=e.cohort_id,
                        cohort_name=e.cohort.name if e.cohort else "Self-paced",
                        status=e.status.value,
                        progress_percentage=pct,
                        enrolled_at=e.created_at,
                    )
                )

            quiz_attempts = db.query(QuizAttempt).filter(QuizAttempt.student_id == student.id).all()
            total_quizzes = len(quiz_attempts)
            avg_score = (
                round(sum((q.score / q.total_questions * 100) for q in quiz_attempts if q.total_questions > 0) / total_quizzes, 1)
                if total_quizzes > 0
                else 0
            )

            student_profile = StudentProfileData(
                student_id=student.id,
                student_code=student.student_code,
                lifecycle_status=student.lifecycle_status.value,
                enrollments=enrollment_items,
                stats={
                    "total_enrollments": len(enrollment_items),
                    "active_programs": active_programs_count,
                    "completed_activities": len(completed_ids),
                    "hours_studied": f"{len(completed_ids) * 1.5:.1f}h",
                    "quiz_attempts": total_quizzes,
                    "average_quiz_score": f"{avg_score}%",
                },
            )

    # 3. Instructor data
    instructor_data = None
    instructor_roles = {"TRAINER", "INSTRUCTOR"}
    if any(r in instructor_roles for r in current_user.roles):
        cohort_query = db.query(Cohort)
        if not is_super_admin(current_user) and org_ids:
            cohort_query = cohort_query.filter(Cohort.organization_id.in_(org_ids))
        all_cohorts = cohort_query.all()

        cohort_infos: list[InstructorCohortInfo] = []
        total_students_enrolled = set()
        for c in all_cohorts:
            p_names = [p.name for p in c.programs]
            enrollment_count = len(c.enrollments)
            for e in c.enrollments:
                total_students_enrolled.add(e.student_id)
            cohort_infos.append(
                InstructorCohortInfo(
                    id=c.id,
                    name=c.name,
                    code=c.code,
                    program_names=p_names,
                    student_count=enrollment_count,
                    status=c.status.value,
                    start_date=c.start_date.isoformat() if c.start_date else None,
                    end_date=c.end_date.isoformat() if c.end_date else None,
                )
            )

        prog_count = (
            db.query(Program).filter(Program.organization_id.in_(org_ids)).count()
            if org_ids
            else db.query(Program).count()
        )

        instructor_data = InstructorProfileData(
            cohorts=cohort_infos,
            stats={
                "assigned_cohorts": len(cohort_infos),
                "total_students": len(total_students_enrolled),
                "programs_available": prog_count,
                "role": "Lead Instructor / Trainer",
            },
        )

    # 4. Admin data
    admin_data = None
    admin_roles = {"SUPER_ADMIN", "ACADEMIC_ADMIN", "PROGRAM_MANAGER"}
    if any(r in admin_roles for r in current_user.roles):
        if is_super_admin(current_user):
            total_users = db.query(User).count()
            total_students = db.query(Student).count()
            total_programs = db.query(Program).count()
            total_cohorts = db.query(Cohort).count()
        elif org_ids:
            total_users = (
                db.query(OrganizationMembership)
                .filter(OrganizationMembership.organization_id.in_(org_ids))
                .distinct(OrganizationMembership.user_id)
                .count()
            )
            total_students = db.query(Student).filter(Student.organization_id.in_(org_ids)).count()
            total_programs = db.query(Program).filter(Program.organization_id.in_(org_ids)).count()
            total_cohorts = db.query(Cohort).filter(Cohort.organization_id.in_(org_ids)).count()
        else:
            total_users = 0
            total_students = 0
            total_programs = 0
            total_cohorts = 0

        admin_data = AdminProfileData(
            stats={
                "total_managed_users": total_users,
                "total_students": total_students,
                "total_programs": total_programs,
                "total_cohorts": total_cohorts,
                "scope": "Global Platform" if is_super_admin(current_user) else "Organization Scoped",
            }
        )

    return FullProfileResponse(
        user=current_user,
        organizations=organizations,
        student_profile=student_profile,
        instructor_data=instructor_data,
        admin_data=admin_data,
    )


@router.get("", response_model=list[UserRead])
def list_users(
    skip: int = 0,
    limit: int = 50,
    organization_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("SUPER_ADMIN", "ACADEMIC_ADMIN", "PROGRAM_MANAGER", "TRAINER")),
) -> list[User]:
    """Scoped to the caller's organizations — same MVP pattern as
    students.py/organizations.py (api/deps.py). Without this, an
    ACADEMIC_ADMIN (an org-scoped role) could list every user across both
    organizations; SUPER_ADMIN is exempted."""
    query = (
        db.query(User)
        .options(
            joinedload(User.memberships).joinedload(OrganizationMembership.user_roles).joinedload(UserRole.role),
            joinedload(User.memberships).joinedload(OrganizationMembership.organization),
            joinedload(User.student_profiles),
        )
    )
    if is_super_admin(current_user):
        if organization_id is not None:
            query = query.join(OrganizationMembership, OrganizationMembership.user_id == User.id).filter(
                OrganizationMembership.organization_id == organization_id
            ).distinct()
    else:
        org_ids = get_user_organization_ids(current_user)
        if not org_ids:
            return []
        target_ids = [organization_id] if organization_id and organization_id in org_ids else org_ids
        query = query.join(OrganizationMembership, OrganizationMembership.user_id == User.id).filter(
            OrganizationMembership.organization_id.in_(target_ids)
        ).distinct()

    users = query.order_by(User.id).offset(skip).limit(min(limit, 200)).all()
    seen = set()
    unique_users = []
    for u in users:
        if u.id not in seen:
            seen.add(u.id)
            unique_users.append(u)
    return unique_users


@router.post("/bulk", response_model=BulkUserCreateResponse, status_code=status.HTTP_200_OK)
def bulk_create_users(
    payload: BulkUserCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("SUPER_ADMIN", "ACADEMIC_ADMIN")),
) -> BulkUserCreateResponse:
    if not is_super_admin(current_user) and payload.organization_id not in get_user_organization_ids(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this organization")

    org = db.get(Organization, payload.organization_id)
    if org is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")

    all_roles = {r.name: r for r in db.query(Role).all()}
    results: list[BulkUserItemResult] = []
    total_created = 0
    total_skipped = 0
    total_errors = 0

    for item in payload.users:
        try:
            email_clean = item.email.lower().strip()
            full_name_clean = item.full_name.strip()
            if not full_name_clean:
                results.append(
                    BulkUserItemResult(
                        email=email_clean,
                        full_name="",
                        status="error",
                        detail="Full name cannot be empty",
                    )
                )
                total_errors += 1
                continue

            target_roles = item.role_names or payload.default_role_names or ["STUDENT"]
            if not is_super_admin(current_user) and "SUPER_ADMIN" in target_roles:
                results.append(
                    BulkUserItemResult(
                        email=email_clean,
                        full_name=full_name_clean,
                        status="error",
                        detail="Cannot grant SUPER_ADMIN role",
                    )
                )
                total_errors += 1
                continue

            invalid_roles = [r for r in target_roles if r not in all_roles]
            if invalid_roles:
                results.append(
                    BulkUserItemResult(
                        email=email_clean,
                        full_name=full_name_clean,
                        status="error",
                        detail=f"Invalid role(s): {', '.join(invalid_roles)}",
                    )
                )
                total_errors += 1
                continue

            existing_user = db.query(User).filter(User.email == email_clean).first()
            if existing_user:
                existing_membership = (
                    db.query(OrganizationMembership)
                    .filter(
                        OrganizationMembership.user_id == existing_user.id,
                        OrganizationMembership.organization_id == payload.organization_id,
                    )
                    .first()
                )

                if existing_membership:
                    results.append(
                        BulkUserItemResult(
                            email=email_clean,
                            full_name=existing_user.full_name,
                            status="already_in_org",
                            detail="User already exists and belongs to this organization",
                            user_id=existing_user.id,
                        )
                    )
                    total_skipped += 1
                    continue
                else:
                    new_mem = OrganizationMembership(
                        user_id=existing_user.id,
                        organization_id=payload.organization_id,
                        status=MembershipStatus.ACTIVE,
                    )
                    db.add(new_mem)
                    db.flush()
                    for r_name in target_roles:
                        db.add(UserRole(organization_membership_id=new_mem.id, role_id=all_roles[r_name].id))

                    if "STUDENT" in target_roles:
                        student_rec = (
                            db.query(Student)
                            .filter(
                                Student.user_id == existing_user.id,
                                Student.organization_id == payload.organization_id,
                            )
                            .first()
                        )
                        if not student_rec:
                            db.add(
                                Student(
                                    user_id=existing_user.id,
                                    organization_id=payload.organization_id,
                                    student_code=f"STU-{existing_user.id:04d}",
                                    lifecycle_status=StudentLifecycleStatus.ENROLLMENT,
                                )
                            )

                    results.append(
                        BulkUserItemResult(
                            email=email_clean,
                            full_name=existing_user.full_name,
                            status="added_to_org",
                            detail="Existing user assigned to this organization",
                            user_id=existing_user.id,
                        )
                    )
                    total_created += 1
                    continue

            effective_password = item.password or payload.default_password
            new_user = User(
                email=email_clean,
                full_name=full_name_clean,
                hashed_password=hash_password(effective_password),
                phone_number=item.phone_number.strip() if item.phone_number else None,
                title=item.title.strip() if item.title else None,
                is_active=True,
                must_change_password=True if "STUDENT" in target_roles else (item.must_change_password if item.must_change_password is not None else False),
            )
            db.add(new_user)
            db.flush()

            new_mem = OrganizationMembership(
                user_id=new_user.id,
                organization_id=payload.organization_id,
                status=MembershipStatus.ACTIVE,
            )
            db.add(new_mem)
            db.flush()

            for r_name in target_roles:
                db.add(UserRole(organization_membership_id=new_mem.id, role_id=all_roles[r_name].id))

            if "STUDENT" in target_roles:
                db.add(
                    Student(
                        user_id=new_user.id,
                        organization_id=payload.organization_id,
                        student_code=f"STU-{new_user.id:04d}",
                        lifecycle_status=StudentLifecycleStatus.ENROLLMENT,
                    )
                )

            results.append(
                BulkUserItemResult(
                    email=email_clean,
                    full_name=full_name_clean,
                    status="created",
                    detail="User created successfully",
                    user_id=new_user.id,
                    temporary_password=effective_password,
                )
            )
            total_created += 1

        except Exception as exc:
            results.append(
                BulkUserItemResult(
                    email=item.email,
                    full_name=item.full_name,
                    status="error",
                    detail=str(exc),
                )
            )
            total_errors += 1

    db.commit()

    return BulkUserCreateResponse(
        total_submitted=len(payload.users),
        total_created=total_created,
        total_skipped=total_skipped,
        total_errors=total_errors,
        results=results,
    )


@router.post("", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("SUPER_ADMIN", "ACADEMIC_ADMIN")),
) -> User:
    if not is_super_admin(current_user) and payload.organization_id not in get_user_organization_ids(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this organization")

    if db.get(Organization, payload.organization_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")

    if db.query(User).filter(User.email == payload.email).first() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A user with this email already exists")

    role_names = set(payload.role_names) or {"STUDENT"}
    if not is_super_admin(current_user) and "SUPER_ADMIN" in role_names:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot grant the SUPER_ADMIN role")

    roles = db.query(Role).filter(Role.name.in_(role_names)).all()
    missing = role_names - {role.name for role in roles}
    if missing:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unknown role(s): {', '.join(sorted(missing))}",
        )

    user = User(
        email=payload.email,
        full_name=payload.full_name,
        hashed_password=hash_password(payload.password),
        phone_number=payload.phone_number,
        bio=payload.bio,
        title=payload.title,
        avatar_url=payload.avatar_url,
        must_change_password=True if "STUDENT" in role_names else payload.must_change_password,
    )
    db.add(user)
    db.flush()

    membership = OrganizationMembership(user_id=user.id, organization_id=payload.organization_id)
    db.add(membership)
    db.flush()

    for role in roles:
        db.add(UserRole(organization_membership_id=membership.id, role_id=role.id))

    if "STUDENT" in role_names:
        db.add(
            Student(
                user_id=user.id,
                organization_id=payload.organization_id,
                student_code=f"STU-{user.id:04d}",
                lifecycle_status=StudentLifecycleStatus.ENROLLMENT,
            )
        )

    db.commit()
    db.refresh(user)
    return user


@router.post("/{user_id}/organizations", response_model=UserRead)
def assign_user_organization(
    user_id: int,
    payload: AssignOrganizationPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("SUPER_ADMIN", "ACADEMIC_ADMIN")),
) -> User:
    if not is_super_admin(current_user) and payload.organization_id not in get_user_organization_ids(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized for this organization")

    if not is_super_admin(current_user) and "SUPER_ADMIN" in payload.role_names:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot grant the SUPER_ADMIN role")

    target_user = db.get(User, user_id)
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    org = db.get(Organization, payload.organization_id)
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")

    # Find or create membership
    membership = (
        db.query(OrganizationMembership)
        .filter(
            OrganizationMembership.user_id == target_user.id,
            OrganizationMembership.organization_id == org.id,
        )
        .first()
    )
    if not membership:
        membership = OrganizationMembership(
            user_id=target_user.id,
            organization_id=org.id,
            status=MembershipStatus.ACTIVE,
        )
        db.add(membership)
        db.flush()
    else:
        membership.status = MembershipStatus.ACTIVE

    # Validate and assign roles
    roles = db.query(Role).filter(Role.name.in_(payload.role_names)).all()
    target_role_ids = {r.id for r in roles}

    # Remove roles not in payload
    for ur in list(membership.user_roles):
        if ur.role_id not in target_role_ids:
            db.delete(ur)

    # Add new roles
    existing_role_ids = {ur.role_id for ur in membership.user_roles}
    for r in roles:
        if r.id not in existing_role_ids:
            db.add(UserRole(organization_membership_id=membership.id, role_id=r.id))

    if "STUDENT" in payload.role_names:
        existing_student = db.query(Student).filter(
            Student.user_id == target_user.id,
            Student.organization_id == payload.organization_id,
        ).first()
        if not existing_student:
            db.add(
                Student(
                    user_id=target_user.id,
                    organization_id=payload.organization_id,
                    student_code=f"STU-{target_user.id:04d}",
                    lifecycle_status=StudentLifecycleStatus.ENROLLMENT,
                )
            )

    db.commit()
    db.refresh(target_user)
    return target_user


@router.delete("/{user_id}/organizations/{organization_id}", response_model=UserRead)
def remove_user_organization(
    user_id: int,
    organization_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("SUPER_ADMIN", "ACADEMIC_ADMIN")),
) -> User:
    if not is_super_admin(current_user) and organization_id not in get_user_organization_ids(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized for this organization")

    target_user = db.get(User, user_id)
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    membership = (
        db.query(OrganizationMembership)
        .filter(
            OrganizationMembership.user_id == target_user.id,
            OrganizationMembership.organization_id == organization_id,
        )
        .first()
    )
    if membership:
        db.delete(membership)
        db.commit()
        db.refresh(target_user)

    return target_user


@router.patch("/{user_id}", response_model=UserRead)
def update_user_by_admin(
    user_id: int,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("SUPER_ADMIN", "ACADEMIC_ADMIN")),
) -> User:
    target_user = db.get(User, user_id)
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if not is_super_admin(current_user):
        admin_org_ids = set(get_user_organization_ids(current_user))
        target_org_ids = set(get_user_organization_ids(target_user))
        if not (admin_org_ids & target_org_ids):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot manage users outside your organization")

    if payload.full_name is not None:
        target_user.full_name = payload.full_name.strip()
    if payload.phone_number is not None:
        target_user.phone_number = payload.phone_number.strip() if payload.phone_number else None
    if payload.bio is not None:
        target_user.bio = payload.bio.strip() if payload.bio else None
    if payload.title is not None:
        target_user.title = payload.title.strip() if payload.title else None
    if payload.avatar_url is not None:
        target_user.avatar_url = payload.avatar_url.strip() if payload.avatar_url else None
    if payload.github_url is not None:
        target_user.github_url = payload.github_url.strip() if payload.github_url else None
    if payload.linkedin_url is not None:
        target_user.linkedin_url = payload.linkedin_url.strip() if payload.linkedin_url else None
    if payload.portfolio_url is not None:
        target_user.portfolio_url = payload.portfolio_url.strip() if payload.portfolio_url else None
    if payload.is_active is not None:
        target_user.is_active = payload.is_active

    db.commit()
    db.refresh(target_user)
    return target_user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("SUPER_ADMIN", "ACADEMIC_ADMIN")),
) -> None:
    if current_user.id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account",
        )

    target_user = db.get(User, user_id)
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    if not is_super_admin(current_user):
        admin_org_ids = set(get_user_organization_ids(current_user))
        target_org_ids = set(get_user_organization_ids(target_user))
        if not (admin_org_ids & target_org_ids):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot delete users outside your organization",
            )
        if is_super_admin(target_user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot delete a Super Admin",
            )

    db.delete(target_user)
    db.commit()


class AdminResetPasswordPayload(BaseModel):
    new_password: str
    must_change_password: bool = True


@router.post("/{user_id}/reset-password", status_code=status.HTTP_200_OK)
def admin_reset_user_password(
    user_id: int,
    payload: AdminResetPasswordPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("SUPER_ADMIN", "ACADEMIC_ADMIN", "PROGRAM_MANAGER")),
) -> dict:
    """Allow organization admins and super admins to reset credentials for a user."""
    target_user = db.get(User, user_id)
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    if not is_super_admin(current_user):
        admin_org_ids = set(get_user_organization_ids(current_user))
        target_org_ids = set(get_user_organization_ids(target_user))
        if not (admin_org_ids & target_org_ids):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot reset password for users outside your organization",
            )
        if is_super_admin(target_user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only a Super Admin can reset credentials for another Super Admin",
            )

    new_pwd = payload.new_password.strip() if payload.new_password else ""
    if len(new_pwd) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters long",
        )

    target_user.hashed_password = hash_password(new_pwd)
    target_user.must_change_password = payload.must_change_password
    db.commit()

    return {
        "detail": f"Password for {target_user.full_name} has been reset successfully.",
        "user_id": target_user.id,
        "must_change_password": target_user.must_change_password,
    }



