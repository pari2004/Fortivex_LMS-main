from typing import Any, Dict, List, Optional, Union
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.api import deps
from app.models.user import User
from app.services.judge0 import execute_code, run_test_cases, LANGUAGE_NAMES

router = APIRouter(prefix="/code", tags=["code"])

class CodeExecutionRequest(BaseModel):
    source_code: str
    language: Union[str, int] = "python"
    stdin: Optional[str] = ""

class TestCaseItem(BaseModel):
    input: Optional[str] = ""
    expected_output: Optional[str] = ""

class CodeTestCasesRequest(BaseModel):
    source_code: str
    language: Union[str, int] = "python"
    test_cases: List[TestCaseItem] = []

@router.get("/languages")
def get_supported_languages(
    current_user: User = Depends(deps.get_current_active_user),
):
    """Return available programming languages in the sandbox."""
    return [
        {"id": lang_id, "name": name, "slug": name.split(" ")[0].lower()}
        for lang_id, name in LANGUAGE_NAMES.items()
    ]

@router.post("/execute")
async def run_code(
    payload: CodeExecutionRequest,
    current_user: User = Depends(deps.get_current_active_user),
):
    """
    Execute user code in a lightweight sandbox via Judge0.
    Available to all authenticated students and instructors.
    """
    if not payload.source_code.strip():
        raise HTTPException(status_code=400, detail="Source code cannot be empty.")

    result = await execute_code(
        source_code=payload.source_code,
        language=payload.language,
        stdin=payload.stdin or ""
    )
    return result

@router.post("/test")
async def run_code_against_tests(
    payload: CodeTestCasesRequest,
    current_user: User = Depends(deps.get_current_active_user),
):
    """
    Execute code against a suite of test cases.
    """
    if not payload.source_code.strip():
        raise HTTPException(status_code=400, detail="Source code cannot be empty.")

    results = await run_test_cases(
        source_code=payload.source_code,
        language=payload.language,
        test_cases=[tc.model_dump() for tc in payload.test_cases]
    )

    passed_count = sum(1 for r in results if r.get("passed"))
    return {
        "total_tests": len(results),
        "passed_tests": passed_count,
        "all_passed": passed_count == len(results) if results else False,
        "results": results,
    }
