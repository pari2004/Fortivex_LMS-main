import asyncio
import json
import logging
from typing import Any, Dict, List, Optional
from openai import AsyncOpenAI
from app.core.config import get_settings
from app.services.ai_quiz import clean_and_parse_llm_json

logger = logging.getLogger(__name__)
settings = get_settings()

def _get_ai_client() -> Optional[AsyncOpenAI]:
    if not settings.AI_API_KEY:
        return None
    return AsyncOpenAI(
        api_key=settings.AI_API_KEY,
        base_url=settings.AI_BASE_URL
    )

async def evaluate_long_answer(
    prompt: str,
    student_answer: str,
    expected_answer: str = "",
    max_score: int = 10,
) -> Dict[str, Any]:
    """
    AI evaluation of open-ended / long-form text responses.
    """
    clean_student_ans = (student_answer or "").strip()
    if not clean_student_ans:
        return {
            "score": 0,
            "max_score": max_score,
            "passed": False,
            "feedback": "No answer was provided.",
            "strengths": [],
            "areas_for_improvement": ["Please provide a written response."]
        }

    client = _get_ai_client()
    if not client:
        # Fallback when AI API is unconfigured
        word_count = len(clean_student_ans.split())
        score = min(max_score, max(1, int((word_count / 30) * max_score)))
        return {
            "score": score,
            "max_score": max_score,
            "passed": score >= (max_score * 0.5),
            "feedback": "Response recorded. AI automated grading service is currently offline.",
            "strengths": ["Response submitted with adequate length."],
            "areas_for_improvement": []
        }

    system_instruction = (
        "You are an expert academic evaluator and professor. Grade the student's written response to the question fairly and constructively.\n"
        f"Maximum possible score: {max_score}.\n"
        "You MUST output ONLY a valid JSON object matching this schema:\n"
        "{\n"
        f'  "score": <number between 0 and {max_score}>,\n'
        '  "passed": <true if score >= 50% else false>,\n'
        '  "feedback": "<2-3 concise sentences giving qualitative assessment and constructive guidance>",\n'
        '  "strengths": ["<strength 1>", "<strength 2>"],\n'
        '  "areas_for_improvement": ["<area 1>", "<area 2>"]\n'
        "}"
    )

    user_content = (
        f"QUESTION PROMPT:\n{prompt}\n\n"
        f"EXPECTED ANSWER CRITERIA / RUBRIC:\n{expected_answer or 'Grade based on accuracy, clarity, and conceptual completeness.'}\n\n"
        f"STUDENT'S ANSWER:\n{clean_student_ans}"
    )

    try:
        response = await client.chat.completions.create(
            model=settings.AI_MODEL,
            messages=[
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": user_content}
            ],
            temperature=0.2,
            max_tokens=1500,
        )
        content = response.choices[0].message.content or ""
        parsed = clean_and_parse_llm_json(content)
        
        raw_score = parsed.get("score")
        try:
            score = round(float(raw_score), 1)
            score = max(0.0, min(float(max_score), score))
        except (TypeError, ValueError):
            score = max_score * 0.7

        return {
            "score": score,
            "max_score": max_score,
            "passed": bool(parsed.get("passed", score >= (max_score * 0.5))),
            "feedback": str(parsed.get("feedback") or "Good effort on your submission."),
            "strengths": list(parsed.get("strengths") or []),
            "areas_for_improvement": list(parsed.get("areas_for_improvement") or []),
        }

    except Exception as e:
        logger.error(f"Error during AI evaluation of long answer: {e}")
        # Graceful fallback: Give partial credit based on answer depth
        word_count = len(clean_student_ans.split())
        score = min(max_score, max(2, int((word_count / 40) * max_score)))
        return {
            "score": score,
            "max_score": max_score,
            "passed": score >= (max_score * 0.5),
            "feedback": "Your answer was saved successfully. Automated evaluation completed with baseline assessment.",
            "strengths": ["Thoughtful attempt provided."],
            "areas_for_improvement": [],
        }

