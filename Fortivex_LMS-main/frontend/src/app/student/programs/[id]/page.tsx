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
import { Button } from "@/components/ui/Button";
import { useMeeting } from "@/lib/live/MeetingContext";

export default function UnifiedProgramPlayer() {
  const { token } = useAuth();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const programId = Number(params.id);

  const [program, setProgram] = useState<Program | null>(null);
  const [modules, setModules] = useState<ProgramModule[] | null>(null);
  const [currentActivity, setCurrentActivity] = useState<Activity | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [resourcesOpen, setResourcesOpen] = useState(true);
  const [videoFinished, setVideoFinished] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const { joinMeeting } = useMeeting();

  const { completedActivityIds, markComplete, loading: progressLoading } = useProgress(token, programId);

  useEffect(() => {
    setVideoFinished(false);
    setVideoError(false);
  }, [currentActivity?.id]);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      getProgram(token, programId),
      getCurriculum(token, programId)
    ])
      .then(([prog, curr]) => {
        setProgram(prog);
        setModules(curr);
      })
      .catch((err: any) => {
        setError(err.message || "Failed to load course content");
      });
  }, [token, programId]);

  if (error) return <ErrorState message={error} onRetry={() => window.location.reload()} />;
  if (!program || !modules || progressLoading) return <LoadingState message="Loading your program..." />;

  const isCompleted = currentActivity ? completedActivityIds.includes(currentActivity.id) : false;

  let youtubeId = "";
  let isNativeVideo = false;
  if (currentActivity?.activity_type === "VIDEO" && currentActivity.content?.url) {
    const urlStr = currentActivity.content.url;
    const ytMatch = urlStr.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]+)/);
    if (ytMatch) {
      youtubeId = ytMatch[1];
    } else {
      // If it's not a youtube link (e.g. an uploaded file or direct link), we use the native video player
      isNativeVideo = true;
    }
  }

  // Find the parent lesson to grab attachments/resources
  let currentLesson = null;
  if (modules && currentActivity) {
    outer: for (const m of modules) {
      for (const w of m.weeks) {
        for (const l of w.lessons) {
          if (l.activities.some(a => a.id === currentActivity.id)) {
            currentLesson = l;
            break outer;
          }
        }
      }
    }
  }
  
  const lessonResources = currentLesson 
    ? currentLesson.activities.filter(a => a.activity_type === "PDF" || (a.content && a.content.attachment)) 
    : [];

  // Calculate Progress
  let totalActivities = 0;
  let completedCount = 0;
  modules.forEach(m => m.weeks.forEach(w => w.lessons.forEach(l => {
    totalActivities += l.activities.length;
    l.activities.forEach(a => {
      if (completedActivityIds.includes(a.id)) completedCount++;
    });
  })));
  const progressPercent = totalActivities === 0 ? 0 : Math.round((completedCount / totalActivities) * 100);

  return (
    <RequireAuth>
      <div style={{ display: "flex", height: "calc(100vh - 64px)", background: "var(--background)", overflow: "hidden" }}>
        
        {/* Left Sidebar: Syllabus */}
        {sidebarOpen && (
          <div style={{ 
            width: "320px", 
            borderRight: "1px solid var(--color-border)", 
            background: "var(--color-surface)",
            display: "flex",
            flexDirection: "column",
            animation: "slideInLeft 0.3s ease-out"
          }}>
            <div style={{ padding: "1.5rem", borderBottom: "1px solid var(--color-border)" }}>
              <button 
                onClick={() => router.push('/student')}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", marginBottom: "1rem", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "0.25rem", fontWeight: 600 }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "1rem" }}>arrow_back</span>
                Dashboard
              </button>
              <h2 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--foreground)", lineHeight: 1.3 }}>
                {program.name}
              </h2>
              <div style={{ marginTop: "1rem", width: "100%", height: "6px", background: "rgba(0,0,0,0.05)", borderRadius: "3px", overflow: "hidden" }}>
                <div style={{ width: `${progressPercent}%`, height: "100%", background: "var(--primary-gradient)" }}></div>
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.5rem", fontWeight: 600 }}>{progressPercent}% Complete</div>
            </div>
            
            <div style={{ flex: 1, overflowY: "auto", padding: "1rem" }}>
              {modules.map(module => (
                <div key={module.id} style={{ marginBottom: "1.5rem" }}>
                  <div style={{ fontSize: "0.8rem", fontWeight: 800, textTransform: "uppercase", color: "var(--primary)", marginBottom: "0.5rem", letterSpacing: "1px" }}>
                    {module.title}
                  </div>
                  {module.weeks.map(week => (
                    <div key={week.id}>
                      {week.lessons.map(lesson => (
                        <div key={lesson.id} style={{ marginBottom: "0.75rem" }}>
                          <div style={{ fontSize: "0.9rem", fontWeight: 600, marginBottom: "0.25rem", color: "var(--foreground)" }}>{lesson.title}</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                            {lesson.activities.map(activity => {
                              const isActive = currentActivity?.id === activity.id;
                              const isActivityCompleted = completedActivityIds.includes(activity.id);
                              return (
                                <button
                                  key={activity.id}
                                  onClick={() => setCurrentActivity(activity)}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "0.5rem",
                                    padding: "0.6rem 0.75rem",
                                    fontSize: "0.85rem",
                                    color: isActive ? "var(--primary)" : "var(--text-muted)",
                                    background: isActive ? "rgba(79, 70, 229, 0.08)" : "transparent",
                                    borderLeft: isActive ? "3px solid var(--primary)" : "3px solid transparent",
                                    borderTop: "none", borderRight: "none", borderBottom: "none",
                                    borderRadius: "0 6px 6px 0",
                                    cursor: "pointer",
                                    textAlign: "left",
                                    transition: "all 0.2s"
                                  }}
                                  onMouseEnter={e => {
                                    if (!isActive) e.currentTarget.style.background = "rgba(0,0,0,0.02)";
                                  }}
                                  onMouseLeave={e => {
                                    if (!isActive) e.currentTarget.style.background = "transparent";
                                  }}
                                >
                                  {isActivityCompleted ? (
                                    <span className="material-symbols-outlined" style={{ fontSize: "1rem", color: "var(--success)" }}>check_circle</span>
                                  ) : (
                                    <span style={{ display: "inline-block", width: "14px", height: "14px", border: "2px solid var(--text-muted)", borderRadius: "50%" }}></span>
                                  )}
                                  <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontWeight: isActive ? 600 : 500 }}>{activity.title}</span>
                                  {activity.activity_type === "VIDEO" && <span className="material-symbols-outlined" style={{ fontSize: "1rem", opacity: 0.5 }}>play_circle</span>}
                                  {activity.activity_type === "READING" && <span className="material-symbols-outlined" style={{ fontSize: "1rem", opacity: 0.5 }}>menu_book</span>}
                                  {activity.activity_type === "LIVE_SESSION" && <span className="material-symbols-outlined" style={{ fontSize: "1rem", opacity: 0.5 }}>sensors</span>}
                                </button>
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
        )}

        {/* Middle: Main Player Area */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "var(--bg-main)" }}>
          {/* Player Topbar */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1rem 1.5rem", background: "var(--color-surface)", borderBottom: "1px solid var(--color-border)" }}>
            <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--foreground)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span className="material-symbols-outlined">{sidebarOpen ? 'menu_open' : 'menu'}</span>
              <span style={{ fontWeight: 600 }}>{sidebarOpen ? 'Hide Menu' : 'Show Menu'}</span>
            </button>
            <button onClick={() => setResourcesOpen(!resourcesOpen)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--foreground)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontWeight: 600 }}>{resourcesOpen ? 'Hide Resources' : 'Resources'}</span>
              <span className="material-symbols-outlined">{resourcesOpen ? 'right_panel_close' : 'right_panel_open'}</span>
            </button>
          </div>

          {/* Player Content */}
          <div style={{ flex: 1, overflowY: "auto", padding: "2rem" }}>
            {!currentActivity ? (
              <div style={{ maxWidth: "800px", margin: "2rem auto", textAlign: "center" }}>
                <span className="material-symbols-outlined" style={{ fontSize: "4rem", color: "var(--primary)", marginBottom: "1rem" }}>school</span>
                <h1 style={{ fontSize: "2.5rem", fontWeight: 800, marginBottom: "1rem" }}>Welcome to {program.name}</h1>
                <p style={{ fontSize: "1.1rem", color: "var(--text-muted)", marginBottom: "2rem" }}>
                  Select an activity from the left menu to begin learning. You have completed {completedCount} out of {totalActivities} activities.
                </p>
                {modules[0]?.weeks[0]?.lessons[0]?.activities[0] && (
                  <Button onClick={() => setCurrentActivity(modules[0].weeks[0].lessons[0].activities[0])}>
                    Start First Lesson
                  </Button>
                )}
              </div>
            ) : (
              <div style={{ maxWidth: "900px", margin: "0 auto", animation: "fadeIn 0.3s ease-out" }}>
                
                <div style={{ marginBottom: "1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <span style={{ 
                      display: "inline-block", fontSize: "0.75rem", padding: "4px 10px", 
                      background: "rgba(79, 70, 229, 0.1)", color: "var(--primary)", borderRadius: "12px",
                      fontWeight: 700, marginBottom: "0.75rem", textTransform: "uppercase"
                    }}>
                      {currentActivity.activity_type}
                    </span>
                    <h1 style={{ fontSize: "2rem", color: "var(--foreground)", fontWeight: 800, letterSpacing: "-0.5px", marginBottom: "0.5rem" }}>
                      {currentActivity.title}
                    </h1>
                  </div>
                  {isCompleted && (
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--success)", fontWeight: 700, background: "rgba(16, 185, 129, 0.1)", padding: "0.5rem 1rem", borderRadius: "20px" }}>
                      <span className="material-symbols-outlined">check_circle</span>
                      Completed
                    </div>
                  )}
                </div>

                <div style={{ 
                  background: "var(--color-surface)", borderRadius: "16px", border: "1px solid var(--color-border)",
                  minHeight: "450px", display: "flex", flexDirection: "column", boxShadow: "var(--shadow-glass)", overflow: "hidden"
                }}>
                  {currentActivity.activity_type === "VIDEO" && youtubeId && (
                    <div style={{ position: "relative", width: "100%", paddingBottom: "56.25%", background: "#000" }}>
                      <iframe 
                        src={`https://www.youtube.com/embed/${youtubeId}?rel=0`}
                        style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: 0 }}
                        allowFullScreen
                      />
                    </div>
                  )}
                  
                  {currentActivity.activity_type === "VIDEO" && isNativeVideo && currentActivity.content?.url && (
                    <div style={{ width: "100%", background: "#000", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "450px" }}>
                      {videoError ? (
                        <div style={{ padding: "4rem", textAlign: "center", color: "var(--text-muted)", flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                          <span className="material-symbols-outlined" style={{ fontSize: "3rem", marginBottom: "1rem", color: "var(--primary)" }}>error</span>
                          <h3 style={{ fontSize: "1.2rem", color: "white", marginBottom: "0.5rem" }}>Video Playback Error</h3>
                          <p style={{ maxWidth: "400px" }}>This video could not be loaded. The format may not be supported or the file is missing.</p>
                        </div>
                      ) : (
                        <video 
                          src={currentActivity.content.url}
                          controls
                          controlsList="nodownload noplaybackrate"
                          disablePictureInPicture
                          onContextMenu={e => e.preventDefault()}
                          onEnded={() => setVideoFinished(true)}
                          onError={() => setVideoError(true)}
                          style={{ width: "100%", maxHeight: "600px" }}
                        />
                      )}
                    </div>
                  )}

                  {currentActivity.activity_type === "VIDEO" && !youtubeId && !isNativeVideo && (
                    <div style={{ padding: "4rem", textAlign: "center", color: "var(--text-muted)", flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      Video URL is missing or invalid.
                    </div>
                  )}

                  {currentActivity.activity_type === "READING" && (
                    <div style={{ padding: "3rem", fontSize: "1.1rem", lineHeight: 1.8, color: "var(--foreground)" }}>
                      {currentActivity.content?.text?.split('\\n').map((paragraph: string, i: number) => (
                        <p key={i} style={{ marginBottom: "1.5rem" }}>{paragraph}</p>
                      )) || "No reading content available."}
                    </div>
                  )}

                  {currentActivity.activity_type === "PDF" && currentActivity.content?.url && (
                    <div style={{ padding: "3rem", flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                      <span className="material-symbols-outlined" style={{ fontSize: "4rem", color: "var(--primary)", marginBottom: "1rem" }}>picture_as_pdf</span>
                      <h3 style={{ fontSize: "1.5rem", marginBottom: "1.5rem" }}>Document Viewer</h3>
                      <a 
                        href={currentActivity.content.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        style={{ background: "var(--primary-gradient)", color: "white", padding: "0.75rem 2rem", borderRadius: "8px", textDecoration: "none", fontWeight: 600 }}
                      >
                        Open Document
                      </a>
                    </div>
                  )}

                  {currentActivity.activity_type === "LIVE_SESSION" && currentActivity.content && (
                    <div style={{ padding: "3rem", flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
                      <span className="material-symbols-outlined" style={{ fontSize: "4rem", color: "var(--danger)", marginBottom: "1rem", animation: "pulse 2s infinite" }}>sensors</span>
                      <h3 style={{ fontSize: "1.8rem", fontWeight: 800, marginBottom: "0.5rem" }}>Live Session</h3>
                      
                      {(() => {
                        const start = currentActivity.content.start_time ? new Date(currentActivity.content.start_time) : null;
                        const end = currentActivity.content.end_time ? new Date(currentActivity.content.end_time) : null;
                        const validStart = start && !isNaN(start.getTime());
                        const validEnd = end && !isNaN(end.getTime());
                        const room = currentActivity.content.room_name || `lms-${currentActivity.id}`;

                        return (
                          <>
                            <div style={{ display: "flex", gap: "1.5rem", color: "var(--text-muted)", fontSize: "1.1rem", marginBottom: "2rem", flexWrap: "wrap", justifyContent: "center" }}>
                              {validStart && (
                                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                  <span className="material-symbols-outlined">calendar_today</span>
                                  {start.toLocaleDateString()}
                                </div>
                              )}
                              {validStart && (
                                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                  <span className="material-symbols-outlined">schedule</span>
                                  {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  {validEnd ? ` - ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ""}
                                </div>
                              )}
                            </div>

                            <button 
                              onClick={() => joinMeeting(room, false, currentActivity.title)}
                              style={{ background: "var(--danger)", color: "white", padding: "1rem 2.5rem", borderRadius: "8px", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "1.1rem", display: "flex", alignItems: "center", gap: "0.75rem", boxShadow: "0 4px 15px rgba(239, 68, 68, 0.4)", transition: "all 0.2s" }}
                              onMouseOver={e => e.currentTarget.style.transform = "scale(1.05)"}
                              onMouseOut={e => e.currentTarget.style.transform = "scale(1)"}
                            >
                              <span className="material-symbols-outlined">video_camera_front</span>
                              Join Meeting Room
                            </button>
                          </>
                        );
                      })()}
                    </div>
                  )}

                  {currentActivity.activity_type === "QUIZ" && (
                    <div style={{ padding: "4rem", flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", background: "var(--color-surface)", borderRadius: "16px", border: "1px solid var(--color-border)" }}>
                      {isCompleted ? (
                        <div 
                          style={{ background: "var(--color-border)", color: "var(--text-muted)", padding: "1rem 3rem", borderRadius: "8px", fontWeight: 700, fontSize: "1.1rem", display: "flex", alignItems: "center", gap: "0.5rem", opacity: 0.7, cursor: "not-allowed" }}
                        >
                          Quiz Completed <span className="material-symbols-outlined" style={{ fontSize: "1.3rem" }}>check_circle</span>
                        </div>
                      ) : (
                        <Link 
                          href={`/student/programs/${program.id}/activity/${currentActivity.id}`}
                          style={{ background: "var(--primary-gradient)", color: "white", padding: "1rem 3rem", borderRadius: "8px", textDecoration: "none", fontWeight: 700, fontSize: "1.1rem", display: "flex", alignItems: "center", gap: "0.5rem", boxShadow: "0 8px 20px rgba(79, 70, 229, 0.3)", transition: "transform 0.2s" }}
                          onMouseEnter={e => e.currentTarget.style.transform = "scale(1.05)"}
                          onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
                        >
                          Take Quiz <span className="material-symbols-outlined" style={{ fontSize: "1.3rem" }}>arrow_forward</span>
                        </Link>
                      )}
                    </div>
                  )}
                </div>

                <div style={{ marginTop: "2rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ color: "var(--text-muted)", fontSize: "0.95rem" }}>
                    {!isCompleted && isNativeVideo && !videoFinished && "Please watch the video to the end to complete this activity."}
                    {!isCompleted && (!isNativeVideo || videoFinished) && "Mark this activity as complete to update your progress."}
                  </div>
                  <Button 
                    onClick={() => { if (!isCompleted && (!isNativeVideo || videoFinished)) markComplete(currentActivity.id); }}
                    disabled={isCompleted || (isNativeVideo && !videoFinished)}
                    style={{ 
                      background: isCompleted || (isNativeVideo && !videoFinished) ? "var(--color-border)" : "var(--primary-gradient)",
                      opacity: isCompleted || (isNativeVideo && !videoFinished) ? 0.7 : 1,
                      cursor: isCompleted || (isNativeVideo && !videoFinished) ? "not-allowed" : "pointer"
                    }}
                  >
                    {isCompleted ? (
                      <>
                        <span className="material-symbols-outlined">done_all</span> Completed
                      </>
                    ) : (isNativeVideo && !videoFinished) ? (
                      <>
                        <span className="material-symbols-outlined" style={{ fontSize: "1.2rem" }}>lock</span> Watch to Complete
                      </>
                    ) : (
                      <>
                        Mark as Complete <span className="material-symbols-outlined" style={{ fontSize: "1.2rem" }}>arrow_forward</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar: Resources / Attached Files */}
        {resourcesOpen && (
          <div style={{ 
            width: "300px", 
            borderLeft: "1px solid var(--color-border)", 
            background: "var(--color-surface)",
            display: "flex",
            flexDirection: "column",
            animation: "slideInRight 0.3s ease-out"
          }}>
            <div style={{ padding: "1.5rem", borderBottom: "1px solid var(--color-border)" }}>
              <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--foreground)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span className="material-symbols-outlined">attachment</span>
                Lesson Resources
              </h2>
            </div>
            
            <div style={{ padding: "1.5rem", flex: 1, overflowY: "auto" }}>
              {currentLesson ? (
                lessonResources.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    {lessonResources.map(res => (
                      <a key={res.id} href={res.content?.url || "#"} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "1rem", background: "var(--bg-main)", border: "1px solid var(--color-border)", borderRadius: "10px", textDecoration: "none", color: "var(--foreground)", transition: "all 0.2s" }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = "var(--primary)"}
                        onMouseLeave={e => e.currentTarget.style.borderColor = "var(--color-border)"}
                      >
                        <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "rgba(79, 70, 229, 0.1)", color: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <span className="material-symbols-outlined" style={{ fontSize: "1.2rem" }}>picture_as_pdf</span>
                        </div>
                        <div style={{ overflow: "hidden" }}>
                          <div style={{ fontSize: "0.9rem", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{res.title}</div>
                          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Document</div>
                        </div>
                      </a>
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign: "center", color: "var(--text-muted)", marginTop: "2rem" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "3rem", opacity: 0.5, marginBottom: "1rem" }}>folder_open</span>
                    <p style={{ fontSize: "0.9rem" }}>No files attached to this lesson.</p>
                  </div>
                )
              ) : (
                <div style={{ textAlign: "center", color: "var(--text-muted)", marginTop: "2rem" }}>
                  <p style={{ fontSize: "0.9rem" }}>Select an activity to view its lesson's resources.</p>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </RequireAuth>
  );
}
