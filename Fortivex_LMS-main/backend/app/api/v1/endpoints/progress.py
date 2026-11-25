from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from pydantic import BaseModel

from app.api.deps import require_roles, get_current_active_user
from app.db.session import get_db
from app.models.progress import ActivityCompletion, QuizAttempt
from app.models.student import Student
from app.models.user import User
from app.models.curriculum import Activity, Lesson, Week, ProgramModule
from app.schemas.quiz import QuizSubmission, QuizAttemptResponse
from app.schemas.achievements import (
    CohortAchievementsResponse,
    PeerComparisonResponse,
    StreakActionResponse,
    StreakInfo,
)
from app.services.achievements import (
    get_cohort_achievements_data,
    compare_peer_in_cohort,
    get_student_streak_info,
    record_student_activity_today,
    apply_streak_save_manual,
)

router = APIRouter(prefix="/progress", tags=["progress"])

@router.get("/my-quizzes", response_model=list[dict])
def get_my_quizzes(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("STUDENT"))
):
    student = db.query(Student).filter(Student.user_id == current_user.id).first()
    if not student:
        raise HTTPException(status_code=403, detail="Student record not found")
        
    # Get programs enrolled in
    from app.models.enrollment import Enrollment
    from app.models.cohort import Cohort
    from app.models.program import Program
    from app.models.curriculum import ProgramModule, Week, Lesson, Activity
    from sqlalchemy.orm import joinedload
    
    enrollments = db.query(Enrollment).filter(Enrollment.student_id == student.id).all()
    if not enrollments:
        return []

    cohort_ids = [e.cohort_id for e in enrollments if e.cohort_id is not None]

    # Get programs for these enrollments directly, plus any programs linked via cohorts
    program_ids = {e.program_id for e in enrollments if e.program_id}
    if cohort_ids:
        cohorts = db.query(Cohort).filter(Cohort.id.in_(cohort_ids)).options(joinedload(Cohort.programs)).all()
        for c in cohorts:
            for p in c.programs:
                program_ids.add(p.id)

    if not program_ids:
        return []

    # Find all quizzes for these programs
    quizzes = db.query(Activity).join(Lesson).join(Week).join(ProgramModule).filter(
        Activity.activity_type == "QUIZ",
        ProgramModule.program_id.in_(program_ids)
    ).options(
        joinedload(Activity.lesson).joinedload(Lesson.week).joinedload(Week.program_module).joinedload(ProgramModule.program)
    ).all()

    # Find past attempts
    attempts = db.query(QuizAttempt).filter(QuizAttempt.student_id == student.id).all()
    attempt_map = {a.activity_id: a for a in attempts}

    result = []
    for q in quizzes:
        lesson = q.lesson
        week = lesson.week if lesson else None
        module = week.program_module if week else None
        program = module.program if module else None

        attempt = attempt_map.get(q.id)

        questions = q.content.get("questions", []) if (q.content and isinstance(q.content, dict)) else []
        result.append({
            "id": q.id,
            "title": q.title,
            "lesson_id": q.lesson_id,
            "lesson_title": lesson.title if lesson else "Unknown",
            "week_title": week.title if week else "Unknown",
            "module_title": module.title if module else "Unknown",
            "program_id": program.id if program else None,
            "program_name": program.name if program else "Unknown",
            "question_count": len(questions),
            "score": attempt.score if attempt else None,
            "attempted": attempt is not None
        })
        
    return result


@router.get("/cohort-achievements", response_model=CohortAchievementsResponse)
def get_cohort_achievements(
    cohort_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("STUDENT")),
) -> CohortAchievementsResponse:
    """Retrieve cohort-isolated achievements, ranking, benchmarks, and leaderboard
    where students are only compared to peers enrolled in the same cohort."""
    return get_cohort_achievements_data(db=db, user=current_user, cohort_id=cohort_id)


