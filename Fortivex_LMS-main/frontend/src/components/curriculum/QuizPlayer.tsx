"use client";

import { useState } from "react";
import { buildApiUrl } from "@/lib/config";


async function parseErrorResponse(res: Response, fallback: string): Promise<string> {
  try {
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const data = await res.json();
      return data.detail || data.message || fallback;
    }
    const text = await res.text();
    const cleanText = text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    return cleanText.slice(0, 200) || res.statusText || fallback;
  } catch {
    return res.statusText || fallback;
  }
}

export interface TestCase {
  input?: string;
  expected_output?: string;
  hidden?: boolean;
}

export interface QuizQuestion {
  type?: "MCQ" | "LONG_ANSWER" | "CODING";
  prompt: string;
  options?: string[];
  correct_index?: number;
  explanation?: string;
  // Long answer / rubric fields
  rubric?: string;
  expected_answer?: string;
  points?: number;
  // Coding fields
  language?: string;
  starter_code?: string;
  reference_solution?: string;
  test_cases?: TestCase[];
}

interface QuizPlayerProps {
  activityId: number;
  title: string;
  questions: QuizQuestion[];
  onComplete?: (score: number, total: number) => void;
}

export default function QuizPlayer({ activityId, title, questions, onComplete }: QuizPlayerProps) {
  // Answers state
  const [mcqAnswers, setMcqAnswers] = useState<Record<string, number>>({});
  const [longAnswers, setLongAnswers] = useState<Record<string, string>>({});
  const [codingAnswers, setCodingAnswers] = useState<Record<string, { code: string; language: string }>>(() => {
    const initial: Record<string, { code: string; language: string }> = {};
    questions.forEach((q, idx) => {
      if (q.type === "CODING") {
        initial[idx.toString()] = {
          code: q.starter_code || (q.language === "javascript" ? "// Write your JavaScript solution here\nfunction solution() {\n  \n}\n" : "# Write your Python solution here\ndef solution():\n    pass\n"),
          language: q.language || "python",
        };
      }
    });
    return initial;
  });

  // Code execution state per question
  const [runningCode, setRunningCode] = useState<Record<number, boolean>>({});
  const [codeOutputs, setCodeOutputs] = useState<Record<number, any>>({});
  const [customStdin, setCustomStdin] = useState<Record<number, string>>({});
  const [showStdin, setShowStdin] = useState<Record<number, boolean>>({});
  const [testingCode, setTestingCode] = useState<Record<number, boolean>>({});
  const [testResults, setTestResults] = useState<Record<number, any>>({});

  // Submission state
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [score, setScore] = useState(0);
  const [totalPossible, setTotalPossible] = useState(questions.length);
  const [evaluations, setEvaluations] = useState<Record<string, any>>({});

  const handleSelectMCQ = (qIndex: number, oIndex: number) => {
    if (submitted) return;
    setMcqAnswers(prev => ({ ...prev, [qIndex.toString()]: oIndex }));
  };

  const handleLongAnswerChange = (qIndex: number, text: string) => {
    if (submitted) return;
    setLongAnswers(prev => ({ ...prev, [qIndex.toString()]: text }));
  };

  const handleCodeChange = (qIndex: number, code: string) => {
    if (submitted) return;
    const current = codingAnswers[qIndex.toString()] || { code: "", language: questions[qIndex].language || "python" };
    setCodingAnswers(prev => ({ ...prev, [qIndex.toString()]: { ...current, code } }));
  };

  const handleLanguageChange = (qIndex: number, language: string) => {
    if (submitted) return;
    const current = codingAnswers[qIndex.toString()] || { code: "", language };
    setCodingAnswers(prev => ({ ...prev, [qIndex.toString()]: { ...current, language } }));
  };

  const handleRunCode = async (qIndex: number) => {
    const current = codingAnswers[qIndex.toString()] || {
      code: questions[qIndex].starter_code || "",
      language: questions[qIndex].language || "python",
    };

    setRunningCode(prev => ({ ...prev, [qIndex]: true }));
    try {
      const token = localStorage.getItem("fortivex_access_token");
      const res = await fetch(buildApiUrl("/api/v1/code/execute"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          source_code: current.code,
          language: current.language,
          stdin: customStdin[qIndex] || "",
        }),
      });

      if (!res.ok) {
        const errDetail = await parseErrorResponse(res, "Sandbox execution failed");
        throw new Error(errDetail);
      }
      const data = await res.json();
      setCodeOutputs(prev => ({ ...prev, [qIndex]: data }));
    } catch (err: any) {
      setCodeOutputs(prev => ({
        ...prev,
        [qIndex]: { stderr: err.message || "Failed to execute code in sandbox", success: false },
      }));
    } finally {
      setRunningCode(prev => ({ ...prev, [qIndex]: false }));
    }
  };

  const handleRunTests = async (qIndex: number, testCases: TestCase[]) => {
    const current = codingAnswers[qIndex.toString()] || {
      code: questions[qIndex].starter_code || "",
      language: questions[qIndex].language || "python",
    };

    setTestingCode(prev => ({ ...prev, [qIndex]: true }));
    try {
      const token = localStorage.getItem("fortivex_access_token");
      const res = await fetch(buildApiUrl("/api/v1/code/test"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          source_code: current.code,
          language: current.language,
          test_cases: testCases,
        }),
      });

      if (!res.ok) {
        const errDetail = await parseErrorResponse(res, "Sandbox test suite execution failed");
        throw new Error(errDetail);
      }
      const data = await res.json();
      setTestResults(prev => ({ ...prev, [qIndex]: data }));
    } catch (err: any) {
      alert("Test cases execution failed: " + err.message);
    } finally {
      setTestingCode(prev => ({ ...prev, [qIndex]: false }));
    }
  };

  const handleSubmit = async () => {
    // Validate that questions have some input
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const type = q.type || "MCQ";
      const key = i.toString();

      if (type === "MCQ" && mcqAnswers[key] === undefined) {
        alert(`Please answer Question ${i + 1} before submitting.`);
        return;
      }
      if (type === "LONG_ANSWER" && (!longAnswers[key] || !longAnswers[key].trim())) {
        alert(`Please write a response for Question ${i + 1} before submitting.`);
        return;
      }
      if (type === "CODING" && (!codingAnswers[key]?.code || !codingAnswers[key].code.trim())) {
        alert(`Please write your code for Question ${i + 1} before submitting.`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const formattedAnswers: Record<string, any> = {};
      questions.forEach((q, idx) => {
        const key = idx.toString();
        const type = q.type || "MCQ";
        if (type === "MCQ") {
          formattedAnswers[key] = mcqAnswers[key];
        } else if (type === "LONG_ANSWER") {
          formattedAnswers[key] = { text: longAnswers[key] || "" };
        } else if (type === "CODING") {
          formattedAnswers[key] = {
            code: codingAnswers[key]?.code || "",
            language: codingAnswers[key]?.language || q.language || "python",
          };
        }
      });

      const token = localStorage.getItem("fortivex_access_token");
      const res = await fetch(buildApiUrl(`/api/v1/progress/${activityId}/submit-quiz`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ answers: formattedAnswers }),
      });

      if (!res.ok) {
        const errDetail = await parseErrorResponse(res, "Failed to submit quiz");
        throw new Error(errDetail);
      }

      const data = await res.json();
      setScore(data.score);
      setTotalPossible(data.total_questions || questions.length);
      setEvaluations(data.evaluations || {});
      setSubmitted(true);
      onComplete?.(data.score, data.total_questions || questions.length);
    } catch (error: any) {
      console.error(error);
      alert("Error submitting quiz: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{
      width: "100%",
      maxWidth: "920px",
      margin: "0 auto",
      padding: "2.5rem",
      background: "var(--color-surface)",
      borderRadius: "24px",
      border: "1px solid var(--color-border)",
      boxShadow: "0 12px 40px rgba(0,0,0,0.06)",
    }}>
      {/* Quiz Header */}
      <div style={{ marginBottom: "2.5rem", borderBottom: "1px solid var(--color-border)", paddingBottom: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
          <div>
            <h2 style={{ fontSize: "2rem", fontWeight: 800, margin: "0 0 0.5rem 0", background: "var(--primary-gradient)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              {title}
            </h2>
            <p style={{ color: "var(--color-muted)", fontSize: "0.95rem", fontWeight: 500, margin: 0 }}>
              {questions.length} Question{questions.length !== 1 ? "s" : ""} • Includes MCQ, Long Form & Coding Challenges
            </p>
          </div>
          {submitted && (
            <div style={{ display: "flex", alignItems: "center", gap: "1rem", background: "rgba(79, 70, 229, 0.08)", padding: "0.75rem 1.5rem", borderRadius: "16px", border: "1px solid rgba(79, 70, 229, 0.2)" }}>
              <div>
                <div style={{ fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 700, color: "var(--color-muted)" }}>Total Score</div>
                <div style={{ fontSize: "1.75rem", fontWeight: 900, color: "var(--primary)" }}>
                  {score} <span style={{ fontSize: "1rem", color: "var(--color-muted)" }}>/ {totalPossible} pts</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Question List */}
      <div style={{ display: "flex", flexDirection: "column", gap: "3rem" }}>
        {questions.map((q, qIdx) => {
          const qType = (q.type || "MCQ").toUpperCase();
          const evaluation = evaluations[qIdx.toString()];

          return (
            <div key={qIdx} style={{
              display: "flex",
              flexDirection: "column",
              gap: "1.25rem",
              padding: "1.75rem",
              borderRadius: "18px",
              background: "rgba(255, 255, 255, 0.6)",
              border: "1px solid var(--color-border)",
              boxShadow: "0 4px 16px rgba(0,0,0,0.02)"
            }}>
              {/* Question Header & Type Tag */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
                <h3 style={{ fontSize: "1.15rem", fontWeight: 600, color: "var(--foreground)", display: "flex", alignItems: "flex-start", gap: "0.85rem", margin: 0, lineHeight: 1.5, flex: 1 }}>
                  <span style={{
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "32px",
                    height: "32px",
                    borderRadius: "50%",
                    background: "rgba(79, 70, 229, 0.1)",
                    color: "var(--primary)",
                    fontWeight: 700,
                    fontSize: "0.9rem",
                    marginTop: "2px"
                  }}>
                    {qIdx + 1}
                  </span>
                  {q.prompt}
                </h3>

                <span style={{
                  padding: "0.3rem 0.75rem",
                  borderRadius: "20px",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  letterSpacing: "0.5px",
                  textTransform: "uppercase",
                  background: qType === "CODING" ? "rgba(14, 165, 233, 0.12)" : qType === "LONG_ANSWER" ? "rgba(245, 158, 11, 0.12)" : "rgba(79, 70, 229, 0.1)",
                  color: qType === "CODING" ? "#0284c7" : qType === "LONG_ANSWER" ? "#b45309" : "var(--primary)",
                  border: `1px solid ${qType === "CODING" ? "rgba(14, 165, 233, 0.25)" : qType === "LONG_ANSWER" ? "rgba(245, 158, 11, 0.25)" : "rgba(79, 70, 229, 0.2)"}`,
                }}>
                  {qType === "CODING" ? "Coding Sandbox" : qType === "LONG_ANSWER" ? "Long Answer" : "Multiple Choice"}
                </span>
              </div>

              {/* ---------------- QUESTION TYPE: MCQ ---------------- */}
              {qType === "MCQ" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "0.75rem", paddingLeft: "2.75rem" }}>
                  {(q.options || []).map((opt, oIdx) => {
                    const selectedIdx = mcqAnswers[qIdx.toString()];
                    let btnBg = "var(--color-surface)";
                    let btnBorder = "var(--color-border)";
                    let btnColor = "var(--foreground)";
                    let checkBorder = "var(--color-border)";
                    let checkBg = "transparent";

                    if (selectedIdx === oIdx) {
                      btnBg = "rgba(79, 70, 229, 0.05)";
                      btnBorder = "var(--primary)";
                      btnColor = "var(--primary)";
                      checkBorder = "var(--primary)";
                      checkBg = "var(--primary)";
                    }

                    if (submitted) {
                      if (oIdx === q.correct_index) {
                        btnBg = "rgba(16, 185, 129, 0.1)";
                        btnBorder = "var(--success)";
                        btnColor = "var(--success)";
                        checkBorder = "var(--success)";
                        checkBg = "var(--success)";
                      } else if (selectedIdx === oIdx) {
                        btnBg = "rgba(239, 68, 68, 0.1)";
                        btnBorder = "var(--danger)";
                        btnColor = "var(--danger)";
                        checkBorder = "var(--danger)";
                        checkBg = "var(--danger)";
                      }
                    }

                    return (
                      <button
                        key={oIdx}
                        onClick={() => handleSelectMCQ(qIdx, oIdx)}
                        disabled={submitted}
                        style={{
                          position: "relative",
                          padding: "0.9rem 1.25rem",
                          borderRadius: "12px",
                          border: `1px solid ${btnBorder}`,
                          background: btnBg,
                          color: btnColor,
                          textAlign: "left",
                          cursor: submitted ? "default" : "pointer",
                          transition: "all 0.2s",
                          opacity: (submitted && oIdx !== q.correct_index && selectedIdx !== oIdx) ? 0.5 : 1,
                          display: "flex",
                          alignItems: "center",
                          gap: "1rem",
                        }}
                      >
                        <div style={{ width: "20px", height: "20px", borderRadius: "50%", border: `2px solid ${checkBorder}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          {(selectedIdx === oIdx || (submitted && oIdx === q.correct_index)) && (
                            <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: checkBg }} />
                          )}
                        </div>
                        <span style={{ fontWeight: 500, fontSize: "0.95rem" }}>{opt}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* ---------------- QUESTION TYPE: LONG_ANSWER ---------------- */}
              {qType === "LONG_ANSWER" && (
                <div style={{ paddingLeft: "2.75rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  <textarea
                    value={longAnswers[qIdx.toString()] || ""}
                    onChange={e => handleLongAnswerChange(qIdx, e.target.value)}
                    disabled={submitted}
                    rows={6}
                    placeholder="Type your detailed, comprehensive answer here..."
                    style={{
                      width: "100%",
                      padding: "1rem",
                      borderRadius: "12px",
                      border: "1px solid var(--color-border)",
                      background: submitted ? "rgba(0,0,0,0.02)" : "var(--color-surface)",
                      fontSize: "0.95rem",
                      lineHeight: 1.6,
                      color: "var(--foreground)",
                      resize: "vertical",
                      outline: "none",
                      fontFamily: "inherit",
                    }}
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", color: "var(--color-muted)" }}>
                    <span>AI will review clarity, depth, and conceptual precision.</span>
                    <span>{(longAnswers[qIdx.toString()] || "").trim().split(/\s+/).filter(Boolean).length} words</span>
                  </div>
                </div>
              )}

              {/* ---------------- QUESTION TYPE: CODING (SANDBOX WITH JUDGE0) ---------------- */}
              {qType === "CODING" && (
                <div style={{ paddingLeft: "2.75rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
                  {/* Language Bar & Controls */}
                  <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background: "#1e1e2e",
                    padding: "0.5rem 1rem",
                    borderTopLeftRadius: "12px",
                    borderTopRightRadius: "12px",
                    borderBottom: "1px solid #313244",
                    flexWrap: "wrap",
                    gap: "0.5rem"
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <span className="material-symbols-outlined" style={{ color: "#89b4fa", fontSize: "18px" }}>terminal</span>
                      <select
                        value={codingAnswers[qIdx.toString()]?.language || q.language || "python"}
                        onChange={e => handleLanguageChange(qIdx, e.target.value)}
                        disabled={submitted}
                        style={{
                          background: "#313244",
                          color: "#cdd6f4",
                          border: "none",
                          borderRadius: "6px",
                          padding: "0.3rem 0.75rem",
                          fontSize: "0.85rem",
                          fontWeight: 600,
                          cursor: "pointer",
                          outline: "none",
                        }}
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

                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <button
                        type="button"
                        onClick={() => setShowStdin(prev => ({ ...prev, [qIdx]: !prev[qIdx] }))}
                        style={{
                          background: showStdin[qIdx] ? "#45475a" : "transparent",
                          color: "#a6adc8",
                          border: "1px solid #45475a",
                          borderRadius: "6px",
                          padding: "0.3rem 0.6rem",
                          fontSize: "0.8rem",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.25rem",
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>input</span>
                        Input
                      </button>

                      {q.test_cases && q.test_cases.length > 0 && (
                        <button
                          type="button"
                          onClick={() => handleRunTests(qIdx, q.test_cases || [])}
                          disabled={testingCode[qIdx] || runningCode[qIdx]}
                          style={{
                            background: "#89b4fa",
                            color: "#11111b",
                            border: "none",
                            borderRadius: "6px",
                            padding: "0.35rem 0.85rem",
                            fontSize: "0.82rem",
                            fontWeight: 700,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "0.35rem",
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>fact_check</span>
                          {testingCode[qIdx] ? "Testing..." : `Run Tests (${q.test_cases.length})`}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleRunCode(qIdx)}
                        disabled={runningCode[qIdx] || testingCode[qIdx]}
                        style={{
                          background: "#a6e3a1",
                          color: "#11111b",
                          border: "none",
                          borderRadius: "6px",
                          padding: "0.35rem 0.85rem",
                          fontSize: "0.82rem",
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.35rem",
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>play_arrow</span>
                        {runningCode[qIdx] ? "Running..." : "Run Code"}
                      </button>
                    </div>
                  </div>

                  {/* Custom Stdin Box */}
                  {showStdin[qIdx] && (
                    <div style={{ background: "#181825", padding: "0.75rem 1rem", borderLeft: "1px solid #313244", borderRight: "1px solid #313244" }}>
                      <label style={{ color: "#a6adc8", fontSize: "0.75rem", display: "block", marginBottom: "0.25rem" }}>Custom Input (stdin):</label>
                      <input
                        type="text"
                        value={customStdin[qIdx] || ""}
                        onChange={e => setCustomStdin(prev => ({ ...prev, [qIdx]: e.target.value }))}
                        placeholder="Enter standard input for your program..."
                        style={{
                          width: "100%",
                          background: "#11111b",
                          border: "1px solid #45475a",
                          color: "#cdd6f4",
                          padding: "0.4rem 0.6rem",
                          borderRadius: "6px",
                          fontSize: "0.85rem",
                          fontFamily: "monospace",
                          outline: "none"
                        }}
                      />
                    </div>
                  )}

                  {/* Code Editor Area */}
                  <textarea
                    value={codingAnswers[qIdx.toString()]?.code ?? ""}
                    onChange={e => handleCodeChange(qIdx, e.target.value)}
                    disabled={submitted}
                    rows={12}
                    onKeyDown={e => {
                      if (e.key === "Tab") {
                        e.preventDefault();
                        const target = e.currentTarget;
                        const start = target.selectionStart;
                        const end = target.selectionEnd;
                        const val = target.value;
                        target.value = val.substring(0, start) + "    " + val.substring(end);
                        target.selectionStart = target.selectionEnd = start + 4;
                        handleCodeChange(qIdx, target.value);
                      }
                    }}
                    style={{
                      width: "100%",
                      background: "#11111b",
                      color: "#cdd6f4",
                      fontFamily: "'Fira Code', 'Courier New', monospace",
                      fontSize: "0.9rem",
                      lineHeight: 1.5,
                      padding: "1rem",
                      border: "1px solid #313244",
                      borderTop: "none",
                      borderBottomLeftRadius: (codeOutputs[qIdx] || testResults[qIdx]) ? "0px" : "12px",
                      borderBottomRightRadius: (codeOutputs[qIdx] || testResults[qIdx]) ? "0px" : "12px",
                      resize: "vertical",
                      outline: "none",
                      tabSize: 4,
                    }}
                  />

                  {/* Live Terminal / Judge0 Execution Output Drawer */}
                  {codeOutputs[qIdx] && (
                    <div style={{
                      background: "#181825",
                      border: "1px solid #313244",
                      borderTop: "none",
                      borderBottomLeftRadius: "12px",
                      borderBottomRightRadius: "12px",
                      padding: "1rem",
                      fontFamily: "'Fira Code', monospace",
                      fontSize: "0.85rem",
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <span style={{
                            padding: "0.2rem 0.5rem",
                            borderRadius: "4px",
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            background: codeOutputs[qIdx].success ? "rgba(166, 227, 161, 0.2)" : "rgba(243, 139, 168, 0.2)",
                            color: codeOutputs[qIdx].success ? "#a6e3a1" : "#f38ba8",
                          }}>
                            {codeOutputs[qIdx].status?.description || (codeOutputs[qIdx].success ? "Accepted" : "Runtime Error")}
                          </span>
                          <span style={{ color: "#6c7086", fontSize: "0.75rem" }}>
                            Time: {codeOutputs[qIdx].time}s • Memory: {codeOutputs[qIdx].memory} KB
                          </span>
                        </div>
                        <button
                          onClick={() => setCodeOutputs(prev => ({ ...prev, [qIdx]: null }))}
                          style={{ background: "none", border: "none", color: "#6c7086", cursor: "pointer", fontSize: "0.75rem" }}
                        >
                          Clear
                        </button>
                      </div>

                      {codeOutputs[qIdx].stdout && (
                        <div style={{ marginBottom: "0.5rem" }}>
                          <div style={{ color: "#a6adc8", fontSize: "0.75rem", marginBottom: "0.2rem" }}>STDOUT:</div>
                          <pre style={{ margin: 0, color: "#a6e3a1", whiteSpace: "pre-wrap" }}>{codeOutputs[qIdx].stdout}</pre>
                        </div>
                      )}

                      {codeOutputs[qIdx].stderr && (
                        <div>
                          <div style={{ color: "#f38ba8", fontSize: "0.75rem", marginBottom: "0.2rem" }}>STDERR:</div>
                          <pre style={{ margin: 0, color: "#f38ba8", whiteSpace: "pre-wrap" }}>{codeOutputs[qIdx].stderr}</pre>
                        </div>
                      )}

                      {codeOutputs[qIdx].compile_output && (
                        <div>
                          <div style={{ color: "#fab387", fontSize: "0.75rem", marginBottom: "0.2rem" }}>COMPILATION:</div>
                          <pre style={{ margin: 0, color: "#fab387", whiteSpace: "pre-wrap" }}>{codeOutputs[qIdx].compile_output}</pre>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Test Cases Results Drawer */}
                  {testResults[qIdx] && (
                    <div style={{
                      background: "#181825",
                      border: "1px solid #313244",
                      borderRadius: "12px",
                      padding: "1rem",
                      fontSize: "0.85rem",
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                        <span style={{ color: "#cdd6f4", fontWeight: 700 }}>
                          Test Results: {testResults[qIdx].passed_tests} / {testResults[qIdx].total_tests} Passed
                        </span>
                        <span style={{
                          padding: "0.2rem 0.5rem",
                          borderRadius: "4px",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          background: testResults[qIdx].all_passed ? "rgba(166, 227, 161, 0.2)" : "rgba(243, 139, 168, 0.2)",
                          color: testResults[qIdx].all_passed ? "#a6e3a1" : "#f38ba8",
                        }}>
                          {testResults[qIdx].all_passed ? "All Tests Passed" : "Some Tests Failed"}
                        </span>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                        {(testResults[qIdx].results || []).map((tr: any, tIdx: number) => (
                          <div key={tIdx} style={{
                            padding: "0.5rem 0.75rem",
                            borderRadius: "8px",
                            background: tr.passed ? "rgba(166, 227, 161, 0.08)" : "rgba(243, 139, 168, 0.08)",
                            border: `1px solid ${tr.passed ? "rgba(166, 227, 161, 0.2)" : "rgba(243, 139, 168, 0.2)"}`,
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}>
                            <div>
                              <span style={{ fontWeight: 600, color: tr.passed ? "#a6e3a1" : "#f38ba8", marginRight: "0.5rem" }}>
                                {tr.passed ? "✓ Test " + tr.test_case : "✗ Test " + tr.test_case}
                              </span>
                              <span style={{ color: "#a6adc8", fontSize: "0.8rem" }}>
                                Expected: "{tr.expected_output}" | Got: "{tr.actual_output}"
                              </span>
                            </div>
                            <span style={{ color: "#6c7086", fontSize: "0.75rem" }}>{tr.time}s</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ---------------- POST-SUBMISSION RESULTS & AI EVALUATION REVIEW ---------------- */}
              {submitted && (
                <div style={{ paddingLeft: "2.75rem", marginTop: "0.5rem" }}>
                  {qType === "MCQ" && (
                    <div style={{
                      padding: "1rem 1.25rem",
                      borderRadius: "12px",
                      background: evaluation?.is_correct ? "rgba(16, 185, 129, 0.08)" : "rgba(239, 68, 68, 0.08)",
                      border: `1px solid ${evaluation?.is_correct ? "rgba(16, 185, 129, 0.25)" : "rgba(239, 68, 68, 0.25)"}`,
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.35rem" }}>
                        <span style={{ fontSize: "0.95rem", fontWeight: 700, color: evaluation?.is_correct ? "var(--success)" : "var(--danger)" }}>
                          {evaluation?.is_correct ? "✓ Correct Answer" : "✗ Incorrect"}
                        </span>
                        <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--color-muted)" }}>
                          {evaluation?.score || 0} / {evaluation?.max_score || 1} pt
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--foreground)", lineHeight: 1.5 }}>
                        {q.explanation}
                      </p>
                    </div>
                  )}

                  {qType === "LONG_ANSWER" && (
                    <div style={{
                      padding: "1.25rem",
                      borderRadius: "14px",
                      background: "rgba(79, 70, 229, 0.04)",
                      border: "1px solid rgba(79, 70, 229, 0.2)",
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <span className="material-symbols-outlined" style={{ color: "var(--primary)", fontSize: "20px" }}>psychology</span>
                          <span style={{ fontSize: "1rem", fontWeight: 700, color: "var(--foreground)" }}>AI Evaluation</span>
                          <span style={{
                            padding: "0.2rem 0.5rem",
                            borderRadius: "12px",
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            background: evaluation?.passed ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)",
                            color: evaluation?.passed ? "var(--success)" : "var(--warning)",
                          }}>
                            {evaluation?.passed ? "Proficient" : "Needs Review"}
                          </span>
                        </div>
                        <span style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--primary)" }}>
                          {evaluation?.score ?? 0} / {evaluation?.max_score ?? 10} pts
                        </span>
                      </div>

                      <p style={{ fontSize: "0.95rem", color: "var(--foreground)", lineHeight: 1.6, marginBottom: "0.75rem" }}>
                        {evaluation?.feedback || "Evaluation complete."}
                      </p>

                      {evaluation?.strengths && evaluation.strengths.length > 0 && (
                        <div style={{ marginBottom: "0.5rem" }}>
                          <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--success)", textTransform: "uppercase" }}>Strengths:</span>
                          <ul style={{ margin: "0.25rem 0 0 1.25rem", padding: 0, fontSize: "0.85rem", color: "var(--foreground)" }}>
                            {evaluation.strengths.map((str: string, sIdx: number) => <li key={sIdx}>{str}</li>)}
                          </ul>
                        </div>
                      )}

                      {evaluation?.areas_for_improvement && evaluation.areas_for_improvement.length > 0 && (
                        <div>
                          <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--warning)", textTransform: "uppercase" }}>Key Suggestions:</span>
                          <ul style={{ margin: "0.25rem 0 0 1.25rem", padding: 0, fontSize: "0.85rem", color: "var(--foreground)" }}>
                            {evaluation.areas_for_improvement.map((imp: string, iIdx: number) => <li key={iIdx}>{imp}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {qType === "CODING" && (
                    <div style={{
                      padding: "1.25rem",
                      borderRadius: "14px",
                      background: "rgba(14, 165, 233, 0.05)",
                      border: "1px solid rgba(14, 165, 233, 0.25)",
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <span className="material-symbols-outlined" style={{ color: "#0284c7", fontSize: "20px" }}>code_blocks</span>
                          <span style={{ fontSize: "1rem", fontWeight: 700, color: "var(--foreground)" }}>AI Code Review & Sandbox Result</span>
                          <span style={{
                            padding: "0.2rem 0.5rem",
                            borderRadius: "12px",
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            background: evaluation?.passed ? "rgba(16, 185, 129, 0.15)" : "rgba(243, 139, 168, 0.15)",
                            color: evaluation?.passed ? "var(--success)" : "var(--danger)",
                          }}>
                            {evaluation?.passed ? "Passed" : "Needs Work"}
                          </span>
                        </div>
                        <span style={{ fontSize: "1.1rem", fontWeight: 800, color: "#0284c7" }}>
                          {evaluation?.score ?? 0} / {evaluation?.max_score ?? 10} pts
                        </span>
                      </div>

                      <p style={{ fontSize: "0.95rem", color: "var(--foreground)", lineHeight: 1.6, marginBottom: "0.75rem" }}>
                        {evaluation?.feedback || "Code reviewed."}
                      </p>

                      {evaluation?.test_summary && (
                        <div style={{ fontSize: "0.85rem", color: "var(--color-muted)", marginBottom: "0.5rem", fontWeight: 600 }}>
                          Sandbox: {evaluation.test_summary}
                        </div>
                      )}

                      {evaluation?.suggestions && evaluation.suggestions.length > 0 && (
                        <div>
                          <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#0284c7", textTransform: "uppercase" }}>Code Quality & Efficiency Recommendations:</span>
                          <ul style={{ margin: "0.25rem 0 0 1.25rem", padding: 0, fontSize: "0.85rem", color: "var(--foreground)" }}>
                            {evaluation.suggestions.map((sug: string, sIdx: number) => <li key={sIdx}>{sug}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer Submit Action & Score */}
      <div style={{
        marginTop: "3rem",
        paddingTop: "2rem",
        borderTop: "1px solid var(--color-border)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "1.5rem"
      }}>
        {submitted ? (
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "2rem", color: "var(--success)" }}>verified</span>
            <div>
              <div style={{ fontWeight: 700, color: "var(--foreground)", fontSize: "1.05rem" }}>Quiz Complete!</div>
              <div style={{ fontSize: "0.9rem", color: "var(--color-muted)" }}>
                You scored {score} out of {totalPossible} points ({Math.round((score / totalPossible) * 100)}%)
              </div>
            </div>
          </div>
        ) : (
          <div style={{ color: "var(--color-muted)", fontSize: "0.9rem" }}>
            * Long-form responses & coding sandbox solutions will be verified with automated AI evaluation.
          </div>
        )}

        {!submitted && (
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            style={{
              padding: "1rem 2.5rem",
              background: "var(--primary-gradient)",
              color: "white",
              fontWeight: 700,
              borderRadius: "14px",
              border: "none",
              cursor: isSubmitting ? "not-allowed" : "pointer",
              transition: "all 0.2s",
              opacity: isSubmitting ? 0.8 : 1,
              boxShadow: "0 8px 24px rgba(79, 70, 229, 0.3)",
              fontSize: "1.05rem",
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
            }}
          >
            {isSubmitting ? (
              <>
                <span className="material-symbols-outlined" style={{ animation: "spin 1s linear infinite" }}>sync</span>
                AI Evaluating Responses...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined">send</span>
                Submit Quiz
              </>
            )}
          </button>
        )}
      </div>

      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
