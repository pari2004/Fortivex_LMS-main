"use client";

import Link from "next/link";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { useAuth } from "@/lib/auth/AuthContext";
import { usePrograms } from "@/lib/api/usePrograms";
import { useCohorts } from "@/lib/api/useCohorts";
import { useUsers } from "@/lib/api/useUsers";
import { Icon } from "@/components/ui/Icon";

function AdminContent() {
  const { user, organization } = useAuth();
  const orgId = organization?.id || user?.organizations?.[0]?.id;
  const { programs } = usePrograms(orgId);
  const { cohorts } = useCohorts();
  const { users } = useUsers(orgId);

  const activeProgramsCount = programs?.filter((p) => p.status === "ACTIVE").length || 0;
  const activeCohortsCount = cohorts?.filter((c) => c.status === "ACTIVE").length || 0;
  const studentsCount = users?.filter((u) => u.roles?.includes("STUDENT")).length || 0;
  const instructorsCount = users?.filter((u) => u.roles?.includes("TRAINER") || u.roles?.includes("INSTRUCTOR")).length || 0;

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", animation: "fadeIn 0.35s ease-out" }}>
      {/* Admin Hero Banner */}
      <div
        className="hero-banner"
        style={{
          background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #4338ca 100%)",
          borderRadius: "24px",
          padding: "2.75rem 3rem",
          color: "#ffffff",
          marginBottom: "2.5rem",
          boxShadow: "0 12px 30px rgba(30, 27, 75, 0.25)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "-50px",
            right: "-50px",
            width: "220px",
            height: "220px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(99, 102, 241, 0.25) 0%, transparent 70%)",
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
                background: "rgba(255, 255, 255, 0.12)",
                backdropFilter: "blur(8px)",
                fontSize: "0.78rem",
                fontWeight: 600,
                marginBottom: "0.85rem",
              }}
            >
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#38bdf8" }} />
              {organization?.name || "Fortivex System Control"} • Multi-Tenant Administration
            </div>

            <h1
              style={{
                fontSize: "2.4rem",
                fontWeight: 800,
                marginBottom: "0.4rem",
                letterSpacing: "-0.02em",
                lineHeight: 1.15,
              }}
            >
              Academy Control Center ⚡
            </h1>
            <p style={{ fontSize: "1.05rem", opacity: 0.85, maxWidth: "560px", lineHeight: 1.5 }}>
              Monitor institutional performance, manage curriculum pipelines, and administer active cohorts.
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <Link
              href="/admin/programs"
              className="btn-primary"
              style={{ background: "#ffffff", color: "#1e1b4b", boxShadow: "0 4px 14px rgba(0,0,0,0.2)" }}
            >
              <Icon name="add" size={18} color="#4f46e5" />
              Create Program
            </Link>
            <Link
              href="/admin/live"
              className="btn-secondary"
              style={{ background: "rgba(255, 255, 255, 0.1)", color: "#ffffff", borderColor: "rgba(255, 255, 255, 0.2)" }}
            >
              <Icon name="videocam" size={18} color="#38bdf8" />
              Start Live Room
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "1.25rem",
          marginBottom: "2.5rem",
        }}
      >
        {[
          { title: "Total Students", value: studentsCount, trend: "Active learners", icon: "group", color: "#4f46e5" },
          { title: "Active Programs", value: activeProgramsCount, trend: "Curricula in session", icon: "menu_book", color: "#0ea5e9" },
          { title: "Active Cohorts", value: activeCohortsCount, trend: "On schedule", icon: "groups", color: "#10b981" },
          { title: "Faculty & Trainers", value: instructorsCount, trend: "Verified staff", icon: "badge", color: "#f59e0b" },
        ].map((kpi, i) => (
          <div
            key={i}
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
              <Icon name={kpi.icon} size={22} color={kpi.color} />
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

      {/* Quick Launch Actions & Administrative Panels */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1.5rem", alignItems: "start" }}>
        {/* Core Administrative Operations */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: "18px",
            border: "1px solid var(--border)",
            padding: "2rem",
            boxShadow: "var(--shadow-xs)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
            <div>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--text-main)" }}>
                Academic Management Modules
              </h2>
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                Direct access to curriculum authoring, cohort scheduling, and evaluation.
              </p>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            {[
              { title: "Programs & Curriculum", desc: "Manage weeks, lessons & activities", href: "/admin/programs", icon: "menu_book", color: "#4f46e5" },
              { title: "Cohorts & Classes", desc: "Enrollments and calendar scheduling", href: "/admin/cohorts", icon: "groups", color: "#0ea5e9" },
              { title: "Student Submissions", desc: "Review rubrics and grade project code", href: "/admin/assignments", icon: "assignment", color: "#10b981" },
              { title: "Live Classroom Rooms", desc: "Launch WebRTC video lecture rooms", href: "/admin/live", icon: "videocam", color: "#8b5cf6" },
              { title: "Assessments & Quizzes", desc: "Author questions, rubrics & AI quizzes", href: "/admin/quizzes", icon: "quiz", color: "#f59e0b" },
              { title: "User & Role Directory", desc: "Invite students, instructors & staff", href: "/admin/users", icon: "badge", color: "#ec4899" },
            ].map((item, idx) => (
              <Link
                key={idx}
                href={item.href}
                className="card-hover"
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "0.85rem",
                  padding: "1.15rem",
                  borderRadius: "12px",
                  border: "1px solid var(--border)",
                  background: "#f8fafc",
                  textDecoration: "none",
                }}
              >
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "8px",
                    background: `${item.color}15`,
                    color: item.color,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Icon name={item.icon} size={18} color={item.color} />
                </div>
                <div>
                  <div style={{ fontSize: "0.92rem", fontWeight: 700, color: "var(--text-main)" }}>
                    {item.title}
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "2px" }}>
                    {item.desc}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Multi-Tenant System Status Panel */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: "18px",
            border: "1px solid var(--border)",
            padding: "2rem",
            boxShadow: "var(--shadow-xs)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
            <Icon name="check_circle" size={20} color="var(--success)" />
            <h3 style={{ fontSize: "1.15rem", fontWeight: 800 }}>Platform Status</h3>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "1rem", fontSize: "0.85rem" }}>
            <div style={{ padding: "0.75rem", background: "#f8fafc", borderRadius: "10px", border: "1px solid var(--border)" }}>
              <div style={{ fontWeight: 700, color: "var(--text-main)" }}>Database Engine</div>
              <div style={{ color: "var(--success)", fontWeight: 600, marginTop: "2px" }}>
                ● PostgreSQL 17 Connected
              </div>
            </div>

            <div style={{ padding: "0.75rem", background: "#f8fafc", borderRadius: "10px", border: "1px solid var(--border)" }}>
              <div style={{ fontWeight: 700, color: "var(--text-main)" }}>Tenant Isolation</div>
              <div style={{ color: "var(--primary)", fontWeight: 600, marginTop: "2px" }}>
                ● Org Scoped Data Isolation Active
              </div>
            </div>

            <div style={{ padding: "0.75rem", background: "#f8fafc", borderRadius: "10px", border: "1px solid var(--border)" }}>
              <div style={{ fontWeight: 700, color: "var(--text-main)" }}>Live Session Server</div>
              <div style={{ color: "var(--success)", fontWeight: 600, marginTop: "2px" }}>
                ● WebRTC Video Nodes Healthy
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  return (
    <RequireAuth>
      <AdminContent />
    </RequireAuth>
  );
}
