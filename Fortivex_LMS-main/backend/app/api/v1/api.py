from fastapi import APIRouter

from app.api.v1.endpoints import (
    ai,
    assignments,
    auth,
    chatbot,
    code,
    cohorts,
    curriculum,
    discussions,
    enrollments,
    health,
    notifications,
    organizations,
    programs,
    progress,
    students,
    uploads,
    users,
)

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(organizations.router)
api_router.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
api_router.include_router(students.router)
api_router.include_router(programs.router)
api_router.include_router(cohorts.router)
api_router.include_router(enrollments.router)
api_router.include_router(curriculum.router, tags=["curriculum"])
api_router.include_router(assignments.router)
api_router.include_router(progress.router)
api_router.include_router(uploads.router)
api_router.include_router(ai.router)
api_router.include_router(code.router)
api_router.include_router(chatbot.router)
api_router.include_router(discussions.router)
