import uuid
import zoneinfo
from datetime import date, datetime, time, timedelta, timezone
from fastapi import HTTPException, status
from openai import AsyncOpenAI
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.chatbot import ChatbotDailyUsage, ChatbotMessage
from app.models.enums import MembershipStatus
from app.models.student import Student
from app.models.user import User
from app.schemas.chatbot import (
    ChatbotHeartbeatResponse,
    ChatbotQuotaResponse,
    ChatbotResponse,
    ChatMessageItem,
)

settings = get_settings()


def get_today_in_configured_timezone() -> tuple[date, datetime, int]:
    """Calculate today's date, the next reset datetime (midnight next day),
    and remaining seconds until reset in the configured LMS timezone (default Asia/Kolkata).
    """
    try:
        tz = zoneinfo.ZoneInfo(settings.CHATBOT_TIMEZONE)
    except Exception:
        if "Kolkata" in settings.CHATBOT_TIMEZONE or "Calcutta" in settings.CHATBOT_TIMEZONE:
            tz = timezone(timedelta(hours=5, minutes=30))
        else:
            tz = timezone.utc

    now_tz = datetime.now(tz)
    today = now_tz.date()
    tomorrow = today + timedelta(days=1)
    resets_at = datetime.combine(tomorrow, time.min, tzinfo=tz)
    seconds_until_reset = max(0, int((resets_at - now_tz).total_seconds()))
    return today, resets_at, seconds_until_reset


def resolve_student_org_id(db: Session, user: User) -> int:
    """Resolve the organization ID for an authenticated student.
    Checks student profile first, then active memberships.
    """
    student = db.query(Student).filter(Student.user_id == user.id).first()
    if student:
        return student.organization_id

    for m in user.memberships:
        if m.status == MembershipStatus.ACTIVE:
            return m.organization_id

    # Fallback to organization 1 if exists or raise
    if user.memberships:
        return user.memberships[0].organization_id

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Student has no organization membership.",
    )


def get_or_create_daily_usage(
    db: Session, user_id: int, org_id: int, usage_date: date
) -> ChatbotDailyUsage:
    """Fetch or atomically initialize the student's daily usage record for today."""
    usage = (
        db.query(ChatbotDailyUsage)
        .filter(
            ChatbotDailyUsage.user_id == user_id,
            ChatbotDailyUsage.usage_date == usage_date,
        )
        .first()
    )
    if not usage:
        usage = ChatbotDailyUsage(
            user_id=user_id,
            organization_id=org_id,
            usage_date=usage_date,
            seconds_used=0,
            last_heartbeat_at=datetime.now(timezone.utc),
        )
        db.add(usage)
        try:
            db.commit()
            db.refresh(usage)
        except IntegrityError:
            db.rollback()
            usage = (
                db.query(ChatbotDailyUsage)
                .filter(
                    ChatbotDailyUsage.user_id == user_id,
                    ChatbotDailyUsage.usage_date == usage_date,
                )
                .first()
            )
            if not usage:
                raise
    return usage


def get_quota_summary(db: Session, user: User) -> ChatbotQuotaResponse:
    """Return the student's remaining daily allowance and reset metadata."""
    today, resets_at, seconds_until_reset = get_today_in_configured_timezone()
    org_id = resolve_student_org_id(db, user)
    usage = get_or_create_daily_usage(db, user.id, org_id, today)

    allowance = settings.CHATBOT_DAILY_ALLOWANCE_SECONDS
    remaining = max(0, allowance - usage.seconds_used)
    is_exhausted = remaining <= 0

    return ChatbotQuotaResponse(
        usage_date=today,
        total_allowance_seconds=allowance,
        seconds_used=usage.seconds_used,
        remaining_seconds=remaining,
        is_exhausted=is_exhausted,
        timezone=settings.CHATBOT_TIMEZONE,
        resets_at=resets_at,
        seconds_until_reset=seconds_until_reset,
    )


def record_heartbeat(
    db: Session, user: User, session_id: str, active_seconds: int
) -> ChatbotHeartbeatResponse:
    """Record active session time spent by the student in the chatbot interface.
    Clamps active_seconds to prevent manipulation and strictly caps at allowance.
    """
    today, resets_at, _ = get_today_in_configured_timezone()
    org_id = resolve_student_org_id(db, user)
    usage = get_or_create_daily_usage(db, user.id, org_id, today)

    # Enforce safe bounds (1 to 30 seconds per heartbeat tick)
    clamped_seconds = max(0, min(active_seconds, 30))
    allowance = settings.CHATBOT_DAILY_ALLOWANCE_SECONDS

    # Increment seconds used without exceeding maximum allowance
    usage.seconds_used = min(allowance, usage.seconds_used + clamped_seconds)
    usage.last_heartbeat_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(usage)

    remaining = max(0, allowance - usage.seconds_used)
    return ChatbotHeartbeatResponse(
        remaining_seconds=remaining,
        seconds_used=usage.seconds_used,
        is_exhausted=remaining <= 0,
        resets_at=resets_at,
    )


