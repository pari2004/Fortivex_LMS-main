"use client";

import { useState, useEffect, useCallback } from "react";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  getCohortAchievements,
  compareCohortPeer,
  recordStreakHeartbeat,
  performStreakSave,
} from "@/lib/api/endpoints";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import type {
  CohortAchievementsResponse,
  PeerLeaderboardItem,
  PeerComparisonResponse,
  AchievementBadge,
  StreakInfo,
} from "@/lib/api/types";

const styles = {
  container: {
    maxWidth: "1280px",
    margin: "0 auto",
    paddingBottom: "3rem",
    animation: "fadeIn 0.3s ease-out",
  },
  modalOverlay: {
    position: "fixed" as const,
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(0,0,0,0.6)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
    backdropFilter: "blur(6px)",
  },
  modalContent: {
    background: "var(--background)",
    padding: "2rem",
    borderRadius: "16px",
    width: "650px",
    maxWidth: "94%",
    maxHeight: "90vh",
    overflowY: "auto" as const,
    boxShadow: "0 20px 40px rgba(0,0,0,0.3)",
    animation: "fadeIn 0.3s ease-out",
  },
  heroBanner: {
    background: "linear-gradient(135deg, rgba(29, 78, 216, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)",
    border: "1px solid rgba(29, 78, 216, 0.2)",
    borderRadius: "16px",
    padding: "2rem",
    marginBottom: "2rem",
  },
  card: {
    background: "var(--color-surface)",
    border: "1px solid var(--color-border)",
    borderRadius: "14px",
    padding: "1.5rem",
    boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
  },
  badgeCard: {
    background: "var(--color-surface)",
    border: "1px solid var(--color-border)",
    borderRadius: "14px",
    padding: "1.5rem",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    textAlign: "center" as const,
    transition: "all 0.2s ease",
    position: "relative" as const,
  },
};

