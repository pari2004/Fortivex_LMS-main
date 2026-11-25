"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { INSTRUCTOR_ROLES, PROGRAM_COHORT_ADMIN_ROLES } from "@/lib/auth/roles";
import { useAuth } from "@/lib/auth/AuthContext";
import { apiRequest } from "@/lib/api/client";
import { Table } from "@/components/ui/Table";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import AdminQuizEditor from "@/components/curriculum/AdminQuizEditor";
import { Button } from "@/components/ui/Button";

const ALLOWED_ROLES = [...INSTRUCTOR_ROLES, ...PROGRAM_COHORT_ADMIN_ROLES];

interface QuizInfo {
  id: number;
  title: string;
  lesson_id: number;
  lesson_title: string;
  week_title: string;
  module_title: string;
  program_id: number;
  program_name: string;
  question_count: number;
}

export default function InstructorQuizzesPage() {
  const { token } = useAuth();
  const [quizzes, setQuizzes] = useState<QuizInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const fetchQuizzes = useCallback(() => {
    if (!token) return;
    apiRequest<QuizInfo[]>("/api/v1/quizzes", { token })
      .then((data) => setQuizzes(data))
      .catch((err) => setError(err.message || "Failed to load quizzes"));
  }, [token]);

  useEffect(() => {
    fetchQuizzes();
  }, [fetchQuizzes]);

  if (isCreating) {
    return (
      <RequireAuth allowedRoles={ALLOWED_ROLES}>
        <div style={{ padding: "2rem" }}>
          <AdminQuizEditor 
            onSaved={() => { setIsCreating(false); fetchQuizzes(); }}
            onCancel={() => setIsCreating(false)}
          />
        </div>
      </RequireAuth>
    );
  }

  return (
    <RequireAuth allowedRoles={ALLOWED_ROLES}>
      <div style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
          <div>
            <h1 style={{ fontSize: "2rem", fontWeight: 800, margin: 0 }}>Quiz Management</h1>
            <p style={{ color: "var(--color-muted)", marginTop: "0.5rem" }}>Manage all AI-generated quizzes across the organization.</p>
          </div>
          <Button onClick={() => setIsCreating(true)}>
            + Create New Quiz
          </Button>
        </div>

        {error && <ErrorState message={error} />}
        
        {!error && quizzes === null && <LoadingState message="Fetching all quizzes..." />}

        {quizzes !== null && quizzes.length === 0 && (
          <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "16px", padding: "4rem 2rem", textAlign: "center" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "3rem", color: "var(--primary)", marginBottom: "1rem" }}>quiz</span>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.5rem" }}>No Quizzes Found</h2>
            <p style={{ color: "var(--color-muted)" }}>You haven't generated any quizzes yet. Click "Create New Quiz" to get started!</p>
          </div>
        )}

        {quizzes !== null && quizzes.length > 0 && (
          <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "12px", overflow: "hidden" }}>
            <Table
              columns={[
                { key: "title", header: "Quiz Title", render: (row) => <span style={{ fontWeight: 600, color: "var(--primary)" }}>{row.title}</span> },
                { key: "program_name", header: "Program" },
                { key: "location", header: "Location", render: (row) => <span style={{ fontSize: "0.85rem", color: "var(--color-muted)" }}>{row.module_title} &gt; {row.week_title}</span> },
                { key: "question_count", header: "Questions", render: (row) => <span style={{ display: "inline-block", padding: "0.25rem 0.75rem", background: "rgba(0,0,0,0.05)", borderRadius: "12px", fontSize: "0.85rem", fontWeight: 600 }}>{row.question_count} Qs</span> },
                {
                  key: "actions",
                  header: "",
                  render: (row) => (
                    <div style={{ textAlign: "right" }}>
                      <Link href={`/instructor/programs/${row.program_id}`}>
                        <Button variant="secondary" style={{ padding: "0.4rem 0.8rem", fontSize: "0.85rem" }}>
                          Manage in Curriculum
                        </Button>
                      </Link>
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
