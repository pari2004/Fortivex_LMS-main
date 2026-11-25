"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PROGRAM_COHORT_ADMIN_ROLES, INSTRUCTOR_ROLES } from "@/lib/auth/roles";
import { Card } from "@/components/ui/Card";
import { Form } from "@/components/ui/Form";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Badge } from "@/components/ui/Badge";
import { Table } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Icon } from "@/components/ui/Icon";
import { useAuth } from "@/lib/auth/AuthContext";
import { usePrograms } from "@/lib/api/usePrograms";
import { createProgram, deleteProgram } from "@/lib/api/endpoints";
import { ApiError } from "@/lib/api/client";
import { DeleteConfirmationModal } from "@/components/ui/DeleteConfirmationModal";
import type { Program } from "@/lib/api/types";
import styles from "../../placeholder.module.css";

function CreateProgramForm({ organizationId, onCreated, onCancel }: { organizationId: number; onCreated: () => void; onCancel: () => void }) {
  const { token } = useAuth();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!token) return;
    setError(null);
    setSubmitting(true);
    try {
      await createProgram(token, { organization_id: organizationId, name, code, description: description || undefined });
      setName("");
      setCode("");
      setDescription("");
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to create program.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Form onSubmit={handleSubmit}>
      <Input id="program-name" label="Program name" required value={name} onChange={(e) => setName(e.target.value)} />
      <Input id="program-code" label="Code" required value={code} onChange={(e) => setCode(e.target.value)} />
      <Input
        id="program-description"
        label="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      {error && <ErrorState message={error} />}
      <div style={{ display: "flex", gap: "1rem", justifyContent: "flex-end", marginTop: "1rem" }}>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting} style={{ background: "transparent", color: "var(--foreground)", border: "1px solid var(--color-border)", boxShadow: "none" }}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Creating…" : "Create program"}
        </Button>
      </div>
    </Form>
  );
}

function ProgramsContent() {
  const { token, organization, user } = useAuth();
  const { programs, error, reload } = usePrograms(organization?.id);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [programToDelete, setProgramToDelete] = useState<Program | null>(null);

  const isAdmin = user?.roles.some((r) => PROGRAM_COHORT_ADMIN_ROLES.includes(r));
  const basePath = isAdmin ? "/admin" : "/instructor";

  const handleCreated = () => {
    setIsModalOpen(false);
    reload();
  };

  const handleDeleteProgram = async () => {
    if (!token || !programToDelete) return;
    await deleteProgram(token, programToDelete.id);
    setProgramToDelete(null);
    reload();
  };

  return (
    <div className={styles.wrapper}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "2rem" }}>
        <div>
          <h1 className={styles.title} style={{ marginBottom: "0.25rem" }}>Programs</h1>
          <p className={styles.subtitle} style={{ marginBottom: 0 }}>
            {organization ? `Programs offered by ${organization.name}.` : "Loading organization…"}
          </p>
        </div>
        {organization && isAdmin && (
          <Button onClick={() => setIsModalOpen(true)} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Icon name="add" size={18} color="#ffffff" />
            Create Program
          </Button>
        )}
      </div>

      <Card>
        {error && <ErrorState message={error} onRetry={reload} />}
        {!error && programs === null && <LoadingState message="Loading programs…" />}
        {!error && programs !== null && (
          <Table
            columns={[
              {
                key: "name",
                header: "Name",
                render: (row) => <Link href={`${basePath}/programs/${row.id}`} style={{ fontWeight: 600, color: "var(--color-primary)", textDecoration: "none" }}>{row.name}</Link>,
              },
              { key: "code", header: "Code" },
              { key: "status", header: "Status", render: (row) => <Badge status={row.status}>{row.status}</Badge> },
              {
                key: "actions",
                header: "",
                render: (row) => (
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", alignItems: "center" }}>
                    <Link href={`${basePath}/programs/${row.id}`}>
                      <Button variant="secondary" style={{ padding: "0.45rem 0.85rem", fontSize: "0.85rem", display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                        <Icon name="settings" size={16} />
                        Settings
                      </Button>
                    </Link>
                    {isAdmin && (
                      <button
                        onClick={() => setProgramToDelete(row)}
                        title="Delete Program"
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
            rows={programs}
            getRowKey={(row) => row.id}
            emptyMessage="No programs yet."
          />
        )}
      </Card>

      {organization && (
        <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create a New Program">
          <CreateProgramForm 
            organizationId={organization.id} 
            onCreated={handleCreated} 
            onCancel={() => setIsModalOpen(false)} 
          />
        </Modal>
      )}

      {programToDelete && (
        <DeleteConfirmationModal
          open={!!programToDelete}
          onClose={() => setProgramToDelete(null)}
          onConfirm={handleDeleteProgram}
          itemName={programToDelete.name}
          itemType="Program"
          itemDetails={`Code: ${programToDelete.code}`}
          warningText="This action will permanently delete this curriculum program, its modules, lessons, activities, and enrollment history. This action cannot be undone."
        />
      )}
    </div>
  );
}

export default function ProgramsPage() {
  return (
    <RequireAuth allowedRoles={[...PROGRAM_COHORT_ADMIN_ROLES, ...INSTRUCTOR_ROLES]}>
      <ProgramsContent />
    </RequireAuth>
  );
}
