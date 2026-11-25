import asyncio
from datetime import date, datetime, timedelta
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

@compiles(JSONB, "sqlite")
def compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"

from app.core.config import get_settings
from app.core.security import create_access_token, hash_password
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.chatbot import ChatbotDailyUsage, ChatbotMessage
from app.models.enums import MembershipStatus
from app.models.organization import Organization, OrganizationMembership
from app.models.role import Role, UserRole
from app.models.student import Student
from app.models.user import User
from app.services.chatbot import (
    get_conversation_history,
    get_or_create_daily_usage,
    get_quota_summary,
    get_today_in_configured_timezone,
    process_student_chat,
    record_heartbeat,
)

settings = get_settings()


# ---------------------------------------------------------------------------
# Unauthenticated tests (against default client)
# ---------------------------------------------------------------------------

def test_chatbot_quota_requires_auth(client: TestClient) -> None:
    res = client.get("/api/v1/chatbot/quota")
    assert res.status_code == 401


def test_chatbot_heartbeat_requires_auth(client: TestClient) -> None:
    res = client.post("/api/v1/chatbot/heartbeat", json={"session_id": "test", "active_seconds": 10})
    assert res.status_code == 401


def test_chatbot_message_requires_auth(client: TestClient) -> None:
    res = client.post("/api/v1/chatbot/message", json={"message": "hello"})
    assert res.status_code == 401


def test_chatbot_history_requires_auth(client: TestClient) -> None:
    res = client.get("/api/v1/chatbot/history")
    assert res.status_code == 401


# ---------------------------------------------------------------------------
# Timezone & reset calculation tests
# ---------------------------------------------------------------------------

def test_get_today_in_configured_timezone() -> None:
    today, resets_at, seconds_until_reset = get_today_in_configured_timezone()
    assert isinstance(today, date)
    assert isinstance(resets_at, datetime)
    assert 0 < seconds_until_reset <= 86400
    assert resets_at.hour == 0
    assert resets_at.minute == 0
    assert resets_at.second == 0


# ---------------------------------------------------------------------------
# In-memory database fixture for role & quota enforcement logic
# ---------------------------------------------------------------------------

@pytest.fixture
def test_db():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = TestingSession()

    try:
        # Seed test organization
        org = Organization(name="Empowers Academy", slug="empowers", code="EA", brand_config={})
        db.add(org)
        db.flush()

        # Seed roles
        student_role = Role(name="STUDENT", description="Student role")
        instructor_role = Role(name="INSTRUCTOR", description="Instructor role")
        db.add_all([student_role, instructor_role])
        db.flush()

        # Seed student user
        student_user = User(
            email="student@empowers.test",
            hashed_password=hash_password("password123"),
            full_name="Alice Student",
            is_active=True,
        )
        db.add(student_user)
        db.flush()

        # Seed student membership and user role
        student_membership = OrganizationMembership(
            organization_id=org.id,
            user_id=student_user.id,
            status=MembershipStatus.ACTIVE,
        )
        db.add(student_membership)
        db.flush()

        db.add(UserRole(organization_membership_id=student_membership.id, role_id=student_role.id))
        db.add(Student(user_id=student_user.id, organization_id=org.id, student_code="STU-001"))

        # Seed instructor user (non-student)
        instructor_user = User(
            email="instructor@empowers.test",
            hashed_password=hash_password("password123"),
            full_name="Bob Instructor",
            is_active=True,
        )
        db.add(instructor_user)
        db.flush()

        instructor_membership = OrganizationMembership(
            organization_id=org.id,
            user_id=instructor_user.id,
            status=MembershipStatus.ACTIVE,
        )
        db.add(instructor_membership)
        db.flush()

        db.add(UserRole(organization_membership_id=instructor_membership.id, role_id=instructor_role.id))

        db.commit()
        yield db
    finally:
        db.close()


def test_quota_summary_initial_state(test_db):
    user = test_db.query(User).filter(User.email == "student@empowers.test").first()
    summary = get_quota_summary(test_db, user)

    assert summary.total_allowance_seconds == 300
    assert summary.seconds_used == 0
    assert summary.remaining_seconds == 300
    assert summary.is_exhausted is False
    assert summary.timezone == "Asia/Kolkata"


