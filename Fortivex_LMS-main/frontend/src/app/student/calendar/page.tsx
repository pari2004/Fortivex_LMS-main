"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { useAuth } from "@/lib/auth/AuthContext";
import { apiRequest } from "@/lib/api/client";
import { getMyAssignments } from "@/lib/api/endpoints";
import { usePrograms } from "@/lib/api/usePrograms";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import { useMeeting } from "@/lib/live/MeetingContext";

export interface CalendarEvent {
  id: string;
  title: string;
  type: "Live Lecture" | "Assignment Due" | "Quiz";
  date: Date;
  dateStr: string; // "YYYY-MM-DD"
  startTimeStr: string;
  endTimeStr?: string;
  programName: string;
  instructor?: string;
  status?: "UPCOMING" | "LIVE" | "COMPLETED" | "PENDING" | "SUBMITTED";
  link?: string;
  meetingUrl?: string;
  roomName?: string;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function formatDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function AcademicCalendarPage() {
  const { token, organization } = useAuth();
  const { programs } = usePrograms(organization?.id);
  const { joinMeeting } = useMeeting();

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Calendar View State
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<"month" | "week" | "agenda">("month");
  const [filterType, setFilterType] = useState<string>("All");

  const loadCalendarData = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError(null);
      const allEvents: CalendarEvent[] = [];

      // 1. Fetch Student Assignments
      try {
        const myAssignments = await getMyAssignments(token);
        for (const a of myAssignments) {
          if (a.due_date) {
            const d = new Date(a.due_date);
            if (!isNaN(d.getTime())) {
              allEvents.push({
                id: `asg-${a.id}`,
                title: a.title,
                type: "Assignment Due",
                date: d,
                dateStr: formatDateKey(d),
                startTimeStr: d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                programName: a.program_name || "Enrolled Course",
                status: a.status === "submitted" ? "SUBMITTED" : "PENDING",
                link: "/student/assignments",
              });
            }
          }
        }
      } catch (e) {
        console.error("Failed to load assignments for calendar:", e);
      }

      // 2. Fetch Live Sessions across programs
      if (programs && programs.length > 0) {
        for (const prog of programs) {
          try {
            const curriculum = await apiRequest<any[]>(`/api/v1/programs/${prog.id}/curriculum`, {
              token,
            });
            if (Array.isArray(curriculum)) {
              for (const mod of curriculum) {
                for (const wk of mod.weeks || []) {
                  for (const lsn of wk.lessons || []) {
                    for (const act of lsn.activities || []) {
                      if (act.activity_type === "LIVE_SESSION" && act.content?.start_time) {
                        const start = new Date(act.content.start_time);
                        if (isNaN(start.getTime())) continue;
                        const end = new Date(act.content.end_time || act.content.start_time);

                        const now = new Date();
                        let status: "UPCOMING" | "LIVE" | "COMPLETED" = "UPCOMING";
                        if (!isNaN(end.getTime()) && now > end) {
                          status = "COMPLETED";
                        } else if (
                          !isNaN(start.getTime()) &&
                          !isNaN(end.getTime()) &&
                          now >= start &&
                          now <= end
                        ) {
                          status = "LIVE";
                        }

                        allEvents.push({
                          id: `live-${act.id}`,
                          title: act.title,
                          type: "Live Lecture",
                          date: start,
                          dateStr: formatDateKey(start),
                          startTimeStr: start.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          }),
                          endTimeStr: !isNaN(end.getTime())
                            ? end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                            : undefined,
                          programName: prog.name,
                          instructor: "Lead Instructor",
                          status,
                          link: "/student/live",
                          meetingUrl:
                            act.content.meeting_url ||
                            `https://${process.env.NEXT_PUBLIC_JITSI_DOMAIN || "meet.systemli.org"}/${
                              act.content.room_name
                            }`,
                          roomName: act.content.room_name,
                        });
                      }
                    }
                  }
                }
              }
            }
          } catch (e) {
            // continue other programs
          }
        }
      }

      // 3. Fetch Quizzes
      try {
        const myQuizzes = await apiRequest<any[]>("/api/v1/progress/my-quizzes", { token });
        if (Array.isArray(myQuizzes)) {
          for (const q of myQuizzes) {
            // If quiz has created_at or due date
            const quizDate = q.due_date ? new Date(q.due_date) : new Date(q.created_at || Date.now());
            if (!isNaN(quizDate.getTime())) {
              allEvents.push({
                id: `quiz-${q.id}`,
                title: q.title,
                type: "Quiz",
                date: quizDate,
                dateStr: formatDateKey(quizDate),
                startTimeStr: `${q.question_count || 10} Questions`,
                programName: q.program_name || "Enrolled Course",
                status: q.best_score !== null ? "COMPLETED" : "UPCOMING",
                link: "/student/quizzes",
              });
            }
          }
        }
      } catch (e) {
        console.error("Failed to load quizzes for calendar:", e);
      }

      allEvents.sort((a, b) => a.date.getTime() - b.date.getTime());
      setEvents(allEvents);
    } catch (err: any) {
      console.error("Calendar sync error:", err);
      setError(err?.message || "Failed to load academic schedule.");
    } finally {
      setLoading(false);
    }
  }, [token, programs]);

  useEffect(() => {
    loadCalendarData();
  }, [loadCalendarData]);

  // Filtered events
  const filteredEvents = useMemo(() => {
    if (filterType === "All") return events;
    return events.filter((e) => e.type === filterType);
  }, [events, filterType]);

  // Map events by dateStr ("YYYY-MM-DD")
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const e of filteredEvents) {
      if (!map[e.dateStr]) map[e.dateStr] = [];
      map[e.dateStr].push(e);
    }
    return map;
  }, [filteredEvents]);

  // Selected date events
  const selectedDateStr = useMemo(() => formatDateKey(selectedDate), [selectedDate]);
  const selectedDayEvents = useMemo(
    () => eventsByDate[selectedDateStr] || [],
    [eventsByDate, selectedDateStr]
  );

  // Month navigation helpers
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  function prevMonth() {
    setCurrentDate(new Date(year, month - 1, 1));
  }

  function nextMonth() {
    setCurrentDate(new Date(year, month + 1, 1));
  }

  function goToToday() {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
  }

  // Month Days Grid Calculation
  const monthGridDays = useMemo(() => {
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    const startingDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sunday
    const totalDaysInMonth = lastDayOfMonth.getDate();

    const days: Array<{
      date: Date;
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      isSelected: boolean;
    }> = [];

    const todayStr = formatDateKey(new Date());

    // Padding from previous month
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthLastDay - i);
      const dStr = formatDateKey(d);
      days.push({
        date: d,
        dateStr: dStr,
        dayNumber: d.getDate(),
        isCurrentMonth: false,
        isToday: dStr === todayStr,
        isSelected: dStr === selectedDateStr,
      });
    }

    // Current month days
    for (let day = 1; day <= totalDaysInMonth; day++) {
      const d = new Date(year, month, day);
      const dStr = formatDateKey(d);
      days.push({
        date: d,
        dateStr: dStr,
        dayNumber: day,
        isCurrentMonth: true,
        isToday: dStr === todayStr,
        isSelected: dStr === selectedDateStr,
      });
    }

    // Padding for next month to complete 5 or 6 weeks (multiples of 7)
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      const dStr = formatDateKey(d);
      days.push({
        date: d,
        dateStr: dStr,
        dayNumber: i,
        isCurrentMonth: false,
        isToday: dStr === todayStr,
        isSelected: dStr === selectedDateStr,
      });
    }

    return days;
  }, [year, month, selectedDateStr]);

  // Week View Days Calculation (Sunday to Saturday around selectedDate)
  const weekDays = useMemo(() => {
    const base = new Date(selectedDate);
    const dayOfWeek = base.getDay();
    const sunday = new Date(base);
    sunday.setDate(base.getDate() - dayOfWeek);

    const days: Array<{
      date: Date;
      dateStr: string;
      dayName: string;
      dayNumber: number;
      isToday: boolean;
      isSelected: boolean;
    }> = [];

    const todayStr = formatDateKey(new Date());

    for (let i = 0; i < 7; i++) {
      const d = new Date(sunday);
      d.setDate(sunday.getDate() + i);
      const dStr = formatDateKey(d);
      days.push({
        date: d,
        dateStr: dStr,
        dayName: WEEKDAYS[d.getDay()],
        dayNumber: d.getDate(),
        isToday: dStr === todayStr,
        isSelected: dStr === selectedDateStr,
      });
    }

    return days;
  }, [selectedDate, selectedDateStr]);

  // Badge Color Styles
  const getEventBadgeStyle = (type: CalendarEvent["type"], isLiveNow?: boolean) => {
    if (isLiveNow) {
      return {
        bg: "rgba(239, 68, 68, 0.15)",
        text: "var(--danger)",
        border: "1px solid rgba(239, 68, 68, 0.4)",
        icon: "sensors",
      };
    }
    switch (type) {
      case "Live Lecture":
        return {
          bg: "rgba(16, 185, 129, 0.12)",
          text: "#059669",
          border: "1px solid rgba(16, 185, 129, 0.3)",
          icon: "videocam",
        };
      case "Assignment Due":
        return {
          bg: "rgba(245, 158, 11, 0.12)",
          text: "#d97706",
          border: "1px solid rgba(245, 158, 11, 0.3)",
          icon: "assignment",
        };
      case "Quiz":
        return {
          bg: "rgba(124, 58, 237, 0.12)",
          text: "#7c3aed",
          border: "1px solid rgba(124, 58, 237, 0.3)",
          icon: "quiz",
        };
      default:
        return {
          bg: "rgba(0,0,0,0.05)",
          text: "var(--text-muted)",
          border: "1px solid var(--color-border)",
          icon: "event",
        };
    }
  };

  return (
    <RequireAuth>
      <div style={{ maxWidth: "1280px", margin: "0 auto", animation: "fadeIn 0.35s ease-out" }}>
        {/* Top Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: "1.75rem",
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
                calendar_month
              </span>
              <h1
                style={{
                  fontSize: "2rem",
                  fontWeight: 800,
                  color: "var(--text-main)",
                  letterSpacing: "-0.02em",
                }}
              >
                Academic Calendar & Schedule
              </h1>
            </div>
            <p style={{ color: "var(--text-muted)", fontSize: "0.95rem", marginTop: "0.35rem" }}>
              Visual calendar tracking your upcoming live classrooms, assignment due dates, and milestone quizzes.
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.5rem" }}>
            <Link
              href="/student/live"
              className="btn-secondary"
              style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.88rem" }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "1.1rem", color: "#10b981" }}>
                videocam
              </span>
              Live Classrooms
            </Link>
            <Link
              href="/student/assignments"
              className="btn-primary"
              style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.88rem" }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "1.1rem" }}>
                assignment
              </span>
              Assignments
            </Link>
          </div>
        </div>

        {/* Calendar Navigation & View Controls Bar */}
        <div
          style={{
            background: "var(--color-surface)",
            borderRadius: "16px",
            border: "1px solid var(--color-border)",
            padding: "1rem 1.25rem",
            marginBottom: "1.5rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "1rem",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          {/* Month / Year Navigator */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <button
              onClick={prevMonth}
              className="btn-secondary"
              style={{
                width: "36px",
                height: "36px",
                padding: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "8px",
              }}
              title="Previous Month"
            >
              <span className="material-symbols-outlined" style={{ fontSize: "1.2rem" }}>
                chevron_left
              </span>
            </button>

            <h2
              style={{
                fontSize: "1.35rem",
                fontWeight: 800,
                color: "var(--text-main)",
                minWidth: "190px",
                textAlign: "center",
                margin: 0,
              }}
            >
              {MONTH_NAMES[month]} {year}
            </h2>

            <button
              onClick={nextMonth}
              className="btn-secondary"
              style={{
                width: "36px",
                height: "36px",
                padding: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "8px",
              }}
              title="Next Month"
            >
              <span className="material-symbols-outlined" style={{ fontSize: "1.2rem" }}>
                chevron_right
              </span>
            </button>

            <button
              onClick={goToToday}
              className="btn-secondary"
              style={{ padding: "0.4rem 0.9rem", fontSize: "0.85rem", fontWeight: 700 }}
            >
              Today
            </button>
          </div>

          {/* Filter Pills */}
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", alignItems: "center" }}>
            {["All", "Live Lecture", "Assignment Due", "Quiz"].map((t) => {
              const isActive = filterType === t;
              return (
                <button
                  key={t}
                  onClick={() => setFilterType(t)}
                  style={{
                    fontSize: "0.8rem",
                    padding: "4px 10px",
                    borderRadius: "16px",
                    background: isActive ? "var(--primary)" : "rgba(0,0,0,0.05)",
                    color: isActive ? "#ffffff" : "var(--text-muted)",
                    border: "none",
                    cursor: "pointer",
                    fontWeight: 600,
                    transition: "all 0.15s ease",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.25rem",
                  }}
                >
                  {t === "Live Lecture" && (
                    <span className="material-symbols-outlined" style={{ fontSize: "0.95rem" }}>
                      videocam
                    </span>
                  )}
                  {t === "Assignment Due" && (
                    <span className="material-symbols-outlined" style={{ fontSize: "0.95rem" }}>
                      assignment
                    </span>
                  )}
                  {t === "Quiz" && (
                    <span className="material-symbols-outlined" style={{ fontSize: "0.95rem" }}>
                      quiz
                    </span>
                  )}
                  {t}
                </button>
              );
            })}
          </div>

          {/* View Mode Switcher */}
          <div style={{ display: "flex", background: "var(--background)", borderRadius: "10px", padding: "3px", border: "1px solid var(--color-border)" }}>
            <button
              onClick={() => setViewMode("month")}
              style={{
                padding: "0.35rem 0.9rem",
                borderRadius: "8px",
                border: "none",
                background: viewMode === "month" ? "var(--color-surface)" : "transparent",
                color: viewMode === "month" ? "var(--primary)" : "var(--text-muted)",
                fontWeight: viewMode === "month" ? 700 : 500,
                fontSize: "0.82rem",
                cursor: "pointer",
                boxShadow: viewMode === "month" ? "var(--shadow-xs)" : "none",
              }}
            >
              Month View
            </button>
            <button
              onClick={() => setViewMode("week")}
              style={{
                padding: "0.35rem 0.9rem",
                borderRadius: "8px",
                border: "none",
                background: viewMode === "week" ? "var(--color-surface)" : "transparent",
                color: viewMode === "week" ? "var(--primary)" : "var(--text-muted)",
                fontWeight: viewMode === "week" ? 700 : 500,
                fontSize: "0.82rem",
                cursor: "pointer",
                boxShadow: viewMode === "week" ? "var(--shadow-xs)" : "none",
              }}
            >
              Week View
            </button>
            <button
              onClick={() => setViewMode("agenda")}
              style={{
                padding: "0.35rem 0.9rem",
                borderRadius: "8px",
                border: "none",
                background: viewMode === "agenda" ? "var(--color-surface)" : "transparent",
                color: viewMode === "agenda" ? "var(--primary)" : "var(--text-muted)",
                fontWeight: viewMode === "agenda" ? 700 : 500,
                fontSize: "0.82rem",
                cursor: "pointer",
                boxShadow: viewMode === "agenda" ? "var(--shadow-xs)" : "none",
              }}
            >
              Agenda
            </button>
          </div>
        </div>

        {/* Loading and Error States */}
        {loading ? (
          <LoadingState message="Syncing your live sessions and assignment deadlines..." />
        ) : error ? (
          <ErrorState message={error} onRetry={loadCalendarData} />
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: viewMode === "agenda" ? "1fr" : "minmax(0, 1fr) 340px",
              gap: "1.5rem",
              alignItems: "start",
            }}
          >
            {/* Main Calendar View Area */}
            <div>
              {/* 1. MONTH VIEW */}
              {viewMode === "month" && (
                <div
                  style={{
                    background: "var(--color-surface)",
                    borderRadius: "16px",
                    border: "1px solid var(--color-border)",
                    overflow: "hidden",
                    boxShadow: "var(--shadow-sm)",
                  }}
                >
                  {/* Weekday Column Headers */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(7, 1fr)",
                      background: "rgba(0,0,0,0.02)",
                      borderBottom: "1px solid var(--color-border)",
                      textAlign: "center",
                      fontWeight: 700,
                      fontSize: "0.85rem",
                      color: "var(--text-muted)",
                      padding: "0.75rem 0",
                    }}
                  >
                    {WEEKDAYS.map((wd) => (
                      <div key={wd}>{wd}</div>
                    ))}
                  </div>

                  {/* 7-Column Days Grid */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                      gridAutoRows: "minmax(110px, auto)",
                    }}
                  >
                    {monthGridDays.map((dayItem, idx) => {
                      const dayEvents = eventsByDate[dayItem.dateStr] || [];
                      const isSelected = dayItem.dateStr === selectedDateStr;

                      return (
                        <div
                          key={idx}
                          onClick={() => setSelectedDate(dayItem.date)}
                          style={{
                            borderRight: (idx + 1) % 7 === 0 ? "none" : "1px solid var(--color-border)",
                            borderBottom: "1px solid var(--color-border)",
                            padding: "0.5rem",
                            background: isSelected
                              ? "rgba(79, 70, 229, 0.05)"
                              : dayItem.isCurrentMonth
                              ? "var(--color-surface)"
                              : "rgba(0,0,0,0.015)",
                            cursor: "pointer",
                            transition: "background 0.15s ease",
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.25rem",
                            minHeight: "110px",
                            outline: isSelected ? "2px solid var(--primary)" : "none",
                            outlineOffset: "-2px",
                          }}
                        >
                          {/* Day Header */}
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              marginBottom: "0.25rem",
                            }}
                          >
                            <span
                              style={{
                                fontSize: "0.82rem",
                                fontWeight: dayItem.isToday ? 800 : dayItem.isCurrentMonth ? 600 : 400,
                                color: dayItem.isToday
                                  ? "#ffffff"
                                  : dayItem.isCurrentMonth
                                  ? "var(--text-main)"
                                  : "var(--text-dim)",
                                background: dayItem.isToday ? "var(--primary)" : "transparent",
                                width: "24px",
                                height: "24px",
                                borderRadius: "50%",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              {dayItem.dayNumber}
                            </span>

                            {dayItem.isToday && (
                              <span
                                style={{
                                  fontSize: "0.65rem",
                                  fontWeight: 800,
                                  color: "var(--primary)",
                                  textTransform: "uppercase",
                                }}
                              >
                                Today
                              </span>
                            )}
                          </div>

                          {/* Event Chips inside the Day Cell */}
                          <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem", flex: 1 }}>
                            {dayEvents.slice(0, 3).map((ev) => {
                              const isLiveNow = ev.status === "LIVE";
                              const badgeStyle = getEventBadgeStyle(ev.type, isLiveNow);

                              return (
                                <div
                                  key={ev.id}
                                  title={`${ev.title} (${ev.startTimeStr})`}
                                  style={{
                                    fontSize: "0.72rem",
                                    padding: "2px 5px",
                                    borderRadius: "5px",
                                    background: badgeStyle.bg,
                                    color: badgeStyle.text,
                                    border: badgeStyle.border,
                                    fontWeight: 600,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "0.25rem",
                                  }}
                                >
                                  <span
                                    className="material-symbols-outlined"
                                    style={{ fontSize: "0.8rem", flexShrink: 0 }}
                                  >
                                    {badgeStyle.icon}
                                  </span>
                                  <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                                    {ev.type === "Assignment Due" ? `Due: ${ev.title}` : ev.title}
                                  </span>
                                </div>
                              );
                            })}

                            {dayEvents.length > 3 && (
                              <span
                                style={{
                                  fontSize: "0.7rem",
                                  fontWeight: 700,
                                  color: "var(--primary)",
                                  marginTop: "auto",
                                }}
                              >
                                +{dayEvents.length - 3} more
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 2. WEEK VIEW */}
              {viewMode === "week" && (
                <div
                  style={{
                    background: "var(--color-surface)",
                    borderRadius: "16px",
                    border: "1px solid var(--color-border)",
                    overflow: "hidden",
                    boxShadow: "var(--shadow-sm)",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(7, 1fr)",
                      minHeight: "480px",
                    }}
                  >
                    {weekDays.map((wDay, idx) => {
                      const dayEvents = eventsByDate[wDay.dateStr] || [];
                      const isSelected = wDay.dateStr === selectedDateStr;

                      return (
                        <div
                          key={idx}
                          onClick={() => setSelectedDate(wDay.date)}
                          style={{
                            borderRight: idx === 6 ? "none" : "1px solid var(--color-border)",
                            display: "flex",
                            flexDirection: "column",
                            background: isSelected ? "rgba(79, 70, 229, 0.04)" : "var(--color-surface)",
                            cursor: "pointer",
                          }}
                        >
                          {/* Column Header */}
                          <div
                            style={{
                              padding: "0.85rem 0.5rem",
                              textAlign: "center",
                              borderBottom: "1px solid var(--color-border)",
                              background: wDay.isToday ? "rgba(79, 70, 229, 0.08)" : "rgba(0,0,0,0.02)",
                            }}
                          >
                            <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
                              {wDay.dayName}
                            </div>
                            <div
                              style={{
                                fontSize: "1.2rem",
                                fontWeight: 800,
                                color: wDay.isToday ? "var(--primary)" : "var(--text-main)",
                                marginTop: "0.2rem",
                              }}
                            >
                              {wDay.dayNumber}
                            </div>
                          </div>

                          {/* Day Events Column Body */}
                          <div style={{ padding: "0.75rem 0.5rem", display: "flex", flexDirection: "column", gap: "0.5rem", flex: 1 }}>
                            {dayEvents.length === 0 ? (
                              <div style={{ textAlign: "center", color: "var(--text-dim)", fontSize: "0.75rem", marginTop: "1rem" }}>
                                No events
                              </div>
                            ) : (
                              dayEvents.map((ev) => {
                                const isLiveNow = ev.status === "LIVE";
                                const badgeStyle = getEventBadgeStyle(ev.type, isLiveNow);

                                return (
                                  <div
                                    key={ev.id}
                                    style={{
                                      padding: "0.5rem",
                                      borderRadius: "8px",
                                      background: badgeStyle.bg,
                                      border: badgeStyle.border,
                                      fontSize: "0.78rem",
                                    }}
                                  >
                                    <div
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "0.25rem",
                                        fontWeight: 700,
                                        color: badgeStyle.text,
                                        marginBottom: "0.2rem",
                                      }}
                                    >
                                      <span className="material-symbols-outlined" style={{ fontSize: "0.9rem" }}>
                                        {badgeStyle.icon}
                                      </span>
                                      <span style={{ fontSize: "0.72rem" }}>
                                        {isLiveNow ? "LIVE NOW" : ev.startTimeStr}
                                      </span>
                                    </div>
                                    <div style={{ fontWeight: 700, color: "var(--text-main)", lineHeight: 1.3 }}>
                                      {ev.title}
                                    </div>
                                    <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>
                                      {ev.programName}
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 3. AGENDA / UPCOMING LIST VIEW */}
              {viewMode === "agenda" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  {filteredEvents.length === 0 ? (
                    <div
                      style={{
                        padding: "4rem 2rem",
                        textAlign: "center",
                        background: "var(--color-surface)",
                        borderRadius: "16px",
                        border: "1px dashed var(--color-border)",
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "3.5rem", color: "var(--text-muted)", marginBottom: "0.75rem" }}>
                        event_busy
                      </span>
                      <h3 style={{ fontSize: "1.25rem", fontWeight: 700 }}>No Scheduled Milestones</h3>
                      <p style={{ color: "var(--text-muted)", fontSize: "0.95rem" }}>
                        You have no upcoming live sessions or assignment dues matching the selected filter.
                      </p>
                    </div>
                  ) : (
                    filteredEvents.map((ev) => {
                      const isLiveNow = ev.status === "LIVE";
                      const badgeStyle = getEventBadgeStyle(ev.type, isLiveNow);
                      const isToday = ev.dateStr === formatDateKey(new Date());

                      return (
                        <div
                          key={ev.id}
                          style={{
                            background: "var(--color-surface)",
                            borderRadius: "14px",
                            border: isToday ? "2px solid var(--primary)" : "1px solid var(--color-border)",
                            padding: "1.25rem 1.5rem",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "1.5rem",
                            boxShadow: "var(--shadow-sm)",
                            flexWrap: "wrap",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "1.25rem", minWidth: "280px", flex: 1 }}>
                            <div
                              style={{
                                width: "48px",
                                height: "48px",
                                borderRadius: "12px",
                                background: badgeStyle.bg,
                                color: badgeStyle.text,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                              }}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: "1.6rem" }}>
                                {badgeStyle.icon}
                              </span>
                            </div>

                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem", flexWrap: "wrap" }}>
                                <span
                                  style={{
                                    fontSize: "0.72rem",
                                    fontWeight: 700,
                                    color: badgeStyle.text,
                                    background: badgeStyle.bg,
                                    padding: "2px 8px",
                                    borderRadius: "10px",
                                  }}
                                >
                                  {isLiveNow ? "LIVE NOW" : ev.type}
                                </span>
                                {isToday && (
                                  <span
                                    style={{
                                      fontSize: "0.7rem",
                                      fontWeight: 800,
                                      color: "#ffffff",
                                      background: "var(--danger)",
                                      padding: "2px 8px",
                                      borderRadius: "10px",
                                    }}
                                  >
                                    TODAY
                                  </span>
                                )}
                                <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                                  • {ev.programName}
                                </span>
                              </div>

                              <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text-main)", margin: 0 }}>
                                {ev.title}
                              </h3>
                            </div>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: "2rem", flexShrink: 0 }}>
                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--text-main)" }}>
                                {ev.date.toLocaleDateString(undefined, {
                                  weekday: "short",
                                  month: "short",
                                  day: "numeric",
                                })}
                              </div>
                              <div style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                                {ev.endTimeStr ? `${ev.startTimeStr} – ${ev.endTimeStr}` : ev.startTimeStr}
                              </div>
                            </div>

                            {ev.type === "Live Lecture" && (
                              <button
                                onClick={() => {
                                  if (ev.roomName) {
                                    joinMeeting(ev.roomName, false, ev.title);
                                  } else if (ev.link) {
                                    window.location.href = ev.link;
                                  }
                                }}
                                className={isLiveNow ? "btn-danger" : "btn-primary"}
                                style={{
                                  padding: "0.55rem 1.25rem",
                                  fontSize: "0.85rem",
                                  fontWeight: 700,
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "0.35rem",
                                }}
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: "1.1rem" }}>
                                  videocam
                                </span>
                                {isLiveNow ? "Join Live" : "Open Class"}
                              </button>
                            )}

                            {ev.type === "Assignment Due" && ev.link && (
                              <Link
                                href={ev.link}
                                className="btn-primary"
                                style={{
                                  padding: "0.55rem 1.25rem",
                                  fontSize: "0.85rem",
                                  fontWeight: 700,
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "0.35rem",
                                }}
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: "1.1rem" }}>
                                  upload_file
                                </span>
                                View & Submit
                              </Link>
                            )}

                            {ev.type === "Quiz" && ev.link && (
                              <Link
                                href={ev.link}
                                className="btn-secondary"
                                style={{
                                  padding: "0.55rem 1.25rem",
                                  fontSize: "0.85rem",
                                  fontWeight: 700,
                                }}
                              >
                                Open Quiz
                              </Link>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* Sidebar: Day Detail Panel (when in month or week view) */}
            {viewMode !== "agenda" && (
              <div
                style={{
                  background: "var(--color-surface)",
                  borderRadius: "16px",
                  border: "1px solid var(--color-border)",
                  padding: "1.5rem",
                  boxShadow: "var(--shadow-sm)",
                  position: "sticky",
                  top: "1.5rem",
                }}
              >
                {/* Header */}
                <div style={{ paddingBottom: "1rem", borderBottom: "1px solid var(--color-border)", marginBottom: "1.25rem" }}>
                  <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--primary)", textTransform: "uppercase" }}>
                    Selected Day Schedule
                  </div>
                  <h3 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--text-main)", marginTop: "0.2rem", marginBottom: 0 }}>
                    {selectedDate.toLocaleDateString(undefined, {
                      weekday: "long",
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </h3>
                </div>

                {/* Day Items List */}
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  {selectedDayEvents.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "2.5rem 1rem", color: "var(--text-muted)" }}>
                      <span className="material-symbols-outlined" style={{ fontSize: "2.5rem", marginBottom: "0.5rem", opacity: 0.5 }}>
                        event_available
                      </span>
                      <p style={{ fontSize: "0.88rem", margin: 0 }}>No classes or assignments due on this date.</p>
                    </div>
                  ) : (
                    selectedDayEvents.map((ev) => {
                      const isLiveNow = ev.status === "LIVE";
                      const badgeStyle = getEventBadgeStyle(ev.type, isLiveNow);

                      return (
                        <div
                          key={ev.id}
                          style={{
                            padding: "1rem",
                            borderRadius: "12px",
                            background: badgeStyle.bg,
                            border: badgeStyle.border,
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.5rem",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span
                              style={{
                                fontSize: "0.72rem",
                                fontWeight: 700,
                                color: badgeStyle.text,
                                display: "flex",
                                alignItems: "center",
                                gap: "0.25rem",
                              }}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: "0.9rem" }}>
                                {badgeStyle.icon}
                              </span>
                              {isLiveNow ? "LIVE NOW" : ev.type}
                            </span>

                            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-main)" }}>
                              {ev.endTimeStr ? `${ev.startTimeStr} – ${ev.endTimeStr}` : ev.startTimeStr}
                            </span>
                          </div>

                          <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "var(--text-main)", lineHeight: 1.35 }}>
                            {ev.title}
                          </div>

                          <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                            Program: <strong>{ev.programName}</strong>
                          </div>

                          {/* Action Button */}
                          <div style={{ marginTop: "0.4rem" }}>
                            {ev.type === "Live Lecture" && (
                              <button
                                onClick={() => {
                                  if (ev.roomName) {
                                    joinMeeting(ev.roomName, false, ev.title);
                                  } else if (ev.link) {
                                    window.location.href = ev.link;
                                  }
                                }}
                                className={isLiveNow ? "btn-danger" : "btn-primary"}
                                style={{
                                  width: "100%",
                                  padding: "0.5rem 1rem",
                                  fontSize: "0.82rem",
                                  fontWeight: 700,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  gap: "0.35rem",
                                }}
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: "1.1rem" }}>
                                  videocam
                                </span>
                                {isLiveNow ? "Join Live Class Now" : "Open Live Class"}
                              </button>
                            )}

                            {ev.type === "Assignment Due" && ev.link && (
                              <Link
                                href={ev.link}
                                className="btn-primary"
                                style={{
                                  width: "100%",
                                  padding: "0.5rem 1rem",
                                  fontSize: "0.82rem",
                                  fontWeight: 700,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  gap: "0.35rem",
                                }}
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: "1.05rem" }}>
                                  upload_file
                                </span>
                                View & Submit Assignment
                              </Link>
                            )}

                            {ev.type === "Quiz" && ev.link && (
                              <Link
                                href={ev.link}
                                className="btn-secondary"
                                style={{
                                  width: "100%",
                                  padding: "0.5rem 1rem",
                                  fontSize: "0.82rem",
                                  fontWeight: 700,
                                  textAlign: "center",
                                  display: "block",
                                }}
                              >
                                Open Assessment
                              </Link>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </RequireAuth>
  );
}
