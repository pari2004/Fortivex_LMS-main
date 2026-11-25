"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { usePrograms } from "@/lib/api/usePrograms";
import { apiRequest } from "@/lib/api/client";
import {
  createProgramModule,
  createWeek,
  createLesson,
  createActivity,
  deleteActivity
} from "@/lib/api/endpoints";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import { useMeeting } from "@/lib/live/MeetingContext";

interface LiveSession {
  id: number;
  title: string;
  programTitle: string;
  startTime: string;
  endTime: string;
  meetingUrl: string;
  roomName: string;
  status: "UPCOMING" | "LIVE" | "COMPLETED";
}

export function LiveSessions({ role }: { role: "ADMIN" | "INSTRUCTOR" | "STUDENT" }) {
  const { token, organization } = useAuth();
  const { programs, error: programsError, reload: reloadPrograms } = usePrograms(organization?.id);
  const [sessions, setSessions] = useState<LiveSession[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const { joinMeeting } = useMeeting();

  // Modal State for Scheduling
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProgramId, setSelectedProgramId] = useState<number | "">("");
  const [modalTitle, setModalTitle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formatLocalDateTime = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const getNextHour = () => {
    const d = new Date();
    d.setHours(d.getHours() + 1, 0, 0, 0);
    return formatLocalDateTime(d);
  };

  const getNextTwoHours = () => {
    const d = new Date();
    d.setHours(d.getHours() + 2, 0, 0, 0);
    return formatLocalDateTime(d);
  };

  const [modalStartDate, setModalStartDate] = useState(getNextHour().slice(0, 10));
  const [modalStartTime, setModalStartTime] = useState(getNextHour().slice(11, 16));
  const [modalEndDate, setModalEndDate] = useState(getNextTwoHours().slice(0, 10));
  const [modalEndTime, setModalEndTime] = useState(getNextTwoHours().slice(11, 16));

  const fetchCurriculums = useCallback(async () => {
    if (!token || !programs) return;
    try {
      const allSessions: LiveSession[] = [];
      
      for (const prog of programs) {
        const details = await apiRequest<any>(`/api/v1/programs/${prog.id}/curriculum`, { token });
        
        if (Array.isArray(details)) {
          for (const mod of details) {
            for (const wk of mod.weeks || []) {
              for (const lsn of wk.lessons || []) {
                for (const act of lsn.activities || []) {
                  if (act.activity_type === "LIVE_SESSION" && act.content) {
                    const now = new Date();
                    const start = new Date(act.content.start_time);
                    const end = new Date(act.content.end_time);
                    
                    let status: "UPCOMING" | "LIVE" | "COMPLETED" = "UPCOMING";
                    if (!isNaN(end.getTime()) && now > end) {
                      status = "COMPLETED";
                    } else if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && now >= start && now <= end) {
                      status = "LIVE";
                    }

                    allSessions.push({
                      id: act.id,
                      title: act.title,
                      programTitle: prog.name,
                      startTime: act.content.start_time,
                      endTime: act.content.end_time,
                      meetingUrl: act.content.meeting_url || `https://${process.env.NEXT_PUBLIC_JITSI_DOMAIN || "meet.systemli.org"}/${act.content.room_name}`,
                      roomName: act.content.room_name,
                      status
                    });
                  }
                }
              }
            }
          }
        }
      }
      
      allSessions.sort((a, b) => {
        const timeA = new Date(a.startTime).getTime();
        const timeB = new Date(b.startTime).getTime();
        return (isNaN(timeA) ? 0 : timeA) - (isNaN(timeB) ? 0 : timeB);
      });
      setSessions(allSessions);
      setLoading(false);
    } catch (e) {
      console.error("Failed to fetch live sessions", e);
      setLoading(false);
    }
  }, [token, programs]);

  useEffect(() => {
    fetchCurriculums();
  }, [fetchCurriculums, reloadKey]);

  const handleOpenScheduleModal = () => {
    if (!programs || programs.length === 0) {
      alert("No programs found. Please create a program first.");
      return;
    }
    setSelectedProgramId(programs[0].id);
    setModalTitle("");
    const nextH = getNextHour();
    const next2H = getNextTwoHours();
    setModalStartDate(nextH.slice(0, 10));
    setModalStartTime(nextH.slice(11, 16));
    setModalEndDate(next2H.slice(0, 10));
    setModalEndTime(next2H.slice(11, 16));
    setIsModalOpen(true);
  };

  const handleSaveLiveSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!selectedProgramId) {
      alert("Please select a program.");
      return;
    }
    if (!modalTitle.trim()) {
      alert("Please enter a title for the session.");
      return;
    }
    if (!modalStartDate || !modalStartTime) {
      alert("Please select a valid start date and time.");
      return;
    }
    if (!modalEndDate || !modalEndTime) {
      alert("Please select a valid end date and time.");
      return;
    }

    const startIso = `${modalStartDate}T${modalStartTime}:00`;
    const endIso = `${modalEndDate}T${modalEndTime}:00`;

    if (new Date(startIso).getTime() >= new Date(endIso).getTime()) {
      alert("End time must be after start time.");
      return;
    }

    setIsSubmitting(true);
    try {
      const details = await apiRequest<any>(`/api/v1/programs/${selectedProgramId}/curriculum`, { token });
      let targetLessonId: number | null = null;

      if (Array.isArray(details) && details.length > 0) {
        for (const mod of details) {
          for (const wk of mod.weeks || []) {
            if (wk.lessons && wk.lessons.length > 0) {
              targetLessonId = wk.lessons[0].id;
              break;
            }
          }
          if (targetLessonId) break;
        }
      }

      if (!targetLessonId) {
        const newMod = await createProgramModule(token, Number(selectedProgramId), {
          title: "Live Interactive Sessions",
          order: 1
        });
        const newWk = await createWeek(token, newMod.id, {
          title: "Live Classes Schedule",
          week_number: 1,
          order: 1
        });
        const newLsn = await createLesson(token, newWk.id, {
          title: "Live Workshops",
          order: 1
        });
        targetLessonId = newLsn.id;
      }

      const roomName = `lms-${selectedProgramId}-${Date.now()}`;
      const jitsiDomain = process.env.NEXT_PUBLIC_JITSI_DOMAIN || "meet.systemli.org";
      await createActivity(token, targetLessonId, {
        title: modalTitle.trim(),
        activity_type: "LIVE_SESSION",
        order: 99,
        content: {
          start_time: startIso,
          end_time: endIso,
          room_name: roomName,
          meeting_url: `https://${jitsiDomain}/${roomName}`
        }
      });

      setIsModalOpen(false);
      setModalTitle("");
      setReloadKey(k => k + 1);
    } catch (err: any) {
      alert(`Error scheduling live session: ${err?.message || "Please check server connection."}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSession = async (activityId: number, title: string) => {
    if (!token) return;
    if (!confirm(`Are you sure you want to cancel and remove the session "${title}"?`)) return;
    try {
      await deleteActivity(token, activityId);
      setReloadKey(k => k + 1);
    } catch (err: any) {
      alert(`Failed to delete session: ${err?.message || "Server error"}`);
    }
  };

  if (programsError) return <ErrorState message={programsError} onRetry={reloadPrograms} />;
  if (!programs || loading) return <LoadingState message="Loading live sessions..." />;

  const liveNow = sessions?.filter(s => s.status === "LIVE") || [];
  const upcoming = sessions?.filter(s => s.status === "UPCOMING") || [];
  const completed = sessions?.filter(s => s.status === "COMPLETED").reverse() || [];

  const SessionCard = ({ session }: { session: LiveSession }) => {
    const isValidStart = !isNaN(new Date(session.startTime).getTime());
    const isValidEnd = !isNaN(new Date(session.endTime).getTime());

    return (
      <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "12px", padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem", boxShadow: session.status === "LIVE" ? "0 4px 20px rgba(239, 68, 68, 0.15)" : "none", position: "relative", overflow: "hidden" }}>
        {session.status === "LIVE" && (
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "4px", background: "var(--danger)" }} />
        )}
        
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <Badge status={session.status === "LIVE" ? "draft" : session.status === "COMPLETED" ? "inactive" : "active"}>
              {session.status}
            </Badge>
            <h3 style={{ fontSize: "1.25rem", fontWeight: 700, margin: "0.75rem 0 0.25rem 0" }}>{session.title}</h3>
            <p style={{ color: "var(--color-primary)", fontSize: "0.9rem", fontWeight: 500 }}>{session.programTitle}</p>
          </div>

          {role !== "STUDENT" && (
            <button
              onClick={() => handleDeleteSession(session.id, session.title)}
              style={{ background: "none", border: "none", color: "var(--color-muted)", cursor: "pointer", display: "flex", alignItems: "center", padding: "0.4rem", borderRadius: "6px", transition: "color 0.2s" }}
              title="Cancel Session"
              onMouseEnter={e => e.currentTarget.style.color = "#ef4444"}
              onMouseLeave={e => e.currentTarget.style.color = "var(--color-muted)"}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "1.2rem" }}>delete</span>
            </button>
          )}
        </div>

        <div style={{ display: "flex", gap: "1.5rem", color: "var(--text-muted)", fontSize: "0.9rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "1.1rem" }}>calendar_today</span>
            {isValidStart ? new Date(session.startTime).toLocaleDateString() : "Date TBD"}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "1.1rem" }}>schedule</span>
            {isValidStart && isValidEnd
              ? `${new Date(session.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(session.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
              : "Time TBD"}
          </div>
        </div>

        <div style={{ marginTop: "auto", paddingTop: "1rem", borderTop: "1px solid var(--color-border)" }}>
          {session.status === "LIVE" ? (
            <button onClick={() => joinMeeting(session.roomName, role !== "STUDENT", session.title)} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", background: "var(--danger)", color: "#fff", padding: "0.75rem", borderRadius: "8px", textDecoration: "none", fontWeight: 600, border: "none", cursor: "pointer", transition: "opacity 0.2s", width: "100%" }} onMouseOver={e => e.currentTarget.style.opacity = "0.9"} onMouseOut={e => e.currentTarget.style.opacity = "1"}>
              <span className="material-symbols-outlined">video_camera_front</span> Join Now
            </button>
          ) : session.status === "UPCOMING" && role !== "STUDENT" ? (
            <button onClick={() => joinMeeting(session.roomName, true, session.title)} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", background: "var(--primary)", color: "#fff", padding: "0.75rem", borderRadius: "8px", textDecoration: "none", fontWeight: 600, border: "none", cursor: "pointer", transition: "opacity 0.2s", width: "100%" }} onMouseOver={e => e.currentTarget.style.opacity = "0.9"} onMouseOut={e => e.currentTarget.style.opacity = "1"}>
              <span className="material-symbols-outlined">meeting_room</span> Start Class Early
            </button>
          ) : session.status === "UPCOMING" ? (
            <button disabled style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", background: "var(--color-border)", color: "var(--text-muted)", padding: "0.75rem", borderRadius: "8px", border: "none", width: "100%", fontWeight: 600, cursor: "not-allowed" }}>
              Waiting to start
            </button>
          ) : (
            <a href={session.meetingUrl} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--foreground)", padding: "0.75rem", borderRadius: "8px", textDecoration: "none", fontWeight: 600 }}>
              View Recording / Notes
            </a>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", paddingBottom: "3rem" }}>
      <div style={{ marginBottom: "2rem", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: "0.5rem" }}>Live Sessions</h1>
          <p style={{ color: "var(--color-muted)", fontSize: "1rem" }}>
            {role === "STUDENT" ? "Join your upcoming classes and view past sessions." : "Manage and join live classes across your programs."}
          </p>
        </div>
        {role !== "STUDENT" && (
          <Button onClick={handleOpenScheduleModal} style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "1.1rem" }}>add</span>
            Schedule Live Session
          </Button>
        )}
      </div>

      {sessions?.length === 0 ? (
        <div style={{ textAlign: "center", padding: "4rem 2rem", background: "var(--color-surface)", borderRadius: "12px", border: "1px dashed var(--color-border)" }}>
          <span className="material-symbols-outlined" style={{ fontSize: "3rem", color: "var(--text-muted)", marginBottom: "1rem" }}>videocam_off</span>
          <h3 style={{ fontSize: "1.2rem", fontWeight: 600, marginBottom: "0.5rem" }}>No Live Sessions Found</h3>
          <p style={{ color: "var(--color-muted)", marginBottom: "1.5rem" }}>There are no live sessions scheduled in your programs yet.</p>
          {role !== "STUDENT" && (
            <Button onClick={handleOpenScheduleModal} style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "1.1rem" }}>add</span>
              Schedule Your First Session
            </Button>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "3rem" }}>
          
          {liveNow.length > 0 && (
            <section>
              <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--danger)" }}>
                <span className="material-symbols-outlined" style={{ animation: "pulse 2s infinite" }}>sensors</span> Happening Now
              </h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1.5rem" }}>
                {liveNow.map(s => <SessionCard key={s.id} session={s} />)}
              </div>
            </section>
          )}

          {upcoming.length > 0 && (
            <section>
              <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span className="material-symbols-outlined">event</span> Upcoming Sessions
              </h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1.5rem" }}>
                {upcoming.map(s => <SessionCard key={s.id} session={s} />)}
              </div>
            </section>
          )}

          {completed.length > 0 && (
            <section>
              <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--text-muted)" }}>
                <span className="material-symbols-outlined">history</span> Past Sessions
              </h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1.5rem" }}>
                {completed.map(s => <SessionCard key={s.id} session={s} />)}
              </div>
            </section>
          )}

        </div>
      )}

      {/* Schedule Live Session Modal */}
      <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)} title="Schedule Live Session">
        <form onSubmit={handleSaveLiveSession} style={{ display: "flex", flexDirection: "column", gap: "1.25rem", marginTop: "1rem" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.88rem", fontWeight: 600, marginBottom: "0.5rem" }}>Target Program</label>
            <select
              value={selectedProgramId}
              onChange={e => setSelectedProgramId(Number(e.target.value))}
              style={{ width: "100%", padding: "0.6rem 0.75rem", borderRadius: "8px", border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--foreground)", fontSize: "0.95rem" }}
              required
            >
              {programs?.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <Input
            id="modal-live-title"
            label="Session Title"
            value={modalTitle}
            onChange={e => setModalTitle(e.target.value)}
            placeholder="e.g. Weekly Live Q&A & Mentorship"
            required
            autoFocus
          />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.88rem", fontWeight: 600, marginBottom: "0.5rem" }}>Start Time</label>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <input
                  type="date"
                  value={modalStartDate}
                  onChange={e => setModalStartDate(e.target.value)}
                  style={{ flex: 1, padding: "0.5rem", borderRadius: "8px", border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--foreground)" }}
                  required
                />
                <input
                  type="time"
                  value={modalStartTime}
                  onChange={e => setModalStartTime(e.target.value)}
                  style={{ padding: "0.5rem", borderRadius: "8px", border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--foreground)" }}
                  required
                />
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.88rem", fontWeight: 600, marginBottom: "0.5rem" }}>End Time</label>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <input
                  type="date"
                  value={modalEndDate}
                  onChange={e => setModalEndDate(e.target.value)}
                  style={{ flex: 1, padding: "0.5rem", borderRadius: "8px", border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--foreground)" }}
                  required
                />
                <input
                  type="time"
                  value={modalEndTime}
                  onChange={e => setModalEndTime(e.target.value)}
                  style={{ padding: "0.5rem", borderRadius: "8px", border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--foreground)" }}
                  required
                />
              </div>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "1rem", marginTop: "1rem" }}>
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Scheduling..." : "Schedule Session"}
            </Button>
          </div>
        </form>
      </Modal>
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
      `}} />
    </div>
  );
}
