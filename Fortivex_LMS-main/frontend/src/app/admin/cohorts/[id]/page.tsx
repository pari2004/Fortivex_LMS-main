"use client";

import { use, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PROGRAM_COHORT_ADMIN_ROLES, INSTRUCTOR_ROLES } from "@/lib/auth/roles";
import { useAuth } from "@/lib/auth/AuthContext";
import { apiRequest } from "@/lib/api/client";
import { Cohort, Enrollment, Student, User } from "@/lib/api/types";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Form } from "@/components/ui/Form";
import { DeleteConfirmationModal } from "@/components/ui/DeleteConfirmationModal";

export default function CohortDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <RequireAuth allowedRoles={[...PROGRAM_COHORT_ADMIN_ROLES, ...INSTRUCTOR_ROLES]}>
      <CohortContent cohortId={parseInt(id, 10)} />
    </RequireAuth>
  );
}

function CohortContent({ cohortId }: { cohortId: number }) {
  const { token, organization, user } = useAuth();
  const router = useRouter();
  const isAdmin = user?.roles.some(r => PROGRAM_COHORT_ADMIN_ROLES.includes(r));
  const basePath = isAdmin ? "/admin" : "/instructor";
  
  const [cohort, setCohort] = useState<Cohort | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showAddStudent, setShowAddStudent] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [enrolling, setEnrolling] = useState(false);
  const [enrollError, setEnrollError] = useState<string | null>(null);

  // Settings Menu & Modal State
  const [menuOpen, setMenuOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editStatus, setEditStatus] = useState("ACTIVE");
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Bulk enrollment state
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);
  const [studentSearch, setStudentSearch] = useState("");

  const openSettingsModal = () => {
    if (!cohort) return;
    setEditName(cohort.name);
    setEditCode(cohort.code);
    setEditStatus(cohort.status);
    setEditStartDate(cohort.start_date);
    setEditEndDate(cohort.end_date || "");
    setIsSettingsModalOpen(true);
    setMenuOpen(false);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !cohort) return;
    setIsSavingSettings(true);
    try {
      const { updateCohort } = await import("@/lib/api/endpoints");
      await updateCohort(token, cohortId, {
        name: editName.trim(),
        code: editCode.trim(),
        status: editStatus,
        start_date: editStartDate,
        end_date: editEndDate.trim() || null
      });
      setIsSettingsModalOpen(false);
      await loadData();
    } catch (err: any) {
      alert("Error saving cohort settings: " + (err.message || err));
    } finally {
      setIsSavingSettings(false);
    }
  };

  const loadData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [cData, eData, sData, uData] = await Promise.all([
        apiRequest<Cohort>(`/api/v1/cohorts/${cohortId}`, { token }),
        apiRequest<Enrollment[]>("/api/v1/enrollments", { token }),
        apiRequest<Student[]>("/api/v1/students", { token }),
        apiRequest<User[]>("/api/v1/users", { token })
      ]);
      setCohort(cData);
      setEnrollments(eData.filter(e => e.cohort_id === cohortId));
      setStudents(sData);
      setUsers(uData);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to load cohort details.");
    } finally {
      setLoading(false);
    }
  }, [token, cohortId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleEnrollStudents(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !organization || !cohort) return;
    
    const targetIds = selectedStudentIds.length > 0 
      ? selectedStudentIds 
      : (selectedStudentId ? [parseInt(selectedStudentId, 10)] : []);

    if (targetIds.length === 0) {
      setEnrollError("Please select at least one student to enroll.");
      return;
    }

    setEnrolling(true);
    setEnrollError(null);

    const programId = cohort.program_ids?.[0];
    if (!programId) {
      setEnrollError("This cohort is not assigned to any program yet. Please assign this cohort to a program first before enrolling students.");
      setEnrolling(false);
      return;
    }

    try {
      await Promise.all(
        targetIds.map(sId =>
          apiRequest("/api/v1/enrollments", {
            method: "POST",
            token,
            body: {
              student_id: sId,
              program_id: programId,
              cohort_id: cohort.id,
              organization_id: organization.id,
              status: "ENROLLED"
            }
          })
        )
      );
      setShowAddStudent(false);
      setSelectedStudentId("");
      setSelectedStudentIds([]);
      loadData();
    } catch (err: any) {
      setEnrollError(err.message || "Failed to enroll students.");
    } finally {
      setEnrolling(false);
    }
  }

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDelete = async () => {
    if (!token) return;
    try {
      const { deleteCohort } = await import("@/lib/api/endpoints");
      await deleteCohort(token, cohortId);
      router.push(`${basePath}/cohorts`);
    } catch(e) {
      alert("Error deleting cohort");
    }
  };

  if (loading) return <LoadingState message="Loading cohort..." />;
  if (error) return <ErrorState message={error} onRetry={loadData} />;
  if (!cohort) return null;

  // Enrich enrollments with student and user data
  const enrichedEnrollments = enrollments.map(e => {
    const student = students.find(s => s.id === e.student_id);
    const user = users.find(u => u.id === student?.user_id);
    return { ...e, student, user };
  });

  // Find students who are NOT already enrolled in this cohort
  const unenrolledStudents = students.filter(s => !enrollments.some(e => e.student_id === s.id)).map(s => {
    const user = users.find(u => u.id === s.user_id);
    return { ...s, user };
  });

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
      {showDeleteConfirm && (
        <DeleteConfirmationModal
          open={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={handleDelete}
          itemName={cohort.name}
          itemType="Cohort"
          itemDetails={`Code: ${cohort.code}`}
          warningText="This action will permanently delete this cohort and remove class roster assignments for enrolled learners. This action cannot be undone."
        />
      )}

      {/* Cohort Settings Modal */}
      {isSettingsModalOpen && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "var(--color-surface)", padding: "2rem", borderRadius: "16px", maxWidth: "520px", width: "100%", border: "1px solid var(--color-border)", boxShadow: "var(--shadow-2xl)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
              <h2 style={{ fontSize: "1.4rem", fontWeight: 700, margin: 0 }}>Cohort Settings</h2>
              <button onClick={() => setIsSettingsModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-muted)" }}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveSettings} style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.35rem" }}>Cohort Name</label>
                  <input
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    style={{ width: "100%", padding: "0.65rem 0.85rem", borderRadius: "8px", border: "1px solid var(--color-border)", background: "var(--background)", color: "var(--foreground)", fontSize: "0.95rem" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.35rem" }}>Cohort Code</label>
                  <input
                    required
                    value={editCode}
                    onChange={(e) => setEditCode(e.target.value)}
                    style={{ width: "100%", padding: "0.65rem 0.85rem", borderRadius: "8px", border: "1px solid var(--color-border)", background: "var(--background)", color: "var(--foreground)", fontSize: "0.95rem" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.35rem" }}>Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  style={{ width: "100%", padding: "0.65rem 0.85rem", borderRadius: "8px", border: "1px solid var(--color-border)", background: "var(--background)", color: "var(--foreground)", fontSize: "0.95rem" }}
                >
                  <option value="ACTIVE">ACTIVE (Running class)</option>
                  <option value="UPCOMING">UPCOMING (Not yet started)</option>
                  <option value="COMPLETED">COMPLETED (Concluded)</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.35rem" }}>Start Date</label>
                  <input
                    type="date"
                    required
                    value={editStartDate}
                    onChange={(e) => setEditStartDate(e.target.value)}
                    style={{ width: "100%", padding: "0.65rem 0.85rem", borderRadius: "8px", border: "1px solid var(--color-border)", background: "var(--background)", color: "var(--foreground)", fontSize: "0.95rem" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.35rem" }}>End Date (Optional)</label>
                  <input
                    type="date"
                    value={editEndDate}
                    onChange={(e) => setEditEndDate(e.target.value)}
                    style={{ width: "100%", padding: "0.65rem 0.85rem", borderRadius: "8px", border: "1px solid var(--color-border)", background: "var(--background)", color: "var(--foreground)", fontSize: "0.95rem" }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: "1rem", justifyContent: "flex-end", marginTop: "0.5rem" }}>
                <Button type="button" variant="secondary" onClick={() => setIsSettingsModalOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={isSavingSettings}>
                  {isSavingSettings ? "Saving..." : "Save Settings"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div style={{ marginBottom: "1rem" }}>
        <Link href={`${basePath}/cohorts`} style={{ color: "var(--color-muted)", fontSize: "0.9rem", display: "inline-flex", alignItems: "center", gap: "0.25rem", textDecoration: "none" }}>
          <span className="material-symbols-outlined" style={{ fontSize: "1.1rem" }}>arrow_back</span>
          Back to Cohorts
        </Link>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "2rem" }}>
        <div>
          <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "1rem" }}>
            {cohort.name}
            {isAdmin && (
              <button
                onClick={openSettingsModal}
                title="Edit Cohort Settings"
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-muted)", display: "flex", alignItems: "center" }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "1.5rem" }}>settings</span>
              </button>
            )}
          </h1>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            <span style={{ color: "var(--color-muted)", fontSize: "0.95rem" }}>
              Code: <strong style={{ color: "var(--foreground)" }}>{cohort.code}</strong> | Starts: <strong style={{ color: "var(--foreground)" }}>{cohort.start_date}</strong> {cohort.end_date ? `| Ends: ${cohort.end_date}` : ""}
            </span>
            <Badge status={cohort.status}>{cohort.status}</Badge>
            {isAdmin && (
              <button
                onClick={openSettingsModal}
                style={{
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "6px",
                  padding: "0.2rem 0.6rem",
                  fontSize: "0.8rem",
                  cursor: "pointer",
                  color: "var(--color-primary)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.25rem",
                  fontWeight: 600,
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "0.95rem" }}>edit</span>
                Change Status / Edit
              </button>
            )}
          </div>
        </div>
        {!showAddStudent && <Button onClick={() => setShowAddStudent(true)}>+ Enroll Students</Button>}
      </div>

      {showAddStudent && (
        <div style={{ background: "var(--color-surface)", borderRadius: "12px", border: "1px solid var(--color-border)", padding: "1.5rem", marginBottom: "2rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
            <div>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 600, margin: 0 }}>Enroll Students into {cohort.name}</h2>
              <p style={{ color: "var(--color-muted)", fontSize: "0.85rem", margin: "0.25rem 0 0 0" }}>
                Select one or multiple unenrolled students to add to this cohort.
              </p>
            </div>
            <button onClick={() => { setShowAddStudent(false); setSelectedStudentIds([]); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-muted)" }}>
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          <form onSubmit={handleEnrollStudents}>
            {unenrolledStudents.length === 0 ? (
              <p style={{ color: "var(--color-muted)", fontStyle: "italic" }}>All students in this organization are already enrolled in this cohort.</p>
            ) : (
              <div>
                <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem", alignItems: "center" }}>
                  <input
                    type="text"
                    placeholder="Search unenrolled students..."
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    style={{ flex: 1, padding: "0.55rem 0.85rem", borderRadius: "8px", border: "1px solid var(--color-border)", background: "var(--background)", color: "var(--foreground)", fontSize: "0.9rem" }}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      const filtered = unenrolledStudents.filter(s =>
                        (s.user?.full_name?.toLowerCase().includes(studentSearch.toLowerCase()) ||
                         s.user?.email?.toLowerCase().includes(studentSearch.toLowerCase()))
                      );
                      if (selectedStudentIds.length === filtered.length) {
                        setSelectedStudentIds([]);
                      } else {
                        setSelectedStudentIds(filtered.map(s => s.id));
                      }
                    }}
                    style={{ fontSize: "0.85rem", padding: "0.55rem 0.9rem" }}
                  >
                    {selectedStudentIds.length > 0 ? "Deselect All" : "Select All"}
                  </Button>
                </div>

                <div style={{ maxHeight: "220px", overflowY: "auto", border: "1px solid var(--color-border)", borderRadius: "8px", padding: "0.5rem" }}>
                  {unenrolledStudents
                    .filter(s =>
                      (s.user?.full_name?.toLowerCase().includes(studentSearch.toLowerCase()) ||
                       s.user?.email?.toLowerCase().includes(studentSearch.toLowerCase()))
                    )
                    .map(s => {
                      const isChecked = selectedStudentIds.includes(s.id);
                      return (
                        <label
                          key={s.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.75rem",
                            padding: "0.45rem 0.6rem",
                            borderRadius: "6px",
                            cursor: "pointer",
                            background: isChecked ? "rgba(var(--color-primary-rgb, 14, 165, 233), 0.08)" : "transparent",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedStudentIds(prev => [...prev, s.id]);
                              } else {
                                setSelectedStudentIds(prev => prev.filter(id => id !== s.id));
                              }
                            }}
                          />
                          <span style={{ fontWeight: 500, fontSize: "0.9rem" }}>{s.user?.full_name || "Unknown"}</span>
                          <span style={{ color: "var(--color-muted)", fontSize: "0.82rem" }}>({s.user?.email || "No email"})</span>
                          <span style={{ marginLeft: "auto", color: "var(--color-muted)", fontSize: "0.8rem" }}>{s.student_code}</span>
                        </label>
                      );
                    })}
                </div>
              </div>
            )}

            {enrollError && <div style={{ marginTop: "1rem" }}><ErrorState message={enrollError} /></div>}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1.25rem" }}>
              <Button type="button" variant="secondary" onClick={() => { setShowAddStudent(false); setSelectedStudentIds([]); }}>
                Cancel
              </Button>
              <Button type="submit" disabled={enrolling || selectedStudentIds.length === 0}>
                {enrolling
                  ? "Enrolling..."
                  : selectedStudentIds.length > 0
                  ? `Enroll Selected (${selectedStudentIds.length} Students)`
                  : "Enroll Students"}
              </Button>
            </div>
          </form>
        </div>
      )}

      <div style={{ background: "var(--color-surface)", borderRadius: "12px", border: "1px solid var(--color-border)", padding: "1.5rem" }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "1.5rem" }}>Enrolled Students</h2>
        <Table
          columns={[
            {
              key: "name",
              header: "Student Name",
              render: (row) => <div style={{ fontWeight: 500 }}>{row.user?.full_name || "Unknown"}</div>,
            },
            { key: "email", header: "Email Address", render: (row) => row.user?.email || "—" },
            { key: "code", header: "Student ID", render: (row) => row.student?.student_code || "—" },
            { key: "status", header: "Status", render: (row) => <Badge status={row.status === "ENROLLED" ? "active" : "draft"}>{row.status}</Badge> },
          ]}
          rows={enrichedEnrollments}
          getRowKey={(row) => row.id}
          emptyMessage="No students are enrolled in this cohort yet."
        />
      </div>
    </div>
  );
}
