"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthContext";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { getCurriculum, getProgram } from "@/lib/api/endpoints";
import type { ProgramModule, Program, Activity } from "@/lib/api/types";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import { useProgress } from "@/lib/api/useProgress";
import QuizPlayer from "@/components/curriculum/QuizPlayer";

export default function ActivityPlayer() {
  const { token } = useAuth();
  const params = useParams<{ id: string, activity_id: string }>();
  const router = useRouter();
  const programId = Number(params.id);
  const activityId = Number(params.activity_id);

  const [program, setProgram] = useState<Program | null>(null);
  const [modules, setModules] = useState<ProgramModule[] | null>(null);
  const [currentActivity, setCurrentActivity] = useState<Activity | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { completedActivityIds, markComplete, loading: progressLoading } = useProgress(token, programId);
  const isCompleted = completedActivityIds.includes(activityId);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      getProgram(token, programId),
      getCurriculum(token, programId)
    ])
      .then(([prog, curr]) => {
        setProgram(prog);
        setModules(curr);
        
        let found: Activity | null = null;
        for (const m of curr) {
          for (const w of m.weeks) {
            for (const l of w.lessons) {
              const act = l.activities.find(a => a.id === activityId);
              if (act) {
                found = act;
                break;
              }
            }
          }
        }
        setCurrentActivity(found);
      })
      .catch((err: any) => {
        setError(err.message || "Failed to load activity");
      });
  }, [token, programId, activityId]);

  if (error) return <ErrorState message={error} onRetry={() => window.location.reload()} />;
  if (!program || !modules || !currentActivity || progressLoading) return <LoadingState message="Loading activity..." />;

  let youtubeUrl = "";
  let isNativeVideo = false;
  if (currentActivity.activity_type === "VIDEO" && currentActivity.content?.url) {
    const urlStr = currentActivity.content.url;
    const ytMatch = urlStr.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]+)/);
    if (ytMatch) {
      youtubeUrl = ytMatch[1];
    } else {
      isNativeVideo = true;
    }
  }

  
  if (currentActivity.activity_type === "QUIZ") {
    return (
      <RequireAuth>
        <div style={{ display: "flex", flexDirection: "column", minHeight: "calc(100vh - 64px)", background: "var(--background)", overflowY: "auto", padding: "3rem" }}>
          <div style={{ maxWidth: "800px", margin: "0 auto", width: "100%", animation: "fadeIn 0.4s ease-out" }}>
            <button 
              onClick={() => router.push(`/student/programs/${programId}`)}
              style={{ background: "none", border: "none", color: "var(--color-muted)", cursor: "pointer", marginBottom: "2rem", fontSize: "0.95rem", display: "flex", alignItems: "center", gap: "0.5rem", transition: "color 0.2s", fontWeight: 600 }}
              onMouseEnter={e => e.currentTarget.style.color = "var(--foreground)"}
              onMouseLeave={e => e.currentTarget.style.color = "var(--color-muted)"}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "1.2rem" }}>arrow_back</span>
              Back to Course
            </button>
            <QuizPlayer
              activityId={currentActivity.id}
              title={currentActivity.title}
              questions={currentActivity.content?.questions || []}
              onComplete={(score, total) => {
                if (!isCompleted) markComplete(currentActivity.id);
              }}
            />
          </div>
        </div>
      </RequireAuth>
    );
  }

  return (
    <RequireAuth>
      <div style={{ display: "flex", height: "calc(100vh - 64px)", background: "var(--background)", animation: "fadeIn 0.4s ease-out" }}>
        
        {/* Sidebar Navigation */}
        <div style={{ 
          width: "340px", 
          borderRight: "1px solid var(--color-border)", 
          background: "rgba(255,255,255,0.02)",
          backdropFilter: "blur(20px)",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column"
        }}>
          <div style={{ padding: "1.5rem", borderBottom: "1px solid var(--color-border)" }}>
            <button 
              onClick={() => router.push(`/student/programs/${programId}`)}
              style={{ background: "none", border: "none", color: "var(--color-muted)", cursor: "pointer", marginBottom: "1rem", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "0.25rem", transition: "color 0.2s" }}
              onMouseEnter={e => e.currentTarget.style.color = "var(--foreground)"}
              onMouseLeave={e => e.currentTarget.style.color = "var(--color-muted)"}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "1rem" }}>arrow_back</span>
              Back to Overview
            </button>
            <h2 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--color-primary)", lineHeight: 1.3 }}>
              {program.name}
            </h2>
          </div>
          
          <div style={{ padding: "1rem" }}>
            {modules.map(module => (
              <div key={module.id} style={{ marginBottom: "1.5rem" }}>
                <div style={{ fontSize: "0.8rem", fontWeight: 800, textTransform: "uppercase", color: "var(--color-muted)", marginBottom: "0.5rem", letterSpacing: "1px" }}>
                  {module.title}
                </div>
                {module.weeks.map(week => (
                  <div key={week.id}>
                    {week.lessons.map(lesson => (
                      <div key={lesson.id} style={{ marginBottom: "0.75rem" }}>
                        <div style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.25rem", color: "var(--foreground)" }}>{lesson.title}</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          {lesson.activities.map(activity => {
                            const isActive = activity.id === activityId;
                            const isActivityCompleted = completedActivityIds.includes(activity.id);
                            return (
                              <Link
                                key={activity.id}
                                href={`/student/programs/${programId}/activity/${activity.id}`}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "0.5rem",
                                  padding: "0.6rem 0.75rem",
                                  fontSize: "0.85rem",
                                  color: isActive ? "var(--color-primary)" : "var(--color-muted)",
                                  background: isActive ? "rgba(255, 214, 186, 0.1)" : "transparent",
                                  borderLeft: isActive ? "3px solid var(--peach-fuzz)" : "3px solid transparent",
                                  borderRadius: "0 6px 6px 0",
                                  textDecoration: "none",
                                  transition: "all 0.2s"
                                }}
                                onMouseEnter={e => {
                                  if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.02)";
                                }}
                                onMouseLeave={e => {
                                  if (!isActive) e.currentTarget.style.background = "transparent";
                                }}
                              >
                                {isActivityCompleted ? (
                                  <span className="material-symbols-outlined" style={{ fontSize: "1rem", color: "#27ae60" }}>check_circle</span>
                                ) : (
                                  <span style={{ display: "inline-block", width: "14px", height: "14px", border: "2px solid var(--muted-teal)", borderRadius: "50%" }}></span>
                                )}
                                <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{activity.title}</span>
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Main Content Area */}
        <div style={{ flex: 1, overflowY: "auto", padding: "3rem" }}>
          <div style={{ maxWidth: "800px", margin: "0 auto", animation: "slideUp 0.5s ease-out" }}>
            
            <div style={{ marginBottom: "2rem", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
              <div>
                <span style={{ 
                  display: "inline-block",
                  fontSize: "0.75rem", 
                  padding: "4px 10px", 
                  background: "var(--peach-fuzz)", 
                  color: "#000", 
                  borderRadius: "12px",
                  fontWeight: 600,
                  marginBottom: "1rem"
                }}>
                  {currentActivity.activity_type}
                </span>
                <h1 style={{ fontSize: "2.5rem", color: "var(--foreground)", fontWeight: 800, letterSpacing: "-0.5px" }}>
                  {currentActivity.title}
                </h1>
              </div>
              {isCompleted && (
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#27ae60", fontWeight: 600, background: "rgba(39, 174, 96, 0.1)", padding: "0.5rem 1rem", borderRadius: "20px" }}>
                  <span className="material-symbols-outlined">check_circle</span>
                  Completed
                </div>
              )}
            </div>

            <div style={{ 
                background: "var(--color-surface)", 
                borderRadius: "16px", 
                border: "1px solid var(--color-border)",
                minHeight: "400px",
                display: "flex",
                flexDirection: "column",
                boxShadow: "0 12px 40px rgba(0,0,0,0.15)",
                overflow: "hidden"
              }}>
                {currentActivity.activity_type === "VIDEO" && youtubeUrl && (
                  <div style={{ position: "relative", width: "100%", paddingBottom: "56.25%", background: "#000" }}>
                    <iframe 
                      src={`https://www.youtube.com/embed/${youtubeUrl}?rel=0`}
                      style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: 0 }}
                      allowFullScreen
                    />
                  </div>
                )}

                {currentActivity.activity_type === "VIDEO" && isNativeVideo && currentActivity.content?.url && (
                  <div style={{ width: "100%", background: "#000", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "450px" }}>
                    <video 
                      src={currentActivity.content.url}
                      controls
                      controlsList="nodownload noplaybackrate"
                      disablePictureInPicture
                      onContextMenu={e => e.preventDefault()}
                      style={{ width: "100%", maxHeight: "600px" }}
                    />
                  </div>
                )}
                
                {currentActivity.activity_type === "VIDEO" && !youtubeUrl && !isNativeVideo && (
                  <div style={{ padding: "3rem", textAlign: "center", color: "var(--color-muted)" }}>
                    Video URL is missing or invalid.
                  </div>
                )}

                {currentActivity.activity_type === "READING" && (
                  <div style={{ padding: "3.5rem 4rem", fontSize: "1.15rem", lineHeight: 1.8, color: "var(--foreground)" }}>
                    {currentActivity.content?.text?.split('\\n').map((paragraph: string, i: number) => (
                      <p key={i} style={{ marginBottom: "1.5rem" }}>{paragraph}</p>
                    )) || "No reading content available."}
                  </div>
                )}

                {currentActivity.activity_type === "PDF" && currentActivity.content?.url && (
                  <div style={{ padding: "4rem 2rem", flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "4rem", color: "var(--primary)", marginBottom: "1rem" }}>picture_as_pdf</span>
                    <h3 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>Document & Reading Materials</h3>
                    <p style={{ color: "var(--text-muted)", marginBottom: "1.5rem", maxWidth: "500px" }}>
                      Access the full PDF document reference in a new window or download for offline study.
                    </p>
                    <a 
                      href={currentActivity.content.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{ background: "var(--primary)", color: "white", padding: "0.75rem 2rem", borderRadius: "8px", textDecoration: "none", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "0.5rem" }}
                    >
                      <span className="material-symbols-outlined">open_in_new</span> Open Document
                    </a>
                  </div>
                )}

                {currentActivity.activity_type === "LIVE_SESSION" && currentActivity.content && (
                  <div style={{ padding: "4rem 2rem", flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "4rem", color: "var(--danger)", marginBottom: "1rem" }}>sensors</span>
                    <h3 style={{ fontSize: "1.8rem", fontWeight: 800, marginBottom: "0.5rem" }}>Live Interactive Session</h3>
                    <p style={{ color: "var(--text-muted)", marginBottom: "1.5rem", maxWidth: "500px" }}>
                      Join live class stream with your instructor and cohort peers.
                    </p>
                    <Link 
                      href="/student/live"
                      style={{ background: "var(--danger)", color: "white", padding: "1rem 2.5rem", borderRadius: "8px", textDecoration: "none", fontWeight: 700, fontSize: "1.1rem", display: "inline-flex", alignItems: "center", gap: "0.75rem" }}
                    >
                      <span className="material-symbols-outlined">video_camera_front</span> Join Live Classroom
                    </Link>
                  </div>
                )}

                {currentActivity.activity_type === "ASSIGNMENT" && (
                  <div style={{ padding: "4rem 2rem", flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "4rem", color: "#10b981", marginBottom: "1rem" }}>assignment</span>
                    <h3 style={{ fontSize: "1.6rem", fontWeight: 800, marginBottom: "0.5rem" }}>Course Assignment</h3>
                    <p style={{ color: "var(--text-muted)", marginBottom: "1.5rem", maxWidth: "500px" }}>
                      View assignment specifications, submit your solution, and check instructor evaluations.
                    </p>
                    <Link 
                      href="/student/assignments"
                      style={{ background: "var(--primary)", color: "white", padding: "0.85rem 2rem", borderRadius: "8px", textDecoration: "none", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "0.5rem" }}
                    >
                      <span className="material-symbols-outlined">arrow_forward</span> Go to Submissions Portal
                    </Link>
                  </div>
                )}

                {!["VIDEO", "READING", "PDF", "LIVE_SESSION", "ASSIGNMENT"].includes(currentActivity.activity_type) && (
                  <div style={{ padding: "3rem", textAlign: "center", color: "var(--color-muted)" }}>
                    This activity type ({currentActivity.activity_type}) requires interactive workspace tools.
                  </div>
                )}
              </div>

            <div style={{ marginTop: "2.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ color: "var(--color-muted)", fontSize: "0.9rem" }}>
                {!isCompleted && "Mark as complete to track your progress."}
              </div>
              <button style={{
                background: isCompleted ? "rgba(255,255,255,0.05)" : "var(--blue-slate)",
                color: isCompleted ? "var(--color-muted)" : "white",
                border: isCompleted ? "1px solid var(--color-border)" : "none",
                padding: "0.85rem 2.5rem",
                borderRadius: "8px",
                fontSize: "1.05rem",
                fontWeight: 600,
                cursor: isCompleted ? "default" : "pointer",
                boxShadow: isCompleted ? "none" : "0 8px 20px rgba(85, 91, 110, 0.4)",
                transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem"
              }}
              onMouseEnter={e => {
                if (!isCompleted) {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 12px 24px rgba(85, 91, 110, 0.5)";
                }
              }}
              onMouseLeave={e => {
                if (!isCompleted) {
                  e.currentTarget.style.transform = "none";
                  e.currentTarget.style.boxShadow = "0 8px 20px rgba(85, 91, 110, 0.4)";
                }
              }}
              onClick={() => {
                if (!isCompleted) markComplete(activityId);
              }}
              >
                {isCompleted ? (
                  <>
                    <span className="material-symbols-outlined">done_all</span>
                    Completed
                  </>
                ) : (
                  <>
                    Mark as Complete
                    <span className="material-symbols-outlined" style={{ fontSize: "1.2rem" }}>arrow_forward</span>
                  </>
                )}
              </button>
            </div>
            
          </div>
        </div>
      </div>
    </RequireAuth>
  );
}
