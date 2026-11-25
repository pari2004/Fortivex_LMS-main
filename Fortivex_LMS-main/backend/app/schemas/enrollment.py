from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.models.enums import EnrollmentStatus
from app.schemas.cohort import CohortRead
from app.schemas.program import ProgramRead


class EnrollmentBase(BaseModel):
    student_id: int
    program_id: int
    cohort_id: Optional[int] = None
    organization_id: int


class EnrollmentCreate(EnrollmentBase):
    pass


class EnrollmentRead(EnrollmentBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    status: EnrollmentStatus
    # Nested so the dashboard can show program/cohort names from one call
    # instead of N+1 fetching each by id.
    program: ProgramRead
    cohort: Optional[CohortRead] = None
