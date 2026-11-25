"use client";

import { RequireAuth } from "@/components/auth/RequireAuth";
import { Card } from "@/components/ui/Card";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Badge } from "@/components/ui/Badge";
import { Table } from "@/components/ui/Table";
import { useAuth } from "@/lib/auth/AuthContext";
import { useEnrollments } from "@/lib/api/useEnrollments";
import styles from "../placeholder.module.css";

function DashboardContent() {
  const { user, organization } = useAuth();
  const { enrollments, error } = useEnrollments();

  return (
    <div className={styles.wrapper}>
      <h1 className={styles.title}>Dashboard</h1>
      <p className={styles.subtitle}>
        Welcome{user ? `, ${user.full_name}` : ""}
        {organization ? ` — ${organization.name}` : ""}.
      </p>

      <Card>
        <h2 style={{ fontSize: "1rem", marginBottom: "0.75rem" }}>Your enrollments</h2>
        {error && <ErrorState message={error} onRetry={() => window.location.reload()} />}
        {!error && enrollments === null && <LoadingState message="Loading enrollments…" />}
        {!error && enrollments !== null && (
          <Table
            columns={[
              { key: "program_id", header: "Program", render: (row) => row.program.name },
              { key: "cohort_id", header: "Cohort", render: (row) => row.cohort?.name ?? "Not yet assigned" },
              { key: "status", header: "Status", render: (row) => <Badge status={row.status}>{row.status}</Badge> },
            ]}
            rows={enrollments}
            getRowKey={(row) => row.id}
            emptyMessage="No enrollments yet."
          />
        )}
      </Card>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <RequireAuth>
      <DashboardContent />
    </RequireAuth>
  );
}