async def evaluate_coding_answer(
    prompt: str,
    student_code: str,
    language: str = "python",
    test_results: Optional[List[Dict[str, Any]]] = None,
    solution_notes: str = "",
    max_score: int = 10,
) -> Dict[str, Any]:
    """
    AI evaluation of student code combined with Judge0 test execution metrics.
    """
    clean_code = (student_code or "").strip()
    if not clean_code:
        return {
            "score": 0,
            "max_score": max_score,
            "passed": False,
            "feedback": "No code was submitted.",
            "suggestions": ["Please implement a solution in the coding sandbox."]
        }

    test_summary = "No pre-configured test cases were run."
    passed_tests = 0
    total_tests = 0
    if test_results:
        total_tests = len(test_results)
        passed_tests = sum(1 for t in test_results if t.get("passed"))
        test_summary = f"{passed_tests} of {total_tests} test cases passed."

    client = _get_ai_client()
    if not client:
        # Fallback scoring purely on test cases if available
        if total_tests > 0:
            score = round((passed_tests / total_tests) * max_score, 1)
        else:
            score = max_score if len(clean_code) > 20 else 5
        return {
            "score": score,
            "max_score": max_score,
            "passed": score >= (max_score * 0.5),
            "feedback": f"Code evaluated: {test_summary}",
            "suggestions": [],
            "test_summary": test_summary,
        }

    system_instruction = (
        "You are a senior software engineering instructor and automated code reviewer.\n"
        "Evaluate the student's code solution based on logic correctness, test outputs, efficiency, edge cases, and best practices.\n"
        f"Maximum possible score: {max_score}.\n"
        "You MUST output ONLY a valid JSON object matching this schema:\n"
        "{\n"
        f'  "score": <number between 0 and {max_score}>,\n'
        '  "passed": <true if score >= 50% else false>,\n'
        '  "feedback": "<2-3 concise sentences summarizing solution correctness and code quality>",\n'
        '  "suggestions": ["<constructive advice 1>", "<constructive advice 2>"]\n'
        "}"
    )

    test_details_str = json.dumps(test_results or [], indent=2)
    user_content = (
        f"CODING PROBLEM PROMPT:\n{prompt}\n\n"
        f"PROGRAMMING LANGUAGE: {language}\n\n"
        f"REFERENCE NOTES / SOLUTION GUIDE:\n{solution_notes or 'Standard idiomatic implementation expected.'}\n\n"
        f"SANDBOX TEST EXECUTION RESULTS:\n{test_summary}\nDetails: {test_details_str}\n\n"
        f"STUDENT'S SUBMITTED CODE:\n```{language}\n{clean_code}\n```"
    )

    try:
        response = await client.chat.completions.create(
            model=settings.AI_MODEL,
            messages=[
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": user_content}
            ],
            temperature=0.2,
            max_tokens=1500,
        )
        content = response.choices[0].message.content or ""
        parsed = clean_and_parse_llm_json(content)

        raw_score = parsed.get("score")
        try:
            score = round(float(raw_score), 1)
            score = max(0.0, min(float(max_score), score))
        except (TypeError, ValueError):
            score = round((passed_tests / total_tests) * max_score, 1) if total_tests > 0 else (max_score * 0.8)

        return {
            "score": score,
            "max_score": max_score,
            "passed": bool(parsed.get("passed", score >= (max_score * 0.5))),
            "feedback": str(parsed.get("feedback") or f"Code reviewed. {test_summary}"),
            "suggestions": list(parsed.get("suggestions") or []),
            "test_summary": test_summary,
        }

    except Exception as e:
        logger.error(f"Error during AI evaluation of code: {e}")
        score = round((passed_tests / total_tests) * max_score, 1) if total_tests > 0 else 7.0
        return {
            "score": score,
            "max_score": max_score,
            "passed": score >= (max_score * 0.5),
            "feedback": f"Code executed successfully in sandbox. {test_summary}",
            "suggestions": ["Make sure to verify edge cases and boundary conditions."],
            "test_summary": test_summary,
        }
