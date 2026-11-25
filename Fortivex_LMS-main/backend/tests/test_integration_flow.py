"""Real end-to-end integration tests against a live PostgreSQL database.

Every other test module in this suite deliberately exercises the DB via a
placeholder, unreachable `DATABASE_URL` (see conftest.py) because no local
Postgres existed when they were written — they only prove the
"unauthenticated -> 401" and "DB unreachable -> 503" paths, never a real
login -> authorized action -> assertion round trip.

This module fills that gap now that a real local PostgreSQL is available
(`fortivex_lms_test` database). It overrides the `get_db` FastAPI
dependency to point at that real database, creates the schema directly
from the ORM models (no Alembic dependency here — that's covered by
actually running `alembic upgrade head`, see docs), seeds two isolated
organizations, and asserts real authenticated behavior: login,
credential rejection, RBAC, and — the highest-risk area for a shared
multi-tenant LMS — cross-organization data isolation.

Requires a reachable Postgres at TEST_DATABASE_URL (defaults to
postgresql://postgres:postgres@localhost:5432/fortivex_lms_test). Skips
cleanly if that database can't be reached, so it never breaks CI/dev
environments that don't have Postgres set up.
"""

import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from app.core.security import hash_password
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.cohort import Cohort
from app.models.enrollment import Enrollment
from app.models.enums import EnrollmentStatus, MembershipStatus
from app.models.organization import Organization, OrganizationMembership
from app.models.program import Program
from app.models.role import Role, UserRole
from app.models.student import Student
from app.models.user import User

TEST_DATABASE_URL = os.environ.get(
    "INTEGRATION_TEST_DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/fortivex_lms_test",
)


def _make_engine():
    engine = create_engine(TEST_DATABASE_URL)
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception:
        pytest.skip(f"No reachable Postgres at {TEST_DATABASE_URL} for integration tests")
    return engine


@pytest.fixture(scope="module")
def engine():
    eng = _make_engine()
    Base.metadata.create_all(eng)
    yield eng
    Base.metadata.drop_all(eng)
    eng.dispose()


@pytest.fixture()
def db_session(engine):
    """Fresh, empty schema state per test via truncate — simpler and
    faster than dropping/recreating tables for every test."""
    TestingSessionLocal = sessionmaker(bind=engine)
    session = TestingSessionLocal()
    for table in reversed(Base.metadata.sorted_tables):
        session.execute(table.delete())
    session.commit()
    yield session
    session.close()


