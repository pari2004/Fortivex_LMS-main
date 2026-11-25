from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload, selectinload

from app.api import deps
from app.models.discussion import DiscussionReply, DiscussionThread, DiscussionUpvote
from app.models.organization import Organization
from app.models.program import Program
from app.models.student import Student
from app.models.user import User
from app.schemas.discussion import (
    DiscussionReplyCreate,
    DiscussionReplyRead,
    DiscussionThreadCreate,
    DiscussionThreadRead,
    DiscussionUpvoteResponse,
)

router = APIRouter(prefix="/discussions", tags=["discussions"])

STAFF_ROLES = {
    "SUPER_ADMIN",
    "ACADEMIC_ADMIN",
    "PROGRAM_MANAGER",
    "TRAINER",
    "INSTRUCTOR",
    "LEAD_TRAINER",
    "MENTOR",
    "TEACHING_ASSISTANT",
}


def _get_author_role(user: Optional[User]) -> str:
    if not user:
        return "Student"
    try:
        roles = deps.get_user_roles(user)
    except Exception:
        roles = set()
    if "SUPER_ADMIN" in roles or "ACADEMIC_ADMIN" in roles:
        return "Admin"
    if "INSTRUCTOR" in roles or "TRAINER" in roles or "LEAD_TRAINER" in roles:
        return "Instructor"
    if "MENTOR" in roles or "TEACHING_ASSISTANT" in roles:
        return "TA"
    return "Student"


def _format_time_ago(dt: Optional[datetime]) -> str:
    if not dt:
        return ""
    now = datetime.now(dt.tzinfo) if dt.tzinfo else datetime.utcnow()
    diff = now - dt
    secs = int(diff.total_seconds())
    if secs < 60:
        return "Just now"
    mins = secs // 60
    if mins < 60:
        return f"{mins}m ago"
    hrs = mins // 60
    if hrs < 24:
        return f"{hrs}h ago"
    days = hrs // 24
    if days < 7:
        return f"{days}d ago"
    return dt.strftime("%b %d, %Y")


def _build_reply_read(reply: DiscussionReply, author_user: Optional[User] = None) -> DiscussionReplyRead:
    author = author_user or reply.author
    author_name = "User"
    if author and getattr(author, "full_name", None):
        author_name = author.full_name
    elif reply.author_id:
        author_name = f"User #{reply.author_id}"

    return DiscussionReplyRead(
        id=reply.id,
        thread_id=reply.thread_id,
        author_id=reply.author_id,
        author_name=author_name,
        author_role=_get_author_role(author),
        content=reply.content,
        is_verified=bool(reply.is_verified),
        created_at=reply.created_at,
        time_ago=_format_time_ago(reply.created_at),
    )


def _build_thread_read(
    thread: DiscussionThread,
    user_upvoted_ids: set[int],
    include_replies: bool = False,
    author_user: Optional[User] = None,
) -> DiscussionThreadRead:
    author = author_user or thread.author
    program = thread.program
    author_name = "User"
    if author and getattr(author, "full_name", None):
        author_name = author.full_name
    elif thread.author_id:
        author_name = f"User #{thread.author_id}"

    replies_count = len(thread.replies) if thread.replies else 0
    replies_read = (
        [_build_reply_read(r) for r in thread.replies]
        if (include_replies and thread.replies)
        else []
    )

    tags = thread.tags if isinstance(thread.tags, list) else []

    return DiscussionThreadRead(
        id=thread.id,
        organization_id=thread.organization_id,
        program_id=thread.program_id,
        program_name=program.name if program else "General Discussion",
        author_id=thread.author_id,
        author_name=author_name,
        author_role=_get_author_role(author),
        title=thread.title,
        content=thread.content,
        tags=tags,
        upvotes=thread.upvotes,
        is_upvoted=thread.id in user_upvoted_ids,
        has_verified_answer=thread.has_verified_answer,
        replies_count=replies_count,
        created_at=thread.created_at,
        time_ago=_format_time_ago(thread.created_at),
        replies=replies_read,
    )


