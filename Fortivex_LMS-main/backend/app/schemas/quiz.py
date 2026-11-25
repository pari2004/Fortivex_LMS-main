from typing import Any, Dict, Optional
from pydantic import BaseModel

class QuizSubmission(BaseModel):
    answers: Dict[str, Any]  # Maps question index (str) to selected option index, text, or coding object

class QuizAttemptResponse(BaseModel):
    score: float
    total_questions: int
    answers_json: Dict[str, Any]
    evaluations: Optional[Dict[str, Any]] = None
