from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import ProgramStatus


class ProgramBase(BaseModel):
    # max_length mirrors app/models/program.py's String(255)/String(50)
    # columns — without it, an over-long value passes Pydantic and fails
    # as an uncaught DataError (500) at INSERT time instead of a clean 422.
    name: str = Field(max_length=255)
    code: str = Field(max_length=50)
    description: Optional[str] = None


class ProgramCreate(ProgramBase):
    organization_id: int
    status: ProgramStatus = ProgramStatus.ACTIVE


class ProgramUpdate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=255)
    description: Optional[str] = None
    status: Optional[ProgramStatus] = None


class ProgramRead(ProgramBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    organization_id: int
    status: ProgramStatus
