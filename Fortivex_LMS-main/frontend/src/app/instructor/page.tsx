"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { INSTRUCTOR_ROLES, PROGRAM_COHORT_ADMIN_ROLES } from "@/lib/auth/roles";
import { useAuth } from "@/lib/auth/AuthContext";
import { usePrograms } from "@/lib/api/usePrograms";
import { useCohorts } from "@/lib/api/useCohorts";
import { useUsers } from "@/lib/api/useUsers";
import { apiRequest } from "@/lib/api/client";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

function InstructorContent() {
  const { user, token, organization } = useAuth();
  const { programs } = usePrograms(organization?.id);
  const { cohorts } = useCohorts();
  const { users } = useUsers(organization?.id);
  const [quizzes, setQuizzes] = useState<any[] | null>(null);

  useEffect(() => {
    if (token) {
      apiRequest<any[]>("/api/v1/quizzes", { token })
        .then(setQuizzes)
        .catch(() => setQuizzes([]));
    }
  }, [token]);

  const activePrograms = programs?.filter(p => p.status === "ACTIVE") || [];
  const activeCohorts = cohorts?.filter(c => c.status === "ACTIVE") || [];
  const studentsCount = users?.filter(u => u.roles?.includes("STUDENT")).length || 0;
  const quizzesCount = quizzes !== null ? quizzes.length : null;

  const tools = [
    {
      title: "Content & Curriculum",
      desc: "Build modules, lessons, and interactive learning material.",
      icon: "menu_book",
      href: "/instructor/programs",
      color: "#4f46e5",
      badge: `${activePrograms.length} Programs`
    },
    {
      title: "Cohort Management",
      desc: "Manage class cohorts, track student rosters, and schedules.",
      icon: "school",
      href: "/instructor/cohorts",
      color: "#0ea5e9",
      badge: `${activeCohorts.length} Active`
    },
    {
      title: "Quiz Management",
      desc: "Create AI quizzes, coding sandboxes, and question banks.",
      icon: "quiz",
      href: "/instructor/quizzes",
      color: "#f59e0b",
      badge: quizzesCount !== null ? `${quizzesCount} Quizzes` : "Quizzes"
    },
    {
      title: "Live Class Sessions",
      desc: "Schedule and host interactive live streams and seminars.",
      icon: "video_camera_front",
      href: "/instructor/live",
      color: "#8b5cf6",
      badge: "Live"
    },
    {
      title: "Grade Center & Assignments",
      desc: "Review student submissions, rubric evaluations, and code grades.",
      icon: "grading",
      href: "/instructor/assignments",
      color: "#10b981",
      badge: "Active",
    }
  ];

  return (
    <div style={{ maxWidth: "1240px", margin: "0 auto", animation: "fadeIn 0.5s ease-out" }}>
      {/* Welcome Banner */}
      <div className="hero-banner" style={{ 
        background: "linear-gradient(135deg, #1e3a8a 0%, #312e81 60%, #4338ca 100%)",
        borderRadius: "24px",
        padding: "2.5rem 3rem",
        color: "white",
        marginBottom: "2.5rem",
        boxShadow: "0 12px 30px rgba(30, 58, 138, 0.25)",
        position: "relative",
        overflow: "hidden"
      }}>
        {/* Decorative background geometry */}
        <div style={{ position: "absolute", top: "-50px", right: "-50px", width: "220px", height: "220px", borderRadius: "50%", background: "rgba(255,255,255,0.06)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: "-70px", right: "120px", width: "160px", height: "160px", borderRadius: "50%", background: "rgba(255,255,255,0.04)", pointerEvents: "none" }} />
        
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", background: "rgba(255, 255, 255, 0.15)", backdropFilter: "blur(8px)", padding: "0.35rem 0.9rem", borderRadius: "20px", fontSize: "0.85rem", fontWeight: 600, marginBottom: "1rem" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "1.1rem" }}>verified</span>
            Instructor Hub
          </div>
          <h1 style={{ fontSize: "2.4rem", fontWeight: 800, marginBottom: "0.5rem", letterSpacing: "-0.02em" }}>
            Welcome back, {user?.full_name?.split(' ')[0] || "Instructor"}! 🎓
          </h1>
          <p style={{ fontSize: "1.05rem", opacity: 0.9, maxWidth: "680px", lineHeight: 1.6, margin: 0 }}>
            Manage your program curriculum modules, administer student cohorts, conduct quizzes with coding sandboxes, and host live sessions.
          </p>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
        gap: "1.5rem",
        marginBottom: "3rem"
      }}>
        {[
          { title: "Active Programs", value: activePrograms.length, icon: "library_books", color: "#4f46e5", href: "/instructor/programs" },
          { title: "Active Cohorts", value: activeCohorts.length, icon: "calendar_today", color: "#0ea5e9", href: "/instructor/cohorts" },
          { title: "Enrolled Students", value: studentsCount, icon: "groups", color: "#10b981", href: "/instructor/cohorts" },
          { title: "Quizzes & Tests", value: quizzesCount !== null ? quizzesCount : "...", icon: "quiz", color: "#f59e0b", href: "/instructor/quizzes" }
        ].map((kpi, i) => (
          <Link key={i} href={kpi.href} style={{ textDecoration: "none", color: "inherit" }}>
            <div style={{
              background: "var(--color-surface)",
              padding: "1.75rem",
              borderRadius: "18px",
              border: "1px solid var(--color-border)",
              boxShadow: "var(--shadow-glass)",
              display: "flex",
              flexDirection: "column",
              position: "relative",
              overflow: "hidden",
              transition: "transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease",
              cursor: "pointer"
            }}
            onMouseEnter={(e) => { 
              e.currentTarget.style.transform = "translateY(-4px)"; 
              e.currentTarget.style.boxShadow = "var(--shadow-lg)"; 
              e.currentTarget.style.borderColor = kpi.color;
            }}
            onMouseLeave={(e) => { 
              e.currentTarget.style.transform = "none"; 
              e.currentTarget.style.boxShadow = "var(--shadow-glass)"; 
              e.currentTarget.style.borderColor = "var(--color-border)";
            }}
            >
              <div style={{ position: "absolute", top: "1.5rem", right: "1.5rem", width: "42px", height: "42px", borderRadius: "12px", background: `${kpi.color}18`, color: kpi.color, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span className="material-symbols-outlined" style={{ fontSize: "1.5rem" }}>{kpi.icon}</span>
              </div>
              
              <div style={{ color: "var(--text-muted)", fontSize: "0.85rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.75rem" }}>
                {kpi.title}
              </div>
              <div style={{ fontSize: "2.4rem", fontWeight: 800, color: "var(--foreground)", marginBottom: "0.25rem" }}>
                {kpi.value}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Instructor Tools Section */}
      <div style={{ marginBottom: "3rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <div>
            <h2 style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--foreground)", margin: 0 }}>Instructor Tools</h2>
            <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginTop: "0.25rem" }}>Direct access to course building, assessments, cohorts, and teaching instruments.</p>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.5rem" }}>
          {tools.map((action, i) => {
            const isClickable = action.href !== "#";
            const CardElement = (
              <div style={{
                display: "flex",
                flexDirection: "column",
                gap: "1rem",
                padding: "1.75rem",
                background: "var(--color-surface)",
                borderRadius: "18px",
                border: "1px solid var(--color-border)",
                boxShadow: "var(--shadow-sm)",
                transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
                cursor: isClickable ? "pointer" : "default",
                height: "100%",
                opacity: isClickable ? 1 : 0.8
              }}
              onMouseEnter={(e) => { 
                if (isClickable) {
                  e.currentTarget.style.borderColor = action.color;
                  e.currentTarget.style.transform = "translateY(-4px)";
                  e.currentTarget.style.boxShadow = `0 10px 24px ${action.color}20`;
                }
              }}
              onMouseLeave={(e) => { 
                if (isClickable) {
                  e.currentTarget.style.borderColor = "var(--color-border)";
                  e.currentTarget.style.transform = "none";
                  e.currentTarget.style.boxShadow = "var(--shadow-sm)";
                }
              }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ width: "52px", height: "52px", borderRadius: "14px", background: `${action.color}15`, color: action.color, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "1.85rem" }}>{action.icon}</span>
                  </div>
                  <span style={{ 
                    fontSize: "0.75rem", 
                    fontWeight: 700, 
                    padding: "0.3rem 0.7rem", 
                    borderRadius: "20px", 
                    background: isClickable ? `${action.color}12` : "rgba(0,0,0,0.06)", 
                    color: isClickable ? action.color : "var(--text-muted)",
                    border: `1px solid ${isClickable ? action.color + "30" : "transparent"}`
                  }}>
                    {action.badge}
                  </span>
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "1.15rem", color: "var(--foreground)", marginBottom: "0.35rem" }}>{action.title}</div>
                  <div style={{ fontSize: "0.88rem", color: "var(--text-muted)", lineHeight: 1.5 }}>{action.desc}</div>
                </div>
                {isClickable && (
                  <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: "0.35rem", color: action.color, fontSize: "0.85rem", fontWeight: 700 }}>
                    Launch Tool
                    <span className="material-symbols-outlined" style={{ fontSize: "1rem" }}>arrow_forward</span>
                  </div>
                )}
              </div>
            );

            if (isClickable) {
              return (
                <Link key={i} href={action.href} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
                  {CardElement}
                </Link>
              );
            }

            return <div key={i}>{CardElement}</div>;
          })}
        </div>
      </div>

      {/* Program & Cohort Quick Overview */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: "2rem" }}>
        {/* Active Programs Overview */}
        <div style={{ background: "var(--color-surface)", borderRadius: "20px", border: "1px solid var(--color-border)", padding: "1.75rem", boxShadow: "var(--shadow-glass)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <span className="material-symbols-outlined" style={{ color: "#4f46e5" }}>library_books</span>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 700, margin: 0 }}>Active Programs</h3>
            </div>
            <Link href="/instructor/programs">
              <Button variant="secondary" style={{ fontSize: "0.82rem", padding: "0.35rem 0.8rem" }}>View All</Button>
            </Link>
          </div>

          {activePrograms.length === 0 ? (
            <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>No active programs available.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {activePrograms.slice(0, 4).map((prog) => (
                <div key={prog.id} style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "0.85rem 1rem",
                  borderRadius: "12px",
                  background: "var(--background)",
                  border: "1px solid var(--color-border)"
                }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.95rem", color: "var(--foreground)" }}>{prog.name}</div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Code: {prog.code}</div>
                  </div>
                  <Link href={`/instructor/programs/${prog.id}`}>
                    <Button variant="secondary" style={{ fontSize: "0.8rem", padding: "0.3rem 0.7rem" }}>
                      Curriculum
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Active Cohorts Overview */}
        <div style={{ background: "var(--color-surface)", borderRadius: "20px", border: "1px solid var(--color-border)", padding: "1.75rem", boxShadow: "var(--shadow-glass)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <span className="material-symbols-outlined" style={{ color: "#0ea5e9" }}>school</span>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 700, margin: 0 }}>Active Cohorts</h3>
            </div>
            <Link href="/instructor/cohorts">
              <Button variant="secondary" style={{ fontSize: "0.82rem", padding: "0.35rem 0.8rem" }}>View All</Button>
            </Link>
          </div>

          {activeCohorts.length === 0 ? (
            <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>No active cohorts currently running.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {activeCohorts.slice(0, 4).map((c) => (
                <div key={c.id} style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "0.85rem 1rem",
                  borderRadius: "12px",
                  background: "var(--background)",
                  border: "1px solid var(--color-border)"
                }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.95rem", color: "var(--foreground)" }}>{c.name}</div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Code: {c.code}</div>
                  </div>
                  <Link href={`/instructor/cohorts/${c.id}`}>
                    <Button variant="secondary" style={{ fontSize: "0.8rem", padding: "0.3rem 0.7rem" }}>
                      Roster & Details
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function InstructorPage() {
  return (
    <RequireAuth allowedRoles={[...INSTRUCTOR_ROLES, ...PROGRAM_COHORT_ADMIN_ROLES]}>
      <InstructorContent />
    </RequireAuth>
  );
}
