"use client";

import { useState, useEffect } from "react";
import { QuizQuestion, TestCase } from "./QuizPlayer";
import { apiRequest } from "@/lib/api/client";
import { config, buildApiUrl } from "@/lib/config";
import { useAuth } from "@/lib/auth/AuthContext";
import { usePrograms } from "@/lib/api/usePrograms";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

async function parseErrorResponse(res: Response, fallback: string): Promise<string> {
  try {
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const data = await res.json();
      return data.detail || data.message || fallback;
    }
    const rawText = await res.text();
    const cleanText = rawText.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    return cleanText.slice(0, 200) || res.statusText || fallback;
  } catch {
    return res.statusText || fallback;
  }
}


const styles = {
  container: {
    background: "var(--color-surface)",
    border: "1px solid var(--color-border)",
    borderRadius: "16px",
    padding: "2rem",
    boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
    maxWidth: "1000px",
    margin: "0 auto"
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "2rem"
  },
  title: {
    fontSize: "1.5rem",
    fontWeight: 800,
    margin: 0
  },
  subtitle: {
    color: "var(--color-muted)",
    fontSize: "0.9rem",
    marginTop: "0.25rem"
  },
  locationPanel: {
    background: "rgba(0,0,0,0.015)",
    border: "1px solid rgba(0,0,0,0.08)",
    borderRadius: "16px",
    padding: "2rem",
    marginBottom: "2.5rem",
    boxShadow: "inset 0 2px 4px rgba(0,0,0,0.02)"
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "1.5rem",
    marginTop: "1rem"
  },
  label: {
    display: "block",
    fontSize: "0.85rem",
    fontWeight: 700,
    color: "var(--color-muted)",
    marginBottom: "0.5rem",
    textTransform: "uppercase" as const,
    letterSpacing: "0.5px"
  },
  select: {
    width: "100%",
    padding: "0.8rem 1.25rem",
    borderRadius: "10px",
    border: "2px solid rgba(0,0,0,0.08)",
    background: "var(--background)",
    color: "var(--foreground)",
    fontSize: "1rem",
    fontWeight: 500,
    outline: "none",
    cursor: "pointer",
    transition: "all 0.2s ease-in-out",
    appearance: "none" as const,
    backgroundImage: `url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23666%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 1rem top 50%",
    backgroundSize: "0.65rem auto"
  },
  aiPanel: {
    background: "rgba(79, 70, 229, 0.05)",
    border: "1px solid rgba(79, 70, 229, 0.2)",
    borderRadius: "12px",
    padding: "1.5rem",
    marginBottom: "2rem"
  },
  aiHeader: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    color: "var(--primary)",
    fontWeight: 700,
    marginBottom: "1rem"
  },
  fileInput: {
    padding: "0.5rem",
    background: "var(--background)",
    border: "1px dashed var(--color-border)",
    borderRadius: "8px",
    width: "100%",
    fontSize: "0.9rem"
  },
  questionCard: {
    background: "var(--background)",
    border: "1px solid var(--color-border)",
    borderRadius: "12px",
    padding: "1.5rem",
    position: "relative" as const,
    marginBottom: "1.5rem"
  },
  removeBtn: {
    position: "absolute" as const,
    top: "1rem",
    right: "1rem",
    background: "none",
    border: "none",
    color: "var(--danger)",
    cursor: "pointer",
  },
  textarea: {
    width: "100%",
    padding: "0.75rem",
    borderRadius: "8px",
    border: "1px solid var(--color-border)",
    background: "var(--background)",
    color: "var(--foreground)",
    fontSize: "0.95rem",
    fontFamily: "inherit",
    minHeight: "80px",
    resize: "vertical" as const
  },
  optionRow: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem"
  }
};

function parseClientSideCSV(text: string): QuizQuestion[] {
  const clean = text.startsWith("\ufeff") ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [""];
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    const next = clean[i + 1];

    if (c === '"') {
      if (inQuotes && next === '"') {
        row[row.length - 1] += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      row.push('');
    } else if ((c === '\r' || c === '\n') && !inQuotes) {
      if (c === '\r' && next === '\n') i++;
      rows.push(row);
      row = [''];
    } else {
      row[row.length - 1] += c;
    }
  }
  if (row.length > 1 || row[0] !== '') {
    rows.push(row);
  }

  const validRows = rows.filter(r => r.some(cell => cell.trim().length > 0));
  if (validRows.length < 2) return [];

  const headers = validRows[0].map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
  const findCol = (aliases: string[]) => {
    for (const a of aliases) {
      const idx = headers.indexOf(a);
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const colType = findCol(["type", "question_type"]);
  const colPrompt = findCol(["prompt", "question", "question_text", "title"]);
  const colOpt1 = findCol(["option1", "option_1", "opt1", "choice1"]);
  const colOpt2 = findCol(["option2", "option_2", "opt2", "choice2"]);
  const colOpt3 = findCol(["option3", "option_3", "opt3", "choice3"]);
  const colOpt4 = findCol(["option4", "option_4", "opt4", "choice4"]);
  const colOptions = findCol(["options", "choices"]);
  const colAnswer = findCol(["correct_answer", "correct_index", "answer", "correct"]);
  const colExpl = findCol(["explanation", "rubric", "notes", "solution"]);
  const colPoints = findCol(["points", "point", "score", "weight"]);
  const colLang = findCol(["language", "lang"]);
  const colStarter = findCol(["starter_code", "starter", "template"]);
  const colTests = findCol(["test_cases", "tests"]);

  if (colPrompt === -1) return [];

  const letterMap: Record<string, number> = { a: 0, b: 1, c: 2, d: 3, e: 4 };
  const parsedQuestions: QuizQuestion[] = [];

  for (let r = 1; r < validRows.length; r++) {
    const curRow = validRows[r];
    const getVal = (idx: number) => (idx !== -1 && idx < curRow.length ? curRow[idx].trim() : "");
    const prompt = getVal(colPrompt);
    if (!prompt) continue;

    const rawType = getVal(colType).toUpperCase();
    const qType: "MCQ" | "LONG_ANSWER" | "CODING" =
      rawType === "CODING" || rawType === "CODE"
        ? "CODING"
        : rawType === "LONG_ANSWER" || rawType === "LONG" || rawType === "ESSAY"
        ? "LONG_ANSWER"
        : "MCQ";

    const explanation = getVal(colExpl);
    const rawPts = getVal(colPoints);
    const points = rawPts && !isNaN(Number(rawPts)) ? Number(rawPts) : (qType === "MCQ" ? 1 : 10);

    let options: string[] = [];
    let correctIndex = 0;

    if (qType === "MCQ") {
      if (colOptions !== -1 && getVal(colOptions)) {
        options = getVal(colOptions).split("|").map(s => s.trim()).filter(Boolean);
      } else {
        const o1 = getVal(colOpt1);
        const o2 = getVal(colOpt2);
        const o3 = getVal(colOpt3);
        const o4 = getVal(colOpt4);
        options = [o1, o2, o3, o4].filter(Boolean);
      }

      if (options.length < 2) {
        options = ["Option A", "Option B", "Option C", "Option D"];
      }

      const rawAns = getVal(colAnswer).toLowerCase();
      if (letterMap[rawAns] !== undefined && letterMap[rawAns] < options.length) {
        correctIndex = letterMap[rawAns];
      } else if (!isNaN(Number(rawAns))) {
        const num = Number(rawAns);
        if (num >= 0 && num < options.length) correctIndex = num;
        else if (num >= 1 && num <= options.length) correctIndex = num - 1;
      } else {
        const matchIdx = options.findIndex(o => o.toLowerCase() === rawAns);
        correctIndex = matchIdx !== -1 ? matchIdx : 0;
      }
    }

    let language = "python";
    let starterCode = "";
    let testCases: TestCase[] = [];

    if (qType === "CODING") {
      language = getVal(colLang) || "python";
      starterCode = getVal(colStarter) || "def solution():\n    pass\n";
      const rawTests = getVal(colTests);
      if (rawTests) {
        try {
          const parsed = JSON.parse(rawTests);
          if (Array.isArray(parsed)) testCases = parsed;
        } catch {
          testCases = rawTests.split("|").filter(Boolean).map(pair => {
            const [inp, out] = pair.split(":");
            return { input: (inp || "").trim(), expected_output: (out || "").trim() };
          });
        }
      }
    }

    parsedQuestions.push({
      type: qType,
      prompt,
      options: qType === "MCQ" ? options : undefined,
      correct_index: qType === "MCQ" ? correctIndex : undefined,
      explanation,
      points,
      language: qType === "CODING" ? language : undefined,
      starter_code: qType === "CODING" ? starterCode : undefined,
      test_cases: qType === "CODING" ? testCases : undefined,
      expected_answer: qType === "LONG_ANSWER" ? explanation : undefined,
      rubric: qType === "LONG_ANSWER" ? explanation : undefined,
    });
  }

  return parsedQuestions;
}

interface ProblemPreset {
  id: string;
  name: string;
  badge: string;
  prompt: string;
  language: string;
  starter_code: string;
  reference_solution: string;
  test_cases: { input: string; expected_output: string; hidden?: boolean }[];
  explanation: string;
}

const CODING_PRESETS: ProblemPreset[] = [
  {
    id: "two-sum",
    name: "Two Sum (Array Indices)",
    badge: "Easy",
    prompt: "Given an array of integers and a target value, find the 0-based indices of the two numbers that add up to target.\nAssume each input has exactly one solution.\n\nInput format: Space-separated integers on the first line (the array), and target integer on the second line.\nOutput format: The two indices separated by a space (e.g. '0 1').",
    language: "python",
    starter_code: `import sys

def two_sum(nums, target):
    # Return [idx1, idx2]
    pass

if __name__ == '__main__':
    lines = sys.stdin.read().strip().split('\\n')
    if len(lines) >= 2:
        nums = [int(x) for x in lines[0].split()]
        target = int(lines[1])
        res = two_sum(nums, target)
        if res:
            print(f"{res[0]} {res[1]}")
`,
    reference_solution: `import sys

def two_sum(nums, target):
    seen = {}
    for i, x in enumerate(nums):
        diff = target - x
        if diff in seen:
            return [seen[diff], i]
        seen[x] = i
    return []

if __name__ == '__main__':
    lines = sys.stdin.read().strip().split('\\n')
    if len(lines) >= 2:
        nums = [int(x) for x in lines[0].split()]
        target = int(lines[1])
        res = two_sum(nums, target)
        if res:
            print(f"{res[0]} {res[1]}")
`,
    test_cases: [
      { input: "2 7 11 15\n9", expected_output: "0 1", hidden: false },
      { input: "3 2 4\n6", expected_output: "1 2", hidden: false },
      { input: "3 3\n6", expected_output: "0 1", hidden: true }
    ],
    explanation: "Use a hash map to look up compliments in single-pass O(n) time."
  },
  {
    id: "palindrome",
    name: "Valid Palindrome",
    badge: "Easy",
    prompt: "A phrase is a palindrome if, after converting uppercase letters into lowercase and removing non-alphanumeric characters, it reads the same forward and backward.\n\nInput format: A single line string.\nOutput format: 'true' or 'false'.",
    language: "python",
    starter_code: `import sys

def is_palindrome(s: str) -> bool:
    # Return True if palindrome, False otherwise
    pass

if __name__ == '__main__':
    text = sys.stdin.read().strip()
    print("true" if is_palindrome(text) else "false")
`,
    reference_solution: `import sys

def is_palindrome(s: str) -> bool:
    cleaned = ''.join(c.lower() for c in s if c.isalnum())
    return cleaned == cleaned[::-1]

if __name__ == '__main__':
    text = sys.stdin.read().strip()
    print("true" if is_palindrome(text) else "false")
`,
    test_cases: [
      { input: "A man, a plan, a canal: Panama", expected_output: "true", hidden: false },
      { input: "race a car", expected_output: "false", hidden: false },
      { input: "Was it a car or a cat I saw?", expected_output: "true", hidden: true }
    ],
    explanation: "Filter characters with str.isalnum() and check equality against slice [::-1]."
  },
  {
    id: "reverse-string",
    name: "Reverse String",
    badge: "Beginner",
    prompt: "Write a program that takes a string from standard input and prints the reversed string to standard output.\n\nInput format: A single line text.\nOutput format: The reversed text.",
    language: "python",
    starter_code: `import sys

def reverse_string(s: str) -> str:
    # Return reversed string
    pass

if __name__ == '__main__':
    line = sys.stdin.read().rstrip('\\r\\n')
    print(reverse_string(line))
`,
    reference_solution: `import sys

def reverse_string(s: str) -> str:
    return s[::-1]

if __name__ == '__main__':
    line = sys.stdin.read().rstrip('\\r\\n')
    print(reverse_string(line))
`,
    test_cases: [
      { input: "hello", expected_output: "olleh", hidden: false },
      { input: "Fortivex", expected_output: "xevitroF", hidden: false },
      { input: "123456789", expected_output: "987654321", hidden: true }
    ],
    explanation: "Reverses string using slicing or two-pointer method in O(n) time."
  },
  {
    id: "fizzbuzz",
    name: "FizzBuzz",
    badge: "Beginner",
    prompt: "Given an integer n, print numbers from 1 to n separated by space.\nFor multiples of 3 print 'Fizz', multiples of 5 print 'Buzz', and multiples of both print 'FizzBuzz'.\n\nInput format: Single integer n.\nOutput format: Space-separated results.",
    language: "python",
    starter_code: `import sys

def fizz_buzz(n: int) -> str:
    # Return space-separated numbers/words
    pass

if __name__ == '__main__':
    n = int(sys.stdin.read().strip())
    print(fizz_buzz(n))
`,
    reference_solution: `import sys

def fizz_buzz(n: int) -> str:
    res = []
    for i in range(1, n + 1):
        if i % 15 == 0:
            res.append("FizzBuzz")
        elif i % 3 == 0:
            res.append("Fizz")
        elif i % 5 == 0:
            res.append("Buzz")
        else:
            res.append(str(i))
    return " ".join(res)

if __name__ == '__main__':
    n = int(sys.stdin.read().strip())
    print(fizz_buzz(n))
`,
    test_cases: [
      { input: "5", expected_output: "1 2 Fizz 4 Buzz", hidden: false },
      { input: "15", expected_output: "1 2 Fizz 4 Buzz Fizz 7 8 Fizz Buzz 11 Fizz 13 14 FizzBuzz", hidden: false }
    ],
    explanation: "Check divisibility by 15 first to handle both 3 and 5, followed by 3 and 5."
  },
  {
    id: "fibonacci",
    name: "N-th Fibonacci",
    badge: "Easy",
    prompt: "Compute the n-th Fibonacci number where F(0) = 0, F(1) = 1, and F(n) = F(n-1) + F(n-2) for n >= 2.\n\nInput format: A non-negative integer n.\nOutput format: The n-th Fibonacci number.",
    language: "python",
    starter_code: `import sys

def fibonacci(n: int) -> int:
    # Compute n-th Fibonacci
    pass

if __name__ == '__main__':
    n = int(sys.stdin.read().strip())
    print(fibonacci(n))
`,
    reference_solution: `import sys

def fibonacci(n: int) -> int:
    if n <= 0: return 0
    if n == 1: return 1
    a, b = 0, 1
    for _ in range(2, n + 1):
        a, b = b, a + b
    return b

if __name__ == '__main__':
    n = int(sys.stdin.read().strip())
    print(fibonacci(n))
`,
    test_cases: [
      { input: "0", expected_output: "0", hidden: false },
      { input: "1", expected_output: "1", hidden: false },
      { input: "7", expected_output: "13", hidden: false },
      { input: "10", expected_output: "55", hidden: true }
    ],
    explanation: "Iterative approach computes result in linear O(n) time and O(1) space."
  }
];

const LANGUAGE_TEMPLATES: Record<string, { functionStub: string; stdinStub: string }> = {
  python: {
    functionStub: `def solution(nums):\n    # Write your solution here\n    return nums\n`,
    stdinStub: `import sys\n\ndef solve():\n    lines = sys.stdin.read().strip().split('\\n')\n    if not lines:\n        return\n    # Process input lines\n    print("output")\n\nif __name__ == '__main__':\n    solve()\n`
  },
  javascript: {
    functionStub: `function solution(nums) {\n  // Write your solution here\n  return nums;\n}\n`,
    stdinStub: `const fs = require('fs');\n\nfunction solve() {\n  const input = fs.readFileSync(0, 'utf-8').trim();\n  // Process input\n  console.log("output");\n}\n\nsolve();\n`
  },
  typescript: {
    functionStub: `function solution(nums: number[]): number[] {\n  // Write your solution here\n  return nums;\n}\n`,
    stdinStub: `import * as fs from 'fs';\n\nfunction solve(): void {\n  const input: string = fs.readFileSync(0, 'utf-8').trim();\n  console.log("output");\n}\n\nsolve();\n`
  },
  cpp: {
    functionStub: `#include <iostream>\n#include <vector>\nusing namespace std;\n\nint solution(int n) {\n    return n;\n}\n`,
    stdinStub: `#include <iostream>\n#include <string>\n#include <vector>\nusing namespace std;\n\nint main() {\n    ios_base::sync_with_stdio(false);\n    cin.tie(NULL);\n    \n    string s;\n    if (cin >> s) {\n        cout << s << "\\n";\n    }\n    return 0;\n}\n`
  },
  java: {
    functionStub: `public class Solution {\n    public static int solution(int n) {\n        return n;\n    }\n}\n`,
    stdinStub: `import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        if (sc.hasNext()) {\n            String s = sc.next();\n            System.out.println(s);\n        }\n    }\n}\n`
  },
  c: {
    functionStub: `#include <stdio.h>\n\nint solution(int n) {\n    return n;\n}\n`,
    stdinStub: `#include <stdio.h>\n\nint main() {\n    char buffer[256];\n    if (fgets(buffer, sizeof(buffer), stdin)) {\n        printf("%s", buffer);\n    }\n    return 0;\n}\n`
  },
  go: {
    functionStub: `package main\n\nfunc solution(n int) int {\n    return n\n}\n`,
    stdinStub: `package main\n\nimport (\n    "bufio"\n    "fmt"\n    "os"\n)\n\nfunc main() {\n    scanner := bufio.NewScanner(os.Stdin)\n    if scanner.Scan() {\n        fmt.Println(scanner.Text())\n    }\n}\n`
  }
};