def test_heartbeat_accumulates_and_caps_at_300(test_db):
    user = test_db.query(User).filter(User.email == "student@empowers.test").first()

    # Session 1: Use 10 seconds
    resp1 = record_heartbeat(test_db, user, session_id="sess-1", active_seconds=10)
    assert resp1.seconds_used == 10
    assert resp1.remaining_seconds == 290
    assert resp1.is_exhausted is False

    # Session 2: Multiple sessions later in the day, use 50 seconds in increments
    resp2 = record_heartbeat(test_db, user, session_id="sess-2", active_seconds=20)
    assert resp2.seconds_used == 30
    assert resp2.remaining_seconds == 270

    # Exhaust the remaining 270 seconds
    resp3 = record_heartbeat(test_db, user, session_id="sess-2", active_seconds=30)
    assert resp3.seconds_used == 60
    assert resp3.remaining_seconds == 240

    # Fast forward usage directly in database to 295
    usage = test_db.query(ChatbotDailyUsage).filter(ChatbotDailyUsage.user_id == user.id).first()
    usage.seconds_used = 295
    test_db.commit()

    # Now add 10 seconds, should cap at 300
    resp_capped = record_heartbeat(test_db, user, session_id="sess-2", active_seconds=10)
    assert resp_capped.seconds_used == 300
    assert resp_capped.remaining_seconds == 0
    assert resp_capped.is_exhausted is True

    # Any further heartbeats remain capped at 300
    resp_further = record_heartbeat(test_db, user, session_id="sess-2", active_seconds=10)
    assert resp_further.seconds_used == 300
    assert resp_further.remaining_seconds == 0
    assert resp_further.is_exhausted is True


def test_process_student_chat_enforces_quota(test_db):
    user = test_db.query(User).filter(User.email == "student@empowers.test").first()

    # Chat when quota is available
    res = asyncio.run(process_student_chat(test_db, user, message_text="What is machine learning?"))
    assert res.reply is not None
    assert len(res.reply) > 0
    assert res.seconds_used > 0
    assert res.remaining_seconds == 300 - res.seconds_used
    assert res.is_exhausted is False

    # Exhaust quota
    usage = test_db.query(ChatbotDailyUsage).filter(ChatbotDailyUsage.user_id == user.id).first()
    usage.seconds_used = 300
    test_db.commit()

    # Chat when quota is exhausted raises HTTP 429
    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(process_student_chat(test_db, user, message_text="Will this work?"))

    assert exc_info.value.status_code == 429
    assert "allowance has been exhausted" in exc_info.value.detail


def test_conversation_history_retrieval(test_db):
    user = test_db.query(User).filter(User.email == "student@empowers.test").first()
    org = test_db.query(Organization).first()

    # Add messages
    m1 = ChatbotMessage(
        user_id=user.id,
        organization_id=org.id,
        session_id="history-sess",
        role="user",
        content="First question",
    )
    m2 = ChatbotMessage(
        user_id=user.id,
        organization_id=org.id,
        session_id="history-sess",
        role="assistant",
        content="First answer",
    )
    test_db.add_all([m1, m2])
    test_db.commit()

    sess_id, history = get_conversation_history(test_db, user, session_id="history-sess")
    assert sess_id == "history-sess"
    assert len(history) == 2
    assert history[0].content == "First question"
    assert history[0].role == "user"
    assert history[1].content == "First answer"
    assert history[1].role == "assistant"


def test_role_authorization_endpoint(test_db, monkeypatch):
    """Verify that STUDENT role can access chatbot endpoints, while INSTRUCTOR role is rejected with 403."""
    app.dependency_overrides[get_db] = lambda: test_db
    client = TestClient(app)

    try:
        student_user = test_db.query(User).filter(User.email == "student@empowers.test").first()
        instructor_user = test_db.query(User).filter(User.email == "instructor@empowers.test").first()

        student_token = create_access_token(subject=str(student_user.id))
        instructor_token = create_access_token(subject=str(instructor_user.id))

        # Student gets 200
        student_resp = client.get(
            "/api/v1/chatbot/quota",
            headers={"Authorization": f"Bearer {student_token}"},
        )
        assert student_resp.status_code == 200
        data = student_resp.json()
        assert data["total_allowance_seconds"] == 300
        assert data["remaining_seconds"] == 300

        # Instructor gets 403 Forbidden
        inst_resp = client.get(
            "/api/v1/chatbot/quota",
            headers={"Authorization": f"Bearer {instructor_token}"},
        )
        assert inst_resp.status_code == 403
        assert "Requires one of roles: STUDENT" in inst_resp.json()["detail"]

    finally:
        app.dependency_overrides.clear()
