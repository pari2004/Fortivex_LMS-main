from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class NotificationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    organization_id: Optional[int] = None
    title: str
    message: str
    type: str
    link_url: Optional[str] = None
    is_read: bool
    read_at: Optional[datetime] = None
    created_at: datetime


class NotificationCreate(BaseModel):
    user_id: int
    organization_id: Optional[int] = None
    title: str
    message: str
    type: str = "SYSTEM"
    link_url: Optional[str] = None


class NotificationListResponse(BaseModel):
    items: list[NotificationRead]
    unread_count: int
    total_count: int
