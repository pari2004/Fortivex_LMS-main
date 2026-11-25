"""FastAPI application entry point (app factory)."""

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.v1.api import api_router
from app.core.config import get_settings
from app.core.exceptions import register_exception_handlers

os.makedirs("uploads", exist_ok=True)

def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(title=settings.APP_NAME, version="0.1.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_allowed_origins_list,
        allow_origin_regex=settings.CORS_ALLOW_ORIGIN_REGEX
        or r"https://([a-zA-Z0-9-]+\.)*(vercel\.app|fortivexaitech\.com|empowersacademy\.com|medivexai\.com)",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    register_exception_handlers(app)
    app.include_router(api_router, prefix="/api/v1")
    app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

    @app.get("/health", tags=["health"])
    def root_health() -> dict:
        """Unversioned alias for infra healthchecks (Railway, load balancers)."""
        return {"status": "ok"}

    return app


app = create_app()
