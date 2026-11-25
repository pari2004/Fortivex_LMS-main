from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

class RubricItem(BaseModel):
    criterion: str
    weight: str

class AssignmentCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=255)
    program_id: int
    lesson_id: Optional[int] = None
    description: str
    due_date: Optional[str] = None  # YYYY-MM-DD or readable string
    points: int = 100
    rubric: Optional[List[Dict[str, Any]]] = None
    submission_type: str = "file"  # "file", "text", "link"

class AssignmentResponse(BaseModel):
    id: int
    title: str
    program_id: int
    program_name: str
    module_title: str
    week_title: str
    lesson_id: int
    lesson_title: str
    description: str
    due_date: Optional[str] = None
    due_in_days: Optional[int] = None
    points: int = 100
    rubric: List[Dict[str, Any]] = []
    submission_type: str = "file"
    submissions_count: int = 0
    graded_count: int = 0
    pending_count: int = 0
    created_at: Optional[str] = None

class StudentAssignmentResponse(BaseModel):
    id: int
    title: str
    program_id: int
    program_name: str
    lesson_id: int
    lesson_title: str
    description: str
    due_date: Optional[str] = None
    due_in_days: int = 0
    points: int = 100
    rubric: List[Dict[str, Any]] = []
    submission_type: str = "file"
    status: str = "pending"  # "pending", "submitted", "graded"
    submission_id: Optional[int] = None
    submitted_at: Optional[str] = None
    file_name: Optional[str] = None
    file_url: Optional[str] = None
    notes: Optional[str] = None
    score: Optional[int] = None
    instructorFeedback: Optional[str] = None

class SubmissionGradeRequest(BaseModel):
    score: int = Field(..., ge=0)
    feedback: Optional[str] = None

class AssignmentSubmissionDetail(BaseModel):
    id: int
    student_id: int
    student_name: str
    student_email: str
    student_code: Optional[str] = None
    submitted_at: str
    file_name: Optional[str] = None
    file_url: Optional[str] = None
    notes: Optional[str] = None
    status: str
    score: Optional[int] = None
    feedback: Optional[str] = None
    graded_at: Optional[str] = None
    graded_by_name: Optional[str] = None
