import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { config } from "@/lib/config";
import { getCurriculum, createProgramModule, createWeek, createLesson, createActivity, uploadFile, uploadFileWithProgress, deleteProgramModule, deleteWeek, deleteLesson, deleteActivity, updateProgramModule, updateWeek, updateLesson, updateActivity } from "@/lib/api/endpoints";
import type { ProgramModule } from "@/lib/api/types";
import { Card } from "@/components/ui/Card";

const resolveFileUrl = (url: string) => (url.startsWith("http://") || url.startsWith("https://") ? url : `${config.apiUrl}${url}`);
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";

const styles = {
  container: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "2rem",
    marginTop: "2rem",
    animation: "fadeIn 0.4s ease-out"
  },
  moduleCard: {
    background: "var(--color-surface)",
    border: "1px solid rgba(0,0,0,0.08)",
    borderRadius: "16px",
    padding: "0",
    boxShadow: "0 4px 12px rgba(0,0,0,0.02)",
    overflow: "hidden"
  },
  moduleHeader: {
    padding: "1.25rem 1.5rem",
    background: "rgba(0,0,0,0.02)",
    borderBottom: "1px solid var(--color-border)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between"
  },
  weekCard: {
    background: "var(--background)",
    border: "1px solid var(--color-border)",
    borderLeft: "4px solid var(--muted-teal)",
    borderRadius: "10px",
    padding: "1rem 1.25rem",
    marginTop: "1rem",
  },
  lessonCard: {
    background: "var(--color-surface)",
    border: "1px solid var(--color-border)",
    borderRadius: "8px",
    padding: "0.75rem 1rem",
    marginTop: "0.75rem",
  },
  activityItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    background: "rgba(0, 0, 0, 0.02)",
    border: "1px solid rgba(0,0,0,0.04)",
    padding: "0.5rem 0.75rem",
    borderRadius: "6px",
    marginTop: "0.5rem",
    fontSize: "0.9rem",
    fontWeight: 500,
  },
  typeBadge: {
    fontSize: "0.7rem",
    padding: "2px 8px",
    borderRadius: "12px",
    background: "var(--peach-fuzz)",
    color: "#000",
    fontWeight: 700,
    marginLeft: "0.5rem",
    letterSpacing: "0.5px"
  },
  inlineForm: {
    background: "var(--color-surface)",
    padding: "1.5rem",
    borderRadius: "12px",
    border: "2px dashed var(--color-border)",
    display: "flex",
    flexDirection: "column" as const,
    gap: "1rem",
    marginTop: "1rem"
  },
  formLabel: {
    fontSize: "0.9rem",
    fontWeight: 700,
    marginBottom: "0.5rem",
    display: "block",
    color: "var(--foreground)"
  },
  formSelect: {
    width: "100%",
    padding: "0.75rem 1rem",
    borderRadius: "10px",
    border: "1px solid rgba(0,0,0,0.15)",
    background: "var(--background)",
    color: "var(--foreground)",
    fontSize: "0.95rem",
    outline: "none",
  },
  inlineButton: {
    background: "transparent",
    border: "1px dashed var(--color-border)",
    color: "var(--foreground)",
    padding: "0.5rem 1rem",
    borderRadius: "8px",
    fontSize: "0.85rem",
    fontWeight: 600,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: "0.5rem",
    transition: "all 0.2s"
  },
  fileInputLabel: {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.5rem",
    padding: "0.75rem 1rem",
    background: "rgba(0,0,0,0.03)",
    border: "1px dashed rgba(0,0,0,0.2)",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "0.9rem",
    fontWeight: 600,
    transition: "all 0.2s"
  }
};

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

const getTodayDate = () => {
  return formatLocalDateTime(new Date()).slice(0, 10);
};

const generateRoomName = (programId: number) => `lms-${programId}-${Date.now()}`;

