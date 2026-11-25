"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PROGRAM_COHORT_ADMIN_ROLES, INSTRUCTOR_ROLES } from "@/lib/auth/roles";
import { Card } from "@/components/ui/Card";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Badge } from "@/components/ui/Badge";
import { Table } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/lib/auth/AuthContext";
import { getProgram, updateProgram } from "@/lib/api/endpoints";
import { ApiError, apiRequest } from "@/lib/api/client";
import type { Program } from "@/lib/api/types";
import { CurriculumBuilder } from "./CurriculumBuilder";
import { useCohorts } from "@/lib/api/useCohorts";
import { DeleteConfirmationModal } from "@/components/ui/DeleteConfirmationModal";

const PROGRAM_STATUSES = ["ACTIVE", "INACTIVE"];

function useProgram(programId: number) {
  const { token } = useAuth();
  const [program, setProgram] = useState<Program | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    getProgram(token, programId)
      .then((data) => {
        if (!cancelled) setProgram(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Unable to load program.");
      });
    return () => {
      cancelled = true;
    };
  }, [token, programId, reloadKey]);

  return { program, error, reload };
}

function ProgramStatusEditor({ program, onUpdated }: { program: Program; onUpdated: () => void }) {
  const { token } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(status: string) {
    if (!token || status === program.status) return;
    setSaving(true);
    setError(null);
    try {
      await updateProgram(token, program.id, { status });
      onUpdated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to update status.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
      <select
        value={program.status}
        disabled={saving}
        onChange={(e) => handleChange(e.target.value)}
        aria-label={`Update status for ${program.name}`}
        style={{
          padding: "0.4rem 1rem",
          borderRadius: "6px",
          border: "1px solid var(--color-border)",
          background: "var(--color-surface)",
          color: "var(--foreground)",
          fontWeight: 600,
          cursor: "pointer"
        }}
      >
        {PROGRAM_STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      {error && <span role="alert" style={{ color: "var(--color-error, #c0392b)", fontSize: "0.85rem" }}>{error}</span>}
    </span>
  );
}

function AssignCohortFormInline({ programId, onAssigned, onCancel }: { programId: number; onAssigned: () => void; onCancel: () => void }) {
  const { token } = useAuth();
  const { cohorts } = useCohorts(); // Fetch all cohorts
  const [selectedCohortId, setSelectedCohortId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Filter cohorts that are not already assigned to this program
  const availableCohorts = cohorts?.filter(c => !c.program_ids?.includes(programId)) || [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !selectedCohortId) return;
    setSubmitting(true);
    setError(null);

    try {
      await apiRequest(`/api/v1/cohorts/${selectedCohortId}/programs/${programId}`, {
        method: "POST",
        token
      });
      setSelectedCohortId("");
      onAssigned();
    } catch (err: any) {
      setError(err.message || "Failed to assign cohort.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ background: "linear-gradient(145deg, var(--color-surface), rgba(255,255,255,0.02))", padding: "2rem", borderRadius: "16px", border: "1px solid var(--color-border)", marginBottom: "2rem", boxShadow: "0 8px 32px rgba(0,0,0,0.04)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.5rem" }}>
        <span className="material-symbols-outlined" style={{ color: "var(--color-primary)", fontSize: "1.5rem" }}>link</span>
        <h3 style={{ fontSize: "1.15rem", fontWeight: 700, margin: 0 }}>Assign Existing Cohort</h3>
      </div>
      
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.5rem", maxWidth: "600px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <label style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--foreground)" }}>Select Cohort</label>
          <select 
            required 
            value={selectedCohortId} 
            onChange={(e) => setSelectedCohortId(e.target.value)}
            style={{ 
              padding: "0.85rem 1rem", 
              borderRadius: "10px", 
              border: "2px solid var(--color-border)", 
              background: "var(--background)", 
              color: "var(--foreground)", 
              fontSize: "0.95rem",
              outline: "none",
              transition: "border-color 0.2s ease"
            }}
            onFocus={(e) => e.target.style.borderColor = "var(--color-primary)"}
            onBlur={(e) => e.target.style.borderColor = "var(--color-border)"}
          >
            <option value="" disabled>Choose a cohort to assign...</option>
            {availableCohorts.map(c => (
              <option key={c.id} value={c.id}>{c.name} (Code: {c.code}) {c.program_ids?.length ? `- Belongs to ${c.program_ids.length} program(s)` : "- Independent"}</option>
            ))}
          </select>
          {availableCohorts.length === 0 && cohorts !== null && (
            <p style={{ color: "var(--color-muted)", fontSize: "0.9rem", marginTop: "0.25rem", display: "flex", alignItems: "center", gap: "0.35rem" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "1rem" }}>info</span> No available cohorts to assign.
            </p>
          )}
        </div>
        
        {error && <ErrorState message={error} />}
        
        <div style={{ display: "flex", gap: "1rem", marginTop: "0.5rem" }}>
          <Button type="submit" disabled={submitting || !selectedCohortId}>
            {submitting ? "Assigning..." : "Assign Cohort"}
          </Button>
          <Button variant="secondary" type="button" onClick={onCancel}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}

function ProgramCohortsList({ programId, basePath }: { programId: number; basePath: string }) {
  const { cohorts, error, reload } = useCohorts(programId);
  const [showAdd, setShowAdd] = useState(false);

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (cohorts === null) return <LoadingState message="Loading assigned cohorts..." />;
  
  return (
    <div style={{ background: "var(--color-surface)", borderRadius: "12px", border: "1px solid var(--color-border)", padding: "1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600 }}>Assigned Cohorts</h2>
        <div style={{ display: "flex", gap: "1rem" }}>
          <Button onClick={() => setShowAdd(!showAdd)}>+ Assign Cohort</Button>
          <Link href={`${basePath}/cohorts`}>
            <Button variant="secondary" style={{ fontSize: "0.9rem" }}>Manage All Cohorts</Button>
          </Link>
        </div>
      </div>
      
      {showAdd && (
        <AssignCohortFormInline programId={programId} onAssigned={() => { setShowAdd(false); reload(); }} onCancel={() => setShowAdd(false)} />
      )}

      <Table
        columns={[
          {
            key: "name",
            header: "Cohort Name",
            render: (row) => <Link href={`${basePath}/cohorts/${row.id}`} style={{ fontWeight: 600, color: "var(--color-primary)", textDecoration: "none" }}>{row.name}</Link>,
          },
          { key: "code", header: "Code" },
          { key: "start_date", header: "Start Date" },
          { key: "status", header: "Status", render: (row) => <Badge status={row.status}>{row.status}</Badge> },
          {
            key: "actions",
            header: "",
            render: (row) => (
              <div style={{ textAlign: "right" }}>
                <Link href={`${basePath}/cohorts/${row.id}`}>
                  <Button variant="secondary" style={{ padding: "0.5rem 1rem", fontSize: "0.85rem", display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "1.1rem" }}>settings</span>
                    Manage
                  </Button>
                </Link>
              </div>
            )
          }
        ]}
        rows={cohorts}
        getRowKey={(row) => row.id}
        emptyMessage="No cohorts assigned to this program yet."
      />
    </div>
  );
}

function ProgramDetailContent({ programId }: { programId: number }) {
  const { program, error: programError, reload: reloadProgram } = useProgram(programId);
  const { token, user } = useAuth();
  const router = useRouter();
  
  const isAdmin = user?.roles.some(r => PROGRAM_COHORT_ADMIN_ROLES.includes(r));
  const basePath = isAdmin ? "/admin" : "/instructor";
  
  const [menuOpen, setMenuOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState("");
  const [activeTab, setActiveTab] = useState<"curriculum" | "cohorts">("curriculum");
  
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  if (programError) {
    return (
      <div style={{ padding: "3rem", width: "100%" }}>
        <ErrorState message={programError} />
      </div>
    );
  }

  if (!program) {
    return (
      <div style={{ padding: "3rem", width: "100%" }}>
        <LoadingState message="Loading program details…" />
      </div>
    );
  }

  const handleSaveName = async () => {
    if (!token || !newName.trim() || newName === program.name) {
      setIsEditing(false);
      return;
    }
    try {
      await updateProgram(token, programId, { name: newName });
      reloadProgram();
    } catch (e) {
      alert("Error renaming program");
    }
    setIsEditing(false);
  };

  const executeDelete = async () => {
    if (!token) return;
    try {
      const { deleteProgram } = await import("@/lib/api/endpoints");
      await deleteProgram(token, programId);
      router.push(`${basePath}/programs`);
    } catch(e) {
      alert("Error deleting program");
    }
  };

  return (
    <div style={{ padding: "3rem 4rem", width: "100%", maxWidth: "1600px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "2rem", animation: "fadeIn 0.3s ease-out" }}>
      
      {showDeleteConfirm && (
        <DeleteConfirmationModal
          open={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={executeDelete}
          itemName={program.name}
          itemType="Program"
          itemDetails={`Code: ${program.code}`}
          warningText="This action will permanently delete this curriculum program, its modules, lessons, activities, and enrollment history. This action cannot be undone."
        />
      )}

      {/* Premium Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.5rem" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "2rem", color: "var(--blue-slate)" }}>local_library</span>
            
            {isEditing ? (
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <input 
                  autoFocus
                  value={newName} 
                  onChange={e => setNewName(e.target.value)}
                  style={{ fontSize: "2.5rem", fontWeight: 800, padding: "0.25rem", border: "1px solid var(--primary)", borderRadius: "8px", background: "var(--bg-main)", color: "var(--foreground)" }} 
                />
                <button onClick={handleSaveName} style={{ padding: "0.5rem", background: "var(--primary)", color: "white", border: "none", borderRadius: "8px", cursor: "pointer" }}>Save</button>
                <button onClick={() => setIsEditing(false)} style={{ padding: "0.5rem", background: "var(--color-border)", border: "none", borderRadius: "8px", cursor: "pointer" }}>Cancel</button>
              </div>
            ) : (
              <h1 style={{ fontSize: "2.5rem", fontWeight: 800, color: "var(--foreground)", letterSpacing: "-0.5px", margin: 0, display: "flex", alignItems: "center", gap: "1rem" }}>
                {program.name}
                
                {/* Settings Menu Toggle */}
                <div style={{ position: "relative" }}>
                  <button onClick={() => setMenuOpen(!menuOpen)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex", alignItems: "center" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "1.75rem", transition: "transform 0.2s", transform: menuOpen ? "rotate(90deg)" : "none" }}>settings</span>
                  </button>
                  
                  {menuOpen && (
                    <div style={{
                      position: "absolute", top: "100%", left: 0, marginTop: "0.5rem", background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "12px", boxShadow: "var(--shadow-lg)", width: "200px", zIndex: 50, padding: "0.5rem", display: "flex", flexDirection: "column", gap: "0.25rem"
                    }}>
                      {isAdmin && (
                        <button className="menu-btn" onClick={() => { setNewName(program.name); setIsEditing(true); setMenuOpen(false); }} style={{ display: "flex", alignItems: "center", gap: "0.5rem", width: "100%", padding: "0.75rem", textAlign: "left", background: "transparent", color: "var(--foreground)", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "0.95rem" }}>
                          <span className="material-symbols-outlined" style={{ fontSize: "1.2rem" }}>edit</span> Edit Name
                        </button>
                      )}
                      <button className="menu-btn" onClick={() => { router.push(`${basePath}/cohorts?programId=${program.id}`); }} style={{ display: "flex", alignItems: "center", gap: "0.5rem", width: "100%", padding: "0.75rem", textAlign: "left", background: "transparent", color: "var(--foreground)", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "0.95rem" }}>
                        <span className="material-symbols-outlined" style={{ fontSize: "1.2rem" }}>school</span> Manage Cohorts
                      </button>
                      {isAdmin && (
                        <>
                          <div style={{ height: "1px", background: "var(--color-border)", margin: "0.25rem 0" }} />
                          <button className="menu-btn-danger" onClick={() => { setMenuOpen(false); setShowDeleteConfirm(true); }} style={{ display: "flex", alignItems: "center", gap: "0.5rem", width: "100%", padding: "0.75rem", textAlign: "left", background: "var(--danger)", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "0.95rem", marginTop: "0.25rem" }}>
                            <span className="material-symbols-outlined" style={{ fontSize: "1.2rem" }}>delete</span> Delete Program
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </h1>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginTop: "1rem" }}>
            <span style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--color-muted)", background: "rgba(0,0,0,0.03)", padding: "0.2rem 0.8rem", borderRadius: "20px" }}>
              Code: {program.code}
            </span>
            <Badge status={program.status}>{program.status}</Badge>
            {isAdmin && <ProgramStatusEditor program={program} onUpdated={reloadProgram} />}
          </div>
          {program.description && (
            <p style={{ marginTop: "1.5rem", fontSize: "1.1rem", color: "var(--foreground)", maxWidth: "800px", lineHeight: 1.6 }}>
              {program.description}
            </p>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: "2rem", borderBottom: "1px solid var(--color-border)", marginTop: "1rem" }}>
        <button
          onClick={() => setActiveTab("curriculum")}
          style={{
            background: "none", border: "none", padding: "0.75rem 0", fontSize: "1.1rem", fontWeight: 600, cursor: "pointer",
            color: activeTab === "curriculum" ? "var(--primary)" : "var(--color-muted)",
            borderBottom: activeTab === "curriculum" ? "3px solid var(--primary)" : "3px solid transparent",
            transition: "all 0.2s ease"
          }}
        >
          Curriculum Builder
        </button>
        <button
          onClick={() => setActiveTab("cohorts")}
          style={{
            background: "none", border: "none", padding: "0.75rem 0", fontSize: "1.1rem", fontWeight: 600, cursor: "pointer",
            color: activeTab === "cohorts" ? "var(--primary)" : "var(--color-muted)",
            borderBottom: activeTab === "cohorts" ? "3px solid var(--primary)" : "3px solid transparent",
            transition: "all 0.2s ease"
          }}
        >
          Assigned Cohorts
        </button>
      </div>

      <div style={{ width: "100%", marginTop: "1rem" }}>
        {activeTab === "curriculum" && <CurriculumBuilder programId={program.id} />}
        {activeTab === "cohorts" && <ProgramCohortsList programId={program.id} basePath={basePath} />}
      </div>
    </div>
  );
}

export default function ProgramDetailPage() {
  const params = useParams<{ id: string }>();
  const programId = Number(params.id);

  return (
    <RequireAuth allowedRoles={[...PROGRAM_COHORT_ADMIN_ROLES, ...INSTRUCTOR_ROLES]}>
      <ProgramDetailContent programId={programId} />
    </RequireAuth>
  );
}
