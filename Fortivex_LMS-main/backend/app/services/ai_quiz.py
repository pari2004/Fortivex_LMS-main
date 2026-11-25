import asyncio
import json
import logging
import re
from typing import Any, List, Optional
try:
    import pymupdf as fitz
except ImportError:
    import fitz
from openai import AsyncOpenAI
from pydantic import BaseModel, Field
from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

class QuizQuestion(BaseModel):
    type: Optional[str] = Field(default="MCQ", description="Question type: 'MCQ', 'LONG_ANSWER', or 'CODING'")
    prompt: str = Field(description="The question text or problem prompt")
    options: list[str] = Field(default=[], description="A list of options for MCQ questions")
    correct_index: int = Field(default=0, description="The 0-based index of the correct option for MCQ")
    language: Optional[str] = Field(default="python", description="Language for CODING question ('python', 'javascript', etc.)")
    starter_code: Optional[str] = Field(default="", description="Starter code template for CODING question")
    test_cases: Optional[list[dict]] = Field(default=[], description="Test cases for CODING question")
    explanation: str = Field(default="", description="Explanation, rubric, or model answer")
    rubric: Optional[str] = Field(default="", description="Evaluation rubric for LONG_ANSWER")
    expected_answer: Optional[str] = Field(default="", description="Expected answer or criteria for LONG_ANSWER")
    reference_solution: Optional[str] = Field(default="", description="Reference solution code for CODING")
    points: int = Field(default=1, description="Score point value for this question")

class QuizGenerationResponse(BaseModel):
    questions: list[QuizQuestion]

def extract_text_from_pdf_bytes(pdf_bytes: bytes) -> str:
    """Safely extract all readable text from raw PDF bytes."""
    text_chunks: list[str] = []
    try:
        with fitz.open(stream=pdf_bytes, filetype="pdf") as doc:
            for page in doc:
                page_text = page.get_text()
                if page_text:
                    text_chunks.append(page_text.strip())
    except Exception as e:
        logger.warning(f"Error extracting text from PDF: {e}")
    return "\n\n".join(text_chunks).strip()

def clean_and_parse_llm_json(raw_text: str) -> Any:
    """Robustly extract and parse JSON from LLM output, handling markdown, reasoning tags, comments, and trailing commas."""
    if not raw_text or not raw_text.strip():
        raise ValueError("The AI model returned an empty payload.")

    # 1. Strip reasoning tags like <think>...</think>
    text = re.sub(r"<think>[\s\S]*?</think>", "", raw_text, flags=re.IGNORECASE).strip()

    # 2. Extract markdown code block if present (matching to the last fence to handle nested backticks)
    code_block = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```(?=[^`]*$)", text)
    if code_block:
        candidate = code_block.group(1).strip()
    else:
        # Standard code block fallback
        std_block = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
        if std_block:
            candidate = std_block.group(1).strip()
        else:
            # 3. Find outermost JSON delimiters { ... } or [ ... ]
            start_brace = text.find("{")
            start_bracket = text.find("[")

            if start_brace != -1 and (start_bracket == -1 or start_brace < start_bracket):
                end_brace = text.rfind("}")
                candidate = text[start_brace:end_brace + 1] if end_brace != -1 else text[start_brace:]
            elif start_bracket != -1:
                end_bracket = text.rfind("]")
                candidate = text[start_bracket:end_bracket + 1] if end_bracket != -1 else text[start_bracket:]
            else:
                candidate = text

    # 4. Normalize Python literals to valid JSON literals
    candidate = re.sub(r':\s*True\b', ': true', candidate)
    candidate = re.sub(r':\s*False\b', ': false', candidate)
    candidate = re.sub(r':\s*None\b', ': null', candidate)

    # 5. Remove single line comments outside of strings
    candidate = re.sub(r'^\s*//.*$', '', candidate, flags=re.MULTILINE)

    # 6. Remove trailing commas before closing braces/brackets
    candidate = re.sub(r",\s*([\]}])", r"\1", candidate)

    # 7. Attempt direct json.loads
    try:
        return json.loads(candidate)
    except json.JSONDecodeError:
        # Recovery attempt for slightly truncated JSON
        last_brace = candidate.rfind("}")
        if last_brace != -1:
            truncated = candidate[:last_brace + 1]
            if truncated.startswith("[") and not truncated.endswith("]"):
                truncated += "]"
            elif not truncated.startswith("[") and "questions" in truncated and not truncated.endswith("}"):
                truncated += "]}"
            try:
                return json.loads(truncated)
            except Exception:
                pass
        raise ValueError("The AI model failed to produce valid JSON.")

