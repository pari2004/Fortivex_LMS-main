"use client";

import { FormEvent, useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { ApiError } from "@/lib/api/client";
import { ROLE_REDIRECTS } from "@/lib/auth/roles";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const prefillEmail = searchParams?.get("email");
    if (prefillEmail) {
      setEmail(prefillEmail);
    }
  }, [searchParams]);

  const demoAccounts = [
    { label: "Empowers Admin", email: "admin@empowers.com", role: "Admin", org: "Empowers Academy", color: "#4f46e5" },
    { label: "Empowers Student", email: "student@empowers.com", role: "Student", org: "Empowers Academy", color: "#0ea5e9" },
    { label: "Medivex Admin", email: "admin@medivex.com", role: "Admin", org: "Medivex AI", color: "#10b981" },
    { label: "Medivex Student", email: "student@medivex.com", role: "Student", org: "Medivex AI", color: "#8b5cf6" },
  ];

  function fillDemo(demoEmail: string, role: string) {
    setEmail(demoEmail);
    setPassword(role === "Admin" ? "admin123" : "student123");
    setError(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const me = await login(email, password);
      if (me?.must_change_password) {
        router.push("/change-password");
        return;
      }
      const primaryRole = me?.roles?.[0];
      const destination = primaryRole ? ROLE_REDIRECTS[primaryRole] || "/student" : "/student";
      router.push(destination);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to authenticate. Check server connection.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-container">
      {/* Left Column: Visual Showcase (desktop only) */}
      <div className="login-left-col">
        {/* Ambient Glow Orbs */}
        <div
          style={{
            position: "absolute",
            top: "15%",
            right: "10%",
            width: "350px",
            height: "350px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(124, 58, 237, 0.3) 0%, transparent 70%)",
            filter: "blur(40px)",
            pointerEvents: "none",
          }}
        />

        {/* Top Brand Logo */}
        <div style={{ position: "relative", zIndex: 2, display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "12px",
              background: "var(--primary-gradient)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
              boxShadow: "0 0 20px rgba(99, 102, 241, 0.5)",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "26px" }}>
              auto_stories
            </span>
          </div>
          <div>
            <div style={{ fontSize: "1.4rem", fontWeight: 800, letterSpacing: "-0.02em" }}>
              Fortivex <span style={{ color: "#818cf8" }}>LMS</span>
            </div>
            <div style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 500 }}>
              Enterprise Dual-Tenant Learning Architecture
            </div>
          </div>
        </div>

        {/* Hero Narrative */}
        <div style={{ position: "relative", zIndex: 2, maxWidth: "580px", margin: "2rem 0" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.35rem 0.85rem",
              borderRadius: "999px",
              background: "rgba(255, 255, 255, 0.08)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              fontSize: "0.8rem",
              fontWeight: 600,
              color: "#38bdf8",
              marginBottom: "1.5rem",
            }}
          >
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#38bdf8" }} />
            Unified Tech & Healthcare Academies
          </div>

          <h1
            style={{
              fontSize: "3.2rem",
              fontWeight: 800,
              lineHeight: 1.15,
              letterSpacing: "-0.03em",
              marginBottom: "1.5rem",
              background: "linear-gradient(135deg, #ffffff 0%, #cbd5e1 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Elevate Learning with Precision & Elegance.
          </h1>

          <p style={{ fontSize: "1.1rem", color: "#94a3b8", lineHeight: 1.6, marginBottom: "2.5rem" }}>
            Experience seamless curriculum delivery, interactive assessments, live collaborative
            cohorts, and organization-scoped governance across Empowers Academy and Medivex AI.
          </p>

          {/* Floating Metric Badges */}
          <div style={{ display: "flex", gap: "1.25rem", flexWrap: "wrap" }}>
            <div
              style={{
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "14px",
                padding: "1rem 1.25rem",
                backdropFilter: "blur(10px)",
                minWidth: "140px",
              }}
            >
              <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#ffffff" }}>2 Orgs</div>
              <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>1 Central Database</div>
            </div>
            <div
              style={{
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "14px",
                padding: "1rem 1.25rem",
                backdropFilter: "blur(10px)",
                minWidth: "140px",
              }}
            >
              <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#34d399" }}>100%</div>
              <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>RBAC Isolation</div>
            </div>
            <div
              style={{
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "14px",
                padding: "1rem 1.25rem",
                backdropFilter: "blur(10px)",
                minWidth: "140px",
              }}
            >
              <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#38bdf8" }}>HD Live</div>
              <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Interactive Sessions</div>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div style={{ position: "relative", zIndex: 2, fontSize: "0.8rem", color: "#64748b" }}>
          © 2026 Fortivex Technologies. High security token-based sessions.
        </div>
      </div>

      {/* Right Column: Sign In Form */}
      <div className="login-right-col">
        <div style={{ width: "100%", maxWidth: "440px" }}>
          {/* Mobile-Only Brand Header */}
          <div className="mobile-only" style={{ alignItems: "center", gap: "0.6rem", marginBottom: "1.75rem" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "12px",
                background: "var(--primary-gradient)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ffffff",
                boxShadow: "0 2px 8px var(--primary-glow)",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "1.3rem" }}>auto_stories</span>
            </div>
            <div>
              <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" }}>
                Fortivex<span style={{ color: "var(--primary)" }}> LMS</span>
              </div>
              <div style={{ fontSize: "0.72rem", color: "#64748b" }}>Multi-Tenant Learning Platform</div>
            </div>
          </div>

          {/* Header */}
          <div style={{ marginBottom: "2rem" }}>
            <h2 style={{ fontSize: "2rem", fontWeight: 800, letterSpacing: "-0.02em", color: "#0f172a" }}>
              Welcome back
            </h2>
            <p style={{ color: "#64748b", fontSize: "0.95rem", marginTop: "0.4rem" }}>
              Sign in with your organizational credentials to access your portal.
            </p>
          </div>

          {/* Quick Demo Credentials Fill Buttons */}
          <div style={{ marginBottom: "1.75rem" }}>
            <div
              style={{
                fontSize: "0.75rem",
                fontWeight: 700,
                color: "#64748b",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: "0.5rem",
              }}
            >
              Instant Demo Fill:
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
              {demoAccounts.map((acc, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => fillDemo(acc.email, acc.role)}
                  style={{
                    padding: "0.5rem 0.65rem",
                    borderRadius: "8px",
                    border: "1px solid #e2e8f0",
                    background: email === acc.email ? "#f1f5f9" : "#ffffff",
                    textAlign: "left",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = acc.color)}
                  onMouseLeave={(e) => {
                    if (email !== acc.email) e.currentTarget.style.borderColor = "#e2e8f0";
                  }}
                >
                  <div style={{ fontSize: "0.78rem", fontWeight: 700, color: acc.color }}>
                    {acc.label}
                  </div>
                  <div style={{ fontSize: "0.68rem", color: "#94a3b8" }}>{acc.org}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div
              style={{
                padding: "0.75rem 1rem",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "10px",
                color: "#dc2626",
                fontSize: "0.85rem",
                fontWeight: 600,
                marginBottom: "1.25rem",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "1.1rem" }}>
                error
              </span>
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div>
              <label
                htmlFor="email"
                style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, color: "#1e293b", marginBottom: "0.4rem" }}
              >
                Email Address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@empowers.com"
                className="input-field"
                style={{ padding: "0.75rem 1rem" }}
              />
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                <label
                  htmlFor="password"
                  style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1e293b" }}
                >
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  style={{ fontSize: "0.78rem", color: "#4f46e5", fontWeight: 600, textDecoration: "none" }}
                  onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                  onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                >
                  Forgot password?
                </Link>
              </div>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input-field"
                style={{ padding: "0.75rem 1rem" }}
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary"
              style={{
                width: "100%",
                padding: "0.85rem",
                fontSize: "0.95rem",
                marginTop: "0.5rem",
              }}
            >
              {submitting ? (
                <>
                  <span className="material-symbols-outlined" style={{ animation: "spin 1s linear infinite" }}>
                    progress_activity
                  </span>
                  Authenticating...
                </>
              ) : (
                <>
                  Sign In to Dashboard
                  <span className="material-symbols-outlined">arrow_forward</span>
                </>
              )}
            </button>
          </form>

          {/* Help & Security note */}
          <div
            style={{
              marginTop: "2rem",
              paddingTop: "1.5rem",
              borderTop: "1px solid #f1f5f9",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: "0.78rem",
              color: "#94a3b8",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "1rem", color: "#10b981" }}>
                lock
              </span>
              256-Bit Encrypted
            </div>
            <div>Need access? Contact Academic Admin</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#0f172a" }} />}>
      <LoginContent />
    </Suspense>
  );
}
