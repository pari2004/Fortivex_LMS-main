from datetime import date
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import CohortStatus


class CohortBase(BaseModel):
    # max_length mirrors app/models/cohort.py's String(255)/String(50)
    # columns — without it, an over-long value passes Pydantic and fails
    # as an uncaught DataError (500) at INSERT time instead of a clean 422.
    name: str = Field(max_length=255)
    code: str = Field(max_length=50)
    start_date: date
    end_date: Optional[date] = None


class CohortCreate(CohortBase):
    organization_id: int
    program_ids: list[int] = []
    status: CohortStatus = CohortStatus.UPCOMING


class CohortUpdate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=255)
    code: Optional[str] = Field(default=None, max_length=50)
    program_ids: Optional[list[int]] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: Optional[CohortStatus] = None


class CohortRead(CohortBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    organization_id: int
    program_ids: list[int] = []
    status: CohortStatus
