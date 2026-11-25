"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { useAuth } from "@/lib/auth/AuthContext";
import { apiRequest } from "@/lib/api/client";
import { usePrograms } from "@/lib/api/usePrograms";
import { useEnrollments } from "@/lib/api/useEnrollments";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";

interface EnrolledProgram {
  program_id?: number;
  id?: number;
  name: string;
  code: string;
  description?: string | null;
  cohort_name?: string;
  progress_percentage?: number;
  completed_lessons?: number;
  total_lessons?: number;
  next_activity?: {
    id: number;
    title: string;
    activity_type: string;
  };
}

export default function MyCoursesPage() {
  const { token, organization } = useAuth();
  const { programs: allOrgPrograms } = usePrograms(organization?.id);
  const { enrollments } = useEnrollments();

  const [dashboardData, setDashboardData] = useState<{
    programs: EnrolledProgram[];
    kpis?: {
      active_courses?: number;
      lessons_completed?: number;
      programs_enrolled?: number;
      hours_studied?: number;
    };
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"enrolled" | "catalog">("enrolled");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "in_progress" | "completed">("all");

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError(null);

    apiRequest<any>("/api/v1/students/me/dashboard", { token })
      .then((data) => {
        setDashboardData(data);
      })
      .catch((err) => {
        console.error("Failed to load student dashboard courses:", err);
        setError(err.message || "Failed to load courses");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [token]);

  const enrolledPrograms: EnrolledProgram[] = useMemo(() => {
    if (dashboardData?.programs && dashboardData.programs.length > 0) {
      return dashboardData.programs;
    }
    // Fallback using enrollments and allOrgPrograms
    if (enrollments && allOrgPrograms) {
      const enrolledSet = new Set(enrollments.map((e) => e.program_id));
      return allOrgPrograms
        .filter((p) => enrolledSet.has(p.id))
        .map((p) => ({
          id: p.id,
          program_id: p.id,
          name: p.name,
          code: p.code,
          description: p.description,
          progress_percentage: 0,
          completed_lessons: 0,
          total_lessons: 0,
        }));
    }
    return [];
  }, [dashboardData, enrollments, allOrgPrograms]);

  // Non-enrolled available catalog programs
  const availableCatalogPrograms = useMemo(() => {
    if (!allOrgPrograms) return [];
    const enrolledIds = new Set(
      enrolledPrograms.map((p) => p.program_id ?? p.id).filter(Boolean)
    );
    return allOrgPrograms.filter((p) => !enrolledIds.has(p.id));
  }, [allOrgPrograms, enrolledPrograms]);

  // Filtered enrolled programs
  const filteredCourses = useMemo(() => {
    return enrolledPrograms.filter((p) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        (p.cohort_name && p.cohort_name.toLowerCase().includes(q));

      const pct = p.progress_percentage || 0;
      let matchesStatus = true;
      if (statusFilter === "in_progress") {
        matchesStatus = pct < 100;
      } else if (statusFilter === "completed") {
        matchesStatus = pct >= 100;
      }

      return matchesSearch && matchesStatus;
    });
  }, [enrolledPrograms, searchQuery, statusFilter]);

  // Summary stats
  const totalEnrolled = enrolledPrograms.length;
  const totalCompletedLessons = enrolledPrograms.reduce(
    (acc, curr) => acc + (curr.completed_lessons || 0),
    0
  );
  const avgProgress =
    totalEnrolled > 0
      ? Math.round(
          enrolledPrograms.reduce((acc, curr) => acc + (curr.progress_percentage || 0), 0) /
            totalEnrolled
        )
      : 0;

  if (loading && !dashboardData) {
    return (
      <RequireAuth>
        <LoadingState message="Loading your enrolled courses..." />
      </RequireAuth>
    );
  }

  return (
    <RequireAuth>
      <div style={{ maxWidth: "1240px", margin: "0 auto", animation: "fadeIn 0.35s ease-out" }}>
        {/* Page Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: "2rem",
            flexWrap: "wrap",
            gap: "1.25rem",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <span
                className="material-symbols-outlined"
                style={{ fontSize: "2.2rem", color: "var(--primary)" }}
              >
                school
              </span>
              <h1
                style={{
                  fontSize: "2rem",
                  fontWeight: 800,
                  color: "var(--text-main)",
                  letterSpacing: "-0.02em",
                }}
              >
                My Courses
              </h1>
            </div>
            <p style={{ color: "var(--text-muted)", fontSize: "0.95rem", marginTop: "0.35rem" }}>
              Access your enrolled programs, track your lesson milestones, and resume learning.
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.75rem" }}>
            <Link
              href="/student/calendar"
              className="btn-secondary"
              style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.9rem" }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "1.1rem" }}>
                calendar_month
              </span>
              Schedule & Calendar
            </Link>
            <Link
              href="/student/assignments"
              className="btn-primary"
              style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.9rem" }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "1.1rem" }}>
                assignment
              </span>
              Assignments
            </Link>
          </div>
        </div>

        {/* Quick KPI Metric Strip */}
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
              background: "var(--color-surface)",
              borderRadius: "14px",
              padding: "1.25rem 1.5rem",
              border: "1px solid var(--color-border)",
              boxShadow: "var(--shadow-sm)",
              display: "flex",
              alignItems: "center",
              gap: "1.25rem",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "12px",
                background: "rgba(79, 70, 229, 0.12)",
                color: "var(--primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "1.6rem" }}>
                menu_book
              </span>
            </div>
            <div>
              <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", fontWeight: 600 }}>
                Enrolled Courses
              </div>
              <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--text-main)" }}>
                {totalEnrolled}
              </div>
            </div>
          </div>

          <div
            style={{
              background: "var(--color-surface)",
              borderRadius: "14px",
              padding: "1.25rem 1.5rem",
              border: "1px solid var(--color-border)",
              boxShadow: "var(--shadow-sm)",
              display: "flex",
              alignItems: "center",
              gap: "1.25rem",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "12px",
                background: "rgba(16, 185, 129, 0.12)",
                color: "#10b981",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "1.6rem" }}>
                task_alt
              </span>
            </div>
            <div>
              <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", fontWeight: 600 }}>
                Lessons Completed
              </div>
              <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--text-main)" }}>
                {totalCompletedLessons}
              </div>
            </div>
          </div>

          <div
            style={{
              background: "var(--color-surface)",
              borderRadius: "14px",
              padding: "1.25rem 1.5rem",
              border: "1px solid var(--color-border)",
              boxShadow: "var(--shadow-sm)",
              display: "flex",
              alignItems: "center",
              gap: "1.25rem",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "12px",
                background: "rgba(245, 158, 11, 0.12)",
                color: "#f59e0b",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "1.6rem" }}>
                donut_large
              </span>
            </div>
            <div>
              <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", fontWeight: 600 }}>
                Average Progress
              </div>
              <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--text-main)" }}>
                {avgProgress}%
              </div>
            </div>
          </div>
        </div>

        {/* View Toggle (Enrolled Courses vs Available Catalog) */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "1rem",
            marginBottom: "1.5rem",
          }}
        >
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              onClick={() => setActiveTab("enrolled")}
              className={`tab-button ${activeTab === "enrolled" ? "active" : ""}`}
              style={{ padding: "0.5rem 1.25rem", fontSize: "0.9rem", fontWeight: 700 }}
            >
              My Enrolled Courses ({enrolledPrograms.length})
            </button>
            <button
              onClick={() => setActiveTab("catalog")}
              className={`tab-button ${activeTab === "catalog" ? "active" : ""}`}
              style={{ padding: "0.5rem 1.25rem", fontSize: "0.9rem", fontWeight: 700 }}
            >
              Explore Other Courses ({availableCatalogPrograms.length})
            </button>
          </div>

          {activeTab === "enrolled" && (
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              {/* Search */}
              <div style={{ position: "relative", width: "240px" }}>
                <span
                  className="material-symbols-outlined"
                  style={{
                    position: "absolute",
                    left: "0.6rem",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--text-muted)",
                    fontSize: "1.1rem",
                  }}
                >
                  search
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter courses..."
                  style={{
                    width: "100%",
                    padding: "0.45rem 0.6rem 0.45rem 2.2rem",
                    borderRadius: "8px",
                    border: "1px solid var(--color-border)",
                    background: "var(--color-surface)",
                    color: "var(--foreground)",
                    fontSize: "0.85rem",
                  }}
                />
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                style={{
                  padding: "0.45rem 0.75rem",
                  borderRadius: "8px",
                  border: "1px solid var(--color-border)",
                  background: "var(--color-surface)",
                  color: "var(--foreground)",
                  fontSize: "0.85rem",
                  cursor: "pointer",
                }}
              >
                <option value="all">All Progress</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed (100%)</option>
              </select>
            </div>
          )}
        </div>

        {/* Tab 1: My Enrolled Courses */}
        {activeTab === "enrolled" && (
          <div>
            {filteredCourses.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "4.5rem 2rem",
                  background: "var(--color-surface)",
                  borderRadius: "16px",
                  border: "1px dashed var(--color-border)",
                }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: "3.5rem", color: "var(--text-muted)", marginBottom: "0.75rem" }}
                >
                  school
                </span>
                <h3 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.35rem" }}>
                  {searchQuery || statusFilter !== "all"
                    ? "No matching courses found"
                    : "No Course Enrollments Found"}
                </h3>
                <p
                  style={{
                    color: "var(--text-muted)",
                    fontSize: "0.95rem",
                    maxWidth: "500px",
                    margin: "0 auto 1.5rem auto",
                    lineHeight: 1.6,
                  }}
                >
                  {searchQuery || statusFilter !== "all"
                    ? "Try adjusting your search query or progress filter."
                    : "You are not currently enrolled in any academic cohorts or programs. Your administrator will assign you to a cohort, or you can explore available courses."}
                </p>
                {availableCatalogPrograms.length > 0 && (
                  <button
                    onClick={() => setActiveTab("catalog")}
                    className="btn-primary"
                    style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
                  >
                    <span className="material-symbols-outlined">travel_explore</span>
                    Browse Available Courses ({availableCatalogPrograms.length})
                  </button>
                )}
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
                  gap: "1.5rem",
                }}
              >
                {filteredCourses.map((prog, idx) => {
                  const programId = prog.program_id ?? prog.id ?? idx;
                  const pct = prog.progress_percentage || 0;
                  const isComplete = pct >= 100;

                  return (
                    <div
                      key={programId}
                      style={{
                        background: "var(--color-surface)",
                        borderRadius: "16px",
                        border: "1px solid var(--color-border)",
                        overflow: "hidden",
                        display: "flex",
                        flexDirection: "column",
                        boxShadow: "var(--shadow-sm)",
                        transition: "transform 0.2s ease, box-shadow 0.2s ease",
                      }}
                      className="card-hover"
                    >
                      {/* Course Card Banner */}
                      <div
                        style={{
                          height: "140px",
                          background: isComplete
                            ? "linear-gradient(135deg, #059669 0%, #10b981 100%)"
                            : "linear-gradient(135deg, #3730a3 0%, #4f46e5 100%)",
                          padding: "1.25rem",
                          position: "relative",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span
                            style={{
                              background: "rgba(255,255,255,0.2)",
                              backdropFilter: "blur(6px)",
                              color: "#ffffff",
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              padding: "2px 10px",
                              borderRadius: "20px",
                              letterSpacing: "0.5px",
                            }}
                          >
                            {prog.code}
                          </span>

                          {prog.cohort_name && (
                            <span
                              style={{
                                background: "rgba(0,0,0,0.25)",
                                backdropFilter: "blur(6px)",
                                color: "#ffffff",
                                fontSize: "0.72rem",
                                fontWeight: 600,
                                padding: "2px 8px",
                                borderRadius: "12px",
                              }}
                            >
                              Cohort: {prog.cohort_name}
                            </span>
                          )}
                        </div>

                        <div>
                          <h2
                            style={{
                              fontSize: "1.2rem",
                              fontWeight: 800,
                              color: "#ffffff",
                              lineHeight: 1.3,
                              margin: 0,
                            }}
                          >
                            {prog.name}
                          </h2>
                        </div>
                      </div>

                      {/* Course Card Body */}
                      <div style={{ padding: "1.25rem 1.4rem", display: "flex", flexDirection: "column", flex: 1 }}>
                        <p
                          style={{
                            fontSize: "0.88rem",
                            color: "var(--text-muted)",
                            lineHeight: 1.5,
                            marginBottom: "1.25rem",
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                            minHeight: "2.6rem",
                          }}
                        >
                          {prog.description || "Comprehensive modular coursework and real-world project assignments."}
                        </p>

                        {/* Progress Bar */}
                        <div style={{ marginBottom: "1.25rem" }}>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              fontSize: "0.82rem",
                              marginBottom: "0.4rem",
                            }}
                          >
                            <span style={{ fontWeight: 700, color: "var(--text-main)" }}>
                              {pct}% Completed
                            </span>
                            <span style={{ color: "var(--text-muted)" }}>
                              {prog.completed_lessons ?? 0} of {prog.total_lessons ?? 0} Lessons
                            </span>
                          </div>
                          <div
                            style={{
                              height: "8px",
                              background: "rgba(0,0,0,0.06)",
                              borderRadius: "6px",
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                height: "100%",
                                width: `${Math.min(100, pct)}%`,
                                background: isComplete
                                  ? "#10b981"
                                  : "linear-gradient(90deg, var(--primary) 0%, #6366f1 100%)",
                                borderRadius: "6px",
                                transition: "width 0.4s ease",
                              }}
                            />
                          </div>
                        </div>

                        {/* Next Activity Hint if available */}
                        {prog.next_activity && (
                          <div
                            style={{
                              background: "var(--bg-subtle, rgba(0,0,0,0.02))",
                              borderRadius: "8px",
                              padding: "0.6rem 0.8rem",
                              marginBottom: "1.25rem",
                              display: "flex",
                              alignItems: "center",
                              gap: "0.5rem",
                              fontSize: "0.8rem",
                              color: "var(--text-muted)",
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: "1.1rem", color: "var(--primary)" }}>
                              play_circle
                            </span>
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              Up next: <strong>{prog.next_activity.title}</strong>
                            </span>
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div style={{ marginTop: "auto", display: "flex", gap: "0.5rem" }}>
                          <Link
                            href={`/student/programs/${programId}`}
                            className="btn-primary"
                            style={{
                              flex: 1,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: "0.4rem",
                              padding: "0.6rem 1rem",
                              fontSize: "0.88rem",
                              fontWeight: 700,
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: "1.15rem" }}>
                              {isComplete ? "replay" : "play_circle"}
                            </span>
                            {isComplete ? "Review Course" : pct > 0 ? "Continue Learning" : "Start Course"}
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Available Courses in Catalog */}
        {activeTab === "catalog" && (
          <div>
            {availableCatalogPrograms.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "4rem 2rem",
                  background: "var(--color-surface)",
                  borderRadius: "16px",
                  border: "1px dashed var(--color-border)",
                }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: "3rem", color: "var(--text-muted)", marginBottom: "0.75rem" }}
                >
                  inventory_2
                </span>
                <h3 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "0.35rem" }}>
                  All Available Courses Enrolled
                </h3>
                <p style={{ color: "var(--text-muted)", maxWidth: "450px", margin: "0 auto 1.5rem auto" }}>
                  You are currently enrolled in all programs configured for your organization.
                </p>
                <button
                  onClick={() => setActiveTab("enrolled")}
                  className="btn-primary"
                >
                  View My Enrolled Courses
                </button>
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
                  gap: "1.5rem",
                }}
              >
                {availableCatalogPrograms.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      background: "var(--color-surface)",
                      borderRadius: "16px",
                      border: "1px solid var(--color-border)",
                      overflow: "hidden",
                      display: "flex",
                      flexDirection: "column",
                      boxShadow: "var(--shadow-sm)",
                    }}
                  >
                    <div
                      style={{
                        height: "130px",
                        background: "linear-gradient(135deg, #475569 0%, #1e293b 100%)",
                        padding: "1.25rem",
                        position: "relative",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                      }}
                    >
                      <span
                        style={{
                          background: "rgba(255,255,255,0.2)",
                          color: "#ffffff",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          padding: "2px 10px",
                          borderRadius: "20px",
                          width: "fit-content",
                        }}
                      >
                        {p.code}
                      </span>
                      <h2
                        style={{
                          fontSize: "1.15rem",
                          fontWeight: 800,
                          color: "#ffffff",
                          lineHeight: 1.3,
                          margin: 0,
                        }}
                      >
                        {p.name}
                      </h2>
                    </div>

                    <div style={{ padding: "1.25rem 1.4rem", display: "flex", flexDirection: "column", flex: 1 }}>
                      <p
                        style={{
                          fontSize: "0.88rem",
                          color: "var(--text-muted)",
                          lineHeight: 1.5,
                          marginBottom: "1.25rem",
                          flex: 1,
                        }}
                      >
                        {p.description || "No description provided for this program."}
                      </p>

                      <div
                        style={{
                          marginTop: "auto",
                          paddingTop: "0.75rem",
                          borderTop: "1px solid var(--color-border)",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                          fontSize: "0.82rem",
                          color: "var(--text-muted)",
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: "1.1rem", color: "var(--primary)" }}>
                          info
                        </span>
                        <span>Contact your academic advisor for cohort assignment.</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </RequireAuth>
  );
}