function AchievementsContent() {
  const { token, user } = useAuth();

  const [data, setData] = useState<CohortAchievementsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedCohortId, setSelectedCohortId] = useState<number | null>(null);

  // Tabs: LEADERBOARD | BADGES
  const [activeTab, setActiveTab] = useState<"LEADERBOARD" | "BADGES">("LEADERBOARD");
  const [badgeCategory, setBadgeCategory] = useState<string>("ALL");

  // Comparison Modal State
  const [comparingPeer, setComparingPeer] = useState<PeerLeaderboardItem | null>(null);
  const [comparisonData, setComparisonData] = useState<PeerComparisonResponse | null>(null);
  const [isLoadingComparison, setIsLoadingComparison] = useState(false);

  const fetchData = useCallback(
    async (cohortId?: number) => {
      if (!token) return;
      try {
        setError(null);
        const res = await getCohortAchievements(token, cohortId);
        setData(res);
        if (res.active_cohort) {
          setSelectedCohortId(prev => prev ?? res.active_cohort?.cohort_id ?? null);
        }
      } catch (err: any) {
        setError(err.message || "Failed to load cohort achievements");
      }
    },
    [token]
  );

  useEffect(() => {
    fetchData(selectedCohortId ?? undefined);
  }, [fetchData, selectedCohortId]);

  const handleCohortChange = (newCohortId: number) => {
    setSelectedCohortId(newCohortId);
    fetchData(newCohortId);
  };

  // Streak Action State
  const [isLoggingHeartbeat, setIsLoggingHeartbeat] = useState(false);
  const [isUsingStreakSave, setIsUsingStreakSave] = useState(false);
  const [streakActionBanner, setStreakActionBanner] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleOpenComparison = async (peer: PeerLeaderboardItem) => {
    if (!token || !data?.active_cohort) return;
    setComparingPeer(peer);
    setIsLoadingComparison(true);
    setComparisonData(null);
    try {
      const res = await compareCohortPeer(token, peer.student_id, data.active_cohort.cohort_id);
      setComparisonData(res);
    } catch (err: any) {
      alert("Error loading peer comparison: " + err.message);
    } finally {
      setIsLoadingComparison(false);
    }
  };

  const handleRecordHeartbeat = async () => {
    if (!token) return;
    setIsLoggingHeartbeat(true);
    setStreakActionBanner(null);
    try {
      const res = await recordStreakHeartbeat(token);
      setStreakActionBanner({ type: "success", text: res.message });
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          streak: res.streak,
          current_student_stats: prev.current_student_stats
            ? {
                ...prev.current_student_stats,
                current_streak: res.streak.current_streak,
                longest_streak: res.streak.longest_streak,
              }
            : null,
        };
      });
    } catch (err: any) {
      setStreakActionBanner({ type: "error", text: err.message || "Failed to record study check-in" });
    } finally {
      setIsLoggingHeartbeat(false);
    }
  };

  const handleUseStreakSave = async () => {
    if (!token) return;
    setIsUsingStreakSave(true);
    setStreakActionBanner(null);
    try {
      const res = await performStreakSave(token);
      setStreakActionBanner({ type: res.success ? "success" : "error", text: res.message });
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          streak: res.streak,
          current_student_stats: prev.current_student_stats
            ? {
                ...prev.current_student_stats,
                current_streak: res.streak.current_streak,
                streak_freeze_count: res.streak.streak_freeze_count,
              }
            : null,
        };
      });
    } catch (err: any) {
      setStreakActionBanner({ type: "error", text: err.message || "Failed to use streak save" });
    } finally {
      setIsUsingStreakSave(false);
    }
  };

  if (error) {
    return <ErrorState message={error} onRetry={() => fetchData(selectedCohortId ?? undefined)} />;
  }

  if (!data) {
    return <LoadingState message="Calculating cohort standings and milestones..." />;
  }

  // Fallback if student has no cohorts yet
  if (!data.has_cohort || !data.active_cohort || !data.current_student_stats) {
    return (
      <div style={styles.container}>
        <div style={{ marginBottom: "2rem" }}>
          <h1 style={{ fontSize: "2rem", fontWeight: 800, margin: 0 }}>Achievements & Leaderboard</h1>
          <p style={{ color: "var(--color-muted)", fontSize: "1rem", marginTop: "0.4rem" }}>
            Compare progress, earn badges, and climb the ranks within your cohort.
          </p>
        </div>

        <div
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "16px",
            padding: "3.5rem 2rem",
            textAlign: "center",
            maxWidth: "600px",
            margin: "0 auto",
          }}
        >
          <div
            style={{
              width: "70px",
              height: "70px",
              borderRadius: "50%",
              background: "rgba(59, 130, 246, 0.1)",
              color: "var(--color-primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 1.5rem auto",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "2.5rem" }}>
              group_off
            </span>
          </div>
          <h2 style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: "0.5rem" }}>No Active Cohort Assignment</h2>
          <p style={{ color: "var(--color-muted)", fontSize: "0.95rem", lineHeight: 1.6, marginBottom: "1.5rem" }}>
            Achievements and rankings in Fortivex LMS are cohort-scoped. You are currently not enrolled in a running class
            cohort. Once your academic program administrator assigns you to a cohort, your standings and classmates will
            display here.
          </p>
        </div>
      </div>
    );
  }

  const { active_cohort, current_student_stats, cohort_benchmarks, badges, leaderboard, student_cohorts, streak } = data;

  const streakDays = streak?.current_streak ?? current_student_stats.current_streak ?? 0;
  const longestStreak = streak?.longest_streak ?? current_student_stats.longest_streak ?? streakDays;
  const isActiveToday = Boolean(streak?.is_active_today);
  const streakFreezeCount = streak?.streak_freeze_count ?? current_student_stats.streak_freeze_count ?? 0;

  const filteredBadges = badges.filter((b) => {
    if (badgeCategory === "ALL") return true;
    return b.category.toUpperCase() === badgeCategory;
  });

  return (
    <div style={styles.container}>
      {/* Minimal Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1.75rem",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <h1 style={{ fontSize: "1.85rem", fontWeight: 800, margin: 0 }}>Achievements & Leaderboard</h1>
            <Badge status="active">Cohort Isolated</Badge>
          </div>
          <p style={{ color: "var(--color-muted)", fontSize: "0.95rem", margin: "0.25rem 0 0 0" }}>
            {active_cohort.cohort_name} ({active_cohort.cohort_code}) • {cohort_benchmarks?.cohort_size ?? 1} {cohort_benchmarks?.cohort_size === 1 ? "Student" : "Students"}
          </p>
        </div>

        {/* Quick Student Stats Bar & Switcher */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          {/* Evident Streak Counter Badge */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              background: "var(--color-surface)",
              border: isActiveToday ? "1.5px solid rgba(249, 115, 22, 0.35)" : "1.5px solid rgba(249, 115, 22, 0.55)",
              borderRadius: "12px",
              padding: "0.45rem 0.85rem",
              boxShadow: "0 2px 8px rgba(249, 115, 22, 0.08)",
            }}
          >
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ffffff",
                boxShadow: "0 2px 6px rgba(234, 88, 12, 0.3)",
                fontSize: "1.2rem",
                flexShrink: 0,
              }}
            >
              🔥
            </div>

            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: "0.35rem" }}>
                <span style={{ fontSize: "1.2rem", fontWeight: 800, color: "#ea580c", lineHeight: 1 }}>
                  {streakDays}
                </span>
                <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--foreground)" }}>
                  {streakDays === 1 ? "Day Streak" : "Day Streak"}
                </span>
                {longestStreak > 0 && (
                  <span
                    style={{ fontSize: "0.72rem", color: "var(--color-muted)", fontWeight: 600, marginLeft: "0.15rem" }}
                    title="All-time longest study streak"
                  >
                    (Best: {longestStreak}d)
                  </span>
                )}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginTop: "0.2rem" }}>
                {isActiveToday ? (
                  <span
                    style={{
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      color: "#059669",
                      background: "rgba(16, 185, 129, 0.12)",
                      padding: "1px 6px",
                      borderRadius: "6px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "3px",
                    }}
                  >
                    <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#10b981" }} />
                    Active today
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      color: "#ea580c",
                      background: "rgba(249, 115, 22, 0.12)",
                      padding: "1px 6px",
                      borderRadius: "6px",
                    }}
                  >
                    Pending today
                  </span>
                )}

                {streakFreezeCount > 0 && (
                  <span
                    style={{
                      fontSize: "0.7rem",
                      fontWeight: 600,
                      color: "#2563eb",
                      background: "rgba(37, 99, 235, 0.08)",
                      padding: "1px 6px",
                      borderRadius: "6px",
                    }}
                    title={`${streakFreezeCount} streak protection freeze available`}
                  >
                    🛡️ {streakFreezeCount}
                  </span>
                )}
              </div>
            </div>

            {!isActiveToday && (
              <button
                onClick={handleRecordHeartbeat}
                disabled={isLoggingHeartbeat}
                style={{
                  background: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "0.38rem 0.75rem",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: "0 2px 6px rgba(234, 88, 12, 0.25)",
                  marginLeft: "0.25rem",
                  whiteSpace: "nowrap",
                }}
                title="Record daily activity to maintain your streak"
              >
                {isLoggingHeartbeat ? "Logging..." : "🔥 Check-In"}
              </button>
            )}
          </div>

          {/* Cohort Stats Pill */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.85rem",
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "12px",
              padding: "0.55rem 1rem",
              fontSize: "0.88rem",
              fontWeight: 700,
              boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
            }}
          >
            <span title="Your Cohort Rank" style={{ color: current_student_stats.rank === 1 ? "#d97706" : "var(--color-primary)" }}>
              #{current_student_stats.rank} Rank
            </span>
            <span style={{ color: "var(--color-border)" }}>•</span>
            <span title="Total Earned XP" style={{ color: "var(--color-primary)" }}>
              {current_student_stats.total_xp.toLocaleString()} XP
            </span>
            <span style={{ color: "var(--color-border)" }}>•</span>
            <span title="Badges Unlocked" style={{ color: "#f59e0b" }}>
              🏆 {current_student_stats.badges_unlocked}/{current_student_stats.total_possible_badges}
            </span>
          </div>

          {student_cohorts.length > 1 && (
            <div style={{ position: "relative" }}>
              <select
                value={active_cohort.cohort_id}
                onChange={(e) => handleCohortChange(Number(e.target.value))}
                style={{
                  padding: "0.55rem 2.2rem 0.55rem 0.85rem",
                  borderRadius: "10px",
                  border: "1px solid var(--color-border)",
                  background: "var(--color-surface)",
                  color: "var(--foreground)",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  outline: "none",
                }}
              >
                {student_cohorts.map((c) => (
                  <option key={c.cohort_id} value={c.cohort_id}>
                    {c.cohort_name}
                  </option>
                ))}
              </select>
              <span
                className="material-symbols-outlined"
                style={{
                  position: "absolute",
                  right: "0.6rem",
                  top: "50%",
                  transform: "translateY(-50%)",
                  pointerEvents: "none",
                  color: "var(--color-muted)",
                  fontSize: "1.1rem",
                }}
              >
                expand_more
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Action Notification Banner */}
      {streakActionBanner && (
        <div
          style={{
            padding: "0.6rem 1rem",
            borderRadius: "8px",
            marginBottom: "1.2rem",
            fontSize: "0.88rem",
            fontWeight: 600,
            background: streakActionBanner.type === "success" ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)",
            color: streakActionBanner.type === "success" ? "#065f46" : "#991b1b",
            border: `1px solid ${streakActionBanner.type === "success" ? "#10b981" : "#ef4444"}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>{streakActionBanner.text}</span>
          <button
            onClick={() => setStreakActionBanner(null)}
            style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}
          >
            &times;
          </button>
        </div>
      )}

      {/* Clean Navigation Tabs */}
      <div
        style={{
          display: "flex",
          gap: "1.5rem",
          borderBottom: "1px solid var(--color-border)",
          marginBottom: "1.5rem",
        }}
      >
        <button
          onClick={() => setActiveTab("LEADERBOARD")}
          style={{
            background: "none",
            border: "none",
            padding: "0.75rem 0",
            fontSize: "1rem",
            fontWeight: 700,
            color: activeTab === "LEADERBOARD" ? "var(--color-primary)" : "var(--color-muted)",
            cursor: "pointer",
            borderBottom: activeTab === "LEADERBOARD" ? "3px solid var(--color-primary)" : "3px solid transparent",
            display: "flex",
            alignItems: "center",
            gap: "0.45rem",
            transition: "all 0.15s ease",
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: "1.2rem" }}>
            leaderboard
          </span>
          Leaderboard ({leaderboard.length})
        </button>

        <button
          onClick={() => setActiveTab("BADGES")}
          style={{
            background: "none",
            border: "none",
            padding: "0.75rem 0",
            fontSize: "1rem",
            fontWeight: 700,
            color: activeTab === "BADGES" ? "var(--color-primary)" : "var(--color-muted)",
            cursor: "pointer",
            borderBottom: activeTab === "BADGES" ? "3px solid var(--color-primary)" : "3px solid transparent",
            display: "flex",
            alignItems: "center",
            gap: "0.45rem",
            transition: "all 0.15s ease",
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: "1.2rem" }}>
            military_tech
          </span>
          Badges ({current_student_stats.badges_unlocked}/{current_student_stats.total_possible_badges})
        </button>
      </div>

      {/* TAB 1: COHORT LEADERBOARD */}
      {activeTab === "LEADERBOARD" && (
        <div>
          {/* Standings Table */}
          <div
            style={{
              background: "var(--color-surface)",
              borderRadius: "14px",
              border: "1px solid var(--color-border)",
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "1.2rem 1.5rem", borderBottom: "1px solid var(--color-border)" }}>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0 }}>
                Cohort Class Leaderboard ({leaderboard.length} {leaderboard.length === 1 ? "Student" : "Students"})
              </h3>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                <thead>
                  <tr style={{ background: "rgba(0,0,0,0.02)", borderBottom: "1px solid var(--color-border)" }}>
                    <th style={{ padding: "1rem 1.5rem", fontSize: "0.82rem", fontWeight: 700, color: "var(--color-muted)" }}>RANK</th>
                    <th style={{ padding: "1rem", fontSize: "0.82rem", fontWeight: 700, color: "var(--color-muted)" }}>LEARNER</th>
                    <th style={{ padding: "1rem", fontSize: "0.82rem", fontWeight: 700, color: "var(--color-muted)" }}>STREAK</th>
                    <th style={{ padding: "1rem", fontSize: "0.82rem", fontWeight: 700, color: "var(--color-muted)" }}>TOTAL XP</th>
                    <th style={{ padding: "1rem", fontSize: "0.82rem", fontWeight: 700, color: "var(--color-muted)" }}>ACTIVITIES</th>
                    <th style={{ padding: "1rem", fontSize: "0.82rem", fontWeight: 700, color: "var(--color-muted)" }}>QUIZ AVERAGE</th>
                    <th style={{ padding: "1rem", fontSize: "0.82rem", fontWeight: 700, color: "var(--color-muted)" }}>BADGES</th>
                    <th style={{ padding: "1rem 1.5rem", fontSize: "0.82rem", fontWeight: 700, color: "var(--color-muted)", textAlign: "right" }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((item) => (
                    <tr
                      key={item.student_id}
                      style={{
                        borderBottom: "1px solid var(--color-border)",
                        background: item.is_current_student ? "rgba(29, 78, 216, 0.05)" : "transparent",
                        fontWeight: item.is_current_student ? 600 : 400,
                        transition: "background 0.2s",
                      }}
                    >
                      {/* Rank */}
                      <td style={{ padding: "1rem 1.5rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                          <span
                            style={{
                              width: "28px",
                              height: "28px",
                              borderRadius: "50%",
                              background:
                                item.rank === 1
                                  ? "#fbbf24"
                                  : item.rank === 2
                                  ? "#94a3b8"
                                  : item.rank === 3
                                  ? "#d97706"
                                  : "rgba(0,0,0,0.06)",
                              color: item.rank <= 3 ? "#fff" : "var(--foreground)",
                              fontSize: "0.82rem",
                              fontWeight: 800,
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            {item.rank}
                          </span>
                        </div>
                      </td>

                      {/* Learner */}
                      <td style={{ padding: "1rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                          {item.avatar_url ? (
                            <img
                              src={item.avatar_url}
                              alt={item.name}
                              style={{ width: "34px", height: "34px", borderRadius: "50%", objectFit: "cover" }}
                            />
                          ) : (
                            <div
                              style={{
                                width: "34px",
                                height: "34px",
                                borderRadius: "50%",
                                background: "var(--primary-gradient)",
                                color: "#fff",
                                fontWeight: 700,
                                fontSize: "0.85rem",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              {item.name.charAt(0)}
                            </div>
                          )}
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                              <span>{item.name}</span>
                              {item.is_current_student && <Badge status="active">You</Badge>}
                            </div>
                            {item.title && <div style={{ fontSize: "0.78rem", color: "var(--color-muted)" }}>{item.title}</div>}
                          </div>
                        </div>
                      </td>

                      {/* Streak */}
                      <td style={{ padding: "1rem" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.25rem",
                            background:
                              (item.current_streak || 0) > 0
                                ? "rgba(249, 115, 22, 0.12)"
                                : "rgba(0,0,0,0.04)",
                            border:
                              (item.current_streak || 0) > 0
                                ? "1px solid rgba(249, 115, 22, 0.25)"
                                : "1px solid transparent",
                            color: (item.current_streak || 0) > 0 ? "#ea580c" : "var(--color-muted)",
                            padding: "0.22rem 0.6rem",
                            borderRadius: "12px",
                            fontSize: "0.82rem",
                            fontWeight: 700,
                          }}
                        >
                          🔥 {item.current_streak || 0}d
                        </span>
                      </td>

                      {/* XP */}
                      <td style={{ padding: "1rem" }}>
                        <span style={{ fontWeight: 700, color: "var(--color-primary)" }}>{item.total_xp.toLocaleString()} XP</span>
                      </td>

                      {/* Activities */}
                      <td style={{ padding: "1rem" }}>
                        <span>
                          {item.activities_completed} / {item.total_activities}
                        </span>
                      </td>

                      {/* Quiz Average */}
                      <td style={{ padding: "1rem" }}>
                        <span style={{ color: item.quiz_average >= 80 ? "#10b981" : "var(--foreground)" }}>
                          {item.quiz_average}%
                        </span>
                      </td>

                      {/* Badges preview */}
                      <td style={{ padding: "1rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                          <span style={{ fontWeight: 700, marginRight: "0.3rem" }}>{item.badges_count}</span>
                          {item.top_badge_icons?.map((b, idx) => (
                            <span
                              key={idx}
                              className="material-symbols-outlined"
                              title={b.title}
                              style={{ fontSize: "1.1rem", color: b.color }}
                            >
                              {b.icon}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Action */}
                      <td style={{ padding: "1rem 1.5rem", textAlign: "right" }}>
                        {item.is_current_student ? (
                          <span
                            style={{
                              fontSize: "0.78rem",
                              fontWeight: 600,
                              color: "var(--color-primary)",
                              background: "rgba(59, 130, 246, 0.08)",
                              padding: "0.25rem 0.6rem",
                              borderRadius: "6px",
                              display: "inline-block",
                            }}
                          >
                            You
                          </span>
                        ) : (
                          <button
                            onClick={() => handleOpenComparison(item)}
                            style={{
                              background: "rgba(59, 130, 246, 0.08)",
                              border: "1px solid rgba(59, 130, 246, 0.2)",
                              color: "var(--color-primary)",
                              padding: "0.35rem 0.75rem",
                              borderRadius: "6px",
                              fontSize: "0.8rem",
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            Compare
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MILESTONE BADGES */}
      {activeTab === "BADGES" && (
        <div>
          {/* Category Filter Pills */}
          <div style={{ display: "flex", gap: "0.6rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
            {[
              { id: "ALL", label: "All Badges" },
              { id: "CURRICULUM", label: "Curriculum Progress" },
              { id: "ASSESSMENT", label: "Quizzes & Mastery" },
              { id: "COHORT STANDING", label: "Cohort Standing" },
              { id: "STREAK", label: "Streaks & Saves" },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setBadgeCategory(cat.id)}
                style={{
                  padding: "0.5rem 1rem",
                  borderRadius: "20px",
                  border: "1px solid var(--color-border)",
                  background: badgeCategory === cat.id ? "var(--color-primary)" : "var(--color-surface)",
                  color: badgeCategory === cat.id ? "#fff" : "var(--foreground)",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Badges Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: "1.5rem",
            }}
          >
            {filteredBadges.map((badge) => (
              <div
                key={badge.id}
                style={{
                  ...styles.badgeCard,
                  opacity: badge.unlocked ? 1 : 0.75,
                  border: badge.unlocked ? `1px solid ${badge.color}60` : "1px solid var(--color-border)",
                  boxShadow: badge.unlocked ? `0 6px 20px ${badge.color}15` : "none",
                }}
              >
                {/* Tier Tag */}
                <span
                  style={{
                    position: "absolute",
                    top: "1rem",
                    right: "1rem",
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    color: badge.color,
                    background: `${badge.color}15`,
                    padding: "0.2rem 0.5rem",
                    borderRadius: "4px",
                  }}
                >
                  {badge.tier}
                </span>

                {/* Big Circular Icon */}
                <div
                  style={{
                    width: "75px",
                    height: "75px",
                    borderRadius: "50%",
                    background: badge.unlocked ? `${badge.color}20` : "rgba(0,0,0,0.05)",
                    color: badge.unlocked ? badge.color : "var(--color-muted)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: "1rem",
                    marginTop: "0.5rem",
                    border: badge.unlocked ? `2px solid ${badge.color}` : "2px dashed var(--color-border)",
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "2.4rem" }}>
                    {badge.unlocked ? badge.icon : "lock"}
                  </span>
                </div>

                <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 0.4rem 0" }}>{badge.title}</h3>
                <p style={{ fontSize: "0.85rem", color: "var(--color-muted)", margin: "0 0 1rem 0", lineHeight: 1.4 }}>
                  {badge.description}
                </p>

                {/* Progress Bar */}
                <div style={{ width: "100%", marginTop: "auto" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", marginBottom: "0.3rem" }}>
                    <span style={{ color: "var(--color-muted)" }}>
                      {badge.progress.current} / {badge.progress.target} {badge.progress.unit}
                    </span>
                    <span style={{ fontWeight: 700, color: badge.unlocked ? badge.color : "var(--color-muted)" }}>
                      {badge.progress.percentage}%
                    </span>
                  </div>
                  <div style={{ width: "100%", height: "6px", background: "rgba(0,0,0,0.06)", borderRadius: "3px", overflow: "hidden" }}>
                    <div
                      style={{
                        width: `${badge.progress.percentage}%`,
                        height: "100%",
                        background: badge.unlocked ? badge.color : "var(--color-muted)",
                        borderRadius: "3px",
                      }}
                    />
                  </div>

                  {/* XP Reward & Status Tag */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.85rem" }}>
                    <span style={{ fontSize: "0.8rem", fontWeight: 700, color: badge.color }}>
                      +{badge.xp_reward} XP
                    </span>
                    {badge.unlocked ? (
                      <span
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          color: "#10b981",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.2rem",
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: "1rem" }}>
                          check_circle
                        </span>{" "}
                        UNLOCKED
                      </span>
                    ) : (
                      <span style={{ fontSize: "0.75rem", color: "var(--color-muted)" }}>LOCKED</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PEER COMPARISON MODAL */}
      {comparingPeer && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
              <div>
                <h2 style={{ fontSize: "1.3rem", fontWeight: 800, margin: 0 }}>Peer Standing Comparison</h2>
                <div style={{ fontSize: "0.85rem", color: "var(--color-muted)", marginTop: "0.2rem" }}>
                  Cohort: <strong>{active_cohort.cohort_name}</strong>
                </div>
              </div>
              <button
                onClick={() => setComparingPeer(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-muted)" }}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {isLoadingComparison && <LoadingState message="Comparing cohort achievements..." />}

            {!isLoadingComparison && comparisonData && (
              <div>
                {/* Header: You vs Peer */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto 1fr",
                    alignItems: "center",
                    gap: "1rem",
                    padding: "1rem 1.5rem",
                    background: "rgba(0,0,0,0.02)",
                    borderRadius: "12px",
                    border: "1px solid var(--color-border)",
                    marginBottom: "1.5rem",
                    textAlign: "center",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800, fontSize: "1rem" }}>You</div>
                    <div style={{ fontSize: "0.8rem", color: "var(--color-muted)" }}>
                      {comparisonData.current_student.full_name}
                    </div>
                    <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--color-primary)", marginTop: "0.3rem" }}>
                      Rank #{comparisonData.current_student.rank}
                    </div>
                  </div>

                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "50%",
                      background: "rgba(0,0,0,0.06)",
                      fontWeight: 800,
                      fontSize: "0.8rem",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--color-muted)",
                    }}
                  >
                    VS
                  </div>

                  <div>
                    <div style={{ fontWeight: 800, fontSize: "1rem" }}>{comparingPeer.name}</div>
                    <div style={{ fontSize: "0.8rem", color: "var(--color-muted)" }}>Classmate</div>
                    <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "#f59e0b", marginTop: "0.3rem" }}>
                      Rank #{comparisonData.peer_student.rank}
                    </div>
                  </div>
                </div>

                {/* Metric by Metric Comparison Rows */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem", marginBottom: "1.5rem" }}>
                  {[
                    {
                      label: "Total Earned XP",
                      you: `${comparisonData.current_student.total_xp.toLocaleString()} XP`,
                      peer: `${comparisonData.peer_student.total_xp.toLocaleString()} XP`,
                      youBetter: comparisonData.current_student.total_xp >= comparisonData.peer_student.total_xp,
                    },
                    {
                      label: "Activities Completed",
                      you: `${comparisonData.current_student.activities_completed} / ${comparisonData.current_student.total_activities}`,
                      peer: `${comparisonData.peer_student.activities_completed} / ${comparisonData.peer_student.total_activities}`,
                      youBetter:
                        comparisonData.current_student.activities_completed >=
                        comparisonData.peer_student.activities_completed,
                    },
                    {
                      label: "Curriculum Completion",
                      you: `${comparisonData.current_student.completion_rate}%`,
                      peer: `${comparisonData.peer_student.completion_rate}%`,
                      youBetter:
                        comparisonData.current_student.completion_rate >= comparisonData.peer_student.completion_rate,
                    },
                    {
                      label: "Quiz Average",
                      you: `${comparisonData.current_student.quiz_average}%`,
                      peer: `${comparisonData.peer_student.quiz_average}%`,
                      youBetter:
                        comparisonData.current_student.quiz_average >= comparisonData.peer_student.quiz_average,
                    },
                    {
                      label: "Badges Earned",
                      you: `${comparisonData.current_student.badges_unlocked}`,
                      peer: `${comparisonData.peer_student.badges_unlocked}`,
                      youBetter:
                        comparisonData.current_student.badges_unlocked >= comparisonData.peer_student.badges_unlocked,
                    },
                    {
                      label: "Daily Study Streak",
                      you: `🔥 ${comparisonData.current_student.current_streak || 0} days`,
                      peer: `🔥 ${comparisonData.peer_student.current_streak || 0} days`,
                      youBetter:
                        (comparisonData.current_student.current_streak || 0) >=
                        (comparisonData.peer_student.current_streak || 0),
                    },
                    {
                      label: "Longest Streak",
                      you: `🏆 ${comparisonData.current_student.longest_streak || 0} days`,
                      peer: `🏆 ${comparisonData.peer_student.longest_streak || 0} days`,
                      youBetter:
                        (comparisonData.current_student.longest_streak || 0) >=
                        (comparisonData.peer_student.longest_streak || 0),
                    },
                  ].map((row, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr auto 1fr",
                        padding: "0.75rem 1rem",
                        borderRadius: "8px",
                        border: "1px solid var(--color-border)",
                        background: "var(--color-surface)",
                        alignItems: "center",
                      }}
                    >
                      <div style={{ textAlign: "left", fontWeight: row.youBetter ? 700 : 500, color: row.youBetter ? "var(--color-primary)" : "var(--foreground)" }}>
                        {row.you}
                      </div>
                      <div style={{ textAlign: "center", fontSize: "0.78rem", fontWeight: 600, color: "var(--color-muted)" }}>
                        {row.label}
                      </div>
                      <div style={{ textAlign: "right", fontWeight: !row.youBetter ? 700 : 500, color: !row.youBetter ? "#f59e0b" : "var(--foreground)" }}>
                        {row.peer}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Peer's Unlocked Badges in this Cohort */}
                <div>
                  <h4 style={{ fontSize: "0.95rem", fontWeight: 700, margin: "0 0 0.8rem 0" }}>
                    {comparingPeer.name}'s Unlocked Badges ({comparisonData.peer_badges.length})
                  </h4>

                  {comparisonData.peer_badges.length > 0 ? (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "0.75rem" }}>
                      {comparisonData.peer_badges.map((b) => (
                        <div
                          key={b.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.6rem",
                            padding: "0.6rem 0.8rem",
                            borderRadius: "8px",
                            border: `1px solid ${b.color}40`,
                            background: `${b.color}10`,
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ color: b.color, fontSize: "1.3rem" }}>
                            {b.icon}
                          </span>
                          <div>
                            <div style={{ fontSize: "0.82rem", fontWeight: 700 }}>{b.title}</div>
                            <div style={{ fontSize: "0.7rem", color: "var(--color-muted)" }}>{b.tier}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ color: "var(--color-muted)", fontSize: "0.85rem", margin: 0 }}>
                      No milestone badges unlocked by this peer yet.
                    </p>
                  )}
                </div>

                <div style={{ marginTop: "1.5rem", display: "flex", justifyContent: "flex-end" }}>
                  <Button onClick={() => setComparingPeer(null)}>Close</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AchievementsPage() {
  return (
    <RequireAuth allowedRoles={["STUDENT"]}>
      <AchievementsContent />
    </RequireAuth>
  );
}
