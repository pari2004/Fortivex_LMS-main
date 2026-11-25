"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { PROGRAM_COHORT_ADMIN_ROLES, INSTRUCTOR_ROLES } from "@/lib/auth/roles";
import { Icon } from "@/components/ui/Icon";
import {
  getStudentNavCounts,
  StudentNavCounts,
  getLiveStatus,
  LiveStatusResponse,
} from "@/lib/api/endpoints";

interface NavItem {
  label: string;
  href: string;
  icon: string;
  badge?: string;
  badgeColor?: "primary" | "warning" | "success" | "purple";
}

interface NavSection {
  title: string;
  items: NavItem[];
}

interface SidebarProps {
  mobileOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ mobileOpen = false, onClose }: SidebarProps) {
  const { user, organization, logout, token } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [navCounts, setNavCounts] = useState<StudentNavCounts | null>(null);
  const [liveStatus, setLiveStatus] = useState<LiveStatusResponse | null>(null);

  const isStudent = user?.roles.includes("STUDENT");

  useEffect(() => {
    if (!token) return;

    let isMounted = true;
    const fetchLiveAndCounts = () => {
      getLiveStatus(token)
        .then((data) => {
          if (isMounted) setLiveStatus(data);
        })
        .catch(() => {});

      if (isStudent) {
        getStudentNavCounts(token)
          .then((data) => {
            if (isMounted) setNavCounts(data);
          })
          .catch(() => {});
      }
    };

    fetchLiveAndCounts();
    const interval = setInterval(fetchLiveAndCounts, 60000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [token, isStudent, pathname]);

  if (!user) return null;

  // Determine real-time active / upcoming live status
  let isLiveNow = false;
  let liveTodayCount = 0;

  if (liveStatus) {
    if (liveStatus.is_live_now) {
      isLiveNow = true;
    }
    if (liveStatus.live_today > 0) {
      liveTodayCount = liveStatus.live_today;
    }

    // Verify against client browser clock for real-time accuracy and timezone alignment
    if (liveStatus.sessions && liveStatus.sessions.length > 0) {
      const now = new Date();
      const activeSessions = liveStatus.sessions.filter((s) => {
        const start = new Date(s.start_time);
        const end = new Date(s.end_time);
        return !isNaN(start.getTime()) && !isNaN(end.getTime()) && now >= start && now <= end;
      });
      isLiveNow = activeSessions.length > 0;

      const todayStr = now.toISOString().slice(0, 10);
      liveTodayCount = liveStatus.sessions.filter((s) => {
        const start = new Date(s.start_time);
        return (
          !isNaN(start.getTime()) &&
          start.toISOString().slice(0, 10) === todayStr &&
          start > now
        );
      }).length;
    }
  }

  // Student nav counts fallback if available
  if (navCounts?.is_live_now) {
    isLiveNow = true;
  }

  let liveBadge: string | undefined = undefined;
  let liveColor: "primary" | "warning" | "success" | "purple" = "success";
  if (isLiveNow) {
    liveBadge = "Live";
    liveColor = "success";
  } else if (liveTodayCount > 0) {
    liveBadge = `${liveTodayCount} Today`;
    liveColor = "primary";
  } else if (navCounts?.has_upcoming_live_today) {
    liveBadge = "Today";
    liveColor = "primary";
  }

  const isAdmin = user.roles.some((r) => PROGRAM_COHORT_ADMIN_ROLES.includes(r));
  const isInstructor = user.roles.some((r) => INSTRUCTOR_ROLES.includes(r));
  const isSuperAdmin = user.roles.includes("SUPER_ADMIN");

  const sections: NavSection[] = [];

  if (isAdmin) {
    sections.push(
      {
        title: "Overview",
        items: [
          { label: "Dashboard", href: "/admin", icon: "dashboard" },
        ],
      },
      {
        title: "Academic Operations",
        items: [
          { label: "Programs & Curriculum", href: "/admin/programs", icon: "menu_book" },
          { label: "Cohorts & Classes", href: "/admin/cohorts", icon: "groups" },
          { label: "Quizzes & Assessments", href: "/admin/quizzes", icon: "quiz" },
          { label: "Assignments & Grading", href: "/admin/assignments", icon: "assignment" },
          { label: "Resource Center", href: "/student/resources", icon: "folder_open" },
        ],
      },
      {
        title: "Live & Engagement",
        items: [
          { label: "Live Classrooms", href: "/admin/live", icon: "videocam", badge: liveBadge, badgeColor: liveColor },
          { label: "Discussion Forum", href: "/admin/discussions", icon: "forum" },
        ],
      },
      {
        title: "Administration",
        items: [
          ...(isSuperAdmin ? [{ label: "Organizations", href: "/admin/organizations", icon: "corporate_fare" }] : []),
          { label: "User Management", href: "/admin/users", icon: "badge" },
          { label: "Analytics & Reports", href: "/admin/reports", icon: "insights" },
          { label: "Platform Settings", href: "/admin/settings", icon: "tune" },
        ],
      }
    );
  } else if (isInstructor) {
    sections.push(
      {
        title: "Overview",
        items: [
          { label: "Dashboard", href: "/instructor", icon: "dashboard" },
        ],
      },
      {
        title: "Teaching",
        items: [
          { label: "My Programs", href: "/instructor/programs", icon: "menu_book" },
          { label: "Assigned Cohorts", href: "/instructor/cohorts", icon: "groups" },
          { label: "Quizzes", href: "/instructor/quizzes", icon: "quiz" },
          { label: "Assignments & Grading", href: "/instructor/assignments", icon: "assignment" },
          { label: "Learning Materials", href: "/student/resources", icon: "folder_open" },
        ],
      },
      {
        title: "Sessions & Community",
        items: [
          { label: "Live Sessions", href: "/instructor/live", icon: "videocam", badge: liveBadge, badgeColor: liveColor },
          { label: "Q&A Forum", href: "/instructor/discussions", icon: "forum" },
        ],
      }
    );
  } else if (isStudent) {
    const assignmentsBadge =
      navCounts && navCounts.pending_assignments > 0
        ? `${navCounts.pending_assignments} Due`
        : undefined;

    const quizzesBadge =
      navCounts && navCounts.unattempted_quizzes > 0
        ? (navCounts.unattempted_quizzes === 1 ? "New" : `${navCounts.unattempted_quizzes} New`)
        : undefined;

    sections.push(
      {
        title: "Learning",
        items: [
          { label: "My Dashboard", href: "/student", icon: "grid_view" },
          { label: "AI Tutor", href: "/student/chatbot", icon: "smart_toy" },
          { label: "My Courses", href: "/student/courses", icon: "school" },
          { label: "Assignments", href: "/student/assignments", icon: "assignment", badge: assignmentsBadge, badgeColor: "warning" },
          { label: "Quizzes & Tests", href: "/student/quizzes", icon: "quiz", badge: quizzesBadge, badgeColor: "purple" },
          { label: "Resource Library", href: "/student/resources", icon: "cloud_download" },
        ],
      },
      {
        title: "Interactive",
        items: [
          { label: "Live Lectures", href: "/student/live", icon: "videocam", badge: liveBadge, badgeColor: liveColor },
          { label: "Community Forum", href: "/student/discussions", icon: "forum" },
          { label: "Schedule & Calendar", href: "/student/calendar", icon: "calendar_month" },
        ],
      },
      {
        title: "Recognition",
        items: [
          { label: "Achievements", href: "/student/achievements", icon: "military_tech" },
          { label: "Verified Certificates", href: "/student/certificates", icon: "verified" },
          { label: "My Profile", href: "/profile", icon: "badge" },
        ],
      }
    );
  }

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  return (
    <>
      {mobileOpen && (
        <div
          className="sidebar-backdrop"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside className={`app-sidebar ${mobileOpen ? "open" : ""}`}>
        {/* Brand Header */}
        <div style={{ padding: "1.4rem 1.25rem 1.2rem", borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", minWidth: 0 }}>
              <div
                style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "12px",
                  background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#ffffff",
                  boxShadow: "0 0 20px rgba(99, 102, 241, 0.45)",
                  flexShrink: 0,
                }}
              >
                <Icon name="auto_stories" size={22} color="#ffffff" />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: "1.15rem", fontWeight: 800, color: "#ffffff", letterSpacing: "-0.02em" }}>
                  Fortivex<span style={{ color: "#818cf8" }}> LMS</span>
                </div>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.35rem",
                    marginTop: "3px",
                    fontSize: "0.72rem",
                    fontWeight: 600,
                    color: "#38bdf8",
                    background: "rgba(56, 189, 248, 0.12)",
                    padding: "2px 8px",
                    borderRadius: "999px",
                    border: "1px solid rgba(56, 189, 248, 0.2)",
                    maxWidth: "100%",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  <span
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      background: "#38bdf8",
                      boxShadow: "0 0 6px #38bdf8",
                    }}
                  />
                  {organization?.name || "Shared Platform"}
                </div>
              </div>
            </div>

            {onClose && (
              <button
                onClick={onClose}
                className="mobile-close-btn"
                aria-label="Close sidebar menu"
              >
                <Icon name="close" size={18} color="#ffffff" />
              </button>
            )}
          </div>
        </div>

      {/* Navigation Sections */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "1.25rem 0.85rem",
          display: "flex",
          flexDirection: "column",
          gap: "1.35rem",
        }}
      >
        {sections.map((section, idx) => (
          <div key={idx}>
            <div
              style={{
                fontSize: "0.68rem",
                fontWeight: 700,
                color: "#64748b",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                padding: "0 0.75rem 0.45rem",
              }}
            >
              {section.title}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
              {section.items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/admin" &&
                    item.href !== "/student" &&
                    item.href !== "/instructor" &&
                    pathname.startsWith(item.href));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch={true}
                    onClick={() => {
                      if (onClose) onClose();
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "0.6rem 0.85rem",
                      borderRadius: "10px",
                      textDecoration: "none",
                      color: isActive ? "#ffffff" : "#94a3b8",
                      background: isActive
                        ? "linear-gradient(90deg, rgba(79, 70, 229, 0.25) 0%, rgba(124, 58, 237, 0.15) 100%)"
                        : "transparent",
                      borderLeft: isActive ? "3px solid #6366f1" : "3px solid transparent",
                      fontWeight: isActive ? 700 : 500,
                      fontSize: "0.88rem",
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.color = "#ffffff";
                        e.currentTarget.style.background = "rgba(255, 255, 255, 0.04)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.color = "#94a3b8";
                        e.currentTarget.style.background = "transparent";
                      }
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <Icon
                        name={item.icon}
                        size={19}
                        color={isActive ? "#818cf8" : "#64748b"}
                      />
                      <span>{item.label}</span>
                    </div>

                    {item.badge && (
                      <span
                        style={{
                          fontSize: "0.68rem",
                          fontWeight: 700,
                          padding: "2px 7px",
                          borderRadius: "99px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          background:
                            item.badgeColor === "success"
                              ? "rgba(16, 185, 129, 0.2)"
                              : item.badgeColor === "warning"
                              ? "rgba(245, 158, 11, 0.2)"
                              : item.badgeColor === "purple"
                              ? "rgba(168, 85, 247, 0.2)"
                              : "rgba(99, 102, 241, 0.25)",
                          color:
                            item.badgeColor === "success"
                              ? "#34d399"
                              : item.badgeColor === "warning"
                              ? "#fbbf24"
                              : item.badgeColor === "purple"
                              ? "#c084fc"
                              : "#a5b4fc",
                          border: `1px solid ${
                            item.badgeColor === "success"
                              ? "rgba(16, 185, 129, 0.4)"
                              : item.badgeColor === "warning"
                              ? "rgba(245, 158, 11, 0.4)"
                              : item.badgeColor === "purple"
                              ? "rgba(168, 85, 247, 0.4)"
                              : "rgba(99, 102, 241, 0.4)"
                          }`,
                        }}
                      >
                        {item.badge === "Live" && (
                          <span
                            style={{
                              width: "5px",
                              height: "5px",
                              borderRadius: "50%",
                              backgroundColor: "#10b981",
                              boxShadow: "0 0 6px #10b981",
                            }}
                          />
                        )}
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* User Footer Profile */}
      <div
        style={{
          padding: "1.1rem 1.15rem",
          borderTop: "1px solid rgba(255, 255, 255, 0.06)",
          background: "rgba(0, 0, 0, 0.2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.75rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", minWidth: 0 }}>
          <div
            style={{
              width: "38px",
              height: "38px",
              borderRadius: "50%",
              background: "linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              fontSize: "0.92rem",
              boxShadow: "0 0 12px rgba(14, 165, 233, 0.35)",
              flexShrink: 0,
            }}
          >
            {user.full_name?.charAt(0) || "U"}
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: "0.85rem",
                fontWeight: 700,
                color: "#ffffff",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {user.full_name}
            </div>
            <div
              style={{
                fontSize: "0.7rem",
                color: "#94a3b8",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {user.roles[0]?.replace("_", " ") || "Member"}
            </div>
          </div>
        </div>

        <button
          onClick={handleLogout}
          title="Sign out"
          style={{
            background: "rgba(255, 255, 255, 0.05)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            color: "#94a3b8",
            cursor: "pointer",
            padding: "8px",
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "#f87171";
            e.currentTarget.style.background = "rgba(239, 68, 68, 0.15)";
            e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.3)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "#94a3b8";
            e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
            e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.08)";
          }}
        >
          <Icon name="logout" size={16} />
        </button>
      </div>
    </aside>
    </>
  );
}
