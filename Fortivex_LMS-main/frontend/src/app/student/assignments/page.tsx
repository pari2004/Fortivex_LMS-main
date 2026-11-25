"use client";

import { useEffect, useState, useCallback } from "react";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { useAuth } from "@/lib/auth/AuthContext";
import { getMyAssignments, submitAssignment } from "@/lib/api/endpoints";
import type { StudentAssignmentItem } from "@/lib/api/types";
import { config } from "@/lib/config";

export default function StudentAssignmentsPage() {
  const { token, user } = useAuth();
  const [assignments, setAssignments] = useState<StudentAssignmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filter, setFilter] = useState<"all" | "pending" | "submitted" | "graded">("all");
  const [selectedAssignment, setSelectedAssignment] = useState<StudentAssignmentItem | null>(null);
  
  // Submission form state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const loadAssignments = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError(null);
      const data = await getMyAssignments(token);
      setAssignments(data);
    } catch (err: any) {
      setError(err?.message || "Failed to load assignments");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  const filtered = assignments.filter((a) => (filter === "all" ? true : a.status === filter));

  const pendingCount = assignments.filter((a) => a.status === "pending").length;
  const gradedAssignments = assignments.filter((a) => a.status === "graded" && a.score !== null && a.score !== undefined);
  
  const avgGradeText =
    gradedAssignments.length > 0
      ? `${Math.round(
          gradedAssignments.reduce((acc, curr) => acc + ((curr.score || 0) / (curr.points || 100)) * 100, 0) /
            gradedAssignments.length
        )}%`
      : "—";

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setSubmitError(null);
    }
  }

  async function handleCompleteSubmission() {
    if (!token || !selectedAssignment) return;
    try {
      setSubmitting(true);
      setSubmitError(null);

      const formData = new FormData();
      if (selectedFile) {
        formData.append("file", selectedFile);
      }
      if (notes.trim()) {
        formData.append("notes", notes.trim());
      }

      await submitAssignment(token, selectedAssignment.id, formData);
      setSubmitSuccess(true);
      
      // Refresh list to pull live updated status
      await loadAssignments();

      setTimeout(() => {
        setSubmitSuccess(false);
        setSelectedAssignment(null);
        setSelectedFile(null);
        setNotes("");
      }, 1300);
    } catch (err: any) {
      setSubmitError(err?.message || "Failed to submit assignment. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <RequireAuth>
      <div style={{ maxWidth: "1200px", margin: "0 auto", animation: "fadeIn 0.35s ease-out" }}>
        {/* Header Title & Summary */}
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
            <h1 style={{ fontSize: "2rem", fontWeight: 800, color: "var(--text-main)", letterSpacing: "-0.02em" }}>
              Assignments & Project Submissions
            </h1>
            <p style={{ color: "var(--text-muted)", fontSize: "0.95rem", marginTop: "0.25rem" }}>
              Submit coursework, review rubrics, and track real-time grading from course instructors.
            </p>
          </div>

          {/* Quick Stats Pill */}
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <div
              style={{
                background: "#ffffff",
                border: "1px solid var(--border)",
                borderRadius: "12px",
                padding: "0.6rem 1rem",
                display: "flex",
                alignItems: "center",
                gap: "0.6rem",
                boxShadow: "var(--shadow-xs)",
              }}
            >
              <span className="material-symbols-outlined" style={{ color: "var(--warning)", fontSize: "1.2rem" }}>
                pending_actions
              </span>
              <div>
                <div style={{ fontSize: "0.72rem", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 700 }}>
                  Due Soon
                </div>
                <div style={{ fontSize: "1.1rem", fontWeight: 800 }}>
                  {pendingCount}
                </div>
              </div>
            </div>

            <div
              style={{
                background: "#ffffff",
                border: "1px solid var(--border)",
                borderRadius: "12px",
                padding: "0.6rem 1rem",
                display: "flex",
                alignItems: "center",
                gap: "0.6rem",
                boxShadow: "var(--shadow-xs)",
              }}
            >
              <span className="material-symbols-outlined" style={{ color: "var(--success)", fontSize: "1.2rem" }}>
                grade
              </span>
              <div>
                <div style={{ fontSize: "0.72rem", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 700 }}>
                  Avg Grade
                </div>
                <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--success)" }}>
                  {avgGradeText}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <div className="tab-list">
            {(["all", "pending", "submitted", "graded"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`tab-button ${filter === tab ? "active" : ""}`}
              >
                {tab === "all" ? "All Assignments" : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
            Showing <strong>{filtered.length}</strong> {filtered.length === 1 ? "item" : "items"}
          </div>
        </div>

        {/* Loading / Error States */}
        {loading && (
          <div style={{ textAlign: "center", padding: "4rem 2rem", color: "var(--text-muted)" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "2.5rem", animation: "spin 1s linear infinite" }}>
              autorenew
            </span>
            <p style={{ marginTop: "0.75rem", fontWeight: 600 }}>Loading your assignments...</p>
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
              onClick={loadAssignments}
              className="btn-secondary"
              style={{ marginLeft: "auto", fontSize: "0.85rem", padding: "0.4rem 0.8rem" }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && filtered.length === 0 && (
          <div
            style={{
              background: "#ffffff",
              borderRadius: "16px",
              border: "1px solid var(--border)",
              padding: "3.5rem 2rem",
              textAlign: "center",
              color: "var(--text-muted)",
              boxShadow: "var(--shadow-xs)",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "3rem", color: "var(--text-dim)", marginBottom: "0.75rem" }}>
              assignment_turned_in
            </span>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-main)", marginBottom: "0.35rem" }}>
              No assignments found
            </h3>
            <p style={{ fontSize: "0.9rem" }}>
              {filter === "all"
                ? "You have no assignments assigned yet in your enrolled programs."
                : `No assignments currently in "${filter}" status.`}
            </p>
          </div>
        )}

        {/* Assignments Cards Grid */}
        {!loading && !error && filtered.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "1rem" }}>
            {filtered.map((item) => (
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
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.4rem", flexWrap: "wrap" }}>
                    <span className="badge-pill badge-primary" style={{ fontSize: "0.72rem" }}>
                      {item.program_name}
                    </span>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
                      {item.lesson_title}
                    </span>

                    {item.status === "pending" && (
                      <span
                        className="badge-pill badge-warning"
                        style={{ fontSize: "0.72rem", display: "inline-flex", alignItems: "center", gap: "0.2rem" }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: "0.85rem" }}>
                          timer
                        </span>
                        {item.due_in_days !== undefined && item.due_in_days <= 0
                          ? "Due Today"
                          : `Due in ${item.due_in_days}d`}
                      </span>
                    )}

                    {item.status === "graded" && (
                      <span className="badge-pill badge-success" style={{ fontSize: "0.72rem" }}>
                        Score: {item.score} / {item.points}
                      </span>
                    )}

                    {item.status === "submitted" && (
                      <span className="badge-pill badge-purple" style={{ fontSize: "0.72rem" }}>
                        Awaiting Grading
                      </span>
                    )}
                  </div>

                  <h3 style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--text-main)", marginBottom: "0.35rem" }}>
                    {item.title}
                  </h3>
                  <p style={{ fontSize: "0.88rem", color: "var(--text-muted)", lineHeight: 1.5, maxWidth: "800px" }}>
                    {item.description}
                  </p>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "1.5rem",
                      marginTop: "0.75rem",
                      fontSize: "0.8rem",
                      color: "var(--text-dim)",
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                      <span className="material-symbols-outlined" style={{ fontSize: "1rem" }}>
                        event
                      </span>
                      Due: {item.due_date || "No deadline"}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                      <span className="material-symbols-outlined" style={{ fontSize: "1rem" }}>
                        star
                      </span>
                      {item.points} Points Available
                    </div>
                    {item.rubric && item.rubric.length > 0 && (
                      <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                        <span className="material-symbols-outlined" style={{ fontSize: "1rem" }}>
                          checklist
                        </span>
                        {item.rubric.length} Rubric Criteria
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Button */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.5rem" }}>
                  <button
                    onClick={() => {
                      setSelectedAssignment(item);
                      setSelectedFile(null);
                      setNotes(item.notes || "");
                      setSubmitError(null);
                      setSubmitSuccess(false);
                    }}
                    className={item.status === "pending" ? "btn-primary" : "btn-secondary"}
                    style={{ whiteSpace: "nowrap" }}
                  >
                    {item.status === "pending" ? (
                      <>
                        <span className="material-symbols-outlined">upload_file</span>
                        Submit Work
                      </>
                    ) : item.status === "graded" ? (
                      <>
                        <span className="material-symbols-outlined">feedback</span>
                        View Feedback
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined">visibility</span>
                        View Submission
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Interactive Submission & Feedback Modal */}
        {selectedAssignment && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(15, 23, 42, 0.6)",
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
                maxWidth: "min(640px, calc(100vw - 24px))",
                maxHeight: "90vh",
                overflowY: "auto",
                boxShadow: "var(--shadow-xl)",
                padding: "1.5rem 1.25rem",
                position: "relative",
                animation: "fadeIn 0.25s ease-out",
              }}
            >
              {/* Close Button */}
              <button
                onClick={() => setSelectedAssignment(null)}
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
                  {selectedAssignment.program_name}
                </span>
                <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--text-main)" }}>
                  {selectedAssignment.title}
                </h2>
                <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                  Deadline: {selectedAssignment.due_date || "Open"} • {selectedAssignment.points} Points Available
                </div>
                <p style={{ fontSize: "0.9rem", color: "var(--text-muted)", marginTop: "0.75rem", lineHeight: 1.5 }}>
                  {selectedAssignment.description}
                </p>
              </div>

              {/* Rubric Section */}
              {selectedAssignment.rubric && selectedAssignment.rubric.length > 0 && (
                <div
                  style={{
                    background: "#f8fafc",
                    borderRadius: "12px",
                    padding: "1rem 1.25rem",
                    marginBottom: "1.5rem",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-main)", marginBottom: "0.5rem" }}>
                    Grading Criteria & Rubric:
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                    {selectedAssignment.rubric.map((r, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: "0.82rem",
                          color: "var(--text-muted)",
                        }}
                      >
                        <span>• {r.criterion}</span>
                        <strong style={{ color: "var(--primary)" }}>{r.weight}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Feedback if Graded */}
              {selectedAssignment.status === "graded" && (
                <div
                  style={{
                    background: "#ecfdf5",
                    border: "1px solid #a7f3d0",
                    borderRadius: "12px",
                    padding: "1.25rem",
                    marginBottom: "1.5rem",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontWeight: 800, color: "#065f46", fontSize: "1.1rem" }}>
                      Score Awarded: {selectedAssignment.score} / {selectedAssignment.points} (
                      {Math.round(((selectedAssignment.score || 0) / (selectedAssignment.points || 100)) * 100)}%)
                    </div>
                    <span className="material-symbols-outlined" style={{ color: "#059669" }}>
                      verified
                    </span>
                  </div>
                  {selectedAssignment.instructorFeedback && (
                    <div style={{ fontSize: "0.88rem", color: "#047857", marginTop: "0.5rem", fontStyle: "italic" }}>
                      "{selectedAssignment.instructorFeedback}"
                    </div>
                  )}
                  {selectedAssignment.submitted_at && (
                    <div style={{ fontSize: "0.75rem", color: "#059669", marginTop: "0.5rem" }}>
                      Submitted on: {selectedAssignment.submitted_at}
                    </div>
                  )}
                </div>
              )}

              {/* Awaiting Grading Details */}
              {selectedAssignment.status === "submitted" && (
                <div
                  style={{
                    background: "#f5f3ff",
                    border: "1px solid #ddd6fe",
                    borderRadius: "12px",
                    padding: "1.25rem",
                    marginBottom: "1.5rem",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#6d28d9", fontWeight: 700 }}>
                    <span className="material-symbols-outlined">schedule</span>
                    Your submission is awaiting instructor review
                  </div>
                  {selectedAssignment.file_name && (
                    <div style={{ fontSize: "0.85rem", color: "#5b21b6", marginTop: "0.5rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      <span className="material-symbols-outlined" style={{ fontSize: "1rem" }}>attachment</span>
                      Uploaded File: <strong>{selectedAssignment.file_name}</strong>
                    </div>
                  )}
                  {selectedAssignment.notes && (
                    <div style={{ fontSize: "0.85rem", color: "#4c1d95", marginTop: "0.4rem" }}>
                      Notes: {selectedAssignment.notes}
                    </div>
                  )}
                  {selectedAssignment.submitted_at && (
                    <div style={{ fontSize: "0.75rem", color: "#7c3aed", marginTop: "0.5rem" }}>
                      Submitted at: {selectedAssignment.submitted_at}
                    </div>
                  )}
                </div>
              )}

              {/* Upload Zone & Submission Form for Pending */}
              {selectedAssignment.status === "pending" && (
                <div>
                  <div
                    style={{
                      border: "2px dashed #cbd5e1",
                      borderRadius: "14px",
                      padding: "2rem",
                      textAlign: "center",
                      background: selectedFile ? "#f0fdf4" : "#fafafa",
                      cursor: "pointer",
                      marginBottom: "1.25rem",
                      transition: "all 0.2s ease",
                    }}
                    onClick={() => document.getElementById("file-upload-input")?.click()}
                  >
                    <input
                      id="file-upload-input"
                      type="file"
                      style={{ display: "none" }}
                      onChange={handleFileSelect}
                    />
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: "2.5rem", color: selectedFile ? "#10b981" : "var(--primary)", marginBottom: "0.5rem" }}
                    >
                      {selectedFile ? "check_circle" : "cloud_upload"}
                    </span>
                    <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text-main)" }}>
                      {selectedFile ? `Attached: ${selectedFile.name}` : "Drag & Drop submission file or click to browse"}
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "var(--text-dim)", marginTop: "0.25rem" }}>
                      Accepts .py, .ipynb, .pdf, .zip, .docx up to 50MB
                    </div>
                  </div>

                  <div style={{ marginBottom: "1.5rem" }}>
                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, marginBottom: "0.4rem" }}>
                      Student Notes / GitHub Repository Link (Optional):
                    </label>
                    <textarea
                      rows={3}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="e.g. Solution repository link or model checkpoint details..."
                      className="input-field"
                      style={{ resize: "vertical" }}
                    />
                  </div>

                  {submitError && (
                    <div
                      style={{
                        padding: "0.75rem",
                        background: "#fef2f2",
                        color: "#dc2626",
                        borderRadius: "8px",
                        fontSize: "0.85rem",
                        marginBottom: "1rem",
                      }}
                    >
                      {submitError}
                    </div>
                  )}

                  {submitSuccess ? (
                    <div
                      style={{
                        padding: "0.85rem",
                        background: "#ecfdf5",
                        color: "#059669",
                        borderRadius: "10px",
                        textAlign: "center",
                        fontWeight: 700,
                        fontSize: "0.9rem",
                      }}
                    >
                      ✓ Assignment Submitted Successfully!
                    </div>
                  ) : (
                    <button
                      onClick={handleCompleteSubmission}
                      disabled={submitting || (!selectedFile && !notes.trim())}
                      className="btn-primary"
                      style={{
                        width: "100%",
                        padding: "0.85rem",
                        opacity: submitting || (!selectedFile && !notes.trim()) ? 0.6 : 1,
                        cursor: submitting || (!selectedFile && !notes.trim()) ? "not-allowed" : "pointer",
                      }}
                    >
                      {submitting ? "Uploading & Submitting..." : "Confirm & Submit Solution"}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </RequireAuth>
  );
}
