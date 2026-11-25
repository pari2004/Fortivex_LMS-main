"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import { useAuth } from "@/lib/auth/AuthContext";

export default function StudentDashboardPage() {
  const { user, token, organization } = useAuth();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [streakDays, setStreakDays] = useState<number>(0);
  const [navCounts, setNavCounts] = useState<any>(null);

  useEffect(() => {
    if (!token) return;
    import("@/lib/api/client").then(({ apiRequest }) => {
      apiRequest("/api/v1/students/me/dashboard", { token })
        .then(setData)
        .catch(() => {
          // Empty dashboard state for unenrolled student or on error
          setData({
            programs: [],
            kpis: {
              active_courses: 0,
              lessons_completed: 0,
              programs_enrolled: 0,
              hours_studied: 0,
            },
          });
        });
    });

    import("@/lib/api/endpoints").then(({ getStudentStreak, getStudentNavCounts }) => {
      getStudentStreak(token)
        .then((s) => setStreakDays(s?.current_streak ?? 0))
        .catch(() => setStreakDays(0));

      getStudentNavCounts(token)
        .then(setNavCounts)
        .catch(() => {});
    });
  }, [token]);

  if (error) return <ErrorState message={error} onRetry={() => window.location.reload()} />;
  if (!data) return <LoadingState message="Loading your personalized dashboard..." />;

  const firstName = user?.full_name?.split(" ")[0] || "Student";

  return (
    <RequireAuth>
      <div style={{ maxWidth: "1200px", margin: "0 auto", animation: "fadeIn 0.35s ease-out" }}>
        {/* Luxury Hero Welcome Banner */}
        <div
          className="hero-banner"
          style={{
            background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #0ea5e9 100%)",
            borderRadius: "24px",
            padding: "2.75rem 3rem",
            color: "#ffffff",
            marginBottom: "2.5rem",
            boxShadow: "0 12px 30px rgba(79, 70, 229, 0.25)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Ambient circles */}
          <div
            style={{
              position: "absolute",
              top: "-60px",
              right: "-60px",
              width: "220px",
              height: "220px",
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(255,255,255,0.2) 0%, transparent 70%)",
              pointerEvents: "none",
            }}
          />

          <div
            style={{
              position: "relative",
              zIndex: 1,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "1.5rem",
            }}
          >
            <div>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  padding: "0.25rem 0.75rem",
                  borderRadius: "99px",
                  background: "rgba(255, 255, 255, 0.15)",
                  backdropFilter: "blur(8px)",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  marginBottom: "0.85rem",
                }}
              >
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#4ade80" }} />
                {organization?.name || "Fortivex LMS"} • Academic Session 2026
              </div>

              <h1
                style={{
                  fontSize: "2.5rem",
                  fontWeight: 800,
                  marginBottom: "0.5rem",
                  letterSpacing: "-0.02em",
                  lineHeight: 1.15,
                }}
              >
                Welcome back, {firstName}! 🚀
              </h1>
              <p style={{ fontSize: "1.05rem", opacity: 0.9, maxWidth: "560px", lineHeight: 1.5 }}>
                You are on track. Continue where you left off or join today's interactive live session.
              </p>
            </div>

            {/* Streak & Live Pill */}
            <div style={{ display: "flex", gap: "1rem" }}>
              <div
                style={{
                  background: "rgba(0, 0, 0, 0.2)",
                  backdropFilter: "blur(10px)",
                  padding: "1rem 1.5rem",
                  borderRadius: "16px",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
              >
                <div style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.06em", opacity: 0.85, fontWeight: 700 }}>
                  Active Streak
                </div>
                <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "#fde047", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: "1.8rem" }}>
                    local_fire_department
                  </span>
                  {streakDays} {streakDays === 1 ? "Day" : "Days"}
                </div>
              </div>

              <Link
                href="/student/live"
                style={{
                  background: "#ffffff",
                  color: "var(--primary)",
                  padding: "1rem 1.5rem",
                  borderRadius: "16px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  textDecoration: "none",
                  fontWeight: 800,
                  fontSize: "0.95rem",
                  boxShadow: "0 6px 16px rgba(0,0,0,0.15)",
                  transition: "transform 0.15s ease",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "1.8rem", color: "#10b981" }}>
                  videocam
                </span>
                Join Live Class
              </Link>
            </div>
          </div>
        </div>

        {/* KPI Metrics Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "1.25rem",
            marginBottom: "2.5rem",
          }}
        >
          {[
            {
              title: "Enrolled Programs",
              value: data.kpis?.programs_enrolled ?? 0,
              trend: (data.kpis?.programs_enrolled ?? 0) > 0 ? "Active Cohort" : "No active cohort",
              icon: "school",
              color: "#4f46e5",
            },
            {
              title: "Completed Lessons",
              value: data.kpis?.lessons_completed ?? 0,
              trend: (data.kpis?.lessons_completed ?? 0) > 0 ? "Tracked progress" : "Start your first lesson",
              icon: "check_circle",
              color: "#10b981",
            },
            {
              title: "Study Hours",
              value: typeof data.kpis?.hours_studied === "string" ? data.kpis.hours_studied : `${data.kpis?.hours_studied ?? 0} hrs`,
              trend: parseFloat(String(data.kpis?.hours_studied || 0)) > 0 ? "Logged time" : "0 hours logged",
              icon: "schedule",
              color: "#0ea5e9",
            },
            {
              title: "Avg. Assessment",
              value: data.kpis?.avg_assessment ? `${data.kpis.avg_assessment}%` : "—",
              trend: data.kpis?.avg_assessment ? "Graded average" : "No quiz attempts yet",
              icon: "military_tech",
              color: "#f59e0b",
            },
          ].map((kpi) => (
            <div
              key={kpi.title}
              className="card-hover"
              style={{
                background: "#ffffff",
                padding: "1.5rem",
                borderRadius: "16px",
                border: "1px solid var(--border)",
                boxShadow: "var(--shadow-xs)",
                display: "flex",
                flexDirection: "column",
                position: "relative",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: "1.25rem",
                  right: "1.25rem",
                  width: "40px",
                  height: "40px",
                  borderRadius: "10px",
                  background: `${kpi.color}15`,
                  color: kpi.color,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "1.4rem" }}>
                  {kpi.icon}
                </span>
              </div>

              <div style={{ color: "var(--text-muted)", fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "0.5rem" }}>
                {kpi.title}
              </div>
              <div style={{ fontSize: "2rem", fontWeight: 800, color: "var(--text-main)", marginBottom: "0.35rem" }}>
                {kpi.value}
              </div>
              <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--success)" }}>
                {kpi.trend}
              </div>
            </div>
          ))}
        </div>

        {/* Quick Launchpad to Sub-Modules */}
        <div style={{ marginBottom: "2.5rem" }}>
          <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--text-main)", marginBottom: "1rem" }}>
            Academic Quick Hub
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1rem" }}>
            {(() => {
              const pendingCount = navCounts?.pending_assignments ?? 0;
              const unattemptedQuizzes = navCounts?.unattempted_quizzes ?? 0;
              return [
                {
                  title: "Course Assignments",
                  desc: pendingCount > 0 ? `${pendingCount} pending task${pendingCount > 1 ? "s" : ""} with rubrics` : "All assignments submitted",
                  href: "/student/assignments",
                  icon: "assignment",
                  color: "#4f46e5",
                  badge: pendingCount > 0 ? `${pendingCount} Due` : "Completed",
                },
                {
                  title: "Quizzes & Tests",
                  desc: unattemptedQuizzes > 0 ? `${unattemptedQuizzes} quiz${unattemptedQuizzes > 1 ? "zes" : ""} ready to attempt` : "All quizzes completed",
                  href: "/student/quizzes",
                  icon: "quiz",
                  color: "#8b5cf6",
                  badge: unattemptedQuizzes > 0 ? (unattemptedQuizzes === 1 ? "New" : `${unattemptedQuizzes} New`) : "Completed",
                },
                { title: "Resource Library", desc: "Lecture slides, code & datasets", href: "/student/resources", icon: "cloud_download", color: "#0ea5e9", badge: "5 Files" },
                { title: "Discussion Forum", desc: "Peer Q&A and instructor verified answers", href: "/student/discussions", icon: "forum", color: "#10b981", badge: "Active" },
              ];
            })().map((mod) => (
              <Link
                key={mod.href}
                href={mod.href}
                className="card-hover"
                style={{
                  background: "#ffffff",
                  borderRadius: "16px",
                  border: "1px solid var(--border)",
                  padding: "1.25rem 1.5rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  textDecoration: "none",
                  boxShadow: "var(--shadow-xs)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  <div
                    style={{
                      width: "44px",
                      height: "44px",
                      borderRadius: "12px",
                      background: `${mod.color}15`,
                      color: mod.color,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "1.4rem" }}>
                      {mod.icon}
                    </span>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text-main)" }}>
                      {mod.title}
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{mod.desc}</div>
                  </div>
                </div>

                <span className="badge-pill badge-primary" style={{ fontSize: "0.7rem" }}>
                  {mod.badge}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* In-Progress Programs Section */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--text-main)" }}>
              My Enrolled Programs
            </h2>
            <Link href="/student/courses" style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--primary)" }}>
              View All Courses →
            </Link>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "1.25rem" }}>
            {(data.programs || []).length === 0 ? (
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: "18px",
                  border: "1px dashed var(--border)",
                  padding: "3.5rem 2rem",
                  textAlign: "center",
                  boxShadow: "var(--shadow-xs)",
                }}
              >
                <div
                  style={{
                    width: "60px",
                    height: "60px",
                    borderRadius: "50%",
                    background: "rgba(79, 70, 229, 0.08)",
                    color: "var(--primary)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 1.25rem auto",
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "2.2rem" }}>
                    school
                  </span>
                </div>
                <h3 style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--text-main)", marginBottom: "0.5rem" }}>
                  No Active Program Enrollment
                </h3>
                <p style={{ fontSize: "0.95rem", color: "var(--text-muted)", maxWidth: "540px", margin: "0 auto 1.5rem auto", lineHeight: 1.6 }}>
                  You are not currently enrolled in any academic cohorts or programs. Once your academic administrator assigns you to a cohort, your coursework, lessons, and live sessions will appear here.
                </p>
                <Link
                  href="/student/courses"
                  className="btn-primary"
                  style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "1.2rem" }}>
                    school
                  </span>
                  View My Courses
                </Link>
              </div>
            ) : (
              (data.programs || []).map((prog: any, idx: number) => {
                const programId = prog.program_id ?? prog.id ?? idx;
                const uniqueKey = prog.enrollment_id
                  ? `enrollment-${prog.enrollment_id}`
                  : prog.id
                  ? `prog-${prog.id}`
                  : `prog-${programId}-${idx}`;
                const title = prog.title || prog.program_name || "Enrolled Program";
                const progressVal = prog.progress_percent ?? prog.progress_percentage ?? 0;
                const code = prog.code || prog.cohort_name || "CORE-2026";
                const status = prog.status || "ACTIVE";
                const currentModule =
                  prog.current_module || (prog.cohort_name ? `Cohort: ${prog.cohort_name}` : "Module 1: Foundations");
                const description =
                  prog.description ||
                  (prog.cohort_name
                    ? `Enrolled in cohort ${prog.cohort_name}. Complete modules and assignments to progress.`
                    : "Comprehensive curriculum and hands-on activities.");

                return (
                  <div
                    key={uniqueKey}
                    className="card-hover"
                    style={{
                      background: "#ffffff",
                      borderRadius: "18px",
                      border: "1px solid var(--border)",
                      padding: "2rem",
                      boxShadow: "var(--shadow-xs)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
                      <div style={{ flex: 1, minWidth: "280px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.5rem" }}>
                          <span className="badge-pill badge-primary">{code}</span>
                          <span className="badge-pill badge-success">{status}</span>
                        </div>

                        <h3 style={{ fontSize: "1.35rem", fontWeight: 800, color: "var(--text-main)", marginBottom: "0.4rem" }}>
                          {title}
                        </h3>
                        <p style={{ fontSize: "0.9rem", color: "var(--text-muted)", lineHeight: 1.5, maxWidth: "700px" }}>
                          {description}
                        </p>

                        <div style={{ marginTop: "1rem", fontSize: "0.85rem", color: "var(--text-main)", fontWeight: 600 }}>
                          Current Module:{" "}
                          <span style={{ color: "var(--primary)", fontWeight: 700 }}>
                            {currentModule}
                          </span>
                        </div>
                      </div>

                      <div style={{ minWidth: "220px", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", fontWeight: 700, marginBottom: "0.35rem" }}>
                            <span>Progress</span>
                            <span style={{ color: "var(--primary)" }}>{progressVal}%</span>
                          </div>
                          <div style={{ height: "8px", width: "100%", background: "#f1f5f9", borderRadius: "99px", overflow: "hidden" }}>
                            <div
                              style={{
                                height: "100%",
                                width: `${progressVal}%`,
                                background: "var(--primary-gradient)",
                                borderRadius: "99px",
                              }}
                            />
                          </div>
                        </div>

                        <Link
                          href={programId ? `/student/programs/${programId}` : "/student"}
                          className="btn-primary"
                          style={{ width: "100%", textAlign: "center" }}
                        >
                          <span className="material-symbols-outlined">play_circle</span>
                          Continue Learning
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </RequireAuth>
  );
}
