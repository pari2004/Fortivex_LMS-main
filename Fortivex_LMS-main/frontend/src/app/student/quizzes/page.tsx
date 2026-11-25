"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { useAuth } from "@/lib/auth/AuthContext";
import { apiRequest } from "@/lib/api/client";
import { Table } from "@/components/ui/Table";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";

interface StudentQuiz {
  id: number;
  title: string;
  lesson_id: number;
  lesson_title: string;
  week_title: string;
  module_title: string;
  program_id: number;
  program_name: string;
  question_count: number;
  score: number | null;
  attempted: boolean;
}

export default function StudentQuizzesPage() {
  const { token } = useAuth();
  const [quizzes, setQuizzes] = useState<StudentQuiz[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    apiRequest<StudentQuiz[]>("/api/v1/progress/my-quizzes", { token })
      .then((data) => setQuizzes(data))
      .catch((err) => setError(err.message || "Failed to load your quizzes"));
  }, [token]);

  return (
    <RequireAuth allowedRoles={["STUDENT"]}>
      <div style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
          <div>
            <h1 style={{ fontSize: "2rem", fontWeight: 800, margin: 0 }}>My Quizzes</h1>
            <p style={{ color: "var(--color-muted)", marginTop: "0.5rem" }}>View your upcoming quizzes, recent attempts, and track your performance.</p>
          </div>
        </div>

        {error && <ErrorState message={error} />}

        {!error && quizzes === null && <LoadingState message="Fetching your quizzes..." />}

        {quizzes !== null && quizzes.length === 0 && (
          <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "16px", padding: "4rem 2rem", textAlign: "center" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "3rem", color: "var(--success)", marginBottom: "1rem" }}>task_alt</span>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.5rem" }}>All Caught Up!</h2>
            <p style={{ color: "var(--color-muted)" }}>You do not have any pending quizzes at this time. When instructors or AI generators assign new quizzes, they will appear here.</p>
          </div>
        )}

        {quizzes !== null && quizzes.length > 0 && (
          <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "12px", overflow: "hidden" }}>
            <Table
              columns={[
                { key: "title", header: "Quiz", render: (row) => <span style={{ fontWeight: 600, color: "var(--primary)" }}>{row.title}</span> },
                { key: "program_name", header: "Program" },
                { key: "location", header: "Location", render: (row) => <span style={{ fontSize: "0.85rem", color: "var(--color-muted)" }}>{row.module_title} &gt; {row.week_title}</span> },
                {
                  key: "status",
                  header: "Status",
                  render: (row) => (
                    row.attempted ? (
                      <span style={{ display: "inline-block", padding: "0.25rem 0.75rem", background: "rgba(16, 185, 129, 0.1)", color: "var(--success)", border: "1px solid rgba(16, 185, 129, 0.2)", borderRadius: "12px", fontSize: "0.85rem", fontWeight: 700 }}>
                        Score: {row.score} / {row.question_count}
                      </span>
                    ) : (
                      <span style={{ display: "inline-block", padding: "0.25rem 0.75rem", background: "rgba(245, 158, 11, 0.1)", color: "var(--warning)", border: "1px solid rgba(245, 158, 11, 0.2)", borderRadius: "12px", fontSize: "0.85rem", fontWeight: 700 }}>
                        Pending
                      </span>
                    )
                  )
                },
                {
                  key: "actions",
                  header: "",
                  render: (row) => (
                    <div style={{ textAlign: "right" }}>
                      {!row.attempted ? (
                        <Link href={`/student/programs/${row.program_id}/activity/${row.id}`}>
                          <Button style={{ padding: "0.4rem 0.8rem", fontSize: "0.85rem" }}>
                            Take Quiz
                          </Button>
                        </Link>
                      ) : (
                        <Link href={`/student/programs/${row.program_id}/activity/${row.id}`}>
                          <Button variant="secondary" style={{ padding: "0.4rem 0.8rem", fontSize: "0.85rem" }}>
                            Retake / Review
                          </Button>
                        </Link>
                      )}
                    </div>
                  )
                }
              ]}
              rows={quizzes}
              getRowKey={(row) => row.id}
              emptyMessage="No quizzes available."
            />
          </div>
        )}
      </div>
    </RequireAuth>
  );
}
