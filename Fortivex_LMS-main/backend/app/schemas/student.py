from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import StudentLifecycleStatus


class StudentBase(BaseModel):
    user_id: int
    organization_id: int
    # max_length mirrors app/models/student.py's String(50) column —
    # without it, an over-long value passes Pydantic and fails as an
    # uncaught DataError (500) at INSERT time instead of a clean 422.
    student_code: str = Field(max_length=50)


class StudentCreate(StudentBase):
    pass


class StudentRead(StudentBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    lifecycle_status: StudentLifecycleStatus