async def execute_ai_completion(messages: list[dict[str, str]]) -> str:
    """Call configured AI model (OpenRouter / OpenAI compatible) or graceful fallback."""
    if not settings.AI_API_KEY:
        # Graceful fallback when API key is unconfigured in test/dev environment
        last_msg = messages[-1]["content"] if messages else "Hello"
        return (
            f"Hello! I am your AI Learning Assistant for Empowers Academy and Medivex AI. "
            f"I received your question: \"{last_msg}\". "
            f"To get live AI responses, ensure AI_API_KEY is configured in your environment. "
            f"I am here to guide your studies, clarify lessons, and help prepare for quizzes!"
        )

    client = AsyncOpenAI(
        api_key=settings.AI_API_KEY,
        base_url=settings.AI_BASE_URL,
    )

    system_prompt = (
        "You are the AI Learning Assistant for the shared LMS serving Empowers Academy and Medivex AI. "
        "You provide clear, accurate, educational explanations to students. Help them understand curriculum topics, "
        "technical concepts, medical/clinical methodologies, and quiz preparation. "
        "Keep answers structured, supportive, concise, and focused on learning."
    )

    api_messages = [{"role": "system", "content": system_prompt}] + messages

    try:
        response = await client.chat.completions.create(
            model=settings.AI_MODEL,
            messages=api_messages,
            max_tokens=600,
            temperature=0.7,
        )
        if response.choices and len(response.choices) > 0:
            content = response.choices[0].message.content
            if content:
                return content.strip()
        return "I apologize, but I could not generate an answer right now. Please try rephrasing your question."
    except Exception as exc:
        # Fallback with informative educational response on external provider failure
        return (
            f"I am currently experiencing connectivity issues with the AI provider ({str(exc)[:60]}). "
            "Please check back in a moment or continue reviewing your course materials."
        )


async def process_student_chat(
    db: Session,
    user: User,
    message_text: str,
    session_id: str | None = None,
) -> ChatbotResponse:
    """Process a student message: checks backend quota, calls AI, persists history,
    and updates active seconds.
    """
    today, resets_at, seconds_until_reset = get_today_in_configured_timezone()
    org_id = resolve_student_org_id(db, user)
    usage = get_or_create_daily_usage(db, user.id, org_id, today)

    allowance = settings.CHATBOT_DAILY_ALLOWANCE_SECONDS
    remaining = max(0, allowance - usage.seconds_used)

    if remaining <= 0:
        hours = seconds_until_reset // 3600
        minutes = (seconds_until_reset % 3600) // 60
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                f"Your daily 5-minute (300 seconds) AI Chatbot allowance has been exhausted for today. "
                f"Your allowance resets at midnight ({settings.CHATBOT_TIMEZONE}) in "
                f"{hours}h {minutes}m."
            ),
        )

    if not session_id:
        session_id = str(uuid.uuid4())

    # Save user message
    user_msg = ChatbotMessage(
        user_id=user.id,
        organization_id=org_id,
        session_id=session_id,
        role="user",
        content=message_text,
        seconds_spent=0,
    )
    db.add(user_msg)
    db.commit()

    # Load recent conversation context (last 6 messages in session)
    recent_records = (
        db.query(ChatbotMessage)
        .filter(
            ChatbotMessage.user_id == user.id,
            ChatbotMessage.session_id == session_id,
        )
        .order_by(ChatbotMessage.created_at.desc())
        .limit(6)
        .all()
    )
    recent_records.reverse()

    chat_payload = [
        {"role": rec.role, "content": rec.content} for rec in recent_records
    ]

    # Generate response
    reply_text = await execute_ai_completion(chat_payload)

    # Count small minimum interaction cost (e.g., 5 seconds) to reflect message time
    min_chat_seconds = 5
    additional_used = min(remaining, min_chat_seconds)
    usage.seconds_used = min(allowance, usage.seconds_used + additional_used)
    usage.last_heartbeat_at = datetime.now(timezone.utc)

    # Save assistant message
    bot_msg = ChatbotMessage(
        user_id=user.id,
        organization_id=org_id,
        session_id=session_id,
        role="assistant",
        content=reply_text,
        seconds_spent=additional_used,
    )
    db.add(bot_msg)
    db.commit()
    db.refresh(usage)

    updated_remaining = max(0, allowance - usage.seconds_used)

    return ChatbotResponse(
        reply=reply_text,
        session_id=session_id,
        remaining_seconds=updated_remaining,
        seconds_used=usage.seconds_used,
        is_exhausted=updated_remaining <= 0,
        resets_at=resets_at,
    )


def get_conversation_history(
    db: Session,
    user: User,
    session_id: str | None = None,
    limit: int = 50,
) -> tuple[str, list[ChatMessageItem]]:
    """Retrieve chat history for the student."""
    query = db.query(ChatbotMessage).filter(ChatbotMessage.user_id == user.id)

    if session_id:
        query = query.filter(ChatbotMessage.session_id == session_id)
    else:
        # Find latest session if exists
        latest = (
            db.query(ChatbotMessage.session_id)
            .filter(ChatbotMessage.user_id == user.id)
            .order_by(ChatbotMessage.created_at.desc())
            .first()
        )
        if latest:
            session_id = latest[0]
            query = query.filter(ChatbotMessage.session_id == session_id)
        else:
            session_id = str(uuid.uuid4())
            return session_id, []

    records = query.order_by(ChatbotMessage.created_at.asc()).limit(limit).all()
    items = [
        ChatMessageItem(
            role=rec.role,
            content=rec.content,
            created_at=rec.created_at,
        )
        for rec in records
    ]
    return session_id, items
