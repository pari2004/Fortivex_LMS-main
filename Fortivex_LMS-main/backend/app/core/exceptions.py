"""Small set of app-level exceptions + handlers, registered in app.main.

Keeps client error responses generic while logging unexpected exceptions.
"""

import logging

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse

logger = logging.getLogger("fortivex_lms")


class NotFoundError(Exception):
    def __init__(self, message: str = "Resource not found"):
        self.message = message


class PermissionDeniedError(Exception):
    def __init__(self, message: str = "Permission denied"):
        self.message = message


def register_exception_handlers(app: FastAPI) -> None:
    from app.core.config import get_settings

    def _cors_headers(request: Request) -> dict[str, str]:
        settings = get_settings()
        origin = request.headers.get("origin")
        if origin and (origin in settings.cors_allowed_origins_list or "*" in settings.cors_allowed_origins_list):
            return {
                "Access-Control-Allow-Origin": origin,
                "Access-Control-Allow-Credentials": "true",
            }
        return {}

    @app.exception_handler(NotFoundError)
    async def not_found_handler(request: Request, exc: NotFoundError) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"detail": exc.message},
            headers=_cors_headers(request),
        )

    @app.exception_handler(PermissionDeniedError)
    async def permission_denied_handler(request: Request, exc: PermissionDeniedError) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"detail": exc.message},
            headers=_cors_headers(request),
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "Internal server error"},
            headers=_cors_headers(request),
        )
