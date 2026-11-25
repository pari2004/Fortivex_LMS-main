"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthContext";
import { getCurriculum, createProgramModule, createWeek, createLesson, createActivity, getProgram } from "@/lib/api/endpoints";
import type { ProgramModule, Program } from "@/lib/api/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PROGRAM_COHORT_ADMIN_ROLES, INSTRUCTOR_ROLES } from "@/lib/auth/roles";

const styles = {
  wrapper: {
    padding: "3rem 4rem",
    width: "100%",
    maxWidth: "1600px",
    margin: "0 auto",
    display: "flex",
    flexDirection: "column" as const,
    gap: "2rem",
    animation: "fadeIn 0.3s ease-out"
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "1rem"
  },
  title: {
    fontSize: "2rem",
    fontWeight: 800,
    color: "var(--foreground)",
    letterSpacing: "-0.5px"
  },
  wizardCard: {
    padding: "2rem",
    border: "2px solid var(--color-border)",
    borderRadius: "16px",
    cursor: "pointer",
    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    gap: "1rem",
    background: "var(--color-surface)",
    minHeight: "160px"
  },
  wizardCardActive: {
    border: "2px solid var(--color-primary)",
    background: "rgba(29, 78, 216, 0.04)",
    transform: "translateY(-4px)",
    boxShadow: "0 12px 24px rgba(29, 78, 216, 0.1)"
  },
  stepIndicator: {
    display: "flex",
    gap: "1rem",
    marginBottom: "3rem",
    justifyContent: "center",
    alignItems: "center"
  },
  stepDot: {
    width: "40px",
    height: "40px",
    borderRadius: "50%",
    background: "var(--color-surface)",
    border: "2px solid var(--color-border)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    color: "var(--color-muted)",
    transition: "all 0.3s"
  },
  stepDotActive: {
    background: "var(--color-primary)",
    border: "2px solid var(--color-primary)",
    color: "white"
  },
  stepLine: {
    width: "60px",
    height: "2px",
    background: "var(--color-border)"
  },
  formSection: {
    background: "var(--color-surface)",
    padding: "3rem",
    borderRadius: "16px",
    border: "1px solid var(--color-border)",
    boxShadow: "0 12px 40px rgba(0,0,0,0.04)",
    display: "flex",
    flexDirection: "column" as const,
    gap: "2rem",
    maxWidth: "800px",
    margin: "0 auto",
    width: "100%"
  },
  label: {
    fontSize: "1rem",
    fontWeight: 700,
    marginBottom: "0.75rem",
    display: "block",
    color: "var(--foreground)"
  },
  select: {
    width: "100%",
    padding: "1rem",
    borderRadius: "10px",
    border: "1px solid rgba(0,0,0,0.12)",
    background: "var(--background)",
    color: "var(--foreground)",
    fontSize: "1rem",
    boxShadow: "0 2px 4px rgba(0,0,0,0.02) inset",
    outline: "none",
    transition: "all 0.2s"
  }
};

type ContentType = "MODULE" | "WEEK" | "LESSON" | "ACTIVITY" | "LIVE_SESSION";

