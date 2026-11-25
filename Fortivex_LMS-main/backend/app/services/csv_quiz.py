import csv
import io
import json
import logging
import re
from typing import Any, Dict, List, Optional
from app.services.ai_quiz import QuizQuestion

logger = logging.getLogger(__name__)

SAMPLE_CSV_CONTENT = """type,prompt,option1,option2,option3,option4,correct_answer,explanation,points,language,starter_code,test_cases
MCQ,"What is the primary function of DNS in computer networks?","Translate domain names to IP addresses","Encrypt web traffic","Route packets across routers","Assign MAC addresses to devices","A","DNS translates human-readable hostnames into machine-routable IP addresses.",1,,,
MCQ,"Which sorting algorithm has an average time complexity of O(n log n)?","Merge Sort","Bubble Sort","Insertion Sort","Selection Sort","1","Merge Sort consistently divides arrays in half and merges in linear time.",1,,,
LONG_ANSWER,"Explain the differences between process and thread, including memory sharing and context switching overhead.","","","","","","Key points: Processes have separate address spaces; threads share memory within the same process. Context switching is faster between threads.",10,,,
CODING,"Write a function named 'two_sum' that returns the indices of two numbers in an array that add up to a target.","","","","","","Use a hash map for optimal O(n) time complexity.",10,python,"def two_sum(nums, target):\n    # Return [idx1, idx2]\n    pass","[2 7 11 15] 9:[0 1]|[3 2 4] 6:[1 2]"
"""

def parse_quiz_csv(csv_text: str) -> List[QuizQuestion]:
    """
    Parse a CSV text payload into a list of validated QuizQuestion objects.
    Supports RFC-4180 multiline cells, quotes, and various column header aliases.
    """
    if not csv_text or not csv_text.strip():
        raise ValueError("CSV content is empty.")

    # Remove UTF-8 BOM if present
    if csv_text.startswith("\ufeff"):
        csv_text = csv_text[1:]

    stream = io.StringIO(csv_text)
    reader = csv.reader(stream)

    rows = []
    for r in reader:
        # Ignore completely empty rows
        if any(cell.strip() for cell in r):
            rows.append(r)

    if not rows:
        raise ValueError("CSV does not contain any valid rows.")

    header_row = [c.strip().lower().replace(" ", "_") for c in rows[0]]
    data_rows = rows[1:]

    if not data_rows:
        raise ValueError("CSV contains a header but no question rows.")

    # Column index helper
    def find_col(aliases: List[str]) -> Optional[int]:
        for alias in aliases:
            for idx, h in enumerate(header_row):
                if h == alias or h.endswith(f"_{alias}"):
                    return idx
        return None

    col_type = find_col(["type", "question_type"])
    col_prompt = find_col(["prompt", "question", "question_text", "title"])
    col_opt1 = find_col(["option1", "option_1", "opt1", "choice1"])
    col_opt2 = find_col(["option2", "option_2", "opt2", "choice2"])
    col_opt3 = find_col(["option3", "option_3", "opt3", "choice3"])
    col_opt4 = find_col(["option4", "option_4", "opt4", "choice4"])
    col_options = find_col(["options", "choices"])
    col_answer = find_col(["correct_answer", "correct_index", "answer", "correct", "key"])
    col_expl = find_col(["explanation", "rubric", "notes", "solution", "model_answer"])
    col_points = find_col(["points", "point", "score", "weight"])
    col_lang = find_col(["language", "lang"])
    col_starter = find_col(["starter_code", "starter", "template", "code_template"])
    col_tests = find_col(["test_cases", "tests", "testcases"])

    if col_prompt is None:
        raise ValueError("CSV header must include a 'prompt' or 'question' column.")

    questions: List[QuizQuestion] = []
    letter_map = {"a": 0, "b": 1, "c": 2, "d": 3, "e": 4}

    for row_idx, row in enumerate(data_rows, start=2):
        def get_val(col_idx: Optional[int]) -> str:
            if col_idx is not None and col_idx < len(row):
                return row[col_idx].strip()
            return ""

        prompt = get_val(col_prompt)
        if not prompt:
            continue

        raw_type = get_val(col_type).upper()
        if raw_type in ("LONG", "ESSAY", "LONG_ANSWER", "TEXT"):
            q_type = "LONG_ANSWER"
        elif raw_type in ("CODE", "CODING", "SANDBOX"):
            q_type = "CODING"
        else:
            q_type = "MCQ"

        explanation = get_val(col_expl)

        # Points
        raw_pts = get_val(col_points)
        try:
            points = int(raw_pts) if raw_pts else (1 if q_type == "MCQ" else 10)
        except ValueError:
            points = 1 if q_type == "MCQ" else 10

        # MCQ Options & Correct Index
        options: List[str] = []
        correct_index = 0

        if q_type == "MCQ":
            if col_options is not None and get_val(col_options):
                # Pipe-separated options: Opt1|Opt2|Opt3|Opt4
                options = [o.strip() for o in get_val(col_options).split("|") if o.strip()]
            else:
                o1 = get_val(col_opt1)
                o2 = get_val(col_opt2)
                o3 = get_val(col_opt3)
                o4 = get_val(col_opt4)
                options = [o for o in [o1, o2, o3, o4] if o]

            if len(options) < 2:
                # Default fallback options if missing
                options = options + [f"Option {i + 1}" for i in range(len(options), 4)]

            ans_raw = get_val(col_answer).strip().lower()
            if ans_raw in letter_map and letter_map[ans_raw] < len(options):
                correct_index = letter_map[ans_raw]
            elif ans_raw.isdigit():
                val = int(ans_raw)
                if 0 <= val < len(options):
                    correct_index = val
                elif 1 <= val <= len(options):
                    correct_index = val - 1
            else:
                # Match by text
                matched = False
                for idx, opt in enumerate(options):
                    if opt.lower() == ans_raw:
                        correct_index = idx
                        matched = True
                        break
                if not matched:
                    correct_index = 0

        # Coding Details
        language = get_val(col_lang) or "python"
        starter_code = get_val(col_starter)
        if not starter_code and q_type == "CODING":
            starter_code = "def solution():\n    pass\n"

        test_cases: List[Dict[str, str]] = []
        raw_tests = get_val(col_tests)
        if raw_tests and q_type == "CODING":
            try:
                # Try JSON parse first
                parsed_json = json.loads(raw_tests)
                if isinstance(parsed_json, list):
                    for tc in parsed_json:
                        if isinstance(tc, dict):
                            test_cases.append({
                                "input": str(tc.get("input", "")),
                                "expected_output": str(tc.get("expected_output", "")),
                            })
            except Exception:
                # Parse delimited: in1:out1|in2:out2
                pairs = raw_tests.split("|")
                for p in pairs:
                    if ":" in p:
                        parts = p.split(":", 1)
                        test_cases.append({
                            "input": parts[0].strip(),
                            "expected_output": parts[1].strip(),
                        })

        questions.append(
            QuizQuestion(
                type=q_type,
                prompt=prompt,
                options=options if q_type == "MCQ" else [],
                correct_index=correct_index if q_type == "MCQ" else 0,
                explanation=explanation,
                points=points,
                language=language if q_type == "CODING" else "python",
                starter_code=starter_code if q_type == "CODING" else "",
                test_cases=test_cases if q_type == "CODING" else [],
            )
        )

    if not questions:
        raise ValueError("No valid questions could be extracted from the CSV file.")

    return questions