@router.get("", response_model=List[DiscussionThreadRead])
def list_discussion_threads(
    tag: Optional[str] = Query(None, description="Filter by topic tag"),
    solved: Optional[bool] = Query(None, description="Filter by solved status"),
    program_id: Optional[int] = Query(None, description="Filter by program ID"),
    organization_id: Optional[int] = Query(None, description="Filter by organization ID"),
    search: Optional[str] = Query(None, description="Search query in title or content"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """List discussion threads visible to user's organization(s)."""
    query = (
        db.query(DiscussionThread)
        .options(
            joinedload(DiscussionThread.author),
            joinedload(DiscussionThread.program),
            selectinload(DiscussionThread.replies).joinedload(DiscussionReply.author),
        )
    )

    is_super = deps.is_super_admin(current_user)
    if not is_super:
        org_ids = deps.get_user_organization_ids(current_user)
        if org_ids:
            query = query.filter(DiscussionThread.organization_id.in_(org_ids))
        else:
            student_profile = db.query(Student).filter(Student.user_id == current_user.id).first()
            if student_profile and student_profile.organization_id:
                query = query.filter(DiscussionThread.organization_id == student_profile.organization_id)
            else:
                first_org = db.query(Organization.id).first()
                if first_org:
                    query = query.filter(DiscussionThread.organization_id == first_org[0])
    elif organization_id:
        query = query.filter(DiscussionThread.organization_id == organization_id)

    if program_id is not None:
        query = query.filter(DiscussionThread.program_id == program_id)

    if solved is not None:
        query = query.filter(DiscussionThread.has_verified_answer == solved)

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                DiscussionThread.title.ilike(term),
                DiscussionThread.content.ilike(term),
            )
        )

    threads = query.order_by(DiscussionThread.created_at.desc()).offset(skip).limit(limit).all()

    # Filter by tag in memory if tag provided
    if tag and tag.lower() not in ("all", ""):
        target = tag.lower().strip()
        threads = [t for t in threads if any(target in tg.lower() for tg in (t.tags or []))]

    if not threads:
        return []

    # Get current user's upvotes
    thread_ids = [t.id for t in threads]
    upvoted = (
        db.query(DiscussionUpvote.thread_id)
        .filter(
            DiscussionUpvote.thread_id.in_(thread_ids),
            DiscussionUpvote.user_id == current_user.id,
        )
        .all()
    )
    user_upvoted_ids = {u[0] for u in upvoted}

    return [_build_thread_read(t, user_upvoted_ids, include_replies=False) for t in threads]