interface AdminQuizEditorProps {
  lessonId?: number;
  onSaved?: () => void;
  onCancel?: () => void;
}

export default function AdminQuizEditor({ lessonId: initialLessonId, onSaved, onCancel }: AdminQuizEditorProps) {
  const [file, setFile] = useState<File | null>(null);
  const [numQuestions, setNumQuestions] = useState(5);
  const [selectedAiTypes, setSelectedAiTypes] = useState<string[]>(["MCQ"]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [title, setTitle] = useState("AI Generated Quiz");
  const getNextHour = () => {
    const d = new Date();
    d.setHours(d.getHours() + 1, 0, 0, 0);
    const tzOffset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
  };
  const getTomorrow = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(d.getHours() + 1, 0, 0, 0);
    const tzOffset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
  };
  const getMinTime = () => {
    const d = new Date();
    const tzOffset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
  };

  const [startDate, setStartDate] = useState(getNextHour().slice(0, 10));
  const [startTimeStr, setStartTimeStr] = useState(getNextHour().slice(11, 16));
  
  const [dueDate, setDueDate] = useState(getTomorrow().slice(0, 10));
  const [dueTimeStr, setDueTimeStr] = useState(getTomorrow().slice(11, 16));
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Coding verification & tabs state
  const [verifyingQuestionIdx, setVerifyingQuestionIdx] = useState<number | null>(null);
  const [verificationResults, setVerificationResults] = useState<Record<number, {
    total_tests: number;
    passed_tests: number;
    all_passed: boolean;
    results: any[];
  }>>({});
  const [autoGeneratingIdx, setAutoGeneratingIdx] = useState<number | null>(null);
  const [activeCodeTab, setActiveCodeTab] = useState<Record<number, "starter" | "solution">>({});

  const { token, organization } = useAuth();
  const { programs, error: programsError } = usePrograms(organization?.id);
  const [selectedProgram, setSelectedProgram] = useState<number | "">("");
  const [modules, setModules] = useState<any[]>([]);
  const [selectedModule, setSelectedModule] = useState<number | "">("");
  const [weeks, setWeeks] = useState<any[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<number | "">("");
  const [lessons, setLessons] = useState<any[]>([]);
  const [selectedLesson, setSelectedLesson] = useState<number | "">(initialLessonId || "");

  useEffect(() => {
    // We get programs from the hook now
  }, []);

  useEffect(() => {
    if (!selectedProgram) {
      setModules([]); setSelectedModule("");
      setWeeks([]); setSelectedWeek("");
      setLessons([]); setSelectedLesson("");
      return;
    }
    if (!token) return;
    apiRequest<any[]>(`/api/v1/programs/${selectedProgram}/curriculum`, { token })
      .then(data => {
        setModules(data);
        setSelectedModule("");
        setWeeks([]); setSelectedWeek("");
        setLessons([]); setSelectedLesson("");
      }).catch(console.error);
  }, [selectedProgram, token]);

  useEffect(() => {
    if (!selectedModule) {
      setWeeks([]); setSelectedWeek("");
      setLessons([]); setSelectedLesson("");
      return;
    }
    const mod = modules.find(m => m.id === Number(selectedModule));
    setWeeks(mod ? mod.weeks : []);
    setSelectedWeek("");
    setLessons([]); setSelectedLesson("");
  }, [selectedModule, modules]);

  useEffect(() => {
    if (!selectedWeek) {
      setLessons([]); setSelectedLesson("");
      return;
    }
    const wk = weeks.find(w => w.id === Number(selectedWeek));
    setLessons(wk ? wk.lessons : []);
    setSelectedLesson("");
  }, [selectedWeek, weeks]);

  const toggleAiType = (typeId: string) => {
    if (selectedAiTypes.includes(typeId)) {
      if (selectedAiTypes.length === 1) return; // Keep at least one type active
      setSelectedAiTypes(selectedAiTypes.filter(t => t !== typeId));
    } else {
      setSelectedAiTypes([...selectedAiTypes, typeId]);
    }
  };

  const handleGenerate = async () => {
    if (!file) return alert("Please select a PDF file first");
    if (selectedAiTypes.length === 0) return alert("Please select at least one question type (MCQ, Long Answer, or Coding)");
    
    setIsGenerating(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("num_questions", numQuestions.toString());
    formData.append("question_types", selectedAiTypes.join(","));

    try {
      const res = await fetch(buildApiUrl("/api/v1/ai/generate-quiz"), {
        method: "POST",
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: formData,
      });

      if (!res.ok) {
        const errDetail = await parseErrorResponse(res, `Failed to generate quiz (Server error ${res.status})`);
        throw new Error(errDetail);
      }

      let data;
      try {
        data = await res.json();
      } catch {
        throw new Error("Invalid response format received from quiz generation service.");
      }

      if (!data.questions || !Array.isArray(data.questions) || data.questions.length === 0) {
        throw new Error("No quiz questions were returned. Please try with another PDF or select different question types.");
      }

      setQuestions(data.questions);
    } catch (error: any) {
      console.error("AI quiz generation error:", error);
      alert(error.message || "Failed to generate quiz");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleVerifyQuestion = async (qIdx: number) => {
    const q = questions[qIdx];
    const codeToTest = q.reference_solution || q.starter_code;
    if (!codeToTest || !codeToTest.trim()) {
      alert("Please provide Reference Solution code or Starter Code to verify test cases.");
      return;
    }
    if (!q.test_cases || q.test_cases.length === 0) {
      alert("Please add at least one test case to verify.");
      return;
    }

    setVerifyingQuestionIdx(qIdx);
    try {
      const res = await fetch(buildApiUrl("/api/v1/code/test"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          source_code: codeToTest,
          language: q.language || "python",
          test_cases: q.test_cases.map(tc => ({
            input: tc.input || "",
            expected_output: tc.expected_output || ""
          }))
        })
      });

      if (!res.ok) {
        const errDetail = await parseErrorResponse(res, "Judge0 verification request failed");
        throw new Error(errDetail);
      }

      const data = await res.json();
      setVerificationResults(prev => ({ ...prev, [qIdx]: data }));
    } catch (e: any) {
      alert(`Verification error: ${e.message}`);
    } finally {
      setVerifyingQuestionIdx(null);
    }
  };

  const handleAutoPopulateOutputs = async (qIdx: number) => {
    const q = questions[qIdx];
    const code = q.reference_solution || q.starter_code;
    if (!code || !code.trim()) {
      alert("Please provide Reference Solution code first to compute expected outputs.");
      return;
    }
    if (!q.test_cases || q.test_cases.length === 0) {
      alert("Please add at least one test case with an input first.");
      return;
    }

    setAutoGeneratingIdx(qIdx);
    try {
      const updatedTestCases = [...q.test_cases];
      for (let i = 0; i < updatedTestCases.length; i++) {
        const tc = updatedTestCases[i];
        const res = await fetch(buildApiUrl("/api/v1/code/execute"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({
            source_code: code,
            language: q.language || "python",
            stdin: tc.input || ""
          })
        });

        if (res.ok) {
          try {
            const runData = await res.json();
            if (runData.stdout !== null && runData.stdout !== undefined) {
              updatedTestCases[i] = {
                ...updatedTestCases[i],
                expected_output: runData.stdout.toString().trim()
              };
            } else if (runData.stderr || runData.compile_output) {
              throw new Error(`Execution error on test case #${i + 1}: ${runData.stderr || runData.compile_output}`);
            }
          } catch (e: any) {
            console.error("Error reading run output:", e);
          }
        } else {
          const errDetail = await parseErrorResponse(res, "Code execution failed");
          throw new Error(errDetail);
        }
      }

      const updated = [...questions];
      updated[qIdx] = { ...updated[qIdx], test_cases: updatedTestCases };
      setQuestions(updated);

      // Instantly run verify with updated outputs
      setTimeout(() => {
        handleVerifyQuestion(qIdx);
      }, 200);
    } catch (e: any) {
      alert(`Auto-fill outputs error: ${e.message}`);
    } finally {
      setAutoGeneratingIdx(null);
    }
  };

  const loadPreset = (qIdx: number, presetId: string) => {
    const preset = CODING_PRESETS.find(p => p.id === presetId);
    if (!preset) return;
    const updated = [...questions];
    updated[qIdx] = {
      ...updated[qIdx],
      prompt: preset.prompt,
      language: preset.language,
      starter_code: preset.starter_code,
      reference_solution: preset.reference_solution,
      test_cases: preset.test_cases.map(tc => ({ ...tc })),
      explanation: preset.explanation,
      points: updated[qIdx].points || 10
    };
    setQuestions(updated);
    setVerificationResults(prev => {
      const copy = { ...prev };
      delete copy[qIdx];
      return copy;
    });
  };

  const applyBoilerplate = (qIdx: number, stubType: "functionStub" | "stdinStub") => {
    const q = questions[qIdx];
    const lang = q.language || "python";
    const templates = LANGUAGE_TEMPLATES[lang] || LANGUAGE_TEMPLATES["python"];
    const stub = templates[stubType];
    const updated = [...questions];
    updated[qIdx] = {
      ...updated[qIdx],
      starter_code: stub
    };
    setQuestions(updated);
  };

  // CSV Import State & Handlers
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvImportMode, setCsvImportMode] = useState<"append" | "replace">("append");
  const [isImportingCsv, setIsImportingCsv] = useState(false);
  const [csvStatusMessage, setCsvStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleDownloadCsvTemplate = () => {
    const csvContent = `type,prompt,option1,option2,option3,option4,correct_answer,explanation,points,language,starter_code,test_cases
MCQ,"What is the primary function of DNS in computer networks?","Translate domain names to IP addresses","Encrypt web traffic","Route packets across routers","Assign MAC addresses to devices","A","DNS translates human-readable hostnames into machine-routable IP addresses.",1,,,
MCQ,"Which sorting algorithm has an average time complexity of O(n log n)?","Merge Sort","Bubble Sort","Insertion Sort","Selection Sort","1","Merge Sort consistently divides arrays in half and merges in linear time.",1,,,
LONG_ANSWER,"Explain the differences between process and thread, including memory sharing and context switching overhead.","","","","","","Key points: Processes have separate address spaces; threads share memory within the same process. Context switching is faster between threads.",10,,,
CODING,"Write a function named 'two_sum' that returns the indices of two numbers in an array that add up to a target.","","","","","","Use a hash map for optimal O(n) time complexity.",10,python,"def two_sum(nums, target):\\n    # Return [idx1, idx2]\\n    pass","[2 7 11 15] 9:[0 1]|[3 2 4] 6:[1 2]"
`;
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "fortivex_quiz_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportCsv = async () => {
    if (!csvFile) {
      alert("Please choose a CSV file to upload first.");
      return;
    }

    setIsImportingCsv(true);
    setCsvStatusMessage(null);

    try {
      let importedQuestions: QuizQuestion[] = [];
      const token = localStorage.getItem("fortivex_access_token");

      try {
        const formData = new FormData();
        formData.append("file", csvFile);

        const res = await fetch(buildApiUrl("/api/v1/curriculum/quizzes/parse-csv"), {
          method: "POST",
          headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: formData,
        });

        if (res.ok) {
          const data = await res.json();
          importedQuestions = data.questions || [];
        }
      } catch (e) {
        // Fallback to client-side
      }

      if (importedQuestions.length === 0) {
        const text = await csvFile.text();
        importedQuestions = parseClientSideCSV(text);
      }

      if (importedQuestions.length === 0) {
        throw new Error("No valid questions could be extracted from this CSV file. Please check column headers against the template.");
      }

      if (csvImportMode === "replace") {
        setQuestions(importedQuestions);
      } else {
        setQuestions(prev => [...prev, ...importedQuestions]);
      }

      const mcqCount = importedQuestions.filter(q => (q.type || "MCQ") === "MCQ").length;
      const longCount = importedQuestions.filter(q => q.type === "LONG_ANSWER").length;
      const codeCount = importedQuestions.filter(q => q.type === "CODING").length;

      setCsvStatusMessage({
        type: "success",
        text: `Successfully imported ${importedQuestions.length} question(s) from "${csvFile.name}" (${mcqCount} Multiple Choice, ${longCount} Long Answer, ${codeCount} Coding Sandbox)!`,
      });
      setCsvFile(null);
    } catch (err: any) {
      setCsvStatusMessage({
        type: "error",
        text: err.message || "Failed to process CSV file.",
      });
    } finally {
      setIsImportingCsv(false);
    }
  };

  const handleSave = async () => {
    if (questions.length === 0) return alert("No questions to save");
    if (!title.trim()) return alert("Please provide a title");

    setIsSaving(true);
    try {
      const targetLessonId = initialLessonId || selectedLesson;
      if (!targetLessonId) return alert("Please select a lesson to save the quiz to");

      const res = await fetch(buildApiUrl(`/api/v1/lessons/${targetLessonId}/activities`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          title: title,
          activity_type: "QUIZ",
          content: { 
            questions,
            start_time: startDate && startTimeStr ? `${startDate}T${startTimeStr}` : null,
            due_time: dueDate && dueTimeStr ? `${dueDate}T${dueTimeStr}` : null
          },
          order: 1
        })
      });

      if (!res.ok) {
        const errDetail = await parseErrorResponse(res, "Failed to save activity");
        throw new Error(errDetail);
      }
      onSaved?.();
    } catch (error: any) {
      console.error(error);
      alert(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const updateQuestion = (idx: number, field: keyof QuizQuestion, value: any) => {
    const updated = [...questions];
    updated[idx] = { ...updated[idx], [field]: value };
    setQuestions(updated);
  };

  const updateOption = (qIdx: number, oIdx: number, value: string) => {
    const updated = [...questions];
    if (!updated[qIdx].options) updated[qIdx].options = [];
    updated[qIdx].options![oIdx] = value;
    setQuestions(updated);
  };

  const addQuestion = (type: "MCQ" | "LONG_ANSWER" | "CODING" = "MCQ") => {
    if (type === "MCQ") {
      setQuestions([
        ...questions,
        { type: "MCQ", prompt: "New Multiple Choice Question", options: ["Option A", "Option B", "Option C", "Option D"], correct_index: 0, explanation: "", points: 1 }
      ]);
    } else if (type === "LONG_ANSWER") {
      setQuestions([
        ...questions,
        { type: "LONG_ANSWER", prompt: "New Long Form Question", rubric: "Evaluate clarity, conceptual correctness, and depth.", explanation: "Model answer or rubric key points.", points: 10 }
      ]);
    } else if (type === "CODING") {
      setQuestions([
        ...questions,
        {
          type: "CODING",
          prompt: "Write a function that...",
          language: "python",
          starter_code: "def solution():\n    # Write your solution here\n    pass\n",
          test_cases: [{ input: "5", expected_output: "10" }],
          explanation: "Reference implementation & time complexity.",
          points: 10
        }
      ]);
    }
  };

  const addTestCase = (qIdx: number) => {
    const updated = [...questions];
    const cases = updated[qIdx].test_cases || [];
    updated[qIdx] = { ...updated[qIdx], test_cases: [...cases, { input: "", expected_output: "", hidden: false }] };
    setQuestions(updated);
  };

  const duplicateTestCase = (qIdx: number, tcIdx: number) => {
    const updated = [...questions];
    const cases = [...(updated[qIdx].test_cases || [])];
    const target = cases[tcIdx];
    cases.splice(tcIdx + 1, 0, { ...target });
    updated[qIdx] = { ...updated[qIdx], test_cases: cases };
    setQuestions(updated);
  };

  const toggleTestCaseHidden = (qIdx: number, tcIdx: number) => {
    const updated = [...questions];
    const cases = [...(updated[qIdx].test_cases || [])];
    cases[tcIdx] = { ...cases[tcIdx], hidden: !cases[tcIdx].hidden };
    updated[qIdx] = { ...updated[qIdx], test_cases: cases };
    setQuestions(updated);
  };

  const updateTestCase = (qIdx: number, tcIdx: number, field: keyof TestCase, val: any) => {
    const updated = [...questions];
    const cases = [...(updated[qIdx].test_cases || [])];
    cases[tcIdx] = { ...cases[tcIdx], [field]: val };
    updated[qIdx] = { ...updated[qIdx], test_cases: cases };
    setQuestions(updated);
  };

  const removeTestCase = (qIdx: number, tcIdx: number) => {
    const updated = [...questions];
    const cases = (updated[qIdx].test_cases || []).filter((_, i) => i !== tcIdx);
    updated[qIdx] = { ...updated[qIdx], test_cases: cases };
    setQuestions(updated);
  };

  const removeQuestion = (idx: number) => {
    setQuestions(questions.filter((_, i) => i !== idx));
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Quiz Editor</h2>
          <p style={styles.subtitle}>Generate using AI or build manually</p>
        </div>
        {onCancel && (
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        )}
      </div>

      {!initialLessonId && (
        <div style={styles.locationPanel}>
          <h3 style={styles.label}>Quiz Location</h3>
          
          <div style={styles.grid}>
            <div>
              <label style={styles.label}>Program</label>
              <select 
                style={{ ...styles.select, border: selectedProgram ? "2px solid var(--primary)" : "2px solid rgba(0,0,0,0.08)" }} 
                value={selectedProgram} 
                onChange={e => {
                  setSelectedProgram(e.target.value ? Number(e.target.value) : "");
                  setSelectedModule("");
                  setSelectedWeek("");
                  setSelectedLesson("");
                }}
              >
                <option value="">Select Program...</option>
                {programs && programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div style={{ opacity: selectedProgram ? 1 : 0.5, transition: "opacity 0.2s" }}>
              <label style={styles.label}>Module</label>
              <select 
                style={{ ...styles.select, border: selectedModule ? "2px solid var(--primary)" : "2px solid rgba(0,0,0,0.08)" }} 
                value={selectedModule} 
                onChange={e => {
                  setSelectedModule(e.target.value ? Number(e.target.value) : "");
                  setSelectedWeek("");
                  setSelectedLesson("");
                }} 
                disabled={!selectedProgram}
              >
                <option value="">Select Module...</option>
                {modules.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
              </select>
            </div>
            <div style={{ opacity: selectedModule ? 1 : 0.5, transition: "opacity 0.2s" }}>
              <label style={styles.label}>Week</label>
              <select 
                style={{ ...styles.select, border: selectedWeek ? "2px solid var(--primary)" : "2px solid rgba(0,0,0,0.08)" }} 
                value={selectedWeek} 
                onChange={e => {
                  setSelectedWeek(e.target.value ? Number(e.target.value) : "");
                  setSelectedLesson("");
                }} 
                disabled={!selectedModule}
              >
                <option value="">Select Week...</option>
                {weeks.map(w => <option key={w.id} value={w.id}>{w.title}</option>)}
              </select>
            </div>
            <div style={{ opacity: selectedWeek ? 1 : 0.5, transition: "opacity 0.2s" }}>
              <label style={styles.label}>Lesson</label>
              <select 
                style={{ ...styles.select, border: selectedLesson ? "2px solid var(--success)" : "2px solid rgba(0,0,0,0.08)" }} 
                value={selectedLesson} 
                onChange={e => setSelectedLesson(e.target.value ? Number(e.target.value) : "")} 
                disabled={!selectedWeek}
              >
                <option value="">Select Lesson...</option>
                {lessons.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* AI Generator Panel */}
      <div style={styles.aiPanel}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
          <h3 style={{ ...styles.aiHeader, marginBottom: 0 }}>
            <span className="material-symbols-outlined">auto_awesome</span>
            AI Magic Quiz Generator
          </h3>
          <span style={{ fontSize: "0.8rem", color: "var(--color-muted)", fontWeight: 600 }}>
            Select question types below and upload a PDF to automatically generate your quiz
          </span>
        </div>

        {/* Question Type Toggles */}
        <div style={{ marginBottom: "1.25rem" }}>
          <label style={{ ...styles.label, fontSize: "0.75rem", marginBottom: "0.5rem" }}>
            Question Types to Generate:
          </label>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            {[
              { id: "MCQ", label: "Multiple Choice", icon: "radio_button_checked", color: "var(--primary)", desc: "4-option multiple choice questions" },
              { id: "LONG_ANSWER", label: "Long Form / Essay", icon: "description", color: "#b45309", desc: "Open-ended questions with AI grading rubrics" },
              { id: "CODING", label: "Coding Sandbox", icon: "code", color: "#0284c7", desc: "Coding challenges with starter code and Judge0 test cases" }
            ].map(item => {
              const active = selectedAiTypes.includes(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggleAiType(item.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    padding: "0.55rem 1rem",
                    borderRadius: "10px",
                    border: active ? `2px solid ${item.color}` : "2px solid rgba(0,0,0,0.1)",
                    background: active 
                      ? (item.id === "MCQ" ? "rgba(79, 70, 229, 0.08)" : item.id === "LONG_ANSWER" ? "rgba(245, 158, 11, 0.08)" : "rgba(2, 132, 199, 0.08)") 
                      : "var(--background)",
                    color: active ? item.color : "var(--color-muted)",
                    fontWeight: 700,
                    fontSize: "0.85rem",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    boxShadow: active ? "0 2px 8px rgba(0,0,0,0.06)" : "none"
                  }}
                  title={item.desc}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>{item.icon}</span>
                  {item.label}
                  <span style={{
                    width: "18px",
                    height: "18px",
                    borderRadius: "50%",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: active ? item.color : "rgba(0,0,0,0.1)",
                    color: "#fff",
                    fontSize: "11px",
                    fontWeight: 900
                  }}>
                    {active ? "✓" : "+"}
                  </span>
                </button>
              );
            })}
          </div>
          {selectedAiTypes.length === 0 && (
            <p style={{ color: "var(--danger)", fontSize: "0.78rem", marginTop: "0.35rem", marginBottom: 0 }}>
              Please select at least one question type.
            </p>
          )}
        </div>

        <div style={{ display: "flex", gap: "1rem", alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 250px" }}>
            <label style={{...styles.label, fontSize: "0.75rem"}}>Source Document (PDF)</label>
            <input 
              type="file" 
              accept=".pdf"
              onChange={e => setFile(e.target.files?.[0] || null)}
              style={styles.fileInput}
            />
          </div>
          <div style={{ width: "120px" }}>
            <label style={{...styles.label, fontSize: "0.75rem"}}>Questions Count</label>
            <input 
              type="number" 
              value={numQuestions}
              onChange={e => setNumQuestions(Number(e.target.value))}
              style={styles.select}
              min={1} max={20}
            />
          </div>
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !file || selectedAiTypes.length === 0}
            style={{ height: "42px" }}
          >
            {isGenerating ? "Generating..." : "Generate with AI"}
          </Button>
        </div>
      </div>

      {/* Bulk CSV Questions Import Panel */}
      <div style={{
        background: "rgba(79, 70, 229, 0.03)",
        border: "1px dashed rgba(79, 70, 229, 0.3)",
        borderRadius: "16px",
        padding: "1.5rem",
        marginBottom: "2rem",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span className="material-symbols-outlined" style={{ color: "var(--primary)", fontSize: "22px" }}>upload_file</span>
            <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "var(--foreground)" }}>
              Bulk CSV Questions Importer
            </h3>
          </div>
          <button
            type="button"
            onClick={handleDownloadCsvTemplate}
            style={{
              background: "transparent",
              border: "1px solid var(--color-border)",
              borderRadius: "8px",
              padding: "0.4rem 0.85rem",
              fontSize: "0.82rem",
              fontWeight: 600,
              color: "var(--primary)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.35rem",
              transition: "all 0.2s"
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>download</span>
            Download CSV Template
          </button>
        </div>

        <p style={{ margin: "0 0 1rem 0", fontSize: "0.85rem", color: "var(--color-muted)", lineHeight: 1.5 }}>
          Upload multiple questions at once from an Excel or Google Sheets CSV export. Supports Multiple Choice, Long Form Essay, and Coding Sandbox questions.
        </p>

        <div style={{ display: "flex", gap: "1rem", alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 250px" }}>
            <label style={{ ...styles.label, fontSize: "0.75rem" }}>Choose CSV File (.csv)</label>
            <input
              type="file"
              accept=".csv"
              onChange={e => setCsvFile(e.target.files?.[0] || null)}
              style={styles.fileInput}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            <label style={{ ...styles.label, fontSize: "0.75rem" }}>Import Mode</label>
            <div style={{ display: "flex", gap: "0.25rem", background: "rgba(0,0,0,0.04)", padding: "0.25rem", borderRadius: "8px" }}>
              <button
                type="button"
                onClick={() => setCsvImportMode("append")}
                style={{
                  border: "none",
                  borderRadius: "6px",
                  padding: "0.35rem 0.75rem",
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  background: csvImportMode === "append" ? "var(--primary)" : "transparent",
                  color: csvImportMode === "append" ? "white" : "var(--color-muted)",
                }}
              >
                Append to List ({questions.length})
              </button>
              <button
                type="button"
                onClick={() => setCsvImportMode("replace")}
                style={{
                  border: "none",
                  borderRadius: "6px",
                  padding: "0.35rem 0.75rem",
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  background: csvImportMode === "replace" ? "var(--danger)" : "transparent",
                  color: csvImportMode === "replace" ? "white" : "var(--color-muted)",
                }}
              >
                Replace Existing
              </button>
            </div>
          </div>

          <Button
            onClick={handleImportCsv}
            disabled={isImportingCsv || !csvFile}
            style={{ height: "42px" }}
          >
            {isImportingCsv ? "Parsing..." : "Upload & Parse CSV"}
          </Button>
        </div>

        {csvStatusMessage && (
          <div style={{
            marginTop: "1rem",
            padding: "0.75rem 1rem",
            borderRadius: "8px",
            background: csvStatusMessage.type === "success" ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)",
            border: `1px solid ${csvStatusMessage.type === "success" ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
            color: csvStatusMessage.type === "success" ? "var(--success)" : "var(--danger)",
            fontSize: "0.85rem",
            fontWeight: 600,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}>
            <span>{csvStatusMessage.text}</span>
            <button
              onClick={() => setCsvStatusMessage(null)}
              style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: "14px" }}
            >
              ✕
            </button>
          </div>
        )}
      </div>

      <div style={{ marginBottom: "2rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
        <Input 
          id="quiz-title"
          label="Quiz Title"
          value={title}
          onChange={e => setTitle(e.target.value)}
        />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <div>
            <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.85rem", fontWeight: 600, color: "var(--foreground)" }}>Start Time (Optional)</label>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <input type="date" onClick={(e) => { try { (e.target as any).showPicker() } catch(err) {} }} value={startDate} min={getMinTime().slice(0, 10)} onChange={e => setStartDate(e.target.value)} style={{ flex: 1, padding: "0.75rem", borderRadius: "8px", border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--foreground)" }} />
              <input type="time" onClick={(e) => { try { (e.target as any).showPicker() } catch(err) {} }} value={startTimeStr} onChange={e => setStartTimeStr(e.target.value)} style={{ padding: "0.75rem", borderRadius: "8px", border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--foreground)" }} />
            </div>
          </div>
          <div>
            <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.85rem", fontWeight: 600, color: "var(--foreground)" }}>Due Time (Optional)</label>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <input type="date" onClick={(e) => { try { (e.target as any).showPicker() } catch(err) {} }} value={dueDate} min={startDate || getMinTime().slice(0, 10)} onChange={e => setDueDate(e.target.value)} style={{ flex: 1, padding: "0.75rem", borderRadius: "8px", border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--foreground)" }} />
              <input type="time" onClick={(e) => { try { (e.target as any).showPicker() } catch(err) {} }} value={dueTimeStr} onChange={e => setDueTimeStr(e.target.value)} style={{ padding: "0.75rem", borderRadius: "8px", border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--foreground)" }} />
            </div>
          </div>
        </div>
      </div>

      {/* Manual Editor */}
      <div>
        {questions.map((q, qIdx) => {
          const qType = (q.type || "MCQ").toUpperCase();

          return (
            <div key={qIdx} style={styles.questionCard}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <span style={{ fontWeight: 800, color: "var(--primary)", fontSize: "1rem" }}>#{qIdx + 1}</span>
                  <select
                    value={qType}
                    onChange={e => {
                      const newType = e.target.value as any;
                      const updated = [...questions];
                      updated[qIdx] = {
                        ...updated[qIdx],
                        type: newType,
                        options: newType === "MCQ" ? (updated[qIdx].options || ["Option A", "Option B", "Option C", "Option D"]) : undefined,
                        points: newType === "MCQ" ? 1 : 10,
                        language: newType === "CODING" ? (updated[qIdx].language || "python") : undefined,
                        starter_code: newType === "CODING" ? (updated[qIdx].starter_code || "def solution():\n    pass\n") : undefined,
                        test_cases: newType === "CODING" ? (updated[qIdx].test_cases || [{ input: "", expected_output: "" }]) : undefined,
                      };
                      setQuestions(updated);
                    }}
                    style={{ ...styles.select, width: "auto", padding: "0.35rem 0.75rem", fontSize: "0.85rem", fontWeight: 700 }}
                  >
                    <option value="MCQ">🔘 Multiple Choice (MCQ)</option>
                    <option value="LONG_ANSWER">📝 Long Answer (Essay)</option>
                    <option value="CODING">💻 Coding Sandbox (Judge0)</option>
                  </select>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                    <label style={{ ...styles.label, margin: 0, fontSize: "0.8rem" }}>Points:</label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={q.points ?? (qType === "MCQ" ? 1 : 10)}
                      onChange={e => updateQuestion(qIdx, "points", Number(e.target.value))}
                      style={{ ...styles.select, width: "70px", padding: "0.25rem 0.5rem", fontSize: "0.85rem" }}
                    />
                  </div>
                  <button 
                    onClick={() => removeQuestion(qIdx)}
                    style={styles.removeBtn}
                    title="Remove Question"
                  >
                    <span className="material-symbols-outlined">delete</span>
                  </button>
                </div>
              </div>
              
              <div style={{ marginBottom: "1.25rem" }}>
                <label style={styles.label}>
                  {qType === "CODING" ? "Problem Statement & Requirements" : qType === "LONG_ANSWER" ? "Prompt / Essay Topic" : "Question Text"}
                </label>
                <textarea 
                  value={q.prompt}
                  onChange={e => updateQuestion(qIdx, "prompt", e.target.value)}
                  style={styles.textarea}
                  rows={3}
                />
              </div>

              {/* MCQ Options */}
              {qType === "MCQ" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
                  {(q.options || []).map((opt, oIdx) => (
                    <div key={oIdx} style={styles.optionRow}>
                      <input 
                        type="radio" 
                        name={`correct-${qIdx}`} 
                        checked={q.correct_index === oIdx}
                        onChange={() => updateQuestion(qIdx, "correct_index", oIdx)}
                        style={{ width: "18px", height: "18px", accentColor: "var(--primary)" }}
                        title="Mark as correct answer"
                      />
                      <input 
                        type="text" 
                        value={opt}
                        onChange={e => updateOption(qIdx, oIdx, e.target.value)}
                        style={{ ...styles.select, flex: 1, border: q.correct_index === oIdx ? "2px solid var(--success)" : "2px solid rgba(0,0,0,0.08)" }}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Long Answer Rubric */}
              {qType === "LONG_ANSWER" && (
                <div style={{ marginBottom: "1.25rem" }}>
                  <label style={styles.label}>AI Evaluation Rubric & Key Points</label>
                  <textarea 
                    value={q.expected_answer || q.rubric || ""}
                    onChange={e => updateQuestion(qIdx, "expected_answer", e.target.value)}
                    style={{ ...styles.textarea, minHeight: "70px" }}
                    placeholder="List the key concepts, points, and criteria the AI evaluator should look for in student answers..."
                  />
                </div>
              )}

              {/* Coding Question Wizard */}
              {qType === "CODING" && (() => {
                const qVerification = verificationResults[qIdx];
                const currentTab = activeCodeTab[qIdx] || "starter";
                const isVerifying = verifyingQuestionIdx === qIdx;
                const isAutoPopulating = autoGeneratingIdx === qIdx;

                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", marginBottom: "1.5rem" }}>
                    
                    {/* Top Wizard Toolbar: Presets & Language & Stubs */}
                    <div style={{
                      background: "rgba(2, 132, 199, 0.04)",
                      border: "1px solid rgba(2, 132, 199, 0.2)",
                      borderRadius: "12px",
                      padding: "1rem 1.25rem",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.85rem"
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: "#0284c7", fontWeight: 700, fontSize: "0.88rem" }}>
                          <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>terminal</span>
                          <span>Coding Question Wizard</span>
                        </div>
                        <span style={{ fontSize: "0.78rem", color: "var(--color-muted)" }}>
                          Quickly create problems with boilerplates, presets, and Judge0 verification
                        </span>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                        {/* Quick Preset Selector */}
                        <div>
                          <label style={{ ...styles.label, fontSize: "0.72rem", marginBottom: "0.3rem" }}>
                            💡 Load Pre-Built Problem Preset
                          </label>
                          <select
                            defaultValue=""
                            onChange={e => {
                              if (e.target.value) {
                                loadPreset(qIdx, e.target.value);
                                e.target.value = "";
                              }
                            }}
                            style={{ ...styles.select, padding: "0.55rem 0.85rem", fontSize: "0.85rem", background: "var(--background)" }}
                          >
                            <option value="">Choose a problem preset...</option>
                            {CODING_PRESETS.map(preset => (
                              <option key={preset.id} value={preset.id}>
                                [{preset.badge}] {preset.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Language Selector & Stubs */}
                        <div>
                          <label style={{ ...styles.label, fontSize: "0.72rem", marginBottom: "0.3rem" }}>
                            Target Programming Language
                          </label>
                          <select
                            value={q.language || "python"}
                            onChange={e => {
                              const newLang = e.target.value;
                              updateQuestion(qIdx, "language", newLang);
                              // Auto-update starter stub if empty or default
                              const defTemplate = LANGUAGE_TEMPLATES[newLang]?.functionStub;
                              if (defTemplate && (!q.starter_code || q.starter_code.includes("def solution") || q.starter_code.includes("function solution"))) {
                                updateQuestion(qIdx, "starter_code", defTemplate);
                              }
                            }}
                            style={{ ...styles.select, padding: "0.55rem 0.85rem", fontSize: "0.85rem", background: "var(--background)" }}
                          >
                            <option value="python">Python 3 (3.12)</option>
                            <option value="javascript">JavaScript (Node.js 20)</option>
                            <option value="typescript">TypeScript (5.0)</option>
                            <option value="cpp">C++ (GCC 14)</option>
                            <option value="c">C (GCC 14)</option>
                            <option value="java">Java (JDK 17)</option>
                            <option value="go">Go (1.18)</option>
                          </select>
                        </div>
                      </div>

                      {/* Quick Boilerplate Insertion Buttons */}
                      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center", paddingTop: "0.25rem", borderTop: "1px dashed rgba(2, 132, 199, 0.15)" }}>
                        <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-muted)", marginRight: "0.25rem" }}>
                          Insert Boilerplate:
                        </span>
                        <button
                          type="button"
                          onClick={() => applyBoilerplate(qIdx, "functionStub")}
                          style={{
                            background: "var(--background)",
                            border: "1px solid rgba(2, 132, 199, 0.3)",
                            borderRadius: "6px",
                            padding: "0.3rem 0.65rem",
                            fontSize: "0.76rem",
                            fontWeight: 600,
                            color: "#0284c7",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.3rem"
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>code</span>
                          Function Stub
                        </button>
                        <button
                          type="button"
                          onClick={() => applyBoilerplate(qIdx, "stdinStub")}
                          style={{
                            background: "var(--background)",
                            border: "1px solid rgba(2, 132, 199, 0.3)",
                            borderRadius: "6px",
                            padding: "0.3rem 0.65rem",
                            fontSize: "0.76rem",
                            fontWeight: 600,
                            color: "#0284c7",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.3rem"
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>input</span>
                          Stdin/Stdout Stub
                        </button>
                      </div>
                    </div>

                    {/* Dual Code Studio: Tabs for Starter Code and Reference Solution */}
                    <div style={{
                      background: "var(--background)",
                      border: "1px solid var(--color-border)",
                      borderRadius: "12px",
                      overflow: "hidden"
                    }}>
                      <div style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        borderBottom: "1px solid var(--color-border)",
                        background: "rgba(0,0,0,0.02)",
                        padding: "0.4rem 0.75rem",
                        flexWrap: "wrap",
                        gap: "0.5rem"
                      }}>
                        <div style={{ display: "flex", gap: "0.35rem" }}>
                          <button
                            type="button"
                            onClick={() => setActiveCodeTab(prev => ({ ...prev, [qIdx]: "starter" }))}
                            style={{
                              padding: "0.45rem 0.9rem",
                              borderRadius: "8px",
                              border: "none",
                              background: currentTab === "starter" ? "var(--primary)" : "transparent",
                              color: currentTab === "starter" ? "#fff" : "var(--color-muted)",
                              fontWeight: 700,
                              fontSize: "0.82rem",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: "0.35rem",
                              transition: "all 0.15s"
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>code</span>
                            Starter Code (Student View)
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveCodeTab(prev => ({ ...prev, [qIdx]: "solution" }))}
                            style={{
                              padding: "0.45rem 0.9rem",
                              borderRadius: "8px",
                              border: "none",
                              background: currentTab === "solution" ? "#059669" : "transparent",
                              color: currentTab === "solution" ? "#fff" : "var(--color-muted)",
                              fontWeight: 700,
                              fontSize: "0.82rem",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: "0.35rem",
                              transition: "all 0.15s"
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>verified</span>
                            Reference Solution (Test Runner)
                            {q.reference_solution?.trim() ? (
                              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#34d399", display: "inline-block" }}></span>
                            ) : null}
                          </button>
                        </div>
                        <span style={{ fontSize: "0.75rem", color: "var(--color-muted)", fontFamily: "monospace" }}>
                          {q.language || "python"}
                        </span>
                      </div>

                      <div style={{ padding: "1rem" }}>
                        {currentTab === "starter" ? (
                          <div>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem" }}>
                              <label style={{ ...styles.label, fontSize: "0.75rem", margin: 0 }}>
                                Initial Code in Student Sandbox
                              </label>
                              <span style={{ fontSize: "0.73rem", color: "var(--color-muted)" }}>
                                Students start with this template
                              </span>
                            </div>
                            <textarea
                              value={q.starter_code || ""}
                              onChange={e => updateQuestion(qIdx, "starter_code", e.target.value)}
                              rows={7}
                              style={{
                                width: "100%",
                                padding: "0.75rem 1rem",
                                borderRadius: "8px",
                                border: "1px solid var(--color-border)",
                                fontFamily: "Consolas, Menlo, Monaco, monospace",
                                fontSize: "0.9rem",
                                lineHeight: "1.45",
                                background: "#1e1e2e",
                                color: "#cdd6f4",
                                outline: "none",
                                resize: "vertical"
                              }}
                              placeholder={`# Write ${q.language || "python"} starter code here...`}
                            />
                          </div>
                        ) : (
                          <div>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem" }}>
                              <label style={{ ...styles.label, fontSize: "0.75rem", margin: 0, color: "#059669" }}>
                                Complete Reference Solution
                              </label>
                              <span style={{ fontSize: "0.73rem", color: "var(--color-muted)" }}>
                                Used by Judge0 to verify test cases and generate outputs
                              </span>
                            </div>
                            <textarea
                              value={q.reference_solution || ""}
                              onChange={e => updateQuestion(qIdx, "reference_solution", e.target.value)}
                              rows={7}
                              style={{
                                width: "100%",
                                padding: "0.75rem 1rem",
                                borderRadius: "8px",
                                border: "1px solid rgba(5, 150, 105, 0.4)",
                                fontFamily: "Consolas, Menlo, Monaco, monospace",
                                fontSize: "0.9rem",
                                lineHeight: "1.45",
                                background: "#111827",
                                color: "#a7f3d0",
                                outline: "none",
                                resize: "vertical"
                              }}
                              placeholder={`# Working reference solution code in ${q.language || "python"}...`}
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Automated Test Cases Studio (Judge0 Sandbox) */}
                    <div style={{
                      background: "rgba(0,0,0,0.015)",
                      border: "1px solid var(--color-border)",
                      borderRadius: "12px",
                      padding: "1.25rem"
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <span className="material-symbols-outlined" style={{ color: "#0284c7", fontSize: "20px" }}>playlist_add_check</span>
                          <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "var(--foreground)" }}>
                            Automated Test Cases ({q.test_cases?.length || 0})
                          </h4>
                        </div>

                        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                          {/* Add test case button */}
                          <button
                            type="button"
                            onClick={() => addTestCase(qIdx)}
                            style={{
                              background: "var(--background)",
                              border: "1px solid var(--color-border)",
                              borderRadius: "8px",
                              padding: "0.35rem 0.75rem",
                              color: "var(--primary)",
                              fontWeight: 700,
                              fontSize: "0.8rem",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: "0.25rem"
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>add</span>
                            Add Test Case
                          </button>

                          {/* Auto-populate outputs button */}
                          <button
                            type="button"
                            onClick={() => handleAutoPopulateOutputs(qIdx)}
                            disabled={isAutoPopulating || isVerifying}
                            title="Execute reference solution through Judge0 to compute expected outputs"
                            style={{
                              background: "rgba(245, 158, 11, 0.1)",
                              border: "1px solid rgba(245, 158, 11, 0.4)",
                              borderRadius: "8px",
                              padding: "0.35rem 0.75rem",
                              color: "#b45309",
                              fontWeight: 700,
                              fontSize: "0.8rem",
                              cursor: isAutoPopulating ? "wait" : "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: "0.25rem"
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>bolt</span>
                            {isAutoPopulating ? "Computing Outputs..." : "Auto-Fill Outputs"}
                          </button>

                          {/* Verify with Judge0 button */}
                          <button
                            type="button"
                            onClick={() => handleVerifyQuestion(qIdx)}
                            disabled={isVerifying || isAutoPopulating}
                            style={{
                              background: "#0284c7",
                              border: "none",
                              borderRadius: "8px",
                              padding: "0.35rem 0.85rem",
                              color: "#fff",
                              fontWeight: 700,
                              fontSize: "0.8rem",
                              cursor: isVerifying ? "wait" : "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: "0.35rem",
                              boxShadow: "0 2px 6px rgba(2, 132, 199, 0.3)"
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>play_arrow</span>
                            {isVerifying ? "Verifying..." : "Verify on Judge0"}
                          </button>
                        </div>
                      </div>

                      {/* Verification Banner if run */}
                      {qVerification && (
                        <div style={{
                          marginBottom: "1rem",
                          padding: "0.75rem 1rem",
                          borderRadius: "8px",
                          background: qVerification.all_passed ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)",
                          border: qVerification.all_passed ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid rgba(239, 68, 68, 0.3)",
                          color: qVerification.all_passed ? "#065f46" : "#991b1b",
                          fontSize: "0.85rem",
                          fontWeight: 600,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "0.5rem"
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
                              {qVerification.all_passed ? "check_circle" : "error"}
                            </span>
                            <span>
                              {qVerification.all_passed
                                ? `🎉 All ${qVerification.total_tests} test cases passed successfully with reference solution!`
                                : `⚠️ ${qVerification.passed_tests} / ${qVerification.total_tests} test cases passed. Review output diffs below.`}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setVerificationResults(prev => {
                              const copy = { ...prev };
                              delete copy[qIdx];
                              return copy;
                            })}
                            style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: "0.75rem", textDecoration: "underline" }}
                          >
                            Dismiss
                          </button>
                        </div>
                      )}

                      {/* Test Cases List */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                        {(q.test_cases || []).length === 0 ? (
                          <div style={{ textAlign: "center", padding: "1.5rem", color: "var(--color-muted)", fontSize: "0.85rem" }}>
                            No test cases added yet. Click &quot;Add Test Case&quot; or choose a preset problem above.
                          </div>
                        ) : (
                          (q.test_cases || []).map((tc, tcIdx) => {
                            const tcResult = qVerification?.results?.[tcIdx];

                            return (
                              <div
                                key={tcIdx}
                                style={{
                                  background: "var(--background)",
                                  border: tcResult ? (tcResult.passed ? "1px solid rgba(16, 185, 129, 0.4)" : "1px solid rgba(239, 68, 68, 0.4)") : "1px solid var(--color-border)",
                                  borderRadius: "10px",
                                  padding: "0.85rem 1rem",
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "0.6rem"
                                }}
                              >
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                    <span style={{ fontSize: "0.8rem", fontWeight: 800, color: "var(--primary)" }}>
                                      Case #{tcIdx + 1}
                                    </span>

                                    {/* Public vs Hidden toggle */}
                                    <button
                                      type="button"
                                      onClick={() => toggleTestCaseHidden(qIdx, tcIdx)}
                                      style={{
                                        border: "none",
                                        borderRadius: "6px",
                                        padding: "0.2rem 0.5rem",
                                        fontSize: "0.72rem",
                                        fontWeight: 700,
                                        cursor: "pointer",
                                        background: tc.hidden ? "rgba(100, 116, 139, 0.15)" : "rgba(2, 132, 199, 0.12)",
                                        color: tc.hidden ? "#475569" : "#0284c7",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "0.25rem"
                                      }}
                                      title={tc.hidden ? "Hidden from students in sandbox, verified on final submission" : "Publicly visible to students in coding sandbox"}
                                    >
                                      <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
                                        {tc.hidden ? "visibility_off" : "visibility"}
                                      </span>
                                      {tc.hidden ? "Hidden Case" : "Public Case"}
                                    </button>

                                    {/* Test Result Chip */}
                                    {tcResult && (
                                      <span style={{
                                        fontSize: "0.72rem",
                                        fontWeight: 700,
                                        padding: "0.2rem 0.5rem",
                                        borderRadius: "6px",
                                        background: tcResult.passed ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                                        color: tcResult.passed ? "#059669" : "#dc2626",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "0.25rem"
                                      }}>
                                        <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
                                          {tcResult.passed ? "check" : "close"}
                                        </span>
                                        {tcResult.passed ? `Passed (${tcResult.time || "0.01"}s)` : `Failed (Got: "${(tcResult.actual_output || tcResult.error || "").trim().slice(0, 30)}")`}
                                      </span>
                                    )}
                                  </div>

                                  <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                                    {/* Duplicate button */}
                                    <button
                                      type="button"
                                      onClick={() => duplicateTestCase(qIdx, tcIdx)}
                                      style={{ background: "none", border: "none", color: "var(--color-muted)", cursor: "pointer", padding: "0.2rem" }}
                                      title="Duplicate Test Case"
                                    >
                                      <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>content_copy</span>
                                    </button>

                                    {/* Remove button */}
                                    <button
                                      type="button"
                                      onClick={() => removeTestCase(qIdx, tcIdx)}
                                      style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", padding: "0.2rem" }}
                                      title="Remove Test Case"
                                    >
                                      <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>delete</span>
                                    </button>
                                  </div>
                                </div>

                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                                  <div>
                                    <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "var(--color-muted)", marginBottom: "0.2rem" }}>
                                      Input (stdin)
                                    </label>
                                    <textarea
                                      value={tc.input || ""}
                                      onChange={e => updateTestCase(qIdx, tcIdx, "input", e.target.value)}
                                      rows={2}
                                      style={{
                                        width: "100%",
                                        padding: "0.45rem 0.65rem",
                                        borderRadius: "6px",
                                        border: "1px solid var(--color-border)",
                                        fontFamily: "monospace",
                                        fontSize: "0.82rem",
                                        background: "var(--color-surface)",
                                        color: "var(--foreground)",
                                        resize: "vertical"
                                      }}
                                      placeholder="e.g. 5 or [2, 7, 11, 15]"
                                    />
                                  </div>

                                  <div>
                                    <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "var(--color-muted)", marginBottom: "0.2rem" }}>
                                      Expected Output (stdout)
                                    </label>
                                    <textarea
                                      value={tc.expected_output || ""}
                                      onChange={e => updateTestCase(qIdx, tcIdx, "expected_output", e.target.value)}
                                      rows={2}
                                      style={{
                                        width: "100%",
                                        padding: "0.45rem 0.65rem",
                                        borderRadius: "6px",
                                        border: "1px solid var(--color-border)",
                                        fontFamily: "monospace",
                                        fontSize: "0.82rem",
                                        background: "var(--color-surface)",
                                        color: "var(--foreground)",
                                        resize: "vertical"
                                      }}
                                      placeholder="e.g. 25 or 0 1"
                                    />
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div>
                <label style={styles.label}>Solution Explanation / Model Answer</label>
                <textarea 
                  value={q.explanation}
                  onChange={e => updateQuestion(qIdx, "explanation", e.target.value)}
                  style={{ ...styles.textarea, minHeight: "60px" }}
                  placeholder="Solution notes, explanation, or ideal response..."
                />
              </div>
            </div>
          );
        })}

        {/* Add Question Actions */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem", marginTop: "1rem" }}>
          <button 
            type="button"
            onClick={() => addQuestion("MCQ")}
            style={{
              padding: "1rem",
              border: "2px dashed var(--color-border)",
              borderRadius: "12px",
              background: "transparent",
              color: "var(--primary)",
              fontSize: "0.9rem",
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem"
            }}
          >
            <span className="material-symbols-outlined">radio_button_checked</span>
            + Multiple Choice
          </button>

          <button 
            type="button"
            onClick={() => addQuestion("LONG_ANSWER")}
            style={{
              padding: "1rem",
              border: "2px dashed var(--color-border)",
              borderRadius: "12px",
              background: "transparent",
              color: "#b45309",
              fontSize: "0.9rem",
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem"
            }}
          >
            <span className="material-symbols-outlined">description</span>
            + Long Answer
          </button>

          <button 
            type="button"
            onClick={() => addQuestion("CODING")}
            style={{
              padding: "1rem",
              border: "2px dashed var(--color-border)",
              borderRadius: "12px",
              background: "transparent",
              color: "#0284c7",
              fontSize: "0.9rem",
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem"
            }}
          >
            <span className="material-symbols-outlined">code</span>
            + Coding Sandbox
          </button>
        </div>
      </div>

      <div style={{ marginTop: "3rem", paddingTop: "2rem", borderTop: "1px solid var(--color-border)", display: "flex", justifyContent: "flex-end" }}>
        <Button
          onClick={handleSave}
          disabled={isSaving || questions.length === 0}
          style={{ padding: "0.75rem 2rem", fontSize: "1.1rem" }}
        >
          {isSaving ? "Saving..." : "Save Quiz to Curriculum"}
        </Button>
      </div>
    </div>
  );
}