export function CurriculumBuilder({ programId }: { programId: number }) {
  const { token } = useAuth();
  const [modules, setModules] = useState<ProgramModule[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [renameDialog, setRenameDialog] = useState<{isOpen: boolean, title: string, currentTitle: string, onConfirm: (newTitle: string) => void} | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{isOpen: boolean, title: string, message: string, onConfirm: () => void} | null>(null);
  // Inline states
  const [addingModule, setAddingModule] = useState(false);
  const [newModuleTitle, setNewModuleTitle] = useState("");

  const [addingWeekFor, setAddingWeekFor] = useState<number | null>(null);
  const [newWeekTitle, setNewWeekTitle] = useState("");

  const [addingLessonFor, setAddingLessonFor] = useState<number | null>(null);
  const [newLessonTitle, setNewLessonTitle] = useState("");
  const [newLessonVideoUrl, setNewLessonVideoUrl] = useState("");
  const [newLessonVideoFile, setNewLessonVideoFile] = useState<File | null>(null);
  const [newLessonDocFile, setNewLessonDocFile] = useState<File | null>(null);
  const [newLessonText, setNewLessonText] = useState("");

  const [addingActivityFor, setAddingActivityFor] = useState<number | null>(null);
  const [newActivityTitle, setNewActivityTitle] = useState("");
  const [newActivityVideoUrl, setNewActivityVideoUrl] = useState("");
  const [newActivityVideoFile, setNewActivityVideoFile] = useState<File | null>(null);
  const [newActivityDocFile, setNewActivityDocFile] = useState<File | null>(null);
  const [newActivityText, setNewActivityText] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);

  const [addingLiveSessionFor, setAddingLiveSessionFor] = useState<number | null>(null);

  const [liveStartDate, setLiveStartDate] = useState(() => getNextHour().slice(0, 10));
  const [liveStartTimeStr, setLiveStartTimeStr] = useState(() => getNextHour().slice(11, 16));
  
  const [liveEndDate, setLiveEndDate] = useState(() => getNextTwoHours().slice(0, 10));
  const [liveEndTimeStr, setLiveEndTimeStr] = useState(() => getNextTwoHours().slice(11, 16));

  const loadCurriculum = useCallback(async () => {
    if (!token) return;
    try {
      const data = await getCurriculum(token, programId);
      setModules(data);
    } catch (err: any) {
      setError(err.message || "Failed to load curriculum");
    }
  }, [token, programId]);

  useEffect(() => {
    loadCurriculum();
  }, [loadCurriculum]);

  const handleAddModule = async () => {
    if (!token || !newModuleTitle.trim()) return;
    setIsSubmitting(true);
    try {
      await createProgramModule(token, programId, { title: newModuleTitle, order: (modules?.length || 0) + 1 });
      setNewModuleTitle("");
      setAddingModule(false);
      loadCurriculum();
    } catch (e) {
      alert("Error adding module");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddWeek = async (moduleId: number) => {
    if (!token || !newWeekTitle.trim()) return;
    setIsSubmitting(true);
    try {
      const currentModule = modules?.find(m => m.id === moduleId);
      const order = (currentModule?.weeks.length || 0) + 1;
      await createWeek(token, moduleId, { title: newWeekTitle, week_number: order, order });
      setNewWeekTitle("");
      setAddingWeekFor(null);
      loadCurriculum();
    } catch (e) {
      alert("Error adding week");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddLesson = async (moduleId: number, weekId: number) => {
    if (!token || !newLessonTitle.trim()) return;
    setIsSubmitting(true);
    try {
      const currentModule = modules?.find(m => m.id === moduleId);
      const currentWeek = currentModule?.weeks.find(w => w.id === weekId);
      const order = (currentWeek?.lessons.length || 0) + 1;
      
      const lesson = await createLesson(token, weekId, { title: newLessonTitle, order });
      let currentActivityOrder = 1;
      
      let finalVideoUrl = newLessonVideoUrl;
      if (newLessonVideoFile) {
        setUploadProgress(0);
        const res = await uploadFileWithProgress(token, newLessonVideoFile, setUploadProgress);
        finalVideoUrl = resolveFileUrl(res.url);
      }
      if (finalVideoUrl.trim()) {
        await createActivity(token, lesson.id, {
          title: `${newLessonTitle} - Video`,
          activity_type: "VIDEO",
          order: currentActivityOrder++,
          content: { url: finalVideoUrl }
        });
      }

      if (newLessonDocFile) {
        setUploadProgress(0);
        const res = await uploadFileWithProgress(token, newLessonDocFile, setUploadProgress);
        await createActivity(token, lesson.id, {
          title: `${newLessonTitle} - Document`,
          activity_type: "PDF",
          order: currentActivityOrder++,
          content: { url: resolveFileUrl(res.url) }
        });
      }

      if (newLessonText.trim()) {
        await createActivity(token, lesson.id, {
          title: `${newLessonTitle} - Study Material`,
          activity_type: "READING",
          order: currentActivityOrder++,
          content: { text: newLessonText }
        });
      }

      setNewLessonTitle("");
      setNewLessonVideoUrl("");
      setNewLessonVideoFile(null);
      setNewLessonDocFile(null);
      setNewLessonText("");
      setUploadProgress(0);
      setAddingLessonFor(null);
      loadCurriculum();
    } catch (e) {
      alert("Error adding lesson");
    } finally {
      setIsSubmitting(false);
      setUploadProgress(0);
    }
  };

  const handleAddActivity = async (moduleId: number, weekId: number, lessonId: number) => {
    if (!token || !newActivityTitle.trim()) return;
    setIsSubmitting(true);
    try {
      const currentModule = modules?.find(m => m.id === moduleId);
      const currentWeek = currentModule?.weeks.find(w => w.id === weekId);
      const currentLesson = currentWeek?.lessons.find(l => l.id === lessonId);
      let order = (currentLesson?.activities.length || 0) + 1;
      
      let finalVideoUrl = newActivityVideoUrl;
      if (newActivityVideoFile) {
        setUploadProgress(0);
        const res = await uploadFileWithProgress(token, newActivityVideoFile, setUploadProgress);
        finalVideoUrl = resolveFileUrl(res.url);
      }

      if (finalVideoUrl.trim()) {
        await createActivity(token, lessonId, { 
          title: newActivityTitle, 
          activity_type: "VIDEO", 
          order: order++,
          content: { url: finalVideoUrl }
        });
      }

      if (newActivityDocFile) {
        setUploadProgress(0);
        const res = await uploadFileWithProgress(token, newActivityDocFile, setUploadProgress);
        await createActivity(token, lessonId, {
          title: `${newActivityTitle} (Doc)`,
          activity_type: "PDF",
          order: order++,
          content: { url: resolveFileUrl(res.url) }
        });
      }

      if (newActivityText.trim()) {
        await createActivity(token, lessonId, { 
          title: finalVideoUrl || newActivityDocFile ? `${newActivityTitle} (Reading)` : newActivityTitle, 
          activity_type: "READING", 
          order: order++,
          content: { text: newActivityText }
        });
      }

      if (!finalVideoUrl.trim() && !newActivityDocFile && !newActivityText.trim()) {
        await createActivity(token, lessonId, { 
          title: newActivityTitle, 
          activity_type: "READING", 
          order: order++,
          content: { text: "" }
        });
      }

      setNewActivityTitle("");
      setNewActivityVideoUrl("");
      setNewActivityVideoFile(null);
      setNewActivityDocFile(null);
      setNewActivityText("");
      setAddingActivityFor(null);
      loadCurriculum();
    } catch (e) {
      alert("Error adding activity");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddLiveSession = async (moduleId: number, weekId: number, lessonId: number) => {
    if (!token) return;
    if (!newActivityTitle.trim()) {
      alert("Please enter a title for the live session.");
      return;
    }
    if (!liveStartDate || !liveStartTimeStr) {
      alert("Please select a valid start date and time.");
      return;
    }
    if (!liveEndDate || !liveEndTimeStr) {
      alert("Please select a valid end date and time.");
      return;
    }

    const startIso = `${liveStartDate}T${liveStartTimeStr}:00`;
    const endIso = `${liveEndDate}T${liveEndTimeStr}:00`;

    if (new Date(startIso).getTime() >= new Date(endIso).getTime()) {
      alert("End time must be after start time.");
      return;
    }

    setIsSubmitting(true);
    try {
      const currentModule = modules?.find(m => m.id === moduleId);
      const currentWeek = currentModule?.weeks.find(w => w.id === weekId);
      const currentLesson = currentWeek?.lessons.find(l => l.id === lessonId);
      const order = (currentLesson?.activities.length || 0) + 1;
      
      const roomName = generateRoomName(programId);
      const jitsiDomain = process.env.NEXT_PUBLIC_JITSI_DOMAIN || "meet.systemli.org";
      await createActivity(token, lessonId, { 
        title: newActivityTitle.trim(), 
        activity_type: "LIVE_SESSION", 
        order: order,
        content: { 
          start_time: startIso,
          end_time: endIso,
          room_name: roomName,
          meeting_url: `https://${jitsiDomain}/${roomName}`
        }
      });

      setNewActivityTitle("");
      const nextH = getNextHour();
      const next2H = getNextTwoHours();
      setLiveStartDate(nextH.slice(0, 10));
      setLiveStartTimeStr(nextH.slice(11, 16));
      setLiveEndDate(next2H.slice(0, 10));
      setLiveEndTimeStr(next2H.slice(11, 16));
      setAddingLiveSessionFor(null);
      await loadCurriculum();
    } catch (e: any) {
      alert(`Error scheduling live session: ${e?.message || e || "Please check server connection."}`);
    } finally {
      setIsSubmitting(false);
    }
  };


  const handleDeleteModule = (moduleId: number) => {
    if (!token) return;
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Module',
      message: 'Are you sure you want to delete this module and all its contents?',
      onConfirm: async () => {
        try {
          await deleteProgramModule(token, moduleId);
          loadCurriculum();
        } catch (e) { alert('Error deleting module'); }
      }
    });
  };

  const handleDeleteWeek = (weekId: number) => {
    if (!token) return;
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Week',
      message: 'Are you sure you want to delete this week and all its lessons?',
      onConfirm: async () => {
        try {
          await deleteWeek(token, weekId);
          loadCurriculum();
        } catch (e) { alert('Error deleting week'); }
      }
    });
  };

  const handleDeleteLesson = (lessonId: number) => {
    if (!token) return;
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Lesson',
      message: 'Are you sure you want to delete this lesson and all its activities?',
      onConfirm: async () => {
        try {
          await deleteLesson(token, lessonId);
          loadCurriculum();
        } catch (e) { alert('Error deleting lesson'); }
      }
    });
  };

  const handleDeleteActivity = (activityId: number) => {
    if (!token) return;
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Activity',
      message: 'Are you sure you want to delete this activity?',
      onConfirm: async () => {
        try {
          await deleteActivity(token, activityId);
          loadCurriculum();
        } catch (e) { alert('Error deleting activity'); }
      }
    });
  };

  const handleEditModule = (moduleId: number, currentTitle: string) => {
    if (!token) return;
    setRenameDialog({
      isOpen: true,
      title: 'Rename Module',
      currentTitle: currentTitle,
      onConfirm: async (newTitle) => {
        if (newTitle && newTitle.trim() !== currentTitle) {
          try {
            await updateProgramModule(token, moduleId, { title: newTitle.trim() });
            loadCurriculum();
          } catch (e) { alert('Error updating module'); }
        }
      }
    });
  };

  const handleEditWeek = (weekId: number, currentTitle: string) => {
    if (!token) return;
    setRenameDialog({
      isOpen: true,
      title: 'Rename Week',
      currentTitle: currentTitle,
      onConfirm: async (newTitle) => {
        if (newTitle && newTitle.trim() !== currentTitle) {
          try {
            await updateWeek(token, weekId, { title: newTitle.trim() });
            loadCurriculum();
          } catch (e) { alert('Error updating week'); }
        }
      }
    });
  };

  const handleEditLesson = (lessonId: number, currentTitle: string) => {
    if (!token) return;
    setRenameDialog({
      isOpen: true,
      title: 'Rename Lesson',
      currentTitle: currentTitle,
      onConfirm: async (newTitle) => {
        if (newTitle && newTitle.trim() !== currentTitle) {
          try {
            await updateLesson(token, lessonId, { title: newTitle.trim() });
            loadCurriculum();
          } catch (e) { alert('Error updating lesson'); }
        }
      }
    });
  };

  const handleEditActivity = (activityId: number, currentTitle: string) => {
    if (!token) return;
    setRenameDialog({
      isOpen: true,
      title: 'Rename Activity',
      currentTitle: currentTitle,
      onConfirm: async (newTitle) => {
        if (newTitle && newTitle.trim() !== currentTitle) {
          try {
            await updateActivity(token, activityId, { title: newTitle.trim() });
            loadCurriculum();
          } catch (e) { alert('Error updating activity'); }
        }
      }
    });
  };

  if (error) return <ErrorState message={error} onRetry={loadCurriculum} />;
  if (!modules) return <LoadingState message="Loading curriculum..." />;

  return (
    <div>
      <div style={{ marginTop: "3rem", borderBottom: "2px solid var(--color-border)", paddingBottom: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ fontSize: "1.75rem", fontWeight: 800 }}>Curriculum Builder</h2>
          <p style={{ color: "var(--color-muted)", marginTop: "0.25rem" }}>Organize modules, weeks, and content inline.</p>
        </div>
        {!addingModule && (
          <Button onClick={() => setAddingModule(true)} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "1.1rem" }}>add</span> Add Module
          </Button>
        )}
      </div>

      <div style={styles.container}>
        {addingModule && (
          <div style={{ ...styles.inlineForm, borderColor: "var(--color-primary)" }}>
            <h4 style={{ margin: 0, fontSize: "1.1rem" }}>Add a New Module</h4>
            <Input id="new-mod" label="Module Title" value={newModuleTitle} onChange={e => setNewModuleTitle(e.target.value)} placeholder="e.g. Introduction" autoFocus />
            <div style={{ display: "flex", gap: "1rem", justifyContent: "flex-end", marginTop: "0.5rem" }}>
              <Button variant="secondary" onClick={() => setAddingModule(false)}>Cancel</Button>
              <Button onClick={handleAddModule} disabled={!newModuleTitle.trim()}>Save Module</Button>
            </div>
          </div>
        )}

        {modules.length === 0 && !addingModule && (
          <Card>
            <p style={{ color: "var(--color-muted)", textAlign: "center", margin: 0 }}>
              The curriculum is currently empty. Click "Add Module" to begin.
            </p>
          </Card>
        )}

        {modules.map(module => (
          <div key={module.id} style={styles.moduleCard}>
            <div style={styles.moduleHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <span className="material-symbols-outlined" style={{ color: "var(--color-primary)" }}>folder_open</span>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 700 }}>{module.title}</h3>
                <button onClick={() => handleEditModule(module.id, module.title)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-muted)", display: "flex", marginLeft: "0.5rem" }} title="Edit Module"><span className="material-symbols-outlined" style={{ fontSize: "1.1rem" }}>edit</span></button>
                <button onClick={() => handleDeleteModule(module.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", display: "flex" }} title="Delete Module"><span className="material-symbols-outlined" style={{ fontSize: "1.1rem" }}>delete</span></button>
              </div>
              <button 
                onClick={() => setAddingWeekFor(addingWeekFor === module.id ? null : module.id)}
                style={styles.inlineButton}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "1rem" }}>add</span> Add Week
              </button>
            </div>
            
            <div style={{ padding: "0 1.5rem 1.5rem 1.5rem" }}>
              {addingWeekFor === module.id && (
                <div style={styles.inlineForm}>
                  <h4 style={{ margin: 0, fontSize: "1rem" }}>Add Week to {module.title}</h4>
                  <Input id={`new-week-${module.id}`} label="Week Title" value={newWeekTitle} onChange={e => setNewWeekTitle(e.target.value)} placeholder="e.g. Week 1: Basics" autoFocus />
                  <div style={{ display: "flex", gap: "1rem", justifyContent: "flex-end" }}>
                    <Button variant="secondary" onClick={() => setAddingWeekFor(null)}>Cancel</Button>
                    <Button onClick={() => handleAddWeek(module.id)} disabled={!newWeekTitle.trim()}>Save Week</Button>
                  </div>
                </div>
              )}

              {(module.weeks || []).map(week => (
                <div key={week.id} style={styles.weekCard}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "0.5rem", borderBottom: "1px dashed rgba(0,0,0,0.1)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span className="material-symbols-outlined" style={{ color: "var(--muted-teal)", fontSize: "1.1rem" }}>calendar_month</span>
                      <h4 style={{ fontSize: "1rem", fontWeight: 600 }}>{week.title}</h4>
                      <button onClick={() => handleEditWeek(week.id, week.title)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-muted)", display: "flex", marginLeft: "0.25rem" }} title="Edit Week"><span className="material-symbols-outlined" style={{ fontSize: "1rem" }}>edit</span></button>
                      <button onClick={() => handleDeleteWeek(week.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", display: "flex" }} title="Delete Week"><span className="material-symbols-outlined" style={{ fontSize: "1rem" }}>delete</span></button>
                    </div>
                    <button 
                      onClick={() => setAddingLessonFor(addingLessonFor === week.id ? null : week.id)}
                      style={{ ...styles.inlineButton, borderColor: "var(--muted-teal)", color: "var(--muted-teal)" }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "1rem" }}>add</span> Add Lesson
                    </button>
                  </div>

                  {addingLessonFor === week.id && (
                    <div style={{ ...styles.inlineForm, borderColor: "var(--muted-teal)" }}>
                      <h4 style={{ margin: 0, fontSize: "0.95rem" }}>Add Lesson to {week.title}</h4>
                      <Input id={`new-les-${week.id}`} label="Lesson Title" value={newLessonTitle} onChange={e => setNewLessonTitle(e.target.value)} placeholder="e.g. Getting Started" autoFocus />
                      
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                        <label style={styles.formLabel}>Video (Optional)</label>
                        <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                          <label style={styles.fileInputLabel}>
                            <span className="material-symbols-outlined" style={{ fontSize: "1.2rem" }}>movie</span>
                            {newLessonVideoFile ? (
                              <div style={{ position: "relative", display: "inline-flex", alignItems: "center", overflow: "hidden", borderRadius: "4px", padding: "0 4px" }}>
                                {uploadProgress > 0 && (
                                  <div style={{ position: "absolute", top: 0, left: 0, height: "100%", width: `${uploadProgress}%`, background: "var(--success)", opacity: 0.3, transition: "width 0.2s" }} />
                                )}
                                <span style={{ position: "relative", zIndex: 1 }}>{newLessonVideoFile.name} {uploadProgress > 0 && uploadProgress < 100 ? `(${uploadProgress}%)` : ""}</span>
                              </div>
                            ) : "Upload Video File"}
                            <input 
                              type="file" 
                              accept="video/*" 
                              onChange={e => e.target.files && setNewLessonVideoFile(e.target.files[0])} 
                              style={{ display: "none" }} 
                            />
                          </label>
                          <span style={{ fontSize: "0.9rem", color: "var(--color-muted)", fontWeight: 600 }}>OR</span>
                          <div style={{ flex: 1 }}>
                            <Input 
                              id={`new-les-vid-${week.id}`} 
                              label="" 
                              value={newLessonVideoUrl} 
                              onChange={e => setNewLessonVideoUrl(e.target.value)} 
                              placeholder="Paste Video Link (e.g. https://youtube.com/...)" 
                            />
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                        <label style={styles.formLabel}>Document / PDF (Optional)</label>
                        <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                          <label style={styles.fileInputLabel}>
                            <span className="material-symbols-outlined" style={{ fontSize: "1.2rem" }}>picture_as_pdf</span>
                            {newLessonDocFile ? (
                              <div style={{ position: "relative", display: "inline-flex", alignItems: "center", overflow: "hidden", borderRadius: "4px", padding: "0 4px" }}>
                                {uploadProgress > 0 && (
                                  <div style={{ position: "absolute", top: 0, left: 0, height: "100%", width: `${uploadProgress}%`, background: "var(--success)", opacity: 0.3, transition: "width 0.2s" }} />
                                )}
                                <span style={{ position: "relative", zIndex: 1 }}>{newLessonDocFile.name} {uploadProgress > 0 && uploadProgress < 100 ? `(${uploadProgress}%)` : ""}</span>
                              </div>
                            ) : "Upload Study Material File"}
                            <input 
                              type="file" 
                              accept=".pdf,.doc,.docx,.ppt,.pptx" 
                              onChange={e => e.target.files && setNewLessonDocFile(e.target.files[0])} 
                              style={{ display: "none" }} 
                            />
                          </label>
                        </div>
                      </div>
                      
                      <div>
                        <label style={styles.formLabel}>Study Material / Paragraphs (Optional)</label>
                        <textarea 
                          value={newLessonText}
                          onChange={e => setNewLessonText(e.target.value)}
                          placeholder="Write your long study material or paragraphs here..."
                          style={{ width: "100%", minHeight: "120px", padding: "1rem", borderRadius: "10px", border: "1px solid rgba(0,0,0,0.15)", background: "var(--background)", color: "var(--foreground)", fontFamily: "inherit", resize: "vertical", fontSize: "0.95rem" }}
                        />
                      </div>

                      <div style={{ display: "flex", gap: "1rem", justifyContent: "flex-end" }}>
                        <Button variant="secondary" onClick={() => { setAddingLessonFor(null); setNewLessonVideoFile(null); setNewLessonDocFile(null); }}>Cancel</Button>
                        <Button onClick={() => handleAddLesson(module.id, week.id)} disabled={isSubmitting || !newLessonTitle.trim()}>{isSubmitting ? "Saving..." : "Save Lesson"}</Button>
                      </div>
                    </div>
                  )}

                  {(week.lessons || []).map(lesson => (
                    <div key={lesson.id} style={styles.lessonCard}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <span className="material-symbols-outlined" style={{ color: "var(--color-primary)", fontSize: "1rem" }}>play_lesson</span>
                          <h5 style={{ fontSize: "0.95rem", fontWeight: 600 }}>{lesson.title}</h5>
                          <button onClick={() => handleEditLesson(lesson.id, lesson.title)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-muted)", display: "flex", marginLeft: "0.25rem" }} title="Edit Lesson"><span className="material-symbols-outlined" style={{ fontSize: "0.95rem" }}>edit</span></button>
                          <button onClick={() => handleDeleteLesson(lesson.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", display: "flex" }} title="Delete Lesson"><span className="material-symbols-outlined" style={{ fontSize: "0.95rem" }}>delete</span></button>
                        </div>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          <button 
                            onClick={() => {
                              if (addingLiveSessionFor === lesson.id) {
                                setAddingLiveSessionFor(null);
                              } else {
                                setAddingLiveSessionFor(lesson.id);
                                setAddingActivityFor(null);
                                setNewActivityTitle("");
                                const nextH = getNextHour();
                                const next2H = getNextTwoHours();
                                setLiveStartDate(nextH.slice(0, 10));
                                setLiveStartTimeStr(nextH.slice(11, 16));
                                setLiveEndDate(next2H.slice(0, 10));
                                setLiveEndTimeStr(next2H.slice(11, 16));
                              }
                            }}
                            style={{ ...styles.inlineButton, borderColor: "var(--warning)", color: "var(--warning)", padding: "0.25rem 0.75rem" }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: "1rem" }}>video_camera_front</span> Add Live Session
                          </button>
                          <button 
                            onClick={() => { setAddingActivityFor(addingActivityFor === lesson.id ? null : lesson.id); setAddingLiveSessionFor(null); }}
                            style={{ ...styles.inlineButton, borderColor: "var(--color-primary)", color: "var(--color-primary)", padding: "0.25rem 0.75rem" }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: "1rem" }}>add</span> Add Activity
                          </button>
                        </div>
                      </div>

                      {addingLiveSessionFor === lesson.id && (
                        <div style={{ ...styles.inlineForm, borderColor: "var(--warning)" }}>
                          <h4 style={{ margin: 0, fontSize: "0.95rem" }}>Schedule Live Session</h4>
                          <Input id={`new-live-${lesson.id}`} label="Session Title" value={newActivityTitle} onChange={e => setNewActivityTitle(e.target.value)} placeholder="e.g. Weekly Q&A" autoFocus />
                          
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                            <div>
                              <label style={styles.formLabel}>Start Time</label>
                              <div style={{ display: "flex", gap: "0.5rem" }}>
                                <input 
                                  type="date" onClick={(e) => { try { (e.target as any).showPicker() } catch(err) {} }} 
                                  style={{...styles.formSelect, flex: 1}}
                                  value={liveStartDate}
                                  onChange={e => setLiveStartDate(e.target.value)}
                                  min={getTodayDate()}
                                  required
                                />
                                <input 
                                  type="time" onClick={(e) => { try { (e.target as any).showPicker() } catch(err) {} }} 
                                  style={styles.formSelect}
                                  value={liveStartTimeStr}
                                  onChange={e => setLiveStartTimeStr(e.target.value)}
                                  required
                                />
                              </div>
                            </div>
                            <div>
                              <label style={styles.formLabel}>End Time</label>
                              <div style={{ display: "flex", gap: "0.5rem" }}>
                                <input 
                                  type="date" onClick={(e) => { try { (e.target as any).showPicker() } catch(err) {} }} 
                                  style={{...styles.formSelect, flex: 1}}
                                  value={liveEndDate}
                                  onChange={e => setLiveEndDate(e.target.value)}
                                  min={liveStartDate || getTodayDate()}
                                  required
                                />
                                <input 
                                  type="time" onClick={(e) => { try { (e.target as any).showPicker() } catch(err) {} }} 
                                  style={styles.formSelect}
                                  value={liveEndTimeStr}
                                  onChange={e => setLiveEndTimeStr(e.target.value)}
                                  required
                                />
                              </div>
                            </div>
                          </div>

                          <div style={{ display: "flex", gap: "1rem", justifyContent: "flex-end", marginTop: "0.5rem" }}>
                            <Button variant="secondary" onClick={() => setAddingLiveSessionFor(null)}>Cancel</Button>
                            <Button onClick={() => handleAddLiveSession(module.id, week.id, lesson.id)} disabled={isSubmitting}>{isSubmitting ? "Saving..." : "Schedule Session"}</Button>
                          </div>
                        </div>
                      )}

                      {addingActivityFor === lesson.id && (
                        <div style={{ ...styles.inlineForm, borderColor: "var(--color-primary)" }}>
                          <h4 style={{ margin: 0, fontSize: "0.95rem" }}>Add Activity Content</h4>
                          <Input id={`new-act-${lesson.id}`} label="Title" value={newActivityTitle} onChange={e => setNewActivityTitle(e.target.value)} placeholder="e.g. Intro Video & Notes" autoFocus />
                          
                          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                              <label style={styles.formLabel}>Video (Optional)</label>
                              <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                                <label style={styles.fileInputLabel}>
                                  <span className="material-symbols-outlined" style={{ fontSize: "1.2rem" }}>movie</span>
                                  {newActivityVideoFile ? (
                                    <div style={{ position: "relative", display: "inline-flex", alignItems: "center", overflow: "hidden", borderRadius: "4px", padding: "0 4px" }}>
                                      {uploadProgress > 0 && (
                                        <div style={{ position: "absolute", top: 0, left: 0, height: "100%", width: `${uploadProgress}%`, background: "var(--success)", opacity: 0.3, transition: "width 0.2s" }} />
                                      )}
                                      <span style={{ position: "relative", zIndex: 1 }}>{newActivityVideoFile.name} {uploadProgress > 0 && uploadProgress < 100 ? `(${uploadProgress}%)` : ""}</span>
                                    </div>
                                  ) : "Upload Video File"}
                                  <input 
                                    type="file" 
                                    accept="video/*" 
                                    onChange={e => e.target.files && setNewActivityVideoFile(e.target.files[0])} 
                                    style={{ display: "none" }} 
                                  />
                                </label>
                                <span style={{ fontSize: "0.9rem", color: "var(--color-muted)", fontWeight: 600 }}>OR</span>
                                <div style={{ flex: 1 }}>
                                  <Input 
                                    id="video-url" 
                                    label="" 
                                    value={newActivityVideoUrl} 
                                    onChange={e => setNewActivityVideoUrl(e.target.value)} 
                                    placeholder="Paste Video Link (e.g. https://youtube.com/...)" 
                                  />
                                </div>
                              </div>
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                              <label style={styles.formLabel}>Document / PDF (Optional)</label>
                              <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                                <label style={styles.fileInputLabel}>
                                  <span className="material-symbols-outlined" style={{ fontSize: "1.2rem" }}>picture_as_pdf</span>
                                  {newActivityDocFile ? (
                                    <div style={{ position: "relative", display: "inline-flex", alignItems: "center", overflow: "hidden", borderRadius: "4px", padding: "0 4px" }}>
                                      {uploadProgress > 0 && (
                                        <div style={{ position: "absolute", top: 0, left: 0, height: "100%", width: `${uploadProgress}%`, background: "var(--success)", opacity: 0.3, transition: "width 0.2s" }} />
                                      )}
                                      <span style={{ position: "relative", zIndex: 1 }}>{newActivityDocFile.name} {uploadProgress > 0 && uploadProgress < 100 ? `(${uploadProgress}%)` : ""}</span>
                                    </div>
                                  ) : "Upload Study Material File"}
                                  <input 
                                    type="file" 
                                    accept=".pdf,.doc,.docx,.ppt,.pptx" 
                                    onChange={e => e.target.files && setNewActivityDocFile(e.target.files[0])} 
                                    style={{ display: "none" }} 
                                  />
                                </label>
                              </div>
                            </div>

                            <div>
                              <label style={styles.formLabel}>Study Material / Paragraphs (Optional)</label>
                              <textarea 
                                value={newActivityText}
                                onChange={e => setNewActivityText(e.target.value)}
                                placeholder="Write your lesson text here..."
                                style={{ width: "100%", minHeight: "120px", padding: "1rem", borderRadius: "10px", border: "1px solid rgba(0,0,0,0.15)", background: "var(--background)", color: "var(--foreground)", fontFamily: "inherit", resize: "vertical", fontSize: "0.95rem" }}
                              />
                            </div>
                          </div>

                          <div style={{ display: "flex", gap: "1rem", justifyContent: "flex-end", marginTop: "0.5rem" }}>
                            <Button variant="secondary" onClick={() => { setAddingActivityFor(null); setNewActivityVideoFile(null); setNewActivityDocFile(null); }}>Cancel</Button>
                            <Button onClick={() => handleAddActivity(module.id, week.id, lesson.id)} disabled={isSubmitting || !newActivityTitle.trim()}>{isSubmitting ? "Saving..." : "Save Content"}</Button>
                          </div>
                        </div>
                      )}

                      {(lesson.activities || []).map(activity => (
                        <div key={activity.id} style={styles.activityItem}>
                          <div style={{ display: "flex", alignItems: "center" }}>
                            <span className="material-symbols-outlined" style={{ fontSize: "1rem", color: "var(--color-muted)", marginRight: "0.5rem" }}>
                              {activity.activity_type === "VIDEO" ? "play_circle" : "article"}
                            </span>
                            {activity.title} 
                            <span style={styles.typeBadge}>{activity.activity_type}</span>
                            <button onClick={() => handleEditActivity(activity.id, activity.title)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-muted)", display: "flex", marginLeft: "0.5rem" }} title="Edit Activity"><span className="material-symbols-outlined" style={{ fontSize: "1rem" }}>edit</span></button>
                            <button onClick={() => handleDeleteActivity(activity.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", display: "flex" }} title="Delete Activity"><span className="material-symbols-outlined" style={{ fontSize: "1rem" }}>delete</span></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {renameDialog && renameDialog.isOpen && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "var(--background)", padding: "2rem", borderRadius: "12px", width: "400px", maxWidth: "90%", boxShadow: "0 10px 25px rgba(0,0,0,0.1)" }}>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "1rem" }}>{renameDialog.title}</h3>
            <input 
              type="text" 
              defaultValue={renameDialog.currentTitle} 
              id="rename-input"
              style={{ width: "100%", padding: "0.75rem", borderRadius: "8px", border: "1px solid var(--color-border)", marginBottom: "1.5rem", outline: "none", fontSize: "1rem", background: "var(--background)", color: "var(--foreground)" }}
              autoFocus
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "1rem" }}>
              <button onClick={() => setRenameDialog(null)} style={{ padding: "0.5rem 1rem", border: "none", background: "transparent", cursor: "pointer", fontWeight: 600, color: "var(--color-muted)" }}>Cancel</button>
              <button onClick={() => {
                const input = document.getElementById('rename-input') as HTMLInputElement;
                if(input) {
                  renameDialog.onConfirm(input.value);
                  setRenameDialog(null);
                }
              }} style={{ padding: "0.5rem 1.5rem", border: "none", background: "var(--color-primary)", color: "white", borderRadius: "8px", cursor: "pointer", fontWeight: 600 }}>Save</button>
            </div>
          </div>
        </div>
      )}

      {confirmDialog && confirmDialog.isOpen && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "var(--background)", padding: "2rem", borderRadius: "12px", width: "400px", maxWidth: "90%", boxShadow: "0 10px 25px rgba(0,0,0,0.1)" }}>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "1rem", color: "var(--danger)" }}>{confirmDialog.title}</h3>
            <p style={{ color: "var(--color-muted)", marginBottom: "1.5rem", lineHeight: 1.5 }}>{confirmDialog.message}</p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "1rem" }}>
              <button onClick={() => setConfirmDialog(null)} style={{ padding: "0.5rem 1rem", border: "none", background: "transparent", cursor: "pointer", fontWeight: 600, color: "var(--color-muted)" }}>Cancel</button>
              <button onClick={() => {
                confirmDialog.onConfirm();
                setConfirmDialog(null);
              }} style={{ padding: "0.5rem 1.5rem", border: "none", background: "var(--danger)", color: "white", borderRadius: "8px", cursor: "pointer", fontWeight: 600 }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