@router.post("", response_model=DiscussionThreadRead, status_code=status.HTTP_201_CREATED)
def create_discussion_thread(
    payload: DiscussionThreadCreate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """Create a new discussion thread."""
    org_ids = deps.get_user_organization_ids(current_user)
    is_super = deps.is_super_admin(current_user)

    org_id = None
    if payload.organization_id and (is_super or payload.organization_id in org_ids):
        org_id = payload.organization_id

    if not org_id and payload.program_id:
        program = db.query(Program).filter(Program.id == payload.program_id).first()
        if program and (is_super or program.organization_id in org_ids):
            org_id = program.organization_id

    if not org_id and org_ids:
        org_id = next(iter(org_ids))

    if not org_id:
        student_profile = db.query(Student).filter(Student.user_id == current_user.id).first()
        if student_profile and student_profile.organization_id:
            org_id = student_profile.organization_id

    if not org_id:
        first_org = db.query(Organization.id).first()
        org_id = first_org[0] if first_org else 1

    clean_tags = []
    if payload.tags:
        for tg in payload.tags:
            if isinstance(tg, str) and tg.strip():
                clean_tags.append(tg.strip())
    if not clean_tags:
        clean_tags = ["General"]

    thread = DiscussionThread(
        organization_id=org_id,
        author_id=current_user.id,
        program_id=payload.program_id,
        title=payload.title.strip(),
        content=payload.content.strip(),
        tags=clean_tags,
        upvotes=1,
        has_verified_answer=False,
    )
    db.add(thread)
    db.flush()

    # Auto-add author upvote
    initial_upvote = DiscussionUpvote(
        thread_id=thread.id,
        user_id=current_user.id,
    )
    db.add(initial_upvote)

    db.commit()
    db.refresh(thread)

    return _build_thread_read(thread, {thread.id}, include_replies=True, author_user=current_user)


@router.get("/{thread_id}", response_model=DiscussionThreadRead)
def get_discussion_thread(
    thread_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """Get discussion thread details and all replies."""
    thread = (
        db.query(DiscussionThread)
        .options(
            joinedload(DiscussionThread.author),
            joinedload(DiscussionThread.program),
            selectinload(DiscussionThread.replies).joinedload(DiscussionReply.author),
        )
        .filter(DiscussionThread.id == thread_id)
        .first()
    )
    if not thread:
        raise HTTPException(status_code=404, detail="Discussion thread not found")

    if not deps.is_super_admin(current_user):
        org_ids = deps.get_user_organization_ids(current_user)
        student_profile = db.query(Student).filter(Student.user_id == current_user.id).first()
        student_org_id = student_profile.organization_id if student_profile else None
        has_access = (
            thread.organization_id in org_ids
            or (student_org_id and thread.organization_id == student_org_id)
            or not org_ids
        )
        if not has_access:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized for this organization")

    upvoted = (
        db.query(DiscussionUpvote)
        .filter(
            DiscussionUpvote.thread_id == thread.id,
            DiscussionUpvote.user_id == current_user.id,
        )
        .first()
    )
    user_upvoted_ids = {thread.id} if upvoted else set()

    return _build_thread_read(thread, user_upvoted_ids, include_replies=True)


@router.post("/{thread_id}/replies", response_model=DiscussionReplyRead, status_code=status.HTTP_201_CREATED)
def add_discussion_reply(
    thread_id: int,
    payload: DiscussionReplyCreate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """Post a reply to a discussion thread."""
    thread = db.query(DiscussionThread).filter(DiscussionThread.id == thread_id).first()
    if not thread:
        raise HTTPException(status_code=404, detail="Discussion thread not found")

    if not deps.is_super_admin(current_user):
        org_ids = deps.get_user_organization_ids(current_user)
        student_profile = db.query(Student).filter(Student.user_id == current_user.id).first()
        student_org_id = student_profile.organization_id if student_profile else None
        has_access = (
            thread.organization_id in org_ids
            or (student_org_id and thread.organization_id == student_org_id)
            or not org_ids
        )
        if not has_access:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized for this organization")

    reply = DiscussionReply(
        thread_id=thread.id,
        author_id=current_user.id,
        content=payload.content.strip(),
        is_verified=False,
    )
    db.add(reply)
    db.commit()
    db.refresh(reply)

    return _build_reply_read(reply, author_user=current_user)


@router.delete("/replies/{reply_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_discussion_reply(
    reply_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """Delete a reply (Author, Thread Author, Instructors, or Admins)."""
    reply = (
        db.query(DiscussionReply)
        .options(joinedload(DiscussionReply.thread))
        .filter(DiscussionReply.id == reply_id)
        .first()
    )
    if not reply:
        raise HTTPException(status_code=404, detail="Reply not found")

    user_roles = deps.get_user_roles(current_user)
    is_staff = bool(user_roles & STAFF_ROLES) or deps.is_super_admin(current_user)
    is_author = reply.author_id == current_user.id
    is_thread_author = reply.thread and reply.thread.author_id == current_user.id

    if not (is_staff or is_author or is_thread_author):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to delete this reply")

    thread_id = reply.thread_id
    db.delete(reply)
    db.flush()

    # Re-evaluate thread has_verified_answer
    remaining_replies = db.query(DiscussionReply).filter(DiscussionReply.thread_id == thread_id).all()
    thread = db.query(DiscussionThread).filter(DiscussionThread.id == thread_id).first()
    if thread:
        thread.has_verified_answer = any(r.is_verified for r in remaining_replies)

    db.commit()


@router.post("/{thread_id}/upvote", response_model=DiscussionUpvoteResponse)
def toggle_thread_upvote(
    thread_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """Toggle upvote on a discussion thread for current user."""
    thread = db.query(DiscussionThread).filter(DiscussionThread.id == thread_id).first()
    if not thread:
        raise HTTPException(status_code=404, detail="Discussion thread not found")

    if not deps.is_super_admin(current_user):
        org_ids = deps.get_user_organization_ids(current_user)
        student_profile = db.query(Student).filter(Student.user_id == current_user.id).first()
        student_org_id = student_profile.organization_id if student_profile else None
        has_access = (
            thread.organization_id in org_ids
            or (student_org_id and thread.organization_id == student_org_id)
            or not org_ids
        )
        if not has_access:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized for this organization")

    existing = (
        db.query(DiscussionUpvote)
        .filter(
            DiscussionUpvote.thread_id == thread.id,
            DiscussionUpvote.user_id == current_user.id,
        )
        .first()
    )

    if existing:
        db.delete(existing)
        thread.upvotes = max(0, thread.upvotes - 1)
        is_upvoted = False
    else:
        new_upvote = DiscussionUpvote(
            thread_id=thread.id,
            user_id=current_user.id,
        )
        db.add(new_upvote)
        thread.upvotes += 1
        is_upvoted = True

    db.commit()
    db.refresh(thread)

    return DiscussionUpvoteResponse(
        thread_id=thread.id,
        is_upvoted=is_upvoted,
        upvotes=thread.upvotes,
    )


@router.put("/replies/{reply_id}/verify", response_model=DiscussionReplyRead)
def toggle_reply_verified(
    reply_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """Mark or unmark a reply as verified solution (Instructors, TAs, Admins, or thread author)."""
    reply = (
        db.query(DiscussionReply)
        .options(joinedload(DiscussionReply.thread))
        .filter(DiscussionReply.id == reply_id)
        .first()
    )
    if not reply:
        raise HTTPException(status_code=404, detail="Reply not found")

    thread = reply.thread
    user_roles = deps.get_user_roles(current_user)
    is_staff = bool(user_roles & STAFF_ROLES) or deps.is_super_admin(current_user)
    is_author = thread.author_id == current_user.id if thread else False

    if not (is_staff or is_author):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only instructors or thread authors can verify solutions")

    reply.is_verified = not reply.is_verified
    db.flush()

    # Sync thread.has_verified_answer
    if thread:
        all_replies = db.query(DiscussionReply).filter(DiscussionReply.thread_id == thread.id).all()
        thread.has_verified_answer = any(r.is_verified for r in all_replies)

    db.commit()
    db.refresh(reply)

    return _build_reply_read(reply)


@router.delete("/{thread_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_discussion_thread(
    thread_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """Delete a discussion thread (Author, Instructors, or Admins)."""
    thread = db.query(DiscussionThread).filter(DiscussionThread.id == thread_id).first()
    if not thread:
        raise HTTPException(status_code=404, detail="Discussion thread not found")

    user_roles = deps.get_user_roles(current_user)
    is_staff = bool(user_roles & STAFF_ROLES) or deps.is_super_admin(current_user)
    is_author = thread.author_id == current_user.id

    if not (is_staff or is_author):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to delete this thread")

    db.delete(thread)
    db.commit()
