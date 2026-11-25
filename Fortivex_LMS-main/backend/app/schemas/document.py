from pydantic import BaseModel, ConfigDict
from typing import Optional

class ProgramDocumentBase(BaseModel):
    title: str
    use_for_quiz: bool = True

class ProgramDocumentCreate(ProgramDocumentBase):
    pass

class ProgramDocumentUpdate(BaseModel):
    title: Optional[str] = None
    use_for_quiz: Optional[bool] = None

class ProgramDocument(ProgramDocumentBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    program_id: int
    file_url: str
