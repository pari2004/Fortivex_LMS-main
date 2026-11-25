"use client";

import { useEffect, useState, useCallback } from "react";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  getAllAssignments,
  createAssignment,
  deleteAssignment,
  getAssignmentSubmissions,
  gradeSubmission,
  listPrograms,
} from "@/lib/api/endpoints";
import type {
  AssignmentItem,
  AssignmentCreatePayload,
  AssignmentSubmissionItem,
  Program,
  RubricItem,
} from "@/lib/api/types";
import { config } from "@/lib/config";

interface AssignmentManagementViewProps {
  allowedRoles: string[];
  roleTitle?: string;
}

export default function AssignmentManagementView({
  allowedRoles,
  roleTitle = "Admin & Academic Staff",
}: AssignmentManagementViewProps) {
  const { token, user } = useAuth();
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedProgramFilter, setSelectedProgramFilter] = useState<number | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Create Assignment Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newProgramId, setNewProgramId] = useState<number | null>(null);
  const [newDescription, setNewDescription] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newPoints, setNewPoints] = useState(100);
  const [newRubric, setNewRubric] = useState<RubricItem[]>([
    { criterion: "Implementation & Correctness", weight: "50%" },
    { criterion: "Code Quality & Documentation", weight: "30%" },
    { criterion: "Analysis & Report", weight: "20%" },
  ]);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Submissions Modal State
  const [activeAssignmentForSubmissions, setActiveAssignmentForSubmissions] = useState<AssignmentItem | null>(null);
  const [submissionsList, setSubmissionsList] = useState<AssignmentSubmissionItem[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [gradingState, setGradingState] = useState<{
    [submissionId: number]: { score: number; feedback: string; saving?: boolean; saved?: boolean };
  }>({});

  const loadData = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError(null);
      const [asgs, progs] = await Promise.all([
        getAllAssignments(token),
        listPrograms(token).catch(() => []),
      ]);
      setAssignments(asgs);
      setPrograms(progs);
      if (progs.length > 0 && newProgramId === null) {
        setNewProgramId(progs[0].id);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load assignments");
    } finally {
      setLoading(false);
    }
  }, [token, newProgramId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Open Submissions modal & load submissions
  async function handleOpenSubmissions(assignment: AssignmentItem) {
    setActiveAssignmentForSubmissions(assignment);
    if (!token) return;
    try {
      setLoadingSubmissions(true);
      const subs = await getAssignmentSubmissions(token, assignment.id);
      setSubmissionsList(subs);

      // Initialize grading state
      const initialGradeMap: typeof gradingState = {};
      subs.forEach((s) => {
        initialGradeMap[s.id] = {
          score: s.score !== null && s.score !== undefined ? s.score : assignment.points,
          feedback: s.feedback || "",
        };
      });
      setGradingState(initialGradeMap);
    } catch (err: any) {
      alert(err?.message || "Failed to load student submissions");
    } finally {
      setLoadingSubmissions(false);
    }
  }

  // Handle grade submission
  async function handleSaveGrade(submissionId: number) {
    if (!token) return;
    const currentGrade = gradingState[submissionId];
    if (!currentGrade) return;

    try {
      setGradingState((prev) => ({
        ...prev,
        [submissionId]: { ...prev[submissionId], saving: true },
      }));

      await gradeSubmission(token, submissionId, {
        score: Number(currentGrade.score),
        feedback: currentGrade.feedback.trim() || undefined,
      });

      // Update local submissions list
      setSubmissionsList((prev) =>
        prev.map((s) =>
          s.id === submissionId
            ? {
                ...s,
                status: "GRADED",
                score: Number(currentGrade.score),
                feedback: currentGrade.feedback.trim(),
                graded_by_name: user?.full_name,
                graded_at: "Just now",
              }
            : s
        )
      );

      setGradingState((prev) => ({
        ...prev,
        [submissionId]: { ...prev[submissionId], saving: false, saved: true },
      }));

      // Refresh assignments to update graded/pending counters
      const updatedAsgs = await getAllAssignments(token);
      setAssignments(updatedAsgs);

      setTimeout(() => {
        setGradingState((prev) => ({
          ...prev,
          [submissionId]: { ...prev[submissionId], saved: false },
        }));
      }, 2000);
    } catch (err: any) {
      alert(err?.message || "Failed to save grade");
      setGradingState((prev) => ({
        ...prev,
        [submissionId]: { ...prev[submissionId], saving: false },
      }));
    }
  }

  // Create Assignment
  async function handleCreateAssignment(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    if (!newProgramId) {
      setCreateError("Please select a program.");
      return;
    }
    if (!newTitle.trim()) {
      setCreateError("Assignment title is required.");
      return;
    }
    if (!newDescription.trim()) {
      setCreateError("Assignment description is required.");
      return;
    }

    try {
      setCreateSubmitting(true);
      setCreateError(null);

      const payload: AssignmentCreatePayload = {
        title: newTitle.trim(),
        program_id: newProgramId,
        description: newDescription.trim(),
        due_date: newDueDate || undefined,
        points: Number(newPoints) || 100,
        rubric: newRubric.filter((r) => r.criterion.trim().length > 0),
        submission_type: "file",
      };

      await createAssignment(token, payload);
      setIsCreateOpen(false);
      setNewTitle("");
      setNewDescription("");
      setNewDueDate("");
      setNewPoints(100);
      await loadData();
    } catch (err: any) {
      setCreateError(err?.message || "Failed to create assignment");
    } finally {
      setCreateSubmitting(false);
    }
  }

  // Delete Assignment
  async function handleDeleteAssignment(activityId: number, title: string) {
    if (!token) return;
    if (!confirm(`Are you sure you want to delete assignment "${title}"? This cannot be undone.`)) {
      return;
    }
    try {
      await deleteAssignment(token, activityId);
      setAssignments((prev) => prev.filter((a) => a.id !== activityId));
    } catch (err: any) {
      alert(err?.message || "Failed to delete assignment");
    }
  }

  // Filtered list
  const filteredAssignments = assignments.filter((item) => {
    if (selectedProgramFilter !== "all" && item.program_id !== selectedProgramFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        item.title.toLowerCase().includes(q) ||
        item.program_name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalAssignmentsCount = assignments.length;
  const totalSubmissionsCount = assignments.reduce((acc, curr) => acc + curr.submissions_count, 0);
  const pendingSubmissionsCount = assignments.reduce((acc, curr) => acc + curr.pending_count, 0);
  const gradedSubmissionsCount = assignments.reduce((acc, curr) => acc + curr.graded_count, 0);

  return (
    <RequireAuth allowedRoles={allowedRoles}>
      <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "1.5rem 0", animation: "fadeIn 0.3s ease-out" }}>
        {/* Top Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: "2rem",
            flexWrap: "wrap",
            gap: "1rem",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
              <span className="badge-pill badge-primary" style={{ fontSize: "0.75rem", textTransform: "uppercase" }}>
                {roleTitle}
              </span>
            </div>
            <h1 style={{ fontSize: "2rem", fontWeight: 800, color: "var(--text-main)", letterSpacing: "-0.02em" }}>
              Assignments & Assessments Management
            </h1>
            <p style={{ color: "var(--text-muted)", fontSize: "0.95rem", marginTop: "0.25rem" }}>
              Assign coursework to enrolled programs, review student submissions, and grade with rubrics.
            </p>
          </div>

          <button
            onClick={() => {
              setIsCreateOpen(true);
              setCreateError(null);
            }}
            className="btn-primary"
            style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
          >
            <span className="material-symbols-outlined">add_task</span>
            Assign New Assignment
          </button>
        </div>

        {/* KPI Summary Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "1rem",
            marginBottom: "2rem",
          }}
        >
          <div
            style={{
              background: "#ffffff",
              border: "1px solid var(--border)",
              borderRadius: "16px",
              padding: "1.25rem 1.5rem",
              boxShadow: "var(--shadow-xs)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--primary)" }}>
              <span className="material-symbols-outlined">assignment</span>
              <span style={{ fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-dim)" }}>
                Total Assignments
              </span>
            </div>
            <div style={{ fontSize: "1.8rem", fontWeight: 800, marginTop: "0.4rem", color: "var(--text-main)" }}>
              {totalAssignmentsCount}
            </div>
          </div>

          <div
            style={{
              background: "#ffffff",
              border: "1px solid var(--border)",
              borderRadius: "16px",
              padding: "1.25rem 1.5rem",
              boxShadow: "var(--shadow-xs)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#6366f1" }}>
              <span className="material-symbols-outlined">folder_shared</span>
              <span style={{ fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-dim)" }}>
                Total Submissions
              </span>
            </div>
            <div style={{ fontSize: "1.8rem", fontWeight: 800, marginTop: "0.4rem", color: "var(--text-main)" }}>
              {totalSubmissionsCount}
            </div>
          </div>

          <div
            style={{
              background: "#ffffff",
              border: "1px solid var(--border)",
              borderRadius: "16px",
              padding: "1.25rem 1.5rem",
              boxShadow: "var(--shadow-xs)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#f59e0b" }}>
              <span className="material-symbols-outlined">pending_actions</span>
              <span style={{ fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-dim)" }}>
                Pending Review
              </span>
            </div>
            <div style={{ fontSize: "1.8rem", fontWeight: 800, marginTop: "0.4rem", color: "#d97706" }}>
              {pendingSubmissionsCount}
            </div>
          </div>

          <div
            style={{
              background: "#ffffff",
              border: "1px solid var(--border)",
              borderRadius: "16px",
              padding: "1.25rem 1.5rem",
              boxShadow: "var(--shadow-xs)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#10b981" }}>
              <span className="material-symbols-outlined">verified</span>
              <span style={{ fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-dim)" }}>
                Graded Submissions
              </span>
            </div>
            <div style={{ fontSize: "1.8rem", fontWeight: 800, marginTop: "0.4rem", color: "#059669" }}>
              {gradedSubmissionsCount}
            </div>
          </div>
        </div>

        {/* Filters & Search Bar */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid var(--border)",
            borderRadius: "14px",
            padding: "1rem 1.25rem",
            marginBottom: "1.5rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "1rem",
            boxShadow: "var(--shadow-xs)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", flex: 1, minWidth: "260px" }}>
            <div style={{ position: "relative", width: "100%", maxWidth: "340px" }}>
              <span
                className="material-symbols-outlined"
                style={{
                  position: "absolute",
                  left: "0.75rem",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--text-dim)",
                  fontSize: "1.2rem",
                }}
              >
                search
              </span>
              <input
                type="text"
                placeholder="Search assignments or programs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-field"
                style={{ paddingLeft: "2.4rem", width: "100%" }}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "0.85rem", color: "var(--text-dim)", whiteSpace: "nowrap" }}>
                Filter Program:
              </span>
              <select
                value={selectedProgramFilter}
                onChange={(e) =>
                  setSelectedProgramFilter(e.target.value === "all" ? "all" : Number(e.target.value))
                }
                className="input-field"
                style={{ minWidth: "200px" }}
              >
                <option value="all">All Programs ({assignments.length})</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ fontSize: "0.85rem", color: "var(--text-dim)" }}>
            Showing <strong>{filteredAssignments.length}</strong> of <strong>{assignments.length}</strong> assignments
          </div>
        </div>

        {/* Loading / Error States */}
        {loading && (
          <div style={{ textAlign: "center", padding: "4rem 2rem", color: "var(--text-muted)" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "2.5rem", animation: "spin 1s linear infinite" }}>
              autorenew
            </span>
            <p style={{ marginTop: "0.75rem", fontWeight: 600 }}>Loading assignments...</p>
          </div>
        )}

        {error && !loading && (
          <div
            style={{
              padding: "1.5rem",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: "12px",
              color: "#dc2626",
              marginBottom: "1.5rem",
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
            }}
          >
            <span className="material-symbols-outlined">error</span>
            <div>{error}</div>
            <button
              onClick={loadData}
              className="btn-secondary"
              style={{ marginLeft: "auto", fontSize: "0.85rem", padding: "0.4rem 0.8rem" }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && filteredAssignments.length === 0 && (
          <div
            style={{
              background: "#ffffff",
              borderRadius: "16px",
              border: "1px solid var(--border)",
              padding: "4rem 2rem",
              textAlign: "center",
              boxShadow: "var(--shadow-xs)",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "3.5rem", color: "var(--text-dim)", marginBottom: "1rem" }}>
              assignment_add
            </span>
            <h3 style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--text-main)", marginBottom: "0.5rem" }}>
              No assignments found
            </h3>
            <p style={{ color: "var(--text-muted)", maxWidth: "500px", margin: "0 auto 1.5rem auto", fontSize: "0.95rem" }}>
              {searchQuery || selectedProgramFilter !== "all"
                ? "No assignments matched your current filters. Try resetting the search or program filter."
                : "No assignments have been assigned yet. Click the button below to assign coursework to your students."}
            </p>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="btn-primary"
            >
              + Assign First Assignment
            </button>
          </div>
        )}

        {/* Assignments Cards List */}
        {!loading && !error && filteredAssignments.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "1rem" }}>
            {filteredAssignments.map((item) => (
              <div
                key={item.id}
                className="card-hover"
                style={{
                  background: "#ffffff",
                  borderRadius: "16px",
                  border: "1px solid var(--border)",
                  padding: "1.5rem 1.75rem",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "1.5rem",
                  boxShadow: "var(--shadow-xs)",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ flex: 1, minWidth: "300px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.4rem", flexWrap: "wrap" }}>
                    <span className="badge-pill badge-primary" style={{ fontSize: "0.75rem" }}>
                      {item.program_name}
                    </span>
                    <span style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>
                      {item.module_title} &gt; {item.week_title}
                    </span>

                    {item.pending_count > 0 ? (
                      <span className="badge-pill badge-warning" style={{ fontSize: "0.75rem" }}>
                        <span className="material-symbols-outlined" style={{ fontSize: "0.9rem" }}>
                          notification_important
                        </span>
                        {item.pending_count} Pending Review
                      </span>
                    ) : item.submissions_count > 0 ? (
                      <span className="badge-pill badge-success" style={{ fontSize: "0.75rem" }}>
                        All Graded ({item.graded_count})
                      </span>
                    ) : (
                      <span className="badge-pill" style={{ fontSize: "0.75rem", background: "#f1f5f9", color: "#64748b" }}>
                        0 Submissions
                      </span>
                    )}
                  </div>

                  <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-main)", marginBottom: "0.35rem" }}>
                    {item.title}
                  </h3>
                  <p style={{ fontSize: "0.9rem", color: "var(--text-muted)", lineHeight: 1.5, maxWidth: "850px" }}>
                    {item.description}
                  </p>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "1.5rem",
                      marginTop: "0.75rem",
                      fontSize: "0.82rem",
                      color: "var(--text-dim)",
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                      <span className="material-symbols-outlined" style={{ fontSize: "1.05rem" }}>
                        event
                      </span>
                      Due: {item.due_date || "No deadline"}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                      <span className="material-symbols-outlined" style={{ fontSize: "1.05rem" }}>
                        military_tech
                      </span>
                      {item.points} Points Available
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                      <span className="material-symbols-outlined" style={{ fontSize: "1.05rem" }}>
                        people
                      </span>
                      {item.submissions_count} Submissions ({item.graded_count} Graded)
                    </div>
                    {item.rubric && item.rubric.length > 0 && (
                      <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                        <span className="material-symbols-outlined" style={{ fontSize: "1.05rem" }}>
                          checklist
                        </span>
                        {item.rubric.length} Rubric Criteria
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <button
                    onClick={() => handleOpenSubmissions(item)}
                    className="btn-primary"
                    style={{ display: "flex", alignItems: "center", gap: "0.4rem", whiteSpace: "nowrap" }}
                  >
                    <span className="material-symbols-outlined">rate_review</span>
                    Submissions & Grading
                    {item.pending_count > 0 && (
                      <span
                        style={{
                          background: "#ffffff",
                          color: "var(--primary)",
                          borderRadius: "10px",
                          padding: "0.1rem 0.45rem",
                          fontSize: "0.75rem",
                          fontWeight: 800,
                          marginLeft: "0.25rem",
                        }}
                      >
                        {item.pending_count}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => handleDeleteAssignment(item.id, item.title)}
                    className="btn-secondary"
                    title="Delete Assignment"
                    style={{
                      color: "#dc2626",
                      borderColor: "#fecaca",
                      padding: "0.6rem 0.8rem",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "1.2rem" }}>
                      delete
                    </span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* MODAL 1: Create Assignment Modal */}
        {isCreateOpen && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(15, 23, 42, 0.65)",
              backdropFilter: "blur(4px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
              padding: "1rem",
            }}
          >
            <div
              style={{
                background: "#ffffff",
                borderRadius: "20px",
                width: "100%",
                maxWidth: "min(680px, calc(100vw - 24px))",
                maxHeight: "90vh",
                overflowY: "auto",
                boxShadow: "var(--shadow-xl)",
                padding: "1.5rem 1.25rem",
                position: "relative",
                animation: "fadeIn 0.2s ease-out",
              }}
            >
              <button
                onClick={() => setIsCreateOpen(false)}
                style={{
                  position: "absolute",
                  top: "1.25rem",
                  right: "1.25rem",
                  background: "#f1f5f9",
                  border: "none",
                  borderRadius: "50%",
                  width: "36px",
                  height: "36px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--text-muted)",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "1.2rem" }}>
                  close
                </span>
              </button>

              <div style={{ marginBottom: "1.5rem" }}>
                <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--text-main)" }}>
                  Assign New Coursework
                </h2>
                <p style={{ color: "var(--text-muted)", fontSize: "0.88rem", marginTop: "0.25rem" }}>
                  Create an assignment activity, assign it to a program, set deadlines, and configure rubrics.
                </p>
              </div>

              {createError && (
                <div
                  style={{
                    padding: "0.75rem 1rem",
                    background: "#fef2f2",
                    color: "#dc2626",
                    borderRadius: "8px",
                    marginBottom: "1rem",
                    fontSize: "0.85rem",
                  }}
                >
                  {createError}
                </div>
              )}

              <form onSubmit={handleCreateAssignment}>
                {/* Program Selector */}
                <div style={{ marginBottom: "1.2rem" }}>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, marginBottom: "0.4rem" }}>
                    Select Target Program *
                  </label>
                  <select
                    value={newProgramId || ""}
                    onChange={(e) => setNewProgramId(Number(e.target.value))}
                    className="input-field"
                    style={{ width: "100%" }}
                    required
                  >
                    <option value="" disabled>
                      Choose Program...
                    </option>
                    {programs.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.code})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Assignment Title */}
                <div style={{ marginBottom: "1.2rem" }}>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, marginBottom: "0.4rem" }}>
                    Assignment Title *
                  </label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. PyTorch Deep Neural Network Optimization"
                    className="input-field"
                    style={{ width: "100%" }}
                    required
                  />
                </div>

                {/* Description */}
                <div style={{ marginBottom: "1.2rem" }}>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, marginBottom: "0.4rem" }}>
                    Description & Instructions *
                  </label>
                  <textarea
                    rows={4}
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Provide detailed instructions, deliverables, requirements, and formatting guidelines..."
                    className="input-field"
                    style={{ width: "100%", resize: "vertical" }}
                    required
                  />
                </div>

                {/* Due Date & Points Row */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.2rem" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, marginBottom: "0.4rem" }}>
                      Due Date (Optional)
                    </label>
                    <input
                      type="date"
                      value={newDueDate}
                      onChange={(e) => setNewDueDate(e.target.value)}
                      className="input-field"
                      style={{ width: "100%" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, marginBottom: "0.4rem" }}>
                      Maximum Points
                    </label>
                    <input
                      type="number"
                      min={10}
                      max={1000}
                      value={newPoints}
                      onChange={(e) => setNewPoints(Number(e.target.value))}
                      className="input-field"
                      style={{ width: "100%" }}
                      required
                    />
                  </div>
                </div>

                {/* Rubric Builder */}
                <div style={{ marginBottom: "1.5rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                    <label style={{ fontSize: "0.85rem", fontWeight: 700 }}>
                      Grading Rubric Criteria (Optional)
                    </label>
                    <button
                      type="button"
                      onClick={() => setNewRubric([...newRubric, { criterion: "", weight: "20%" }])}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--primary)",
                        fontSize: "0.8rem",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      + Add Criterion
                    </button>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {newRubric.map((r, idx) => (
                      <div key={idx} style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                        <input
                          type="text"
                          placeholder="e.g. Model Accuracy & Loss Convergence"
                          value={r.criterion}
                          onChange={(e) => {
                            const updated = [...newRubric];
                            updated[idx].criterion = e.target.value;
                            setNewRubric(updated);
                          }}
                          className="input-field"
                          style={{ flex: 1, fontSize: "0.85rem" }}
                        />
                        <input
                          type="text"
                          placeholder="Weight (e.g. 40%)"
                          value={r.weight}
                          onChange={(e) => {
                            const updated = [...newRubric];
                            updated[idx].weight = e.target.value;
                            setNewRubric(updated);
                          }}
                          className="input-field"
                          style={{ width: "100px", fontSize: "0.85rem" }}
                        />
                        <button
                          type="button"
                          onClick={() => setNewRubric(newRubric.filter((_, i) => i !== idx))}
                          style={{
                            background: "none",
                            border: "none",
                            color: "var(--text-dim)",
                            cursor: "pointer",
                            padding: "0.3rem",
                          }}
                          title="Remove criterion"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: "1.1rem" }}>
                            delete
                          </span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Submit Buttons */}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
                  <button
                    type="button"
                    onClick={() => setIsCreateOpen(false)}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createSubmitting}
                    className="btn-primary"
                  >
                    {createSubmitting ? "Creating Assignment..." : "Assign to Program"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 2: Submissions & Grading Drawer/Modal */}
        {activeAssignmentForSubmissions && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(15, 23, 42, 0.65)",
              backdropFilter: "blur(4px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
              padding: "1rem",
            }}
          >
            <div
              style={{
                background: "#ffffff",
                borderRadius: "20px",
                width: "100%",
                maxWidth: "min(880px, calc(100vw - 24px))",
                maxHeight: "92vh",
                overflowY: "auto",
                boxShadow: "var(--shadow-xl)",
                padding: "1.5rem 1.25rem",
                position: "relative",
                animation: "fadeIn 0.2s ease-out",
              }}
            >
              <button
                onClick={() => setActiveAssignmentForSubmissions(null)}
                style={{
                  position: "absolute",
                  top: "1.25rem",
                  right: "1.25rem",
                  background: "#f1f5f9",
                  border: "none",
                  borderRadius: "50%",
                  width: "36px",
                  height: "36px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--text-muted)",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "1.2rem" }}>
                  close
                </span>
              </button>

              <div style={{ marginBottom: "1.5rem" }}>
                <span className="badge-pill badge-primary" style={{ marginBottom: "0.5rem" }}>
                  {activeAssignmentForSubmissions.program_name}
                </span>
                <h2 style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--text-main)" }}>
                  Submissions: {activeAssignmentForSubmissions.title}
                </h2>
                <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                  Max Points: {activeAssignmentForSubmissions.points} • Due: {activeAssignmentForSubmissions.due_date || "Open"}
                </div>
              </div>

              {/* Rubric Summary in modal */}
              {activeAssignmentForSubmissions.rubric && activeAssignmentForSubmissions.rubric.length > 0 && (
                <div
                  style={{
                    background: "#f8fafc",
                    border: "1px solid var(--border)",
                    borderRadius: "12px",
                    padding: "0.85rem 1.25rem",
                    marginBottom: "1.5rem",
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "1.5rem",
                  }}
                >
                  <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-main)", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "1rem" }}>checklist</span>
                    Rubric Breakdown:
                  </div>
                  {activeAssignmentForSubmissions.rubric.map((r, idx) => (
                    <div key={idx} style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                      {r.criterion}: <strong style={{ color: "var(--primary)" }}>{r.weight}</strong>
                    </div>
                  ))}
                </div>
              )}

              {/* Submissions List */}
              {loadingSubmissions && (
                <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--text-muted)" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: "2rem", animation: "spin 1s linear infinite" }}>
                    autorenew
                  </span>
                  <p style={{ marginTop: "0.5rem" }}>Loading student submissions...</p>
                </div>
              )}

              {!loadingSubmissions && submissionsList.length === 0 && (
                <div
                  style={{
                    background: "#f8fafc",
                    borderRadius: "14px",
                    border: "1px dashed var(--border)",
                    padding: "3rem 1.5rem",
                    textAlign: "center",
                    color: "var(--text-muted)",
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "2.5rem", color: "var(--text-dim)", marginBottom: "0.5rem" }}>
                    inbox
                  </span>
                  <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "var(--text-main)" }}>
                    No student submissions yet
                  </div>
                  <p style={{ fontSize: "0.85rem", marginTop: "0.25rem" }}>
                    Students enrolled in {activeAssignmentForSubmissions.program_name} will appear here once they upload their work.
                  </p>
                </div>
              )}

              {!loadingSubmissions && submissionsList.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                  {submissionsList.map((sub) => {
                    const gradeInfo = gradingState[sub.id] || {
                      score: sub.score !== null ? sub.score : activeAssignmentForSubmissions.points,
                      feedback: sub.feedback || "",
                    };

                    return (
                      <div
                        key={sub.id}
                        style={{
                          background: "#ffffff",
                          border: sub.status === "GRADED" ? "1px solid #a7f3d0" : "1px solid #fed7aa",
                          borderRadius: "14px",
                          padding: "1.25rem",
                          boxShadow: "var(--shadow-xs)",
                        }}
                      >
                        {/* Student Info Header */}
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            flexWrap: "wrap",
                            gap: "0.75rem",
                            marginBottom: "0.75rem",
                          }}
                        >
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                              <strong style={{ fontSize: "1.05rem", color: "var(--text-main)" }}>
                                {sub.student_name}
                              </strong>
                              {sub.student_code && (
                                <span style={{ fontSize: "0.75rem", color: "var(--text-dim)", background: "#f1f5f9", padding: "0.1rem 0.4rem", borderRadius: "6px" }}>
                                  {sub.student_code}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                              {sub.student_email} • Submitted: {sub.submitted_at}
                            </div>
                          </div>

                          <div>
                            {sub.status === "GRADED" ? (
                              <span className="badge-pill badge-success" style={{ fontSize: "0.75rem" }}>
                                Graded: {sub.score} / {activeAssignmentForSubmissions.points}
                              </span>
                            ) : (
                              <span className="badge-pill badge-warning" style={{ fontSize: "0.75rem" }}>
                                Awaiting Grade
                              </span>
                            )}
                          </div>
                        </div>

                        {/* File & Notes Attachment */}
                        <div
                          style={{
                            background: "#f8fafc",
                            borderRadius: "10px",
                            padding: "0.75rem 1rem",
                            marginBottom: "1rem",
                            border: "1px solid var(--border)",
                          }}
                        >
                          {sub.file_name ? (
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                              <span className="material-symbols-outlined" style={{ color: "var(--primary)" }}>
                                attach_file
                              </span>
                              <span style={{ fontSize: "0.88rem", fontWeight: 600 }}>
                                {sub.file_name}
                              </span>
                              {sub.file_url && (
                                <a
                                  href={sub.file_url.startsWith("http://") || sub.file_url.startsWith("https://") ? sub.file_url : `${config.apiUrl}${sub.file_url}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="btn-secondary"
                                  style={{
                                    fontSize: "0.75rem",
                                    padding: "0.25rem 0.6rem",
                                    marginLeft: "auto",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "0.2rem",
                                  }}
                                >
                                  <span className="material-symbols-outlined" style={{ fontSize: "0.95rem" }}>
                                    download
                                  </span>
                                  Download / View Solution
                                </a>
                              )}
                            </div>
                          ) : (
                            <div style={{ fontSize: "0.82rem", color: "var(--text-dim)" }}>
                              No file attached
                            </div>
                          )}

                          {sub.notes && (
                            <div style={{ fontSize: "0.85rem", color: "var(--text-main)", marginTop: "0.5rem", borderTop: "1px dashed #e2e8f0", paddingTop: "0.5rem" }}>
                              <strong>Student Notes:</strong> {sub.notes}
                            </div>
                          )}
                        </div>

                        {/* Grading Inputs */}
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "0.75rem",
                            alignItems: "flex-end",
                          }}
                        >
                          <div style={{ width: "120px", flexShrink: 0 }}>
                            <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-dim)", marginBottom: "0.25rem" }}>
                              Score (Max {activeAssignmentForSubmissions.points})
                            </label>
                            <input
                              type="number"
                              min={0}
                              max={activeAssignmentForSubmissions.points}
                              value={gradeInfo.score}
                              onChange={(e) =>
                                setGradingState((prev) => ({
                                  ...prev,
                                  [sub.id]: { ...prev[sub.id], score: Number(e.target.value) },
                                }))
                              }
                              className="input-field"
                              style={{ width: "100%", fontSize: "0.9rem", padding: "0.5rem" }}
                            />
                          </div>

                          <div style={{ flex: "1 1 220px", minWidth: "180px" }}>
                            <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-dim)", marginBottom: "0.25rem" }}>
                              Feedback / Review Comments
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. Excellent implementation and loss curve analysis."
                              value={gradeInfo.feedback}
                              onChange={(e) =>
                                setGradingState((prev) => ({
                                  ...prev,
                                  [sub.id]: { ...prev[sub.id], feedback: e.target.value },
                                }))
                              }
                              className="input-field"
                              style={{ width: "100%", fontSize: "0.88rem", padding: "0.5rem" }}
                            />
                          </div>

                          <div style={{ flexShrink: 0 }}>
                            <button
                              onClick={() => handleSaveGrade(sub.id)}
                              disabled={gradeInfo.saving}
                              className={gradeInfo.saved ? "btn-secondary" : "btn-primary"}
                              style={{
                                padding: "0.55rem 1rem",
                                fontSize: "0.85rem",
                                whiteSpace: "nowrap",
                                display: "flex",
                                alignItems: "center",
                                gap: "0.3rem",
                              }}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: "1rem" }}>
                                {gradeInfo.saved ? "check" : "save"}
                              </span>
                              {gradeInfo.saved ? "Saved!" : gradeInfo.saving ? "Saving..." : "Grade"}
                            </button>
                          </div>
                        </div>

                        {sub.graded_by_name && (
                          <div style={{ fontSize: "0.72rem", color: "#059669", marginTop: "0.5rem", fontStyle: "italic" }}>
                            Graded by {sub.graded_by_name} ({sub.graded_at})
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </RequireAuth>
  );
}
