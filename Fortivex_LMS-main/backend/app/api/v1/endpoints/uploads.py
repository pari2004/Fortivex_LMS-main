"""Media and document upload endpoints."""

import logging
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from app.api import deps
from app.models.user import User
from app.services.storage import MAX_FILE_SIZE_MB_GENERAL, get_storage_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/uploads", tags=["uploads"])


@router.post("", status_code=status.HTTP_201_CREATED)
async def upload_file(
    file: UploadFile = File(...),
    current_user: User = Depends(deps.get_current_active_user),
):
    """
    Secure file upload endpoint.
    - Requires active authentication (prevents anonymous abuse).
    - Validates file extensions (blocks executables, scripts, SVGs).
    - Enforces max size limit (100 MB).
    - Generates collision-resistant object keys.
    - Stores file in AWS S3 (or local disk fallback).
    """
    storage_service = get_storage_service()
    try:
        url = await storage_service.upload_file(
            file=file,
            folder="media",
            max_size_mb=MAX_FILE_SIZE_MB_GENERAL,
            user_id=current_user.id,
        )
        return {"url": url}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Unexpected error during file upload: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="File upload failed. Please try again.",
        )
