from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user
from app.core.rate_limit import register_failed_attempt, register_success, seconds_until_retry
from app.core.security import (
    create_access_token,
    create_password_reset_token,
    hash_password,
    verify_password,
    verify_password_reset_token,
)
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import Token
from app.schemas.user import UserRead

router = APIRouter(prefix="/auth", tags=["auth"])


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str
    full_name: str | None = None
    phone_number: str | None = None
    title: str | None = None
    bio: str | None = None
    linkedin_url: str | None = None
    github_url: str | None = None
    portfolio_url: str | None = None


@router.post("/login", response_model=Token)
def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)) -> Token:
    client_host = request.client.host if request.client else "unknown"
    rate_limit_key = f"{client_host}:{form_data.username.lower()}"

    retry_after = seconds_until_retry(rate_limit_key)
    if retry_after is not None:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed login attempts. Try again later.",
            headers={"Retry-After": str(max(1, int(retry_after) + 1))},
        )

    user = db.query(User).filter(User.email == form_data.username).first()
    if user is None or not verify_password(form_data.password, user.hashed_password):
        register_failed_attempt(rate_limit_key)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Inactive user")

    register_success(rate_limit_key)
    access_token = create_access_token(subject=str(user.id))
    return Token(access_token=access_token)


@router.get("/me", response_model=UserRead)
def read_current_user(current_user: User = Depends(get_current_active_user)) -> User:
    return current_user


@router.post("/logout")
def logout(_: User = Depends(get_current_active_user)) -> dict:
    """Access tokens are stateless JWTs with no server-side session or
    refresh-token store yet (see docs/BACKEND_STATUS.md "Not built today"),
    so there is nothing to invalidate server-side today. This endpoint
    exists so the client has one consistent call to make; the client is
    responsible for discarding the stored token."""
    return {"detail": "Logged out. Discard the access token client-side."}


@router.post("/forgot-password", status_code=status.HTTP_200_OK)
def request_password_reset(
    payload: ForgotPasswordRequest,
    db: Session = Depends(get_db),
) -> dict:
    """Validate user by email and issue a password reset authorization token."""
    email_clean = payload.email.strip().lower()
    if not email_clean:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email address is required.",
        )

    user = db.query(User).filter(func.lower(User.email) == email_clean).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account found with this email address. Please check spelling or contact support.",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been deactivated. Please contact your organization administrator.",
        )

    reset_token = create_password_reset_token(user.email)
    return {
        "detail": "Password reset authorization granted.",
        "reset_token": reset_token,
        "email": user.email,
        "full_name": user.full_name,
        "phone_number": user.phone_number,
        "title": user.title,
        "bio": user.bio,
        "linkedin_url": user.linkedin_url,
        "github_url": user.github_url,
        "portfolio_url": user.portfolio_url,
    }


@router.post("/reset-password", status_code=status.HTTP_200_OK)
def confirm_password_reset(
    payload: ResetPasswordRequest,
    db: Session = Depends(get_db),
) -> dict:
    """Verify reset token, update user's password, and save completed profile details."""
    email = verify_password_reset_token(payload.token)
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token. Please request a new password reset.",
        )

    new_pwd = payload.new_password.strip() if payload.new_password else ""
    if len(new_pwd) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters long.",
        )

    user = db.query(User).filter(func.lower(User.email) == email.lower()).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User account associated with this token no longer exists.",
        )

    user.hashed_password = hash_password(new_pwd)
    user.must_change_password = False

    if payload.full_name is not None and payload.full_name.strip():
        user.full_name = payload.full_name.strip()
    if payload.phone_number is not None:
        user.phone_number = payload.phone_number.strip() if payload.phone_number else None
    if payload.title is not None:
        user.title = payload.title.strip() if payload.title else None
    if payload.bio is not None:
        user.bio = payload.bio.strip() if payload.bio else None
    if payload.linkedin_url is not None:
        user.linkedin_url = payload.linkedin_url.strip() if payload.linkedin_url else None
    if payload.github_url is not None:
        user.github_url = payload.github_url.strip() if payload.github_url else None
    if payload.portfolio_url is not None:
        user.portfolio_url = payload.portfolio_url.strip() if payload.portfolio_url else None

    db.commit()

    return {
        "detail": "Password has been reset successfully and profile details updated.",
        "email": user.email,
        "full_name": user.full_name,
    }