@router.get("/cohort-achievements/compare/{peer_student_id}", response_model=PeerComparisonResponse)
def compare_cohort_peer(
    peer_student_id: int,
    cohort_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("STUDENT")),
) -> PeerComparisonResponse:
    """Compare achievement metrics and badges side-by-side with a peer in the same cohort."""
    return compare_peer_in_cohort(
        db=db, user=current_user, peer_student_id=peer_student_id, cohort_id=cohort_id
    )


@router.get("/streak", response_model=StreakInfo)
def get_streak(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("STUDENT")),
) -> StreakInfo:
    """Get current student's daily study streak, weekly streak freeze status, and 7-day timeline."""
    student = db.query(Student).filter(Student.user_id == current_user.id).first()
    if not student:
        raise HTTPException(status_code=403, detail="Student profile not found")
    return get_student_streak_info(db=db, student_id=student.id)


@router.post("/streak/heartbeat", response_model=StreakActionResponse)
def record_streak_heartbeat(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("STUDENT")),
) -> StreakActionResponse:
    """Record a daily study check-in/heartbeat to maintain and advance the student's streak."""
    student = db.query(Student).filter(Student.user_id == current_user.id).first()
    if not student:
        raise HTTPException(status_code=403, detail="Student profile not found")
    record_student_activity_today(db=db, student_id=student.id)
    streak_info = get_student_streak_info(db=db, student_id=student.id)
    return StreakActionResponse(
        success=True,
        message="Daily study activity recorded! Streak maintained.",
        streak=streak_info,
    )


@router.post("/streak/use-save", response_model=StreakActionResponse)
def use_streak_save(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("STUDENT")),
) -> StreakActionResponse:
    """Apply an available weekly streak save to protect/repair yesterday's missed day."""
    student = db.query(Student).filter(Student.user_id == current_user.id).first()
    if not student:
        raise HTTPException(status_code=403, detail="Student profile not found")
    success, message, _ = apply_streak_save_manual(db=db, student_id=student.id)
    streak_info = get_student_streak_info(db=db, student_id=student.id)
    return StreakActionResponse(
        success=success,
        message=message,
        streak=streak_info,
    )


class ProgressResponse(BaseModel):
    completed_activity_ids: list[int]

@router.get("/{program_id}", response_model=ProgressResponse)
def get_progress(
    program_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("STUDENT"))
):
    student = db.query(Student).filter(Student.user_id == current_user.id).first()
    if not student:
        return {"completed_activity_ids": []}
    
    completions = (
        db.query(ActivityCompletion.activity_id)
        .join(Activity, Activity.id == ActivityCompletion.activity_id)
        .join(Lesson, Lesson.id == Activity.lesson_id)
        .join(Week, Week.id == Lesson.week_id)
        .join(ProgramModule, ProgramModule.id == Week.program_module_id)
        .filter(
            ActivityCompletion.student_id == student.id,
            ProgramModule.program_id == program_id,
        )
        .all()
    )
    
    return {"completed_activity_ids": [c[0] for c in completions]}

@router.post("/{activity_id}")
def mark_activity_complete(
    activity_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("STUDENT"))
):
    student = db.query(Student).filter(Student.user_id == current_user.id).first()
    if not student:
        raise HTTPException(status_code=403, detail="Student record not found")
        
    completion = ActivityCompletion(student_id=student.id, activity_id=activity_id)
    db.add(completion)
    try:
        db.commit()
        record_student_activity_today(db, student.id)
    except IntegrityError:
        db.rollback() # Already marked complete
    
    return {"success": True}

from app.services.judge0 import run_test_cases
from app.services.ai_evaluator import evaluate_long_answer, evaluate_coding_answer

