from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from app.api import deps
from app.models.user import User
from app.services.ai_quiz import extract_text_from_pdf_bytes, generate_quiz_from_text, QuizGenerationResponse

router = APIRouter(prefix="/ai", tags=["ai"])

@router.post("/generate-quiz", response_model=QuizGenerationResponse)
async def generate_quiz_from_document(
    file: UploadFile = File(...),
    num_questions: int = Form(10),
    question_types: Optional[str] = Form("MCQ"),
    current_user: User = Depends(deps.require_roles("SUPER_ADMIN", "ACADEMIC_ADMIN", "PROGRAM_MANAGER", "INSTRUCTOR", "TRAINER", "LEAD_TRAINER", "PROGRAM_DIRECTOR", "MENTOR", "TEACHING_ASSISTANT")),
):
    """
    Generate a quiz from an uploaded PDF document.
    Supports toggling question types: MCQ, LONG_ANSWER, CODING (comma-separated).
    Requires admin or instructor privileges.
    """
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported for AI quiz generation.")
        
    try:
        content = await file.read()
        text = extract_text_from_pdf_bytes(content)
        
        if not text.strip():
            raise HTTPException(status_code=400, detail="Could not extract any text from the provided PDF.")
            
        types_list = [t.strip().upper() for t in (question_types or "MCQ").split(",") if t.strip()]
        if not types_list:
            types_list = ["MCQ"]

        quiz = await generate_quiz_from_text(text, num_questions=num_questions, question_types=types_list)
        return quiz
        
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to generate quiz: {str(e)}")

