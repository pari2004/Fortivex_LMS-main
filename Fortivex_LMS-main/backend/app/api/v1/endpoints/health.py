import logging

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.session import get_db

router = APIRouter(tags=["health"])
logger = logging.getLogger("fortivex_lms")


@router.get("/health")
def health() -> dict:
    """Liveness check. Does not touch the database on purpose."""
    return {"status": "ok"}


@router.get("/health/db")
def health_db(db: Session = Depends(get_db)) -> JSONResponse:
    """Readiness check: actually queries Postgres. Reports the real error
    (503) instead of pretending the database is reachable when it is not."""
    try:
        db.execute(text("SELECT 1"))
    except Exception:  # noqa: BLE001 - readiness failures are reported without leaking driver details
        logger.exception("Database readiness check failed")
        return JSONResponse(status_code=503, content={"status": "error", "detail": "Database unavailable"})
    return JSONResponse(status_code=200, content={"status": "ok"})
