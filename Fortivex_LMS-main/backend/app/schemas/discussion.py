from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class DiscussionReplyRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    thread_id: int
    author_id: int
    author_name: str
    author_role: str
    content: str
    is_verified: bool = False
    created_at: datetime
    time_ago: str = ""


class DiscussionReplyCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=10000)


class DiscussionThreadRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    organization_id: int
    program_id: Optional[int] = None
    program_name: Optional[str] = None
    author_id: int
    author_name: str
    author_role: str
    title: str
    content: str
    tags: List[str] = Field(default_factory=list)
    upvotes: int = 0
    is_upvoted: bool = False
    has_verified_answer: bool = False
    replies_count: int = 0
    created_at: datetime
    time_ago: str = ""
    replies: List[DiscussionReplyRead] = Field(default_factory=list)


class DiscussionThreadCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=255)
    content: str = Field(..., min_length=5, max_length=20000)
    program_id: Optional[int] = None
    organization_id: Optional[int] = None
    tags: List[str] = Field(default_factory=list)


class DiscussionUpvoteResponse(BaseModel):
    thread_id: int
    is_upvoted: bool
    upvotes: int

