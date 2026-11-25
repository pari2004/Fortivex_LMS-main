from datetime import date, datetime
from pydantic import BaseModel, Field


class ChatbotQuotaResponse(BaseModel):
    usage_date: date
    total_allowance_seconds: int = 300
    seconds_used: int
    remaining_seconds: int
    is_exhausted: bool
    timezone: str
    resets_at: datetime
    seconds_until_reset: int


class ChatbotHeartbeatRequest(BaseModel):
    session_id: str = Field(..., max_length=64)
    active_seconds: int = Field(default=10, ge=1, le=30)


class ChatbotHeartbeatResponse(BaseModel):
    remaining_seconds: int
    seconds_used: int
    is_exhausted: bool
    resets_at: datetime


class ChatMessageItem(BaseModel):
    role: str
    content: str
    created_at: datetime | None = None


class ChatbotRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    session_id: str | None = Field(default=None, max_length=64)


class ChatbotResponse(BaseModel):
    reply: str
    session_id: str
    remaining_seconds: int
    seconds_used: int
    is_exhausted: bool
    resets_at: datetime


class ChatbotHistoryResponse(BaseModel):
    session_id: str
    messages: list[ChatMessageItem]
    quota: ChatbotQuotaResponse