def normalize_quiz_data(data: Any) -> QuizGenerationResponse:
    """Normalize varied JSON output formats into standardized QuizQuestion models."""
    if isinstance(data, list):
        raw_questions = data
    elif isinstance(data, dict):
        raw_questions = data.get("questions") or data.get("quiz") or data.get("items") or data.get("data")
        if not raw_questions:
            for v in data.values():
                if isinstance(v, list):
                    raw_questions = v
                    break
    else:
        raw_questions = None

    if not isinstance(raw_questions, list) or len(raw_questions) == 0:
        raise ValueError("The AI model did not return any quiz questions.")

    normalized: List[QuizQuestion] = []
    letter_map = {"a": 0, "b": 1, "c": 2, "d": 3, "e": 4}

    for item in raw_questions:
        if not isinstance(item, dict):
            continue

        prompt = (
            item.get("prompt")
            or item.get("question")
            or item.get("question_text")
            or item.get("title")
            or ""
        ).strip()
        if not prompt:
            continue

        # Determine type
        raw_type = str(item.get("type", "")).strip().upper()
        if not raw_type:
            if item.get("starter_code") or item.get("test_cases"):
                raw_type = "CODING"
            elif item.get("rubric") or item.get("expected_answer") or not (item.get("options") or item.get("choices")):
                raw_type = "LONG_ANSWER"
            else:
                raw_type = "MCQ"

        if raw_type in ("CODING", "CODE"):
            language = str(item.get("language") or "python").strip().lower()
            starter_code = str(item.get("starter_code") or "").strip()
            if not starter_code:
                if language in ("javascript", "typescript"):
                    starter_code = "// Complete the function below\nfunction solution() {\n  \n}\n"
                else:
                    starter_code = "# Complete the function below\ndef solution():\n    pass\n"

            raw_test_cases = item.get("test_cases") or []
            test_cases = []
            if isinstance(raw_test_cases, list):
                for tc in raw_test_cases:
                    if isinstance(tc, dict):
                        inp_val = tc.get("input") if tc.get("input") is not None else ""
                        out_val = tc.get("expected_output") if tc.get("expected_output") is not None else tc.get("output", "")
                        test_cases.append({
                            "input": str(inp_val).strip(),
                            "expected_output": str(out_val).strip()
                        })

            explanation = (item.get("explanation") or item.get("solution") or "").strip()
            ref_solution = (item.get("reference_solution") or item.get("solution") or "").strip()
            points = int(item.get("points") or 10)

            normalized.append(
                QuizQuestion(
                    type="CODING",
                    prompt=prompt,
                    language=language,
                    starter_code=starter_code,
                    test_cases=test_cases,
                    explanation=explanation,
                    reference_solution=ref_solution,
                    points=points,
                    options=[],
                    correct_index=0
                )
            )

        elif raw_type in ("LONG_ANSWER", "ESSAY", "DESCRIPTIVE", "OPEN_ENDED"):
            rubric = (item.get("rubric") or item.get("expected_answer") or item.get("explanation") or "").strip()
            expected_answer = (item.get("expected_answer") or item.get("rubric") or "").strip()
            explanation = (item.get("explanation") or expected_answer or rubric).strip()
            points = int(item.get("points") or 10)

            normalized.append(
                QuizQuestion(
                    type="LONG_ANSWER",
                    prompt=prompt,
                    rubric=rubric,
                    expected_answer=expected_answer,
                    explanation=explanation,
                    points=points,
                    options=[],
                    correct_index=0
                )
            )

        else:
            # Multiple Choice (MCQ)
            raw_opts = item.get("options") or item.get("choices") or item.get("answers") or []
            if isinstance(raw_opts, dict):
                sorted_keys = sorted(raw_opts.keys())
                options = [str(raw_opts[k]).strip() for k in sorted_keys if raw_opts[k] is not None]
            elif isinstance(raw_opts, list):
                options = [str(opt).strip() for opt in raw_opts if opt is not None]
            else:
                options = []

            if len(options) < 2:
                # If no choices provided, treat as long answer
                explanation = (item.get("explanation") or item.get("answer") or "").strip()
                normalized.append(
                    QuizQuestion(
                        type="LONG_ANSWER",
                        prompt=prompt,
                        rubric="Evaluate clarity, depth, and factual correctness.",
                        expected_answer=explanation,
                        explanation=explanation,
                        points=10,
                        options=[],
                        correct_index=0
                    )
                )
                continue

            correct_raw = (
                item.get("correct_index")
                if "correct_index" in item
                else item.get("answer")
                if "answer" in item
                else item.get("correct_answer")
                if "correct_answer" in item
                else item.get("correct")
            )

            correct_idx = 0
            if isinstance(correct_raw, int):
                if 0 <= correct_raw < len(options):
                    correct_idx = correct_raw
                elif 1 <= correct_raw <= len(options):
                    correct_idx = correct_raw - 1
            elif isinstance(correct_raw, str):
                clean_str = correct_raw.strip().lower()
                if clean_str in letter_map and letter_map[clean_str] < len(options):
                    correct_idx = letter_map[clean_str]
                elif clean_str.isdigit():
                    val = int(clean_str)
                    if 0 <= val < len(options):
                        correct_idx = val
                    elif 1 <= val <= len(options):
                        correct_idx = val - 1
                else:
                    matched = False
                    for idx, opt in enumerate(options):
                        if opt.lower() == clean_str:
                            correct_idx = idx
                            matched = True
                            break
                    if not matched:
                        correct_idx = 0

            explanation = (item.get("explanation") or item.get("reason") or "").strip()
            if not explanation:
                explanation = f"Option {correct_idx + 1} is the correct answer."

            points = int(item.get("points") or 1)

            normalized.append(
                QuizQuestion(
                    type="MCQ",
                    prompt=prompt,
                    options=options,
                    correct_index=correct_idx,
                    explanation=explanation,
                    points=points
                )
            )

    if not normalized:
        raise ValueError("Could not parse any valid questions from the AI model output.")

    return QuizGenerationResponse(questions=normalized)

