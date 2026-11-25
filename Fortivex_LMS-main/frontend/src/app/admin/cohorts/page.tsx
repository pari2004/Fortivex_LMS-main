"use client";

import { useState } from "react";
import Link from "next/link";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PROGRAM_COHORT_ADMIN_ROLES, INSTRUCTOR_ROLES } from "@/lib/auth/roles";
import { Card } from "@/components/ui/Card";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Badge } from "@/components/ui/Badge";
import { Table } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { Form } from "@/components/ui/Form";
import { Input } from "@/components/ui/Input";
import { Icon } from "@/components/ui/Icon";
import { useAuth } from "@/lib/auth/AuthContext";
import { useCohorts } from "@/lib/api/useCohorts";
import { usePrograms } from "@/lib/api/usePrograms";
import { apiRequest, ApiError } from "@/lib/api/client";
import { deleteCohort } from "@/lib/api/endpoints";
import { DeleteConfirmationModal } from "@/components/ui/DeleteConfirmationModal";
import type { Cohort } from "@/lib/api/types";

function CreateCohortForm({ onCreated }: { onCreated: () => void }) {
  const { token, organization } = useAuth();
  const { programs } = usePrograms(organization?.id);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [programId, setProgramId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState("AUTO");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !organization) return;
    setSubmitting(true);
    setError(null);

    const todayStr = new Date().toISOString().slice(0, 10);
    let resolvedStatus = status;
    if (resolvedStatus === "AUTO") {
      if (endDate && endDate < todayStr) {
        resolvedStatus = "COMPLETED";
      } else if (startDate && startDate <= todayStr) {
        resolvedStatus = "ACTIVE";
      } else {
        resolvedStatus = "UPCOMING";
      }
    }

    try {
      await apiRequest("/api/v1/cohorts", {
        method: "POST",
        token,
        body: {
          organization_id: organization.id,
          program_ids: programId ? [parseInt(programId)] : [],
          name,
          code,
          start_date: startDate,
          end_date: endDate || null,
          status: resolvedStatus
        }
      });
      setName("");
      setCode("");
      setProgramId("");
      setStartDate("");
      setEndDate("");
      setStatus("AUTO");
      onCreated();
    } catch (err: any) {
      setError(err.message || "Failed to create cohort.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Form onSubmit={handleSubmit}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
        <Input id="cohort-name" label="Cohort Name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Jan 2026 Cohort" />
        <Input id="cohort-code" label="Cohort Code" required value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. 2026-JAN" />
      </div>
      
      <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
        <label style={{ fontSize: "0.9rem", fontWeight: 500, color: "var(--foreground)" }}>Program (Optional)</label>
        <select 
          value={programId} 
          onChange={(e) => setProgramId(e.target.value)}
          style={{ padding: "0.75rem 1rem", borderRadius: "8px", border: "1px solid var(--color-border)", background: "var(--background)", color: "var(--foreground)", fontSize: "0.95rem" }}
        >
          <option value="">No Program / Independent</option>
          {programs?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1.5rem" }}>
        <Input type="date" id="start-date" label="Start Date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <Input type="date" id="end-date" label="End Date (Optional)" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
          <label style={{ fontSize: "0.9rem", fontWeight: 500, color: "var(--foreground)" }}>Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            style={{ padding: "0.75rem 1rem", borderRadius: "8px", border: "1px solid var(--color-border)", background: "var(--background)", color: "var(--foreground)", fontSize: "0.95rem" }}
          >
            <option value="AUTO">Auto (based on dates)</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="UPCOMING">UPCOMING</option>
            <option value="COMPLETED">COMPLETED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
        </div>
      </div>

      {error && <ErrorState message={error} />}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Button type="submit" disabled={submitting}>{submitting ? "Creating..." : "Create Cohort"}</Button>
      </div>
    </Form>
  );
}

function CohortsContent() {
  const { token, organization, user } = useAuth();
  const { cohorts, error, reload } = useCohorts();
  const [showCreate, setShowCreate] = useState(false);
  const [cohortToDelete, setCohortToDelete] = useState<Cohort | null>(null);

  const isAdmin = user?.roles.some((r) => PROGRAM_COHORT_ADMIN_ROLES.includes(r));
  const basePath = isAdmin ? "/admin" : "/instructor";

  const handleDeleteCohort = async () => {
    if (!token || !cohortToDelete) return;
    await deleteCohort(token, cohortToDelete.id);
    setCohortToDelete(null);
    reload();
  };

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "2rem" }}>
        <div>
          <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: "0.5rem" }}>Manage Cohorts</h1>
          <p style={{ color: "var(--color-muted)", fontSize: "1rem" }}>
            {organization ? `Active class sessions for ${organization.name}.` : "Loading organization..."}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowCreate(!showCreate)}>{showCreate ? "Cancel" : "+ New Cohort"}</Button>
        )}
      </div>

      {showCreate && isAdmin && (
        <div style={{ background: "var(--color-surface)", borderRadius: "12px", border: "1px solid var(--color-border)", padding: "1.5rem", marginBottom: "2rem" }}>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "1.5rem" }}>Create a new Cohort</h2>
          <CreateCohortForm onCreated={() => { setShowCreate(false); reload(); }} />
        </div>
      )}

      <div style={{ background: "var(--color-surface)", borderRadius: "12px", border: "1px solid var(--color-border)", padding: "1.5rem" }}>
        {error && <ErrorState message={error} onRetry={reload} />}
        {!error && cohorts === null && <LoadingState message="Loading cohorts..." />}
        {!error && cohorts !== null && (
          <Table
            columns={[
              {
                key: "name",
                header: "Cohort Name",
                render: (row) => <Link href={`${basePath}/cohorts/${row.id}`} style={{ fontWeight: 600, color: "var(--color-primary)" }}>{row.name}</Link>,
              },
              { key: "code", header: "Code" },
              { key: "start_date", header: "Start Date" },
              { key: "status", header: "Status", render: (row) => <Badge status={row.status}>{row.status}</Badge> },
              {
                key: "actions",
                header: "",
                render: (row) => (
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", alignItems: "center" }}>
                    <Link href={`${basePath}/cohorts/${row.id}`}>
                      <Button variant="secondary" style={{ padding: "0.45rem 0.85rem", fontSize: "0.85rem", display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                        <Icon name="settings" size={16} />
                        Settings & Students
                      </Button>
                    </Link>
                    {isAdmin && (
                      <button
                        onClick={() => setCohortToDelete(row)}
                        title="Delete Cohort"
                        style={{
                          background: "rgba(239, 68, 68, 0.08)",
                          border: "1px solid rgba(239, 68, 68, 0.2)",
                          color: "#dc2626",
                          padding: "0.45rem 0.65rem",
                          borderRadius: "8px",
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.25rem",
                          fontSize: "0.8rem",
                          transition: "all 0.2s",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "#dc2626";
                          e.currentTarget.style.color = "#ffffff";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "rgba(239, 68, 68, 0.08)";
                          e.currentTarget.style.color = "#dc2626";
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: "1rem" }}>
                          delete
                        </span>
                        Delete
                      </button>
                    )}
                  </div>
                )
              }
            ]}
            rows={cohorts}
            getRowKey={(row) => row.id}
            emptyMessage="No cohorts yet."
          />
        )}
      </div>

      {cohortToDelete && (
        <DeleteConfirmationModal
          open={!!cohortToDelete}
          onClose={() => setCohortToDelete(null)}
          onConfirm={handleDeleteCohort}
          itemName={cohortToDelete.name}
          itemType="Cohort"
          itemDetails={`Code: ${cohortToDelete.code}`}
          warningText="This action will permanently delete this cohort and unassign all enrolled learners from this class. This action cannot be undone."
        />
      )}
    </div>
  );
}

export default function CohortsPage() {
  return (
    <RequireAuth allowedRoles={[...PROGRAM_COHORT_ADMIN_ROLES, ...INSTRUCTOR_ROLES]}>
      <CohortsContent />
    </RequireAuth>
  );
}
