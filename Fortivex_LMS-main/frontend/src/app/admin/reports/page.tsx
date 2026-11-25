"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PROGRAM_COHORT_ADMIN_ROLES } from "@/lib/auth/roles";
import { useAuth } from "@/lib/auth/AuthContext";
import { apiRequest } from "@/lib/api/client";
import { Program, Cohort, Enrollment, Student, AssignmentItem, User } from "@/lib/api/types";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Table } from "@/components/ui/Table";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import Link from "next/link";

function ReportsContent() {
  const { token, organization } = useAuth();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (isRefresh = false) => {
    if (!token) return;
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      const [progs, cohs, enrolls, studs, asgs, usrs] = await Promise.all([
        apiRequest<Program[]>("/api/v1/programs?limit=250", { token }).catch(() => []),
        apiRequest<Cohort[]>("/api/v1/cohorts?limit=250", { token }).catch(() => []),
        apiRequest<Enrollment[]>("/api/v1/enrollments?limit=500", { token }).catch(() => []),
        apiRequest<Student[]>("/api/v1/students?limit=500", { token }).catch(() => []),
        apiRequest<AssignmentItem[]>("/api/v1/assignments?limit=250", { token }).catch(() => []),
        apiRequest<User[]>("/api/v1/users?limit=500", { token }).catch(() => [])
      ]);
      setPrograms(progs);
      setCohorts(cohs);
      setEnrollments(enrolls);
      setStudents(studs);
      setAssignments(asgs);
      setUsers(usrs);
    } catch (err: any) {
      setError(err?.message || "Failed to load report analytics");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Lookup maps for fast joining
  const userById = useMemo(() => new Map(users.map(u => [u.id, u])), [users]);
  const studentById = useMemo(() => new Map(students.map(s => [s.id, s])), [students]);
  const programById = useMemo(() => new Map(programs.map(p => [p.id, p])), [programs]);
  const cohortById = useMemo(() => new Map(cohorts.map(c => [c.id, c])), [cohorts]);

  // Derived metrics
  const totalStudents = students.length;
  const activeEnrollments = enrollments.filter(e => e.status === "ENROLLED" || e.status === "ACTIVE").length;
  const activeProgramsCount = programs.filter(p => !p.status || p.status === "ACTIVE").length;
  const activeCohortsCount = cohorts.filter(c => c.status === "ACTIVE").length;
  const totalAssignments = assignments.length;
  const totalSubmissions = assignments.reduce((acc, a) => acc + (a.submissions_count || 0), 0);
  const pendingGrading = assignments.reduce((acc, a) => acc + (a.pending_count || 0), 0);

  // Program Breakdown Data
  const programMetrics = useMemo(() => {
    return programs.map(p => {
      const progCohorts = cohorts.filter(c => c.program_ids?.includes(p.id));
      const progCohortIds = new Set(progCohorts.map(c => c.id));
      const progEnrollments = enrollments.filter(
        e => e.program_id === p.id || (e.cohort_id != null && progCohortIds.has(e.cohort_id))
      );
      return {
        id: p.id,
        name: p.name,
        code: p.code,
        cohortsCount: progCohorts.length,
        studentsCount: progEnrollments.length,
        status: p.status || "ACTIVE"
      };
    });
  }, [programs, cohorts, enrollments]);

  // Cohort Distribution Data
  const cohortMetrics = useMemo(() => {
    return cohorts.map(c => {
      const cohortEnrollments = enrollments.filter(e => e.cohort_id === c.id);
      return {
        id: c.id,
        name: c.name,
        code: c.code,
        studentCount: cohortEnrollments.length,
        startDate: c.start_date,
        status: c.status
      };
    });
  }, [cohorts, enrollments]);

  // Detailed Enrollment Table Data
  const enrollmentRows = useMemo(() => {
    return enrollments.map(e => {
      const student = studentById.get(e.student_id);
      const user = student ? userById.get(student.user_id) : undefined;
      const prog = e.program || programById.get(e.program_id);
      const coh = e.cohort || (e.cohort_id ? cohortById.get(e.cohort_id) : null);

      return {
        id: e.id,
        studentId: e.student_id,
        studentName: user?.full_name || (student ? `Student ${student.student_code}` : `Student #${e.student_id}`),
        studentEmail: user?.email || "—",
        studentCode: student?.student_code || `STU-${e.student_id}`,
        programName: prog?.name || `Program #${e.program_id}`,
        programCode: prog?.code || "—",
        cohortId: e.cohort_id,
        cohortName: coh?.name || "Direct Program Enrollment",
        cohortCode: coh?.code || "—",
        status: e.status || "ENROLLED",
        createdAt: e.created_at || null
      };
    });
  }, [enrollments, studentById, userById, programById, cohortById]);

  // Filtered enrollments based on search query
  const filteredEnrollments = useMemo(() => {
    if (!searchQuery.trim()) return enrollmentRows;
    const q = searchQuery.toLowerCase();
    return enrollmentRows.filter(r =>
      r.studentName.toLowerCase().includes(q) ||
      r.studentEmail.toLowerCase().includes(q) ||
      r.studentCode.toLowerCase().includes(q) ||
      r.programName.toLowerCase().includes(q) ||
      r.cohortName.toLowerCase().includes(q) ||
      r.status.toLowerCase().includes(q)
    );
  }, [enrollmentRows, searchQuery]);

  const handleExportCSV = () => {
    if (enrollments.length === 0 && students.length === 0) return;

    const escapeCsv = (val: any) => `"${String(val ?? "").replace(/"/g, '""')}"`;

    const headers = [
      "Enrollment ID",
      "Student Name",
      "Student Email",
      "Student Code",
      "Program Name",
      "Program Code",
      "Cohort Name",
      "Cohort Code",
      "Status",
      "Enrolled Date"
    ];

    const rows = enrollmentRows.map(row => [
      escapeCsv(row.id),
      escapeCsv(row.studentName),
      escapeCsv(row.studentEmail),
      escapeCsv(row.studentCode),
      escapeCsv(row.programName),
      escapeCsv(row.programCode),
      escapeCsv(row.cohortName),
      escapeCsv(row.cohortCode),
      escapeCsv(row.status),
      escapeCsv(row.createdAt ? new Date(row.createdAt).toLocaleDateString() : "N/A")
    ]);

    const csvContent = [headers.map(escapeCsv).join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Academic_Enrollments_Report_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loading) return <LoadingState message="Generating institutional report..." />;
  if (error) return <ErrorState message={error} onRetry={() => loadData()} />;

  const maxStudents = Math.max(...programMetrics.map(m => m.studentsCount), 1);

  return (
    <div style={{ maxWidth: "1300px", margin: "0 auto", animation: "fadeIn 0.35s ease-out" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "2rem", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 style={{ fontSize: "2rem", fontWeight: 800, color: "var(--text-main)", letterSpacing: "-0.02em" }}>
            Academic Reports & Analytics
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.95rem", marginTop: "0.25rem" }}>
            Real-time enrollment health, cohort capacity, and curriculum evaluation metrics for {organization?.name || "the institution"}.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          <Button
            variant="secondary"
            onClick={() => loadData(true)}
            disabled={refreshing}
            style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
          >
            <span
              className="material-symbols-outlined"
              style={{
                fontSize: "1.2rem",
                animation: refreshing ? "spin 1s linear infinite" : undefined
              }}
            >
              refresh
            </span>
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>
          <Button onClick={handleExportCSV} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "1.2rem" }}>download</span>
            Export Enrollments CSV
          </Button>
        </div>
      </div>

      {/* KPI Metrics */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1.25rem", marginBottom: "2.5rem" }}>
        <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "16px", padding: "1.5rem", boxShadow: "var(--shadow-sm)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-muted)" }}>Total Students</span>
            <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "rgba(79, 70, 229, 0.1)", color: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "1.3rem" }}>school</span>
            </div>
          </div>
          <div style={{ fontSize: "2.25rem", fontWeight: 800, color: "var(--foreground)" }}>{totalStudents}</div>
          <div style={{ fontSize: "0.8rem", color: "#10b981", marginTop: "0.25rem", display: "flex", alignItems: "center", gap: "0.25rem" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "1rem" }}>check_circle</span>
            {activeEnrollments} Active Enrollments
          </div>
        </div>

        <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "16px", padding: "1.5rem", boxShadow: "var(--shadow-sm)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-muted)" }}>Active Programs</span>
            <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "rgba(14, 165, 233, 0.1)", color: "#0ea5e9", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "1.3rem" }}>menu_book</span>
            </div>
          </div>
          <div style={{ fontSize: "2.25rem", fontWeight: 800, color: "var(--foreground)" }}>{activeProgramsCount}</div>
          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
            {programs.length} Total Curricula
          </div>
        </div>

        <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "16px", padding: "1.5rem", boxShadow: "var(--shadow-sm)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-muted)" }}>Active Cohorts</span>
            <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "rgba(16, 185, 129, 0.1)", color: "#10b981", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "1.3rem" }}>groups</span>
            </div>
          </div>
          <div style={{ fontSize: "2.25rem", fontWeight: 800, color: "var(--foreground)" }}>{activeCohortsCount}</div>
          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
            {cohorts.length} Total Registered Classes
          </div>
        </div>

        <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "16px", padding: "1.5rem", boxShadow: "var(--shadow-sm)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-muted)" }}>Assignments & Tasks</span>
            <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "rgba(245, 158, 11, 0.1)", color: "#f59e0b", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "1.3rem" }}>assignment</span>
            </div>
          </div>
          <div style={{ fontSize: "2.25rem", fontWeight: 800, color: "var(--foreground)" }}>{totalAssignments}</div>
          <div style={{ fontSize: "0.8rem", color: pendingGrading > 0 ? "#f59e0b" : "var(--text-muted)", marginTop: "0.25rem" }}>
            {totalSubmissions} submissions {pendingGrading > 0 ? `(${pendingGrading} pending grading)` : "evaluated"}
          </div>
        </div>
      </div>

      {/* Program Enrollment Distribution */}
      <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "16px", padding: "2rem", marginBottom: "2.5rem" }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.5rem" }}>
          Curriculum & Program Enrollment Distribution
        </h2>
        <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "1.5rem" }}>
          Breakdown of enrolled learners and active classes per academic program.
        </p>

        {programMetrics.length === 0 ? (
          <div style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>No programs available.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {programMetrics.map(p => {
              const percent = p.studentsCount > 0 ? Math.max(Math.round((p.studentsCount / maxStudents) * 100), 8) : 0;
              return (
                <div key={p.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <Link href={`/admin/programs/${p.id}`} style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--foreground)", textDecoration: "none" }}>
                        {p.name}
                      </Link>
                      <span style={{ fontSize: "0.75rem", padding: "2px 8px", background: "rgba(0,0,0,0.05)", borderRadius: "10px", color: "var(--text-muted)" }}>{p.code}</span>
                    </div>
                    <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                      <strong>{p.studentsCount}</strong> Students • <strong>{p.cohortsCount}</strong> Cohorts
                    </div>
                  </div>
                  <div style={{ width: "100%", height: "10px", background: "var(--color-border)", borderRadius: "6px", overflow: "hidden" }}>
                    <div
                      style={{
                        width: `${percent}%`,
                        height: "100%",
                        background: "var(--primary-gradient)",
                        borderRadius: "6px",
                        transition: "width 0.6s ease"
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Cohort Status Table */}
      <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "16px", padding: "2rem", marginBottom: "2.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700 }}>Cohort Roster & Capacity</h2>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Active class enrollments and commencement schedules.</p>
          </div>
          <Link href="/admin/cohorts">
            <Button variant="secondary" style={{ fontSize: "0.85rem" }}>Manage Cohorts</Button>
          </Link>
        </div>

        <Table
          columns={[
            {
              key: "name",
              header: "Cohort Name",
              render: (row) => (
                <div>
                  <div style={{ fontWeight: 600 }}>{row.name}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{row.code}</div>
                </div>
              )
            },
            {
              key: "startDate",
              header: "Start Date",
              render: (row) => {
                if (!row.startDate) return <span style={{ fontSize: "0.9rem", color: "var(--text-muted)" }}>Flexible</span>;
                try {
                  const d = new Date(row.startDate);
                  if (isNaN(d.getTime())) return <span style={{ fontSize: "0.9rem" }}>{row.startDate}</span>;
                  return <span style={{ fontSize: "0.9rem" }}>{d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}</span>;
                } catch {
                  return <span style={{ fontSize: "0.9rem" }}>{row.startDate}</span>;
                }
              }
            },
            {
              key: "studentCount",
              header: "Enrolled Learners",
              render: (row) => (
                <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--primary)" }}>
                  {row.studentCount} students
                </span>
              )
            },
            {
              key: "status",
              header: "Status",
              render: (row) => <Badge status={row.status}>{row.status}</Badge>
            },
            {
              key: "actions",
              header: "",
              render: (row) => (
                <div style={{ textAlign: "right" }}>
                  <Link href={`/admin/cohorts/${row.id}`}>
                    <Button variant="secondary" style={{ padding: "0.3rem 0.75rem", fontSize: "0.8rem" }}>
                      View Roster
                    </Button>
                  </Link>
                </div>
              )
            }
          ]}
          rows={cohortMetrics}
          getRowKey={(row) => row.id}
          emptyMessage="No cohorts registered yet."
        />
      </div>

      {/* Detailed Student Enrollments Roster */}
      <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "16px", padding: "2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700 }}>Student Enrollment Records</h2>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
              All registered student enrollments, curriculum assignments, and current standing ({filteredEnrollments.length} total).
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div style={{ position: "relative" }}>
              <span
                className="material-symbols-outlined"
                style={{
                  position: "absolute",
                  left: "0.75rem",
                  top: "50%",
                  transform: "translateY(-50%)",
                  fontSize: "1.1rem",
                  color: "var(--text-muted)"
                }}
              >
                search
              </span>
              <input
                type="text"
                placeholder="Filter learners or programs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  padding: "0.5rem 0.75rem 0.5rem 2.25rem",
                  borderRadius: "8px",
                  border: "1px solid var(--color-border)",
                  background: "var(--color-surface)",
                  color: "var(--foreground)",
                  fontSize: "0.85rem",
                  minWidth: "240px",
                  outline: "none"
                }}
              />
            </div>
            {searchQuery && (
              <Button variant="secondary" onClick={() => setSearchQuery("")} style={{ padding: "0.5rem 0.75rem", fontSize: "0.8rem" }}>
                Clear
              </Button>
            )}
          </div>
        </div>

        <Table
          columns={[
            {
              key: "studentName",
              header: "Learner",
              render: (row) => (
                <div>
                  <div style={{ fontWeight: 600, color: "var(--foreground)" }}>{row.studentName}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{row.studentEmail}</div>
                </div>
              )
            },
            {
              key: "studentCode",
              header: "Student ID",
              render: (row) => (
                <span style={{ fontSize: "0.8rem", fontFamily: "monospace", padding: "2px 6px", background: "rgba(0,0,0,0.04)", borderRadius: "4px" }}>
                  {row.studentCode}
                </span>
              )
            },
            {
              key: "programName",
              header: "Enrolled Program",
              render: (row) => (
                <div>
                  <div style={{ fontWeight: 500 }}>{row.programName}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{row.programCode}</div>
                </div>
              )
            },
            {
              key: "cohortName",
              header: "Cohort / Class",
              render: (row) => (
                <div>
                  <div style={{ fontWeight: 500 }}>{row.cohortName}</div>
                  {row.cohortCode !== "—" && (
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{row.cohortCode}</div>
                  )}
                </div>
              )
            },
            {
              key: "status",
              header: "Status",
              render: (row) => <Badge status={row.status}>{row.status}</Badge>
            },
            {
              key: "createdAt",
              header: "Enrolled On",
              render: (row) => {
                if (!row.createdAt) return <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>—</span>;
                try {
                  const d = new Date(row.createdAt);
                  return <span style={{ fontSize: "0.85rem" }}>{d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}</span>;
                } catch {
                  return <span style={{ fontSize: "0.85rem" }}>{row.createdAt}</span>;
                }
              }
            }
          ]}
          rows={filteredEnrollments}
          getRowKey={(row) => row.id}
          emptyMessage={searchQuery ? "No matching enrollments found." : "No student enrollments registered yet."}
        />
      </div>
    </div>
  );
}

export default function ReportsPage() {
  return (
    <RequireAuth allowedRoles={PROGRAM_COHORT_ADMIN_ROLES}>
      <ReportsContent />
    </RequireAuth>
  );
}
