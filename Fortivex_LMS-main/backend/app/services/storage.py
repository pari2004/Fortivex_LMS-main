"""Object storage service with S3 integration and security hardening.

Implements defense-in-depth measures:
1. Strict extension whitelisting & blocking of executable/script files (XSS, malware prevention).
2. Enforced maximum file size limits via streaming chunk inspection (DoS / cost explosion protection).
3. Cryptographically random, collision-resistant object key generation (Path Traversal / Overwrite prevention).
4. Safe MIME type detection and Content-Disposition headers (prevent browser script execution).
5. Automatic fallback to local storage if S3 credentials are not configured (e.g. offline dev).
"""

import io
import mimetypes
import os
import re
import uuid
import logging
from typing import Optional, Set, Tuple

import boto3
from botocore.config import Config as BotoConfig
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import HTTPException, UploadFile, status

from app.core.config import get_settings

logger = logging.getLogger(__name__)

# Extensions that are strictly blocked to prevent remote code execution,
# server-side execution, or stored XSS in student/admin browsers.
DISALLOWED_EXTENSIONS: Set[str] = {
    # Executables & Binaries
    "exe", "dll", "bin", "bat", "cmd", "sh", "bash", "ps1", "vbs", "scr", "msi", "com",
    # Web scripts & Stored XSS vectors (SVGs can embed inline javascript!)
    "html", "htm", "xhtml", "svg", "js", "mjs", "php", "php3", "php4", "php5", "phtml",
    "jsp", "asp", "aspx", "cgi", "pl"
}

# Standard safe extensions for LMS usage
DEFAULT_ALLOWED_EXTENSIONS: Set[str] = {
    # Documents
    "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv", "rtf",
    # Images
    "png", "jpg", "jpeg", "gif", "webp",
    # Audio & Video
    "mp4", "webm", "mov", "m4v", "mp3", "wav", "ogg",
    # Code & Archives
    "zip", "tar", "gz", "ipynb", "py"
}

# 100 MB max for course videos, 25 MB max for assignments/documents
MAX_FILE_SIZE_MB_GENERAL = 100
MAX_FILE_SIZE_MB_ASSIGNMENT = 25