@router.post("/{activity_id}/submit-quiz", response_model=QuizAttemptResponse)
async def submit_quiz(
    activity_id: int,
    payload: QuizSubmission,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("STUDENT"))
):
    student = db.query(Student).filter(Student.user_id == current_user.id).first()
    if not student:
        raise HTTPException(status_code=403, detail="Student record not found")

    activity = db.get(Activity, activity_id)
    if not activity or activity.activity_type.name != "QUIZ":
        raise HTTPException(status_code=404, detail="Quiz not found")

    quiz_data = activity.content
    if not quiz_data or "questions" not in quiz_data:
        raise HTTPException(status_code=400, detail="Quiz data is invalid")

    questions = quiz_data.get("questions", [])
    evaluations: dict = {}
    total_score: float = 0.0
    total_possible: int = 0

    for i, q in enumerate(questions):
        idx_str = str(i)
        q_type = str(q.get("type") or q.get("question_type") or "MCQ").upper()
        ans_val = payload.answers.get(idx_str)

        if q_type == "MCQ":
            correct_idx = q.get("correct_index", 0)
            selected_idx = None
            if ans_val is not None:
                try:
                    selected_idx = int(ans_val)
                except (ValueError, TypeError):
                    selected_idx = None

            is_correct = (selected_idx is not None and selected_idx == correct_idx)
            q_score = 1.0 if is_correct else 0.0
            max_score = 1

            evaluations[idx_str] = {
                "type": "MCQ",
                "is_correct": is_correct,
                "selected_index": selected_idx,
                "correct_index": correct_idx,
                "score": q_score,
                "max_score": max_score,
                "explanation": q.get("explanation", ""),
            }
            total_score += q_score
            total_possible += max_score

        elif q_type in ("LONG_ANSWER", "ESSAY", "TEXT"):
            # Open-ended / long-form question
            ans_text = ""
            if isinstance(ans_val, dict):
                ans_text = str(ans_val.get("text", "") or "")
            elif ans_val is not None:
                ans_text = str(ans_val)

            max_pts = int(q.get("points") or 10)
            eval_result = await evaluate_long_answer(
                prompt=q.get("prompt", ""),
                student_answer=ans_text,
                expected_answer=q.get("expected_answer") or q.get("rubric") or q.get("explanation", ""),
                max_score=max_pts
            )
            eval_result["type"] = "LONG_ANSWER"
            eval_result["student_text"] = ans_text
            eval_result["explanation"] = q.get("explanation", "")
            evaluations[idx_str] = eval_result

            total_score += float(eval_result.get("score", 0))
            total_possible += max_pts

        elif q_type in ("CODING", "CODE"):
            # Coding question with Judge0 sandbox validation
            code_text = ""
            language = str(q.get("language") or "python")
            if isinstance(ans_val, dict):
                code_text = str(ans_val.get("code", "") or "")
                language = str(ans_val.get("language") or language)
            elif ans_val is not None:
                code_text = str(ans_val)

            max_pts = int(q.get("points") or 10)
            test_cases = q.get("test_cases") or []
            test_results = []
            if test_cases and code_text.strip():
                try:
                    test_results = await run_test_cases(code_text, language, test_cases)
                except Exception as e:
                    test_results = [{"error": str(e), "passed": False}]

            eval_result = await evaluate_coding_answer(
                prompt=q.get("prompt", ""),
                student_code=code_text,
                language=language,
                test_results=test_results,
                solution_notes=q.get("explanation", ""),
                max_score=max_pts
            )
            eval_result["type"] = "CODING"
            eval_result["student_code"] = code_text
            eval_result["language"] = language
            eval_result["test_results"] = test_results
            eval_result["explanation"] = q.get("explanation", "")
            evaluations[idx_str] = eval_result

            total_score += float(eval_result.get("score", 0))
            total_possible += max_pts

    saved_answers = {
        "answers": payload.answers,
        "evaluations": evaluations,
    }

    attempt = QuizAttempt(
        student_id=student.id,
        activity_id=activity_id,
        score=int(round(total_score)),
        total_questions=total_possible if total_possible > 0 else len(questions),
        answers_json=saved_answers
    )
    db.add(attempt)

    # Also mark activity as complete
    completion = ActivityCompletion(student_id=student.id, activity_id=activity_id)
    db.add(completion)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        db.add(attempt)
        db.commit()

    record_student_activity_today(db, student.id)
    db.refresh(attempt)

    return QuizAttemptResponse(
        score=total_score,
        total_questions=total_possible if total_possible > 0 else len(questions),
        answers_json=payload.answers,
        evaluations=evaluations
    )
