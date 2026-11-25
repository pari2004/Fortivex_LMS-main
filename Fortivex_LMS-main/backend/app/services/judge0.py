import asyncio
import json
import logging
import urllib.request
import urllib.error
from typing import Any, Dict, List, Optional, Union
from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

LANGUAGE_MAP: Dict[str, int] = {
    "python": 100,      # Python (3.12.5)
    "py": 100,
    "javascript": 97,   # JavaScript (Node.js 20.17.0)
    "js": 97,
    "typescript": 94,   # TypeScript (5.0.3)
    "ts": 94,
    "cpp": 105,         # C++ (GCC 14.1.0)
    "c++": 105,
    "c": 103,           # C (GCC 14.1.0)
    "java": 91,         # Java (JDK 17.0.6)
    "go": 95,           # Go (1.18.5)
}

LANGUAGE_NAMES: Dict[int, str] = {
    100: "Python (3.12.5)",
    97: "JavaScript (Node.js 20.17.0)",
    94: "TypeScript (5.0.3)",
    105: "C++ (GCC 14.1.0)",
    103: "C (GCC 14.1.0)",
    91: "Java (JDK 17.0.6)",
    95: "Go (1.18.5)",
    # Legacy fallbacks
    71: "Python (3.8.1)",
    63: "JavaScript (Node.js 12.14.0)",
    54: "C++ (GCC 9.2.0)",
    50: "C (GCC 9.2.0)",
    62: "Java (OpenJDK 13.0.1)",
    60: "Go (1.13.5)",
}

def resolve_language_id(lang: Union[str, int]) -> int:
    if isinstance(lang, int):
        return lang
    clean = str(lang).strip().lower()
    if clean.isdigit():
        return int(clean)
    return LANGUAGE_MAP.get(clean, 100)

def _execute_sync(source_code: str, language_id: int, stdin: str = "") -> Dict[str, Any]:
    url = f"{settings.JUDGE0_URL.rstrip('/')}/submissions?base64_encoded=false&wait=true"
    payload = json.dumps({
        "source_code": source_code,
        "language_id": language_id,
        "stdin": stdin,
    }).encode("utf-8")

    headers = {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    }

    if settings.JUDGE0_API_KEY:
        headers["X-RapidAPI-Key"] = settings.JUDGE0_API_KEY
        headers["Authorization"] = f"Bearer {settings.JUDGE0_API_KEY}"
    if settings.JUDGE0_API_HOST:
        headers["X-RapidAPI-Host"] = settings.JUDGE0_API_HOST

    req = urllib.request.Request(url, data=payload, headers=headers)

    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            data = json.loads(res.read().decode("utf-8"))
            status = data.get("status", {})
            status_id = status.get("id", 0)
            status_desc = status.get("description", "Unknown")

            return {
                "stdout": data.get("stdout") or "",
                "stderr": data.get("stderr") or "",
                "compile_output": data.get("compile_output") or "",
                "message": data.get("message") or "",
                "status": {
                    "id": status_id,
                    "description": status_desc,
                },
                "time": data.get("time") or "0.0",
                "memory": data.get("memory") or 0,
                "success": status_id == 3,  # 3 = Accepted
            }
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode("utf-8", errors="ignore")
        logger.error(f"Judge0 HTTP error {e.code}: {err_msg}")
        return {
            "stdout": "",
            "stderr": f"Judge0 Execution Service Error ({e.code}): {err_msg}",
            "compile_output": "",
            "status": {"id": 13, "description": f"HTTP {e.code} Error"},
            "time": "0.0",
            "memory": 0,
            "success": False,
        }
    except Exception as e:
        logger.error(f"Judge0 execution connection error: {e}")
        return {
            "stdout": "",
            "stderr": f"Could not connect to sandbox runner: {str(e)}",
            "compile_output": "",
            "status": {"id": 13, "description": "Connection Error"},
            "time": "0.0",
            "memory": 0,
            "success": False,
        }

async def execute_code(source_code: str, language: Union[str, int], stdin: str = "") -> Dict[str, Any]:
    lang_id = resolve_language_id(language)
    return await asyncio.to_thread(_execute_sync, source_code, lang_id, stdin)

async def run_test_cases(source_code: str, language: Union[str, int], test_cases: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    lang_id = resolve_language_id(language)
    results = []

    for i, tc in enumerate(test_cases):
        tc_in = str(tc.get("input", "") or "")
        tc_expected = str(tc.get("expected_output", "") or "").strip()

        exec_res = await asyncio.to_thread(_execute_sync, source_code, lang_id, tc_in)
        actual = (exec_res.get("stdout") or "").strip()
        passed = (exec_res.get("success", False) and actual == tc_expected)

        results.append({
            "test_case": i + 1,
            "passed": passed,
            "input": tc_in,
            "expected_output": tc_expected,
            "actual_output": actual,
            "stderr": exec_res.get("stderr") or "",
            "compile_output": exec_res.get("compile_output") or "",
            "status": exec_res.get("status", {}).get("description", "Unknown"),
            "time": exec_res.get("time", "0.0"),
        })

    return results