function ContentBuilder() {
  const params = useParams<{ id: string }>();
  const programId = Number(params.id);
  const router = useRouter();
  const { token, user } = useAuth();
  
  const isAdmin = user?.roles.some(r => PROGRAM_COHORT_ADMIN_ROLES.includes(r));
  const basePath = isAdmin ? "/admin" : "/instructor";
  
  const [program, setProgram] = useState<Program | null>(null);
  const [modules, setModules] = useState<ProgramModule[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Wizard State
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [contentType, setContentType] = useState<ContentType>("MODULE");
  
  // Parent Selection State
  const [selectedModuleId, setSelectedModuleId] = useState<number | "">("");
  const [selectedWeekId, setSelectedWeekId] = useState<number | "">("");
  const [selectedLessonId, setSelectedLessonId] = useState<number | "">("");

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

  // Details State
  const [title, setTitle] = useState("");
  const [activityType, setActivityType] = useState("VIDEO");
  const [activityContent, setActivityContent] = useState("");
  const [liveStartTime, setLiveStartTime] = useState(getNextHour());
  const [liveEndTime, setLiveEndTime] = useState(getNextTwoHours());
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      getProgram(token, programId),
      getCurriculum(token, programId)
    ])
    .then(([progData, currData]) => {
      setProgram(progData);
      setModules(currData);
    })
    .catch((err: any) => {
      setError(err.message || "Failed to load program data");
    });
  }, [token, programId]);

  const handleNextStep = () => {
    if (step === 1) {
      if (contentType === "MODULE") setStep(3); // skip location for modules
      else setStep(2);
    } else if (step === 2) {
      if (contentType === "WEEK" && !selectedModuleId) return alert("Select a Module first");
      if (contentType === "LESSON" && (!selectedModuleId || !selectedWeekId)) return alert("Select Module and Week");
      if ((contentType === "ACTIVITY" || contentType === "LIVE_SESSION") && (!selectedModuleId || !selectedWeekId || !selectedLessonId)) return alert("Select Module, Week, and Lesson");
      setStep(3);
    }
  };

  const handleCreate = async () => {
    if (!token || !title.trim()) return alert("Title is required");
    setIsSubmitting(true);
    try {
      if (contentType === "MODULE") {
        await createProgramModule(token, programId, { title, order: (modules?.length || 0) + 1 });
      } else if (contentType === "WEEK") {
        const mod = modules?.find(m => m.id === Number(selectedModuleId));
        await createWeek(token, Number(selectedModuleId), { title, week_number: (mod?.weeks.length || 0) + 1, order: (mod?.weeks.length || 0) + 1 });
      } else if (contentType === "LESSON") {
        const mod = modules?.find(m => m.id === Number(selectedModuleId));
        const wk = mod?.weeks.find(w => w.id === Number(selectedWeekId));
        await createLesson(token, Number(selectedWeekId), { title, order: (wk?.lessons.length || 0) + 1 });
      } else if (contentType === "ACTIVITY") {
        const mod = modules?.find(m => m.id === Number(selectedModuleId));
        const wk = mod?.weeks.find(w => w.id === Number(selectedWeekId));
        const lsn = wk?.lessons.find(l => l.id === Number(selectedLessonId));
        await createActivity(token, Number(selectedLessonId), { 
          title, 
          activity_type: activityType, 
          order: (lsn?.activities.length || 0) + 1,
          content: activityType === 'VIDEO' ? { url: activityContent } : { text: activityContent }
        });
      } else if (contentType === "LIVE_SESSION") {
        if (!liveStartTime || !liveEndTime) {
          setIsSubmitting(false);
          return alert("Please select both start time and end time for the live session.");
        }
        if (new Date(liveStartTime).getTime() >= new Date(liveEndTime).getTime()) {
          setIsSubmitting(false);
          return alert("End time must be after start time.");
        }
        const mod = modules?.find(m => m.id === Number(selectedModuleId));
        const wk = mod?.weeks.find(w => w.id === Number(selectedWeekId));
        const lsn = wk?.lessons.find(l => l.id === Number(selectedLessonId));
        const roomName = `lms-${programId}-${Date.now()}`;
        const startIso = liveStartTime.length === 16 ? `${liveStartTime}:00` : liveStartTime;
        const endIso = liveEndTime.length === 16 ? `${liveEndTime}:00` : liveEndTime;
        await createActivity(token, Number(selectedLessonId), { 
          title: title.trim(), 
          activity_type: "LIVE_SESSION", 
          order: (lsn?.activities.length || 0) + 1,
          content: { 
            start_time: startIso,
            end_time: endIso,
            room_name: roomName,
            meeting_url: `https://${process.env.NEXT_PUBLIC_JITSI_DOMAIN || "meet.systemli.org"}/${roomName}`
          }
        });
      }
      router.push(`${basePath}/programs/${programId}`);
    } catch (e) {
      alert("Error adding content");
      setIsSubmitting(false);
    }
  };

  // Helper selectors
  const activeModule = modules?.find(m => m.id === Number(selectedModuleId));
  const activeWeek = activeModule?.weeks.find(w => w.id === Number(selectedWeekId));

  if (error) return <div style={styles.wrapper}><ErrorState message={error} /></div>;
  if (!modules || !program) return <div style={styles.wrapper}><LoadingState message="Loading builder..." /></div>;

  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>
        <div>
          <Link href={`${basePath}/programs/${programId}`} style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", color: "var(--color-muted)", textDecoration: "none", marginBottom: "1rem", fontWeight: 600 }}>
            <span className="material-symbols-outlined" style={{ fontSize: "1.2rem" }}>arrow_back</span>
            Back to Program
          </Link>
          <h1 style={styles.title}>Build Curriculum for {program.name}</h1>
        </div>
      </div>

      <div style={styles.stepIndicator}>
        <div style={{ ...styles.stepDot, ...(step >= 1 ? styles.stepDotActive : {}) }}>1</div>
        <div style={styles.stepLine} />
        <div style={{ ...styles.stepDot, ...(step >= 2 ? styles.stepDotActive : {}) }}>2</div>
        <div style={styles.stepLine} />
        <div style={{ ...styles.stepDot, ...(step >= 3 ? styles.stepDotActive : {}) }}>3</div>
      </div>

      {step === 1 && (
        <div style={{ animation: "fadeIn 0.3s ease-out" }}>
          <h2 style={{ textAlign: "center", marginBottom: "2rem", fontSize: "1.5rem" }}>What do you want to add?</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "1.5rem", maxWidth: "1200px", margin: "0 auto" }}>
            <div 
              style={{ ...styles.wizardCard, ...(contentType === "MODULE" ? styles.wizardCardActive : {}) }}
              onClick={() => setContentType("MODULE")}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "3rem", color: "var(--color-primary)" }}>folder_open</span>
              <span style={{ fontWeight: 700, fontSize: "1.2rem" }}>Module</span>
              <span style={{ color: "var(--color-muted)", fontSize: "0.9rem", textAlign: "center" }}>A top-level container for a section of the course</span>
            </div>
            <div 
              style={{ ...styles.wizardCard, ...(contentType === "WEEK" ? styles.wizardCardActive : {}) }}
              onClick={() => setContentType("WEEK")}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "3rem", color: "var(--muted-teal)" }}>calendar_month</span>
              <span style={{ fontWeight: 700, fontSize: "1.2rem" }}>Week</span>
              <span style={{ color: "var(--color-muted)", fontSize: "0.9rem", textAlign: "center" }}>A chronological grouping inside a Module</span>
            </div>
            <div 
              style={{ ...styles.wizardCard, ...(contentType === "LESSON" ? styles.wizardCardActive : {}) }}
              onClick={() => setContentType("LESSON")}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "3rem", color: "var(--color-primary)" }}>play_lesson</span>
              <span style={{ fontWeight: 700, fontSize: "1.2rem" }}>Lesson</span>
              <span style={{ color: "var(--color-muted)", fontSize: "0.9rem", textAlign: "center" }}>A specific topic within a Week</span>
            </div>
            <div 
              style={{ ...styles.wizardCard, ...(contentType === "ACTIVITY" ? styles.wizardCardActive : {}) }}
              onClick={() => setContentType("ACTIVITY")}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "3rem", color: "var(--blue-slate)" }}>article</span>
              <span style={{ fontWeight: 700, fontSize: "1.2rem" }}>Activity</span>
              <span style={{ color: "var(--color-muted)", fontSize: "0.9rem", textAlign: "center" }}>Actual learning content (Video or Reading)</span>
            </div>
            <div 
              style={{ ...styles.wizardCard, ...(contentType === "LIVE_SESSION" ? styles.wizardCardActive : {}) }}
              onClick={() => setContentType("LIVE_SESSION")}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "3rem", color: "var(--warning)" }}>video_camera_front</span>
              <span style={{ fontWeight: 700, fontSize: "1.2rem" }}>Live Session</span>
              <span style={{ color: "var(--color-muted)", fontSize: "0.9rem", textAlign: "center" }}>Schedule a live interactive class</span>
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div style={styles.formSection}>
          <h2 style={{ textAlign: "center", fontSize: "1.5rem", marginBottom: "1rem" }}>Where should it go?</h2>
          
          <div>
            <label style={styles.label}>Select Module</label>
            <select 
              value={selectedModuleId} 
              onChange={(e) => { setSelectedModuleId(e.target.value ? Number(e.target.value) : ""); setSelectedWeekId(""); setSelectedLessonId(""); }}
              style={styles.select}
            >
              <option value="">-- Choose Module --</option>
              {modules.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
            </select>
          </div>

          {(contentType === "LESSON" || contentType === "ACTIVITY" || contentType === "LIVE_SESSION") && (
            <div>
              <label style={styles.label}>Select Week</label>
              <select 
                value={selectedWeekId} 
                onChange={(e) => { setSelectedWeekId(e.target.value ? Number(e.target.value) : ""); setSelectedLessonId(""); }}
                disabled={!selectedModuleId}
                style={{ ...styles.select, opacity: !selectedModuleId ? 0.5 : 1 }}
              >
                <option value="">-- Choose Week --</option>
                {activeModule?.weeks.map(w => <option key={w.id} value={w.id}>{w.title}</option>)}
              </select>
            </div>
          )}

          {(contentType === "ACTIVITY" || contentType === "LIVE_SESSION") && (
            <div>
              <label style={styles.label}>Select Lesson</label>
              <select 
                value={selectedLessonId} 
                onChange={(e) => setSelectedLessonId(e.target.value ? Number(e.target.value) : "")}
                disabled={!selectedWeekId}
                style={{ ...styles.select, opacity: !selectedWeekId ? 0.5 : 1 }}
              >
                <option value="">-- Choose Lesson --</option>
                {activeWeek?.lessons.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
              </select>
            </div>
          )}
        </div>
      )}

      {step === 3 && (
        <div style={styles.formSection}>
          <h2 style={{ textAlign: "center", fontSize: "1.5rem", marginBottom: "1rem" }}>Enter Details</h2>
          
          <Input 
            id="content-title" 
            label={`${contentType.charAt(0) + contentType.slice(1).toLowerCase()} Title`} 
            value={title} 
            onChange={e => setTitle(e.target.value)} 
            placeholder={`e.g. Introduction to the ${contentType.toLowerCase()}`} 
            autoFocus
          />

          {contentType === "LIVE_SESSION" && (
            <>
              <div>
                <label style={styles.label}>Start Time</label>
                <input 
                  type="datetime-local" 
                  id="live-start-time"
                  value={liveStartTime}
                  onChange={e => setLiveStartTime(e.target.value)}
                  style={styles.select}
                  required
                />
              </div>
              <div>
                <label style={styles.label}>End Time</label>
                <input 
                  type="datetime-local" 
                  id="live-end-time"
                  value={liveEndTime}
                  onChange={e => setLiveEndTime(e.target.value)}
                  style={styles.select}
                  required
                />
              </div>
            </>
          )}

          {contentType === "ACTIVITY" && (
            <>
              <div>
                <label style={styles.label}>Activity Type</label>
                <select 
                  value={activityType} 
                  onChange={e => { setActivityType(e.target.value); setActivityContent(""); }}
                  style={styles.select}
                >
                  <option value="VIDEO">Video</option>
                  <option value="READING">Reading Material</option>
                </select>
              </div>

              {activityType === "VIDEO" && (
                <Input 
                  id="video-url" 
                  label="YouTube URL" 
                  value={activityContent} 
                  onChange={e => setActivityContent(e.target.value)} 
                  placeholder="https://youtube.com/..." 
                />
              )}

              {activityType === "READING" && (
                <div>
                  <label style={styles.label}>Content</label>
                  <textarea 
                    value={activityContent}
                    onChange={e => setActivityContent(e.target.value)}
                    placeholder="Write your lesson text here..."
                    style={{ width: "100%", minHeight: "250px", padding: "1rem", borderRadius: "10px", border: "1px solid rgba(0,0,0,0.12)", background: "var(--background)", color: "var(--foreground)", fontFamily: "inherit", resize: "vertical", fontSize: "1rem" }}
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "2rem", maxWidth: "800px", margin: "2rem auto 0 auto", width: "100%" }}>
        {step > 1 ? (
          <Button variant="secondary" onClick={() => setStep(step === 3 && contentType === "MODULE" ? 1 : step - 1 as any)}>Back</Button>
        ) : (
          <div /> // Spacer
        )}
        
        {step < 3 ? (
          <Button onClick={handleNextStep}>Continue Next Step</Button>
        ) : (
          <Button onClick={handleCreate} disabled={isSubmitting || !title.trim()}>
            {isSubmitting ? "Creating..." : `Create ${contentType}`}
          </Button>
        )}
      </div>
    </div>
  );
}

export default function BuildPage() {
  return (
    <RequireAuth allowedRoles={[...PROGRAM_COHORT_ADMIN_ROLES, ...INSTRUCTOR_ROLES]}>
      <ContentBuilder />
    </RequireAuth>
  );
}
