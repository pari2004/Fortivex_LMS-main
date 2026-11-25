from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api import deps
from app.db.session import get_db
from app.models.user import User
from app.schemas.chatbot import (
    ChatbotHeartbeatRequest,
    ChatbotHeartbeatResponse,
    ChatbotHistoryResponse,
    ChatbotQuotaResponse,
    ChatbotRequest,
    ChatbotResponse,
)
from app.services.chatbot import (
    get_conversation_history,
    get_quota_summary,
    process_student_chat,
    record_heartbeat,
)

router = APIRouter(prefix="/chatbot", tags=["chatbot"])


@router.get("/quota", response_model=ChatbotQuotaResponse)
def get_student_chatbot_quota(
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.require_roles("STUDENT")),
) -> ChatbotQuotaResponse:
    """Retrieve today's active chatbot usage and remaining quota for the authenticated student.
    Quota is 300 seconds (5 minutes) per LMS day, resetting at midnight in configured timezone.
    """
    return get_quota_summary(db, current_user)


@router.post("/heartbeat", response_model=ChatbotHeartbeatResponse)
def student_chatbot_heartbeat(
    payload: ChatbotHeartbeatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.require_roles("STUDENT")),
) -> ChatbotHeartbeatResponse:
    """Log active time spent by the student in the chatbot interface.
    Called periodically while the chatbot is actively open and not idle.
    Backend tracks and caps allowance at 300 seconds.
    """
    return record_heartbeat(
        db=db,
        user=current_user,
        session_id=payload.session_id,
        active_seconds=payload.active_seconds,
    )


@router.post("/message", response_model=ChatbotResponse)
async def send_student_chatbot_message(
    payload: ChatbotRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.require_roles("STUDENT")),
) -> ChatbotResponse:
    """Send a query to the AI chatbot.
    Enforces that the student has remaining quota today before generating a response.
    429 is raised if daily allowance is exhausted.
    """
    return await process_student_chat(
        db=db,
        user=current_user,
        message_text=payload.message,
        session_id=payload.session_id,
    )


@router.get("/history", response_model=ChatbotHistoryResponse)
def get_student_chatbot_history(
    session_id: str | None = Query(None, max_length=64),
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.require_roles("STUDENT")),
) -> ChatbotHistoryResponse:
    """Retrieve recent conversation history and current quota status for the student."""
    resolved_session_id, messages = get_conversation_history(
        db=db, user=current_user, session_id=session_id
    )
    quota = get_quota_summary(db, current_user)
    return ChatbotHistoryResponse(
        session_id=resolved_session_id,
        messages=messages,
        quota=quota,
    )
