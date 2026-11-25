from typing import Optional
from pydantic import BaseModel, ConfigDict
from app.models.enums import ActivityType

class ActivityBase(BaseModel):
    title: str
    activity_type: ActivityType
    content: Optional[dict] = None
    order: int = 1

class ActivityCreate(ActivityBase):
    pass

class ActivityUpdate(BaseModel):
    title: Optional[str] = None
    activity_type: Optional[ActivityType] = None
    content: Optional[dict] = None
    order: Optional[int] = None

class Activity(ActivityBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    lesson_id: int

class LessonBase(BaseModel):
    title: str
    description: Optional[str] = None
    order: int = 1

class LessonCreate(LessonBase):
    pass

class LessonUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    order: Optional[int] = None

class Lesson(LessonBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    week_id: int
    activities: list[Activity] = []

class WeekBase(BaseModel):
    title: str
    week_number: int
    order: int = 1

class WeekCreate(WeekBase):
    pass

class WeekUpdate(BaseModel):
    title: Optional[str] = None
    week_number: Optional[int] = None
    order: Optional[int] = None

class Week(WeekBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    program_module_id: int
    lessons: list[Lesson] = []

class ProgramModuleBase(BaseModel):
    title: str
    description: Optional[str] = None
    order: int = 1

class ProgramModuleCreate(ProgramModuleBase):
    pass

class ProgramModuleUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    order: Optional[int] = None

class ProgramModule(ProgramModuleBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    program_id: int
    weeks: list[Week] = []