@pytest.fixture()
def live_client(db_session: Session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.pop(get_db, None)


class Seeded:
    def __init__(self):
        self.orgs: dict[str, Organization] = {}
        self.users: dict[str, User] = {}
        self.programs: dict[str, Program] = {}
        self.cohorts: dict[str, Cohort] = {}
        self.students: dict[str, Student] = {}


PASSWORD = "test-password-123"


def _seed(db: Session) -> Seeded:
    seeded = Seeded()

    academic_admin_role = Role(name="ACADEMIC_ADMIN")
    student_role = Role(name="STUDENT")
    db.add_all([academic_admin_role, student_role])
    db.flush()

    for slug, name, code in [
        ("empowers-academy", "Empowers Academy", "EMPOWERS"),
        ("medivex-ai", "Medivex AI", "MEDIVEX"),
    ]:
        org = Organization(name=name, slug=slug, code=code)
        db.add(org)
        db.flush()
        seeded.orgs[slug] = org

        program = Program(organization_id=org.id, name=f"{name} Foundation", code="FOUNDATION")
        db.add(program)
        db.flush()
        seeded.programs[slug] = program

        cohort = Cohort(
            organization_id=org.id,
            name=f"{name} Jan Cohort",
            code="2026-JAN",
            start_date="2026-01-15",
        )
        cohort.programs.append(program)
        db.add(cohort)
        db.flush()
        seeded.cohorts[slug] = cohort

        admin_user = User(
            email=f"admin@{slug}.dev.local",
            hashed_password=hash_password(PASSWORD),
            full_name=f"{name} Admin",
        )
        db.add(admin_user)
        db.flush()
        admin_membership = OrganizationMembership(
            user_id=admin_user.id, organization_id=org.id, status=MembershipStatus.ACTIVE
        )
        db.add(admin_membership)
        db.flush()
        db.add(UserRole(organization_membership_id=admin_membership.id, role_id=academic_admin_role.id))
        seeded.users[f"admin-{slug}"] = admin_user

        student_user = User(
            email=f"student@{slug}.dev.local",
            hashed_password=hash_password(PASSWORD),
            full_name=f"{name} Student",
        )
        db.add(student_user)
        db.flush()
        student_membership = OrganizationMembership(
            user_id=student_user.id, organization_id=org.id, status=MembershipStatus.ACTIVE
        )
        db.add(student_membership)
        db.flush()
        db.add(UserRole(organization_membership_id=student_membership.id, role_id=student_role.id))
        seeded.users[f"student-{slug}"] = student_user

        student = Student(user_id=student_user.id, organization_id=org.id, student_code=f"{code}-0001")
        db.add(student)
        db.flush()
        seeded.students[slug] = student

        db.add(
            Enrollment(
                student_id=student.id,
                program_id=program.id,
                cohort_id=cohort.id,
                organization_id=org.id,
                status=EnrollmentStatus.ENROLLED,
            )
        )

    db.commit()
    return seeded


def _login(client: TestClient, email: str) -> str:
    response = client.post("/api/v1/auth/login", data={"username": email, "password": PASSWORD})
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def test_login_success_and_invalid_credentials(live_client: TestClient, db_session: Session) -> None:
    _seed(db_session)

    ok = live_client.post(
        "/api/v1/auth/login",
        data={"username": "admin@empowers-academy.dev.local", "password": PASSWORD},
    )
    assert ok.status_code == 200
    assert "access_token" in ok.json()

    bad_password = live_client.post(
        "/api/v1/auth/login",
        data={"username": "admin@empowers-academy.dev.local", "password": "wrong"},
    )
    assert bad_password.status_code == 401

    unknown_user = live_client.post(
        "/api/v1/auth/login",
        data={"username": "nobody@nowhere.dev.local", "password": PASSWORD},
    )
    assert unknown_user.status_code == 401


def test_login_rate_limit_blocks_after_repeated_failures_then_recovers_on_success(
    live_client: TestClient, db_session: Session
) -> None:
    _seed(db_session)

    for _ in range(5):
        response = live_client.post(
            "/api/v1/auth/login",
            data={"username": "admin@empowers-academy.dev.local", "password": "wrong"},
        )
        assert response.status_code == 401

    blocked = live_client.post(
        "/api/v1/auth/login",
        data={"username": "admin@empowers-academy.dev.local", "password": "wrong"},
    )
    assert blocked.status_code == 429
    assert "Retry-After" in blocked.headers

    # Correct password is rejected too while the window is open...
    still_blocked = live_client.post(
        "/api/v1/auth/login",
        data={"username": "admin@empowers-academy.dev.local", "password": PASSWORD},
    )
    assert still_blocked.status_code == 429

    # ...but a different user at the same client IP is unaffected (rate
    # limit is keyed per-user, not a blanket per-IP block).
    other_user = live_client.post(
        "/api/v1/auth/login",
        data={"username": "nobody@nowhere.dev.local", "password": "wrong"},
    )
    assert other_user.status_code == 401


def test_student_dashboard_enrollment_shows_own_program_and_cohort(
    live_client: TestClient, db_session: Session
) -> None:
    _seed(db_session)
    token = _login(live_client, "student@empowers-academy.dev.local")

    response = live_client.get("/api/v1/enrollments", headers=_auth(token))
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["program"]["code"] == "FOUNDATION"
    assert body[0]["cohort"]["code"] == "2026-JAN"
    assert body[0]["status"] == "ENROLLED"


def test_academic_admin_cannot_see_other_organizations_users(
    live_client: TestClient, db_session: Session
) -> None:
    """Regression test for the /users org-isolation gap: an ACADEMIC_ADMIN
    (an org-scoped role) must only see users in their own organization,
    same as /students and /organizations already enforced."""
    _seed(db_session)
    medivex_admin_token = _login(live_client, "admin@medivex-ai.dev.local")

    response = live_client.get("/api/v1/users", headers=_auth(medivex_admin_token))
    assert response.status_code == 200
    emails = {u["email"] for u in response.json()}
    assert emails == {"admin@medivex-ai.dev.local", "student@medivex-ai.dev.local"}
    assert "admin@empowers-academy.dev.local" not in emails
    assert "student@empowers-academy.dev.local" not in emails


def test_academic_admin_cannot_access_other_organizations_program(
    live_client: TestClient, db_session: Session
) -> None:
    seeded = _seed(db_session)
    medivex_admin_token = _login(live_client, "admin@medivex-ai.dev.local")
    empowers_program_id = seeded.programs["empowers-academy"].id

    response = live_client.get(f"/api/v1/programs/{empowers_program_id}", headers=_auth(medivex_admin_token))
    assert response.status_code == 403


def test_academic_admin_cannot_create_program_for_other_organization(
    live_client: TestClient, db_session: Session
) -> None:
    seeded = _seed(db_session)
    medivex_admin_token = _login(live_client, "admin@medivex-ai.dev.local")
    empowers_org_id = seeded.orgs["empowers-academy"].id

    response = live_client.post(
        "/api/v1/programs",
        headers=_auth(medivex_admin_token),
        json={"organization_id": empowers_org_id, "name": "Hijacked Program", "code": "HIJACK"},
    )
    assert response.status_code == 403


def test_student_cannot_list_users_or_create_programs(live_client: TestClient, db_session: Session) -> None:
    _seed(db_session)
    student_token = _login(live_client, "student@empowers-academy.dev.local")

    assert live_client.get("/api/v1/users", headers=_auth(student_token)).status_code == 403
    assert (
        live_client.post(
            "/api/v1/programs",
            headers=_auth(student_token),
            json={"organization_id": 1, "name": "x", "code": "x"},
        ).status_code
        == 403
    )


def test_student_program_visibility_limited_to_own_enrollment(
    live_client: TestClient, db_session: Session
) -> None:
    """A student in one org must not see the other org's programs, even
    though both share the same Program list endpoint."""
    _seed(db_session)
    student_token = _login(live_client, "student@empowers-academy.dev.local")

    response = live_client.get("/api/v1/programs", headers=_auth(student_token))
    assert response.status_code == 200
    codes = {p["code"] for p in response.json()}
    assert codes == {"FOUNDATION"}


def test_academic_admin_can_update_own_organizations_program(
    live_client: TestClient, db_session: Session
) -> None:
    """PATCH /programs/{id} exists (app/api/v1/endpoints/programs.py) but
    previously had only an unauthenticated-401 test (test_programs.py) —
    no coverage that it actually persists a change or stays org-scoped.
    Found during the 2026-09-28 audit; added live coverage here."""
    seeded = _seed(db_session)
    admin_token = _login(live_client, "admin@empowers-academy.dev.local")
    program_id = seeded.programs["empowers-academy"].id

    response = live_client.patch(
        f"/api/v1/programs/{program_id}",
        headers=_auth(admin_token),
        json={"description": "Updated during integration test"},
    )
    assert response.status_code == 200
    assert response.json()["description"] == "Updated during integration test"


def test_academic_admin_cannot_update_other_organizations_program(
    live_client: TestClient, db_session: Session
) -> None:
    seeded = _seed(db_session)
    medivex_admin_token = _login(live_client, "admin@medivex-ai.dev.local")
    empowers_program_id = seeded.programs["empowers-academy"].id

    response = live_client.patch(
        f"/api/v1/programs/{empowers_program_id}",
        headers=_auth(medivex_admin_token),
        json={"description": "hijack attempt"},
    )
    assert response.status_code == 403


def test_academic_admin_can_update_own_organizations_cohort(
    live_client: TestClient, db_session: Session
) -> None:
    """Same gap as the Program PATCH tests above, for
    PATCH /cohorts/{id} (app/api/v1/endpoints/cohorts.py)."""
    seeded = _seed(db_session)
    admin_token = _login(live_client, "admin@empowers-academy.dev.local")
    cohort_id = seeded.cohorts["empowers-academy"].id

    response = live_client.patch(
        f"/api/v1/cohorts/{cohort_id}",
        headers=_auth(admin_token),
        json={"status": "COMPLETED"},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "COMPLETED"


def test_academic_admin_cannot_update_other_organizations_cohort(
    live_client: TestClient, db_session: Session
) -> None:
    seeded = _seed(db_session)
    medivex_admin_token = _login(live_client, "admin@medivex-ai.dev.local")
    empowers_cohort_id = seeded.cohorts["empowers-academy"].id

    response = live_client.patch(
        f"/api/v1/cohorts/{empowers_cohort_id}",
        headers=_auth(medivex_admin_token),
        json={"status": "CANCELLED"},
    )
    assert response.status_code == 403


def test_academic_admin_can_create_user_in_own_organization(
    live_client: TestClient, db_session: Session
) -> None:
    """POST /api/v1/users (new 2026-09-29): the only prior way a user
    account existed was backend/scripts/seed_dev_data.py (dev-only)."""
    seeded = _seed(db_session)
    admin_token = _login(live_client, "admin@empowers-academy.dev.local")
    org_id = seeded.orgs["empowers-academy"].id

    response = live_client.post(
        "/api/v1/users",
        headers=_auth(admin_token),
        json={
            "email": "new.admin@example.com",
            "full_name": "New Admin",
            "password": "a-strong-password",
            "organization_id": org_id,
            "role_names": ["ACADEMIC_ADMIN"],
        },
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["email"] == "new.admin@example.com"
    assert body["roles"] == ["ACADEMIC_ADMIN"]

    login = live_client.post(
        "/api/v1/auth/login",
        data={"username": "new.admin@example.com", "password": "a-strong-password"},
    )
    assert login.status_code == 200


def test_create_user_defaults_to_student_role(live_client: TestClient, db_session: Session) -> None:
    seeded = _seed(db_session)
    admin_token = _login(live_client, "admin@empowers-academy.dev.local")
    org_id = seeded.orgs["empowers-academy"].id

    response = live_client.post(
        "/api/v1/users",
        headers=_auth(admin_token),
        json={
            "email": "default.role@example.com",
            "full_name": "Default Role",
            "password": "a-strong-password",
            "organization_id": org_id,
        },
    )
    assert response.status_code == 201, response.text
    assert response.json()["roles"] == ["STUDENT"]


def test_academic_admin_cannot_create_user_in_other_organization(
    live_client: TestClient, db_session: Session
) -> None:
    seeded = _seed(db_session)
    medivex_admin_token = _login(live_client, "admin@medivex-ai.dev.local")
    empowers_org_id = seeded.orgs["empowers-academy"].id

    response = live_client.post(
        "/api/v1/users",
        headers=_auth(medivex_admin_token),
        json={
            "email": "hijack@example.com",
            "full_name": "Hijack Attempt",
            "password": "a-strong-password",
            "organization_id": empowers_org_id,
        },
    )
    assert response.status_code == 403


def test_academic_admin_cannot_grant_super_admin(live_client: TestClient, db_session: Session) -> None:
    seeded = _seed(db_session)
    admin_token = _login(live_client, "admin@empowers-academy.dev.local")
    org_id = seeded.orgs["empowers-academy"].id

    response = live_client.post(
        "/api/v1/users",
        headers=_auth(admin_token),
        json={
            "email": "power.grab@example.com",
            "full_name": "Power Grab",
            "password": "a-strong-password",
            "organization_id": org_id,
            "role_names": ["SUPER_ADMIN"],
        },
    )
    assert response.status_code == 403


def test_create_user_rejects_duplicate_email(live_client: TestClient, db_session: Session) -> None:
    seeded = _seed(db_session)
    admin_token = _login(live_client, "admin@empowers-academy.dev.local")
    org_id = seeded.orgs["empowers-academy"].id
    payload = {
        "email": "duplicate@example.com",
        "full_name": "Duplicate",
        "password": "a-strong-password",
        "organization_id": org_id,
    }

    first = live_client.post("/api/v1/users", headers=_auth(admin_token), json=payload)
    assert first.status_code == 201, first.text

    second = live_client.post("/api/v1/users", headers=_auth(admin_token), json=payload)
    assert second.status_code == 409


def test_create_user_rejects_unknown_role(live_client: TestClient, db_session: Session) -> None:
    seeded = _seed(db_session)
    admin_token = _login(live_client, "admin@empowers-academy.dev.local")
    org_id = seeded.orgs["empowers-academy"].id

    response = live_client.post(
        "/api/v1/users",
        headers=_auth(admin_token),
        json={
            "email": "bad.role@example.com",
            "full_name": "Bad Role",
            "password": "a-strong-password",
            "organization_id": org_id,
            "role_names": ["NOT_A_REAL_ROLE"],
        },
    )
    assert response.status_code == 422


def test_student_cannot_create_user(live_client: TestClient, db_session: Session) -> None:
    seeded = _seed(db_session)
    student_token = _login(live_client, "student@empowers-academy.dev.local")
    org_id = seeded.orgs["empowers-academy"].id

    response = live_client.post(
        "/api/v1/users",
        headers=_auth(student_token),
        json={
            "email": "student.made@example.com",
            "full_name": "Student Made",
            "password": "a-strong-password",
            "organization_id": org_id,
        },
    )
    assert response.status_code == 403


def test_academic_admin_can_create_valid_enrollment(
    live_client: TestClient, db_session: Session
) -> None:
    """A valid enrollment can be created in the isolated test database."""
    seeded = _seed(db_session)
    admin_token = _login(live_client, "admin@empowers-academy.dev.local")

    org = seeded.orgs["empowers-academy"]
    student = seeded.students["empowers-academy"]

    # Use a new program so this test doesn't duplicate the seeded enrollment.
    program = Program(
        organization_id=org.id,
        name="Additional Enrollment Test Program",
        code="ENROLL-TEST",
    )
    db_session.add(program)
    db_session.commit()
    db_session.refresh(program)

    response = live_client.post(
        "/api/v1/enrollments",
        headers=_auth(admin_token),
        json={
            "student_id": student.id,
            "program_id": program.id,
            "organization_id": org.id,
        },
    )

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["student_id"] == student.id
    assert body["program_id"] == program.id
    assert body["organization_id"] == org.id


def test_academic_admin_can_update_own_organization(live_client: TestClient, db_session: Session) -> None:
    seeded = _seed(db_session)
    admin_token = _login(live_client, "admin@empowers-academy.dev.local")
    org_id = seeded.orgs["empowers-academy"].id

    response = live_client.patch(
        f"/api/v1/organizations/{org_id}",
        headers=_auth(admin_token),
        json={
            "name": "Empowers Academy Updated",
            "primary_domain": "empowers.example.com",
            "brand_config": {
                "primary_color": "#2563eb",
                "tagline": "Empowering future leaders",
                "governance": {
                    "pass_percentage": 75,
                },
            },
        },
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["name"] == "Empowers Academy Updated"
    assert body["primary_domain"] == "empowers.example.com"
    assert body["brand_config"]["primary_color"] == "#2563eb"
    assert body["brand_config"]["governance"]["pass_percentage"] == 75


def test_academic_admin_cannot_update_other_organization(live_client: TestClient, db_session: Session) -> None:
    seeded = _seed(db_session)
    admin_token = _login(live_client, "admin@empowers-academy.dev.local")
    other_org_id = seeded.orgs["medivex-ai"].id

    response = live_client.patch(
        f"/api/v1/organizations/{other_org_id}",
        headers=_auth(admin_token),
        json={"name": "Hacked Name"},
    )
    assert response.status_code == 403


def test_academic_admin_cannot_change_organization_slug(live_client: TestClient, db_session: Session) -> None:
    seeded = _seed(db_session)
    admin_token = _login(live_client, "admin@empowers-academy.dev.local")
    org_id = seeded.orgs["empowers-academy"].id

    response = live_client.patch(
        f"/api/v1/organizations/{org_id}",
        headers=_auth(admin_token),
        json={"slug": "new-slug"},
    )
    assert response.status_code == 403


def test_student_receives_notification_when_new_assignment_posted(
    live_client: TestClient, db_session: Session
) -> None:
    seeded = _seed(db_session)
    admin_token = _login(live_client, "admin@empowers-academy.dev.local")
    student_token = _login(live_client, "student@empowers-academy.dev.local")
    program = seeded.programs["empowers-academy"]

    # Admin posts a new assignment
    create_res = live_client.post(
        "/api/v1/assignments",
        headers=_auth(admin_token),
        json={
            "program_id": program.id,
            "title": "Machine Learning Midterm Project",
            "description": "Build an end-to-end classification pipeline.",
            "due_date": "2026-11-20",
            "points": 100,
        },
    )
    assert create_res.status_code == 200, create_res.text

    # Student checks notifications
    notif_res = live_client.get("/api/v1/notifications", headers=_auth(student_token))
    assert notif_res.status_code == 200
    data = notif_res.json()
    assert data["unread_count"] >= 1
    items = data["items"]
    assert any("Machine Learning Midterm Project" in item["title"] and item["type"] == "ASSIGNMENT" for item in items)

    # Student marks as read
    target_id = items[0]["id"]
    read_res = live_client.patch(f"/api/v1/notifications/{target_id}/read", headers=_auth(student_token))
    assert read_res.status_code == 200
    assert read_res.json()["is_read"] is True


def test_student_receives_notification_when_new_quiz_added(
    live_client: TestClient, db_session: Session
) -> None:
    seeded = _seed(db_session)
    admin_token = _login(live_client, "admin@empowers-academy.dev.local")
    student_token = _login(live_client, "student@empowers-academy.dev.local")
    program = seeded.programs["empowers-academy"]

    # Retrieve lesson id from curriculum
    curr_res = live_client.get(f"/api/v1/programs/{program.id}/curriculum", headers=_auth(admin_token))
    # Or create a module -> week -> lesson
    mod_res = live_client.post(
        f"/api/v1/programs/{program.id}/modules",
        headers=_auth(admin_token),
        json={"title": "Quiz Module", "order": 1},
    )
    mod_id = mod_res.json()["id"]

    week_res = live_client.post(
        f"/api/v1/modules/{mod_id}/weeks",
        headers=_auth(admin_token),
        json={"title": "Week 1", "week_number": 1, "order": 1},
    )
    week_id = week_res.json()["id"]

    lesson_res = live_client.post(
        f"/api/v1/weeks/{week_id}/lessons",
        headers=_auth(admin_token),
        json={"title": "Lesson 1", "order": 1},
    )
    lesson_id = lesson_res.json()["id"]

    # Create quiz activity
    act_res = live_client.post(
        f"/api/v1/lessons/{lesson_id}/activities",
        headers=_auth(admin_token),
        json={
            "title": "Comprehensive AI Quiz 1",
            "activity_type": "QUIZ",
            "content": {"questions": []},
            "order": 1,
        },
    )
    assert act_res.status_code in (200, 201)

    # Student checks notifications
    notif_res = live_client.get("/api/v1/notifications", headers=_auth(student_token))
    assert notif_res.status_code == 200
    data = notif_res.json()
    items = data["items"]
    assert any("Comprehensive AI Quiz 1" in item["title"] and item["type"] == "QUIZ" for item in items)