async def generate_quiz_from_text(
    text: str, 
    num_questions: int = 10,
    question_types: Optional[List[str]] = None
) -> QuizGenerationResponse:
    """Generate quiz questions using external AI models with reasoning-response handling and direct error propagation."""
    types_normalized = [t.strip().upper() for t in (question_types or ["MCQ"]) if t.strip()]
    if not types_normalized:
        types_normalized = ["MCQ"]

    if not settings.AI_API_KEY:
        raise ValueError("AI_API_KEY is not configured in environment variables. Please provide a valid AI API key in your .env file.")

    client = AsyncOpenAI(
        api_key=settings.AI_API_KEY,
        base_url=settings.AI_BASE_URL,
        timeout=60.0
    )

    # Build schema sample according to requested types
    sample_items = []
    types_desc = []

    if "MCQ" in types_normalized:
        types_desc.append("Multiple Choice ('MCQ')")
        sample_items.append({
            "type": "MCQ",
            "prompt": "Which concept best describes...?",
            "options": ["Option A", "Option B", "Option C", "Option D"],
            "correct_index": 0,
            "explanation": "Brief explanation of why this option is correct.",
            "points": 1
        })

    if "LONG_ANSWER" in types_normalized:
        types_desc.append("Long Answer / Conceptual Essay ('LONG_ANSWER')")
        sample_items.append({
            "type": "LONG_ANSWER",
            "prompt": "Explain the architecture, advantages, and trade-offs of...",
            "rubric": "Grade based on: 1. Clarity, 2. Key concepts covered, 3. Real-world examples.",
            "expected_answer": "Model answer covering key components and principles...",
            "explanation": "Core criteria and rubric for grading.",
            "points": 10
        })

    if "CODING" in types_normalized:
        types_desc.append("Coding Sandbox Challenges ('CODING')")
        sample_items.append({
            "type": "CODING",
            "prompt": "Write a Python script that calculates the square of an integer received via standard input (stdin) and prints the result to standard output (stdout).",
            "language": "python",
            "starter_code": "import sys\n\ndef solution(n: int) -> int:\n    # Write your solution below\n    pass\n\nif __name__ == '__main__':\n    raw = sys.stdin.read().strip()\n    if raw:\n        print(solution(int(raw)))\n",
            "test_cases": [
                {"input": "5", "expected_output": "25"},
                {"input": "10", "expected_output": "100"}
            ],
            "reference_solution": "import sys\n\ndef solution(n: int) -> int:\n    return n * n\n\nif __name__ == '__main__':\n    raw = sys.stdin.read().strip()\n    if raw:\n        print(solution(int(raw)))\n",
            "explanation": "Optimal solution computes square and prints to standard output.",
            "points": 10
        })

    schema_sample = {"questions": sample_items}
    schema_str = json.dumps(schema_sample, indent=2)

    prompt_type_guidelines = []
    if "MCQ" in types_normalized:
        prompt_type_guidelines.append("- MCQ: Provide 4 distinct options, a 0-based correct_index, and a 1-sentence explanation.")
    if "LONG_ANSWER" in types_normalized:
        prompt_type_guidelines.append("- LONG_ANSWER: Provide an in-depth essay or open-ended question, an AI grading rubric, and an expected model answer.")
    if "CODING" in types_normalized:
        prompt_type_guidelines.append(
            "- CODING: Provide a clear coding problem. CRITICAL: Test cases execute in a Judge0 sandbox using standard input (stdin) and standard output (stdout). "
            "`starter_code`: Include a Python solution function and an `if __name__ == '__main__':` runner that reads from sys.stdin or input() and prints the result with print(). "
            "`reference_solution`: A complete working Python implementation that reads stdin and prints the correct answer to stdout. "
            "`test_cases`: At least 2 test cases with the exact stdin string in `input` and expected stdout string in `expected_output`."
        )

    if len(types_normalized) == 1:
        type_str = f"only {types_desc[0]}"
    else:
        type_str = f"a balanced mix of {', '.join(types_desc)}"

    prompt = (
        f"Generate a {num_questions}-question quiz containing {type_str} based strictly on the following text.\n"
        f"Make the questions challenging, educational, and relevant to the material.\n\n"
        f"Question type guidelines:\n" + "\n".join(prompt_type_guidelines) + "\n\n"
        f"TEXT:\n{text[:10000]}"
    )

    system_message = (
        "You are an expert technical curriculum designer and test creator.\n"
        f"Create a high quality quiz featuring {', '.join(types_desc)}.\n"
        "CRITICAL: Write prompts, questions, and explanations as universal facts. Do NOT say 'According to the text' or 'In the passage'.\n"
        f"You MUST output ONLY a valid JSON object matching this structure (no additional conversation or markdown outside JSON):\n{schema_str}"
    )

    # Candidate models to try in order
    candidate_models: list[str] = []
    if settings.AI_MODEL:
        candidate_models.append(settings.AI_MODEL)

    if "googleapis.com" in (settings.AI_BASE_URL or ""):
        for gemini_model in ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-1.5-pro"]:
            if gemini_model not in candidate_models:
                candidate_models.append(gemini_model)
    else:
        for model_opt in [
            "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
            "dots-studio/dots-3-note-preview:free",
            "liquid/lfm-2.5-2.6b:free",
        ]:
            if model_opt not in candidate_models:
                candidate_models.append(model_opt)

    last_error: Optional[Exception] = None

    for model_name in candidate_models:
        try:
            logger.info(f"Attempting AI quiz generation using model '{model_name}'...")
            api_kwargs: dict[str, Any] = {
                "model": model_name,
                "messages": [
                    {"role": "system", "content": system_message},
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.3,
                "max_tokens": 3500,
            }

            try:
                response = await asyncio.wait_for(
                    client.chat.completions.create(
                        **api_kwargs,
                        response_format={"type": "json_object"}
                    ),
                    timeout=45.0
                )
            except Exception as format_err:
                logger.debug(f"Direct json_object mode not accepted by {model_name}, retrying standard: {format_err}")
                response = await asyncio.wait_for(
                    client.chat.completions.create(**api_kwargs),
                    timeout=45.0
                )

            if not getattr(response, "choices", None) or len(response.choices) == 0:
                raise ValueError("The AI model returned an empty response.")

            msg = response.choices[0].message
            # Extract content; if None, fallback to reasoning text from reasoning models
            raw_content = msg.content or getattr(msg, "reasoning", None) or ""
            if not raw_content and getattr(msg, "model_extra", None):
                raw_content = msg.model_extra.get("reasoning", "") or ""
            if not raw_content.strip():
                raise ValueError(f"Model '{model_name}' returned empty content and reasoning.")

            parsed_data = clean_and_parse_llm_json(raw_content)
            result = normalize_quiz_data(parsed_data)
            logger.info(f"Successfully generated {len(result.questions)} questions with model '{model_name}'.")
            return result

        except Exception as e:
            logger.warning(f"AI model '{model_name}' generation attempt failed: {e}")
            last_error = e
            continue

    # No fallback questions: fail explicitly if external AI models failed
    logger.error(f"All external AI models failed. Last error: {last_error}")
    raise ValueError(f"AI quiz generation failed: {last_error}. Please verify AI_API_KEY and model status.")
