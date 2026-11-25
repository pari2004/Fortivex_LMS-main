"use client";

import { useState, useEffect } from "react";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { useAuth } from "@/lib/auth/AuthContext";
import { apiRequest } from "@/lib/api/client";
import { LoadingState } from "@/components/ui/LoadingState";
import Link from "next/link";

interface ProgramProgressItem {
  enrollment_id: number;
  program_id: number;
  program_name: string;
  cohort_name: string;
  status: string;
  progress_percentage: number;
}

export default function CertificatesPage() {
  const { user, token, organization } = useAuth();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [programs, setPrograms] = useState<ProgramProgressItem[]>([]);
  const [selectedCertIndex, setSelectedCertIndex] = useState(0);

  useEffect(() => {
    if (!token) return;
    apiRequest<{ programs: ProgramProgressItem[] }>("/api/v1/students/me/dashboard", { token })
      .then((data) => {
        setPrograms(data.programs || []);
      })
      .catch(() => {
        setPrograms([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [token]);

  const completedPrograms = programs.filter((p) => p.progress_percentage >= 100);
  const inProgressPrograms = programs.filter((p) => p.progress_percentage < 100);

  function handleCopyLink(certId: string) {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    navigator.clipboard.writeText(`${origin}/credentials/${certId}`);
    setCopiedId(certId);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function handleDownloadPDF() {
    setDownloading(true);
    setTimeout(() => {
      window.print();
      setDownloading(false);
    }, 600);
  }

  if (loading) {
    return <LoadingState message="Loading your verified credentials..." />;
  }

  return (
    <RequireAuth>
      <div style={{ maxWidth: "1100px", margin: "0 auto", animation: "fadeIn 0.35s ease-out" }}>
        {/* Header & Actions */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "2rem",
            flexWrap: "wrap",
            gap: "1rem",
          }}
        >
          <div>
            <h1 style={{ fontSize: "2rem", fontWeight: 800, color: "var(--text-main)", letterSpacing: "-0.02em" }}>
              Verified Certificates & Transcripts
            </h1>
            <p style={{ color: "var(--text-muted)", fontSize: "0.95rem", marginTop: "0.25rem" }}>
              Cryptographically verified credentials issued upon accredited program completion.
            </p>
          </div>
        </div>

        {/* If no programs are 100% complete yet */}
        {completedPrograms.length === 0 ? (
          <div
            style={{
              background: "var(--color-surface)",
              borderRadius: "16px",
              border: "1px solid var(--color-border)",
              padding: "3.5rem 2rem",
              textAlign: "center",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <div
              style={{
                width: "72px",
                height: "72px",
                borderRadius: "50%",
                background: "rgba(79, 70, 229, 0.1)",
                color: "var(--primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 1.5rem auto",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "2.5rem" }}>
                workspace_premium
              </span>
            </div>

            <h2 style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: "0.75rem", color: "var(--text-main)" }}>
              No Issued Certificates Yet
            </h2>
            <p style={{ color: "var(--text-muted)", maxWidth: "550px", margin: "0 auto 2rem auto", lineHeight: 1.6 }}>
              Certificates are automatically issued when all lessons, activities, quizzes, and assignments in your
              enrolled program reach 100% completion.
            </p>

            {inProgressPrograms.length > 0 && (
              <div style={{ maxWidth: "600px", margin: "0 auto", textAlign: "left" }}>
                <h3 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "1rem", color: "var(--text-main)" }}>
                  Programs in Progress:
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  {inProgressPrograms.map((p) => (
                    <div
                      key={p.program_id}
                      style={{
                        padding: "1.25rem",
                        background: "var(--background)",
                        borderRadius: "12px",
                        border: "1px solid var(--color-border)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: "0.5rem",
                        }}
                      >
                        <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>{p.program_name}</span>
                        <span style={{ fontWeight: 800, color: "var(--primary)", fontSize: "0.9rem" }}>
                          {p.progress_percentage}%
                        </span>
                      </div>
                      <div
                        style={{
                          width: "100%",
                          height: "8px",
                          background: "var(--color-border)",
                          borderRadius: "4px",
                          overflow: "hidden",
                          marginBottom: "0.75rem",
                        }}
                      >
                        <div
                          style={{
                            width: `${p.progress_percentage}%`,
                            height: "100%",
                            background: "var(--primary-gradient)",
                            borderRadius: "4px",
                            transition: "width 0.4s ease",
                          }}
                        />
                      </div>
                      <div style={{ display: "flex", justifyContent: "flex-end" }}>
                        <Link
                          href={`/student/programs/${p.program_id}`}
                          className="btn-primary"
                          style={{ padding: "0.4rem 1rem", fontSize: "0.85rem" }}
                        >
                          Continue Learning
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div>
            {/* Multiple Completed Programs Selector */}
            {completedPrograms.length > 1 && (
              <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem" }}>
                {completedPrograms.map((p, idx) => (
                  <button
                    key={p.program_id}
                    onClick={() => setSelectedCertIndex(idx)}
                    className={`btn-secondary ${selectedCertIndex === idx ? "btn-primary" : ""}`}
                    style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }}
                  >
                    {p.program_name}
                  </button>
                ))}
              </div>
            )}

            {(() => {
              const activeProg = completedPrograms[selectedCertIndex] || completedPrograms[0];
              const certId = `FX-${activeProg.program_id}-${user?.id}-${new Date().getFullYear()}`;
              const institution = organization?.name || "Fortivex Academy";
              const studentName = user?.full_name || "Enrolled Student";

              return (
                <div>
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginBottom: "1.5rem" }}>
                    <button
                      onClick={() => handleCopyLink(certId)}
                      className="btn-secondary"
                      style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "1.2rem" }}>
                        {copiedId === certId ? "check" : "share"}
                      </span>
                      {copiedId === certId ? "Link Copied!" : "Share Credential"}
                    </button>
                    <button
                      onClick={handleDownloadPDF}
                      className="btn-primary"
                      disabled={downloading}
                      style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "1.2rem" }}>
                        download
                      </span>
                      {downloading ? "Preparing..." : "Download PDF"}
                    </button>
                  </div>

                  {/* Certificate Canvas */}
                  <div
                    id="certificate-print-area"
                    style={{
                      background: "#ffffff",
                      borderRadius: "16px",
                      border: "12px solid #0f172a",
                      padding: "4rem 4.5rem",
                      boxShadow: "0 20px 50px rgba(0, 0, 0, 0.12)",
                      position: "relative",
                      color: "#0f172a",
                      fontFamily: "var(--font-sans), sans-serif",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        top: "16px",
                        left: "16px",
                        right: "16px",
                        bottom: "16px",
                        border: "2px solid #cbd5e1",
                        pointerEvents: "none",
                      }}
                    />

                    {/* Top Org & Badge */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "3rem" }}>
                      <div>
                        <span
                          style={{
                            fontSize: "1.4rem",
                            fontWeight: 900,
                            letterSpacing: "2px",
                            textTransform: "uppercase",
                            color: "var(--primary)",
                          }}
                        >
                          {institution}
                        </span>
                        <div style={{ fontSize: "0.75rem", color: "#64748b", letterSpacing: "1px" }}>
                          ACADEMIC & PROFESSIONAL CREDENTIALS
                        </div>
                      </div>

                      <div
                        style={{
                          width: "60px",
                          height: "60px",
                          borderRadius: "50%",
                          background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#ffffff",
                          boxShadow: "0 4px 12px rgba(217, 119, 6, 0.35)",
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: "2rem" }}>
                          verified
                        </span>
                      </div>
                    </div>

                    {/* Certificate Body */}
                    <div style={{ textAlign: "center", marginBottom: "3.5rem" }}>
                      <p
                        style={{
                          fontSize: "0.95rem",
                          fontWeight: 700,
                          letterSpacing: "3px",
                          textTransform: "uppercase",
                          color: "#64748b",
                          marginBottom: "1rem",
                        }}
                      >
                        Certificate of Completion
                      </p>

                      <p style={{ fontSize: "1.1rem", color: "#475569", margin: "0 auto 1.5rem auto" }}>
                        This is to certify that
                      </p>

                      <h2
                        style={{
                          fontSize: "2.8rem",
                          fontWeight: 900,
                          color: "#0f172a",
                          letterSpacing: "-0.03em",
                          margin: "0 auto 1.5rem auto",
                          borderBottom: "2px solid #e2e8f0",
                          paddingBottom: "0.5rem",
                          display: "inline-block",
                        }}
                      >
                        {studentName}
                      </h2>

                      <p style={{ fontSize: "1.1rem", color: "#475569", margin: "0 auto 1rem auto" }}>
                        has successfully completed all requirements and competencies for
                      </p>

                      <h3
                        style={{
                          fontSize: "1.75rem",
                          fontWeight: 800,
                          color: "var(--primary)",
                          letterSpacing: "-0.01em",
                          marginBottom: "1rem",
                        }}
                      >
                        {activeProg.program_name}
                      </h3>

                      <p style={{ fontSize: "0.95rem", color: "#64748b", maxWidth: "650px", margin: "0 auto", lineHeight: 1.6 }}>
                        Verified completion of all core lectures, practical coding modules, evaluated assignments, and
                        knowledge milestones.
                      </p>
                    </div>

                    {/* Footer Credentials */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-end",
                        borderTop: "1px solid #e2e8f0",
                        paddingTop: "2rem",
                        fontSize: "0.85rem",
                        color: "#64748b",
                      }}
                    >
                      <div>
                        <div><strong>Credential ID:</strong> {certId}</div>
                        <div><strong>Issue Date:</strong> {new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}</div>
                      </div>

                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontWeight: 800, color: "#0f172a", fontSize: "0.95rem" }}>Academic Director</div>
                        <div>{institution} Board of Evaluation</div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </RequireAuth>
  );
}