class StorageService:
    def __init__(self):
        self.settings = get_settings()
        self._s3_client = None
        self._init_s3()

    def _init_s3(self):
        if (
            self.settings.STORAGE_BUCKET_NAME
            and self.settings.STORAGE_ACCESS_KEY_ID
            and self.settings.STORAGE_SECRET_ACCESS_KEY
        ):
            try:
                boto_config = BotoConfig(
                    region_name=self.settings.STORAGE_REGION or "ap-south-1",
                    signature_version="s3v4",
                    retries={"max_attempts": 3, "mode": "standard"},
                )
                self._s3_client = boto3.client(
                    "s3",
                    aws_access_key_id=self.settings.STORAGE_ACCESS_KEY_ID,
                    aws_secret_access_key=self.settings.STORAGE_SECRET_ACCESS_KEY,
                    region_name=self.settings.STORAGE_REGION or "ap-south-1",
                    endpoint_url=self.settings.STORAGE_ENDPOINT_URL or None,
                    config=boto_config,
                )
                logger.info("StorageService: Initialized S3 client for bucket '%s'.", self.settings.STORAGE_BUCKET_NAME)
            except Exception as e:
                logger.error("StorageService: Failed to initialize S3 client: %s", e)
                self._s3_client = None
        else:
            logger.warning("StorageService: S3 credentials not fully configured; falling back to local disk.")

    @property
    def is_s3_enabled(self) -> bool:
        return self._s3_client is not None and bool(self.settings.STORAGE_BUCKET_NAME)

    def sanitize_filename(self, filename: str) -> str:
        """Strip directory paths and unsafe special characters from filename."""
        clean_name = os.path.basename(filename)
        # Keep only alphanumeric, hyphens, underscores, dots
        clean_name = re.sub(r"[^a-zA-Z0-9._-]", "_", clean_name)
        # Avoid leading dot or empty names
        clean_name = clean_name.lstrip(".")
        return clean_name or "file"

    async def validate_and_read_file(
        self,
        file: UploadFile,
        max_size_mb: int = MAX_FILE_SIZE_MB_GENERAL,
        allowed_extensions: Optional[Set[str]] = None,
    ) -> Tuple[bytes, str, str, str]:
        """
        Validates the incoming file:
        - Checks for disallowed extensions (malware, XSS prevention).
        - Validates against whitelist.
        - Streams the content up to max_size_mb (DoS / memory bloat prevention).
        Returns: (file_bytes, safe_filename, extension, mime_type)
        """
        if not file.filename:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No filename provided in upload.",
            )

        safe_name = self.sanitize_filename(file.filename)
        ext = safe_name.split(".")[-1].lower() if "." in safe_name else ""

        # Check explicit blacklist
        if ext in DISALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File extension '.{ext}' is strictly prohibited for security reasons.",
            )

        # Check allowed whitelist
        effective_allowed = allowed_extensions or DEFAULT_ALLOWED_EXTENSIONS
        if ext not in effective_allowed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File extension '.{ext}' is not permitted. Allowed types: {', '.join(sorted(effective_allowed))}",
            )

        # Stream and check size chunk-by-chunk to prevent memory exhaustion
        max_bytes = max_size_mb * 1024 * 1024
        chunks = []
        total_size = 0
        chunk_size = 64 * 1024  # 64 KB

        while True:
            chunk = await file.read(chunk_size)
            if not chunk:
                break
            total_size += len(chunk)
            if total_size > max_bytes:
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail=f"File size exceeds maximum permitted limit of {max_size_mb} MB.",
                )
            chunks.append(chunk)

        content = b"".join(chunks)
        if len(content) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot upload an empty file.",
            )

        # Guess MIME type
        mime_type, _ = mimetypes.guess_type(safe_name)
        if not mime_type:
            mime_type = file.content_type or "application/octet-stream"

        return content, safe_name, ext, mime_type

    async def upload_file(
        self,
        file: UploadFile,
        folder: str = "general",
        max_size_mb: int = MAX_FILE_SIZE_MB_GENERAL,
        allowed_extensions: Optional[Set[str]] = None,
        user_id: Optional[int] = None,
    ) -> str:
        """
        Uploads a validated file to S3 (or local disk fallback).
        Returns the publicly accessible URL.
        """
        content, safe_name, ext, mime_type = await self.validate_and_read_file(
            file=file,
            max_size_mb=max_size_mb,
            allowed_extensions=allowed_extensions,
        )

        # Generate a cryptographically unique object key to prevent collisions & overwrites
        unique_token = uuid.uuid4().hex
        object_key = f"{folder}/{unique_token}_{safe_name}"

        if self.is_s3_enabled:
            return self._upload_to_s3(
                content=content,
                object_key=object_key,
                mime_type=mime_type,
                safe_name=safe_name,
                user_id=user_id,
            )
        else:
            return self._upload_to_local(
                content=content,
                object_key=object_key,
            )

    def _upload_to_s3(
        self,
        content: bytes,
        object_key: str,
        mime_type: str,
        safe_name: str,
        user_id: Optional[int] = None,
    ) -> str:
        bucket = self.settings.STORAGE_BUCKET_NAME
        region = self.settings.STORAGE_REGION or "ap-south-1"

        # Determine disposition: inline for browser-viewable (PDF, images, video),
        # attachment for archives or raw code
        disposition_type = "inline"
        if mime_type.startswith("application/zip") or mime_type.startswith("application/x-tar"):
            disposition_type = "attachment"

        extra_args = {
            "ContentType": mime_type,
            "ContentDisposition": f'{disposition_type}; filename="{safe_name}"',
            "Metadata": {
                "uploaded-by": str(user_id) if user_id else "anonymous",
                "original-filename": safe_name,
            },
        }

        try:
            self._s3_client.put_object(
                Bucket=bucket,
                Key=object_key,
                Body=content,
                **extra_args,
            )
            logger.info("Successfully uploaded %s to S3 bucket %s", object_key, bucket)
        except (BotoCoreError, ClientError) as e:
            logger.error("Failed to upload %s to S3: %s", object_key, e)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Cloud storage upload failed. Please try again later.",
            )

        # Construct public URL
        if self.settings.STORAGE_ENDPOINT_URL:
            # Custom S3 endpoint (e.g. Cloudflare R2 or MinIO)
            base = self.settings.STORAGE_ENDPOINT_URL.rstrip("/")
            return f"{base}/{bucket}/{object_key}"
        else:
            # Standard AWS S3 URL format
            return f"https://{bucket}.s3.{region}.amazonaws.com/{object_key}"

    def _upload_to_local(self, content: bytes, object_key: str) -> str:
        local_dir = os.path.join("uploads", os.path.dirname(object_key))
        os.makedirs(local_dir, exist_ok=True)
        local_path = os.path.join("uploads", object_key)

        with open(local_path, "wb") as f:
            f.write(content)

        return f"/uploads/{object_key}"


_storage_service_instance: Optional[StorageService] = None


def get_storage_service() -> StorageService:
    global _storage_service_instance
    if _storage_service_instance is None:
        _storage_service_instance = StorageService()
    return _storage_service_instance

