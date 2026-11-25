"use client";

import { FormEvent, useState, useMemo, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { forgotPassword, resetPassword } from "@/lib/api/endpoints";

function ForgotPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Steps: "REQUEST" -> "RESET" -> "PROFILE" -> "SUCCESS"
  const [step, setStep] = useState<"REQUEST" | "RESET" | "PROFILE" | "SUCCESS">("REQUEST");

  // Form states - Security
  const [email, setEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Form states - Profile Details
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [title, setTitle] = useState("");
  const [bio, setBio] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if token was passed in query params
  useEffect(() => {
    const urlToken = searchParams?.get("token");
    const urlEmail = searchParams?.get("email");
    if (urlEmail) {
      setEmail(urlEmail);
    }
    if (urlToken) {
      setResetToken(urlToken);
      setStep("RESET");
    }
  }, [searchParams]);

  // Password criteria evaluations
  const criteria = useMemo(() => {
    return {
      minLength: newPassword.length >= 8,
      hasUpper: /[A-Z]/.test(newPassword),
      hasLower: /[a-z]/.test(newPassword),
      hasNumber: /[0-9]/.test(newPassword),
      hasSpecial: /[^A-Za-z0-9]/.test(newPassword),
    };
  }, [newPassword]);

  // Strength score: 0 to 4
  const strengthScore = useMemo(() => {
    let score = 0;
    if (criteria.minLength) score += 1;
    if (criteria.hasUpper && criteria.hasLower) score += 1;
    if (criteria.hasNumber) score += 1;
    if (criteria.hasSpecial) score += 1;
    return score;
  }, [criteria]);

  const strengthLabel = useMemo(() => {
    if (!newPassword) return "";
    switch (strengthScore) {
      case 1:
        return "Weak";
      case 2:
        return "Fair";
      case 3:
        return "Good";
      case 4:
        return "Strong";
      default:
        return "Too Short";
    }
  }, [newPassword, strengthScore]);

  const strengthColor = useMemo(() => {
    switch (strengthScore) {
      case 1:
        return "#ef4444";
      case 2:
        return "#f59e0b";
      case 3:
        return "#3b82f6";
      case 4:
        return "#10b981";
      default:
        return "#94a3b8";
    }
  }, [strengthScore]);

  const passwordsMatch = newPassword.length > 0 && confirmPassword.length > 0 && newPassword === confirmPassword;
  const canProceedToProfile = criteria.minLength && passwordsMatch && !submitting;

  // Step 1: Request reset authorization
  const handleRequestReset = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || submitting) return;

    setError(null);
    setSubmitting(true);

    try {
      const res = await forgotPassword(email.trim());
      setResetToken(res.reset_token);
      setUserName(res.full_name || "");
      setFullName(res.full_name || "");
      setPhoneNumber(res.phone_number || "");
      setTitle(res.title || "");
      setBio(res.bio || "");
      setLinkedinUrl(res.linkedin_url || "");
      setGithubUrl(res.github_url || "");
      setPortfolioUrl(res.portfolio_url || "");
      setStep("RESET");
    } catch (err: any) {
      setError(err.message || "Failed to find account with this email address.");
    } finally {
      setSubmitting(false);
    }
  };

  // Step 2: Validate password and proceed to profile completion
  const handlePasswordNext = (e: FormEvent) => {
    e.preventDefault();
    if (!canProceedToProfile) return;
    setError(null);
    setStep("PROFILE");
  };

  // Step 3: Complete password reset & profile details
  const handleCompleteReset = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await resetPassword({
        token: resetToken,
        new_password: newPassword,
        full_name: fullName.trim() || undefined,
        phone_number: phoneNumber.trim() || undefined,
        title: title.trim() || undefined,
        bio: bio.trim() || undefined,
        linkedin_url: linkedinUrl.trim() || undefined,
        github_url: githubUrl.trim() || undefined,
        portfolio_url: portfolioUrl.trim() || undefined,
      });
      setStep("SUCCESS");
    } catch (err: any) {
      setError(err.message || "Failed to reset password. Token may have expired.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "radial-gradient(ellipse at top, #1e1b4b 0%, #0f172a 50%, #020617 100%)",
        padding: "2rem 1rem",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background glowing effects */}
      <div
        style={{
          position: "absolute",
          top: "10%",
          left: "50%",
          transform: "translateX(-50%)",
          width: "600px",
          height: "350px",
          background: "radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, transparent 70%)",
          filter: "blur(60px)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          width: "100%",
          maxWidth: step === "PROFILE" ? "560px" : "480px",
          position: "relative",
          zIndex: 1,
          transition: "max-width 0.3s ease",
        }}
      >
        {/* Brand Header */}
        <div style={{ textAlign: "center", marginBottom: "1.75rem" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.75rem",
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              borderRadius: "14px",
              padding: "0.5rem 1rem",
              marginBottom: "1rem",
              backdropFilter: "blur(12px)",
            }}
          >
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "8px",
                background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ffffff",
                fontWeight: 800,
                fontSize: "1rem",
              }}
            >
              F
            </div>
            <span style={{ fontSize: "1rem", fontWeight: 700, color: "#ffffff", letterSpacing: "-0.01em" }}>
              Fortivex LMS
            </span>
          </div>

          <h1
            style={{
              fontSize: "1.85rem",
              fontWeight: 800,
              color: "#ffffff",
              letterSpacing: "-0.02em",
              marginBottom: "0.45rem",
            }}
          >
            {step === "REQUEST" && "Forgot Password?"}
            {step === "RESET" && "Step 1: Set New Password"}
            {step === "PROFILE" && "Step 2: Complete Your Profile"}
            {step === "SUCCESS" && "Password & Profile Updated!"}
          </h1>

          <p style={{ fontSize: "0.92rem", color: "#94a3b8", lineHeight: 1.5, margin: 0 }}>
            {step === "REQUEST" && "Enter your registered email address to verify your account and reset credentials."}
            {step === "RESET" && "Choose a strong password to secure your account credentials."}
            {step === "PROFILE" && "Enter your contact and profile details to complete your account setup."}
            {step === "SUCCESS" && "Your password and profile have been successfully saved."}
          </p>

          {/* Stepper Indicator for Reset & Profile */}
          {(step === "RESET" || step === "PROFILE") && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.75rem",
                marginTop: "1.25rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: step === "RESET" ? "#38bdf8" : "#10b981",
                }}
              >
                <span
                  style={{
                    width: "22px",
                    height: "22px",
                    borderRadius: "50%",
                    background: step === "RESET" ? "rgba(56, 189, 248, 0.2)" : "rgba(16, 185, 129, 0.2)",
                    border: `1px solid ${step === "RESET" ? "#38bdf8" : "#10b981"}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.75rem",
                  }}
                >
                  {step === "PROFILE" ? "✓" : "1"}
                </span>
                Password
              </div>

              <div style={{ width: "32px", height: "1px", background: "rgba(255, 255, 255, 0.2)" }} />

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: step === "PROFILE" ? "#38bdf8" : "#64748b",
                }}
              >
                <span
                  style={{
                    width: "22px",
                    height: "22px",
                    borderRadius: "50%",
                    background: step === "PROFILE" ? "rgba(56, 189, 248, 0.2)" : "rgba(255, 255, 255, 0.05)",
                    border: `1px solid ${step === "PROFILE" ? "#38bdf8" : "rgba(255, 255, 255, 0.15)"}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.75rem",
                  }}
                >
                  2
                </span>
                Profile Details
              </div>
            </div>
          )}
        </div>

        {/* Card Container */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: "20px",
            padding: "2.25rem",
            boxShadow: "0 20px 40px rgba(0, 0, 0, 0.35)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
          }}
        >
          {error && (
            <div
              style={{
                padding: "0.85rem 1rem",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "10px",
                color: "#dc2626",
                fontSize: "0.85rem",
                fontWeight: 600,
                marginBottom: "1.5rem",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "1.2rem", flexShrink: 0 }}>
                error
              </span>
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: Request Email */}
          {step === "REQUEST" && (
            <form onSubmit={handleRequestReset} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <div>
                <label
                  htmlFor="email-input"
                  style={{
                    display: "block",
                    fontSize: "0.85rem",
                    fontWeight: 700,
                    color: "#1e293b",
                    marginBottom: "0.45rem",
                  }}
                >
                  Email Address
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    id="email-input"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@empowers.com"
                    className="input-field"
                    style={{
                      width: "100%",
                      padding: "0.8rem 1rem",
                      paddingLeft: "2.5rem",
                      borderRadius: "10px",
                      border: "1px solid #cbd5e1",
                      fontSize: "0.95rem",
                      color: "#0f172a",
                      outline: "none",
                    }}
                  />
                  <span
                    className="material-symbols-outlined"
                    style={{
                      position: "absolute",
                      left: "0.75rem",
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "#94a3b8",
                      fontSize: "1.2rem",
                      pointerEvents: "none",
                    }}
                  >
                    mail
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting || !email.trim()}
                className="btn-primary"
                style={{
                  width: "100%",
                  padding: "0.85rem",
                  fontSize: "0.95rem",
                  fontWeight: 700,
                  borderRadius: "10px",
                  background: "linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)",
                  color: "#ffffff",
                  border: "none",
                  cursor: submitting || !email.trim() ? "not-allowed" : "pointer",
                  opacity: submitting || !email.trim() ? 0.7 : 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem",
                  marginTop: "0.5rem",
                  boxShadow: "0 4px 12px rgba(79, 70, 229, 0.25)",
                }}
              >
                {submitting ? (
                  <>
                    <span className="material-symbols-outlined" style={{ animation: "spin 1s linear infinite" }}>
                      progress_activity
                    </span>
                    Verifying Account...
                  </>
                ) : (
                  <>
                    Continue
                    <span className="material-symbols-outlined" style={{ fontSize: "1.1rem" }}>
                      arrow_forward
                    </span>
                  </>
                )}
              </button>

              <div style={{ textAlign: "center", marginTop: "1rem" }}>
                <Link
                  href="/login"
                  style={{
                    fontSize: "0.85rem",
                    color: "#64748b",
                    fontWeight: 600,
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.35rem",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#4f46e5")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#64748b")}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "1rem" }}>
                    arrow_back
                  </span>
                  Back to Sign In
                </Link>
              </div>
            </form>
          )}

          {/* STEP 2: Set New Password */}
          {step === "RESET" && (
            <form onSubmit={handlePasswordNext} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              {email && (
                <div
                  style={{
                    background: "rgba(16, 185, 129, 0.08)",
                    border: "1px solid rgba(16, 185, 129, 0.25)",
                    borderRadius: "10px",
                    padding: "0.75rem 1rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.6rem",
                  }}
                >
                  <span className="material-symbols-outlined" style={{ color: "#10b981", fontSize: "1.25rem" }}>
                    check_circle
                  </span>
                  <div>
                    <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#065f46" }}>
                      Account Verified
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "#047857" }}>
                      {userName ? `${userName} (${email})` : email}
                    </div>
                  </div>
                </div>
              )}

              {/* New Password */}
              <div>
                <label
                  htmlFor="new-pwd"
                  style={{
                    display: "block",
                    fontSize: "0.85rem",
                    fontWeight: 700,
                    color: "#1e293b",
                    marginBottom: "0.45rem",
                  }}
                >
                  New Password
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    id="new-pwd"
                    type={showNewPassword ? "text" : "password"}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter at least 8 characters"
                    className="input-field"
                    style={{
                      width: "100%",
                      padding: "0.8rem 1rem",
                      paddingRight: "2.5rem",
                      borderRadius: "10px",
                      border: "1px solid #cbd5e1",
                      fontSize: "0.95rem",
                      color: "#0f172a",
                      outline: "none",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    tabIndex={-1}
                    style={{
                      position: "absolute",
                      right: "0.75rem",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      color: "#94a3b8",
                      cursor: "pointer",
                      padding: "0.2rem",
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "1.2rem" }}>
                      {showNewPassword ? "visibility_off" : "visibility"}
                    </span>
                  </button>
                </div>

                {/* Strength Meter Bar */}
                {newPassword && (
                  <div style={{ marginTop: "0.6rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
                      <span style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 600 }}>Strength:</span>
                      <span style={{ fontSize: "0.75rem", color: strengthColor, fontWeight: 700 }}>
                        {strengthLabel}
                      </span>
                    </div>
                    <div style={{ height: "4px", width: "100%", background: "#e2e8f0", borderRadius: "999px", overflow: "hidden" }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${(strengthScore / 4) * 100}%`,
                          background: strengthColor,
                          transition: "all 0.3s ease",
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label
                  htmlFor="confirm-pwd"
                  style={{
                    display: "block",
                    fontSize: "0.85rem",
                    fontWeight: 700,
                    color: "#1e293b",
                    marginBottom: "0.45rem",
                  }}
                >
                  Confirm New Password
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    id="confirm-pwd"
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your new password"
                    className="input-field"
                    style={{
                      width: "100%",
                      padding: "0.8rem 1rem",
                      paddingRight: "2.5rem",
                      borderRadius: "10px",
                      border: `1px solid ${
                        confirmPassword.length > 0
                          ? passwordsMatch
                            ? "#10b981"
                            : "#ef4444"
                          : "#cbd5e1"
                      }`,
                      fontSize: "0.95rem",
                      color: "#0f172a",
                      outline: "none",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    tabIndex={-1}
                    style={{
                      position: "absolute",
                      right: "0.75rem",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      color: "#94a3b8",
                      cursor: "pointer",
                      padding: "0.2rem",
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "1.2rem" }}>
                      {showConfirmPassword ? "visibility_off" : "visibility"}
                    </span>
                  </button>
                </div>
                {confirmPassword.length > 0 && !passwordsMatch && (
                  <div style={{ fontSize: "0.78rem", color: "#ef4444", marginTop: "0.35rem", fontWeight: 600 }}>
                    Passwords do not match
                  </div>
                )}
              </div>

              {/* Requirements Checklist */}
              <div
                style={{
                  background: "#f8fafc",
                  borderRadius: "10px",
                  padding: "0.85rem",
                  fontSize: "0.78rem",
                  color: "#64748b",
                  border: "1px solid #e2e8f0",
                }}
              >
                <div style={{ fontWeight: 700, color: "#334155", marginBottom: "0.4rem" }}>
                  Password must include:
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.35rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", color: criteria.minLength ? "#10b981" : "#64748b" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "0.95rem" }}>
                      {criteria.minLength ? "check_circle" : "radio_button_unchecked"}
                    </span>
                    8+ characters
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", color: criteria.hasUpper && criteria.hasLower ? "#10b981" : "#64748b" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "0.95rem" }}>
                      {criteria.hasUpper && criteria.hasLower ? "check_circle" : "radio_button_unchecked"}
                    </span>
                    Upper & lower case
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", color: criteria.hasNumber ? "#10b981" : "#64748b" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "0.95rem" }}>
                      {criteria.hasNumber ? "check_circle" : "radio_button_unchecked"}
                    </span>
                    At least 1 number
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", color: criteria.hasSpecial ? "#10b981" : "#64748b" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "0.95rem" }}>
                      {criteria.hasSpecial ? "check_circle" : "radio_button_unchecked"}
                    </span>
                    Special symbol
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={!canProceedToProfile}
                className="btn-primary"
                style={{
                  width: "100%",
                  padding: "0.85rem",
                  fontSize: "0.95rem",
                  fontWeight: 700,
                  borderRadius: "10px",
                  background: canProceedToProfile
                    ? "linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)"
                    : "#cbd5e1",
                  color: "#ffffff",
                  border: "none",
                  cursor: canProceedToProfile ? "pointer" : "not-allowed",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem",
                  marginTop: "0.5rem",
                  boxShadow: canProceedToProfile ? "0 4px 12px rgba(79, 70, 229, 0.25)" : "none",
                }}
              >
                Continue to Profile Details
                <span className="material-symbols-outlined" style={{ fontSize: "1.1rem" }}>
                  arrow_forward
                </span>
              </button>

              <div style={{ textAlign: "center", marginTop: "0.5rem" }}>
                <button
                  type="button"
                  onClick={() => {
                    setStep("REQUEST");
                    setError(null);
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    fontSize: "0.82rem",
                    color: "#64748b",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  Use a different email address
                </button>
              </div>
            </form>
          )}

          {/* STEP 3: Complete Profile Details */}
          {step === "PROFILE" && (
            <form onSubmit={handleCompleteReset} style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
              <div
                style={{
                  background: "rgba(99, 102, 241, 0.06)",
                  border: "1px solid rgba(99, 102, 241, 0.2)",
                  borderRadius: "10px",
                  padding: "0.75rem 1rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.6rem",
                }}
              >
                <span className="material-symbols-outlined" style={{ color: "#4f46e5", fontSize: "1.25rem" }}>
                  badge
                </span>
                <div style={{ fontSize: "0.82rem", color: "#334155" }}>
                  Password is ready. Complete your profile details below to finalize your account.
                </div>
              </div>

              {/* Full Name & Phone Number */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem" }}>
                <div>
                  <label
                    htmlFor="full-name"
                    style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#1e293b", marginBottom: "0.35rem" }}
                  >
                    Full Name *
                  </label>
                  <input
                    id="full-name"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Jane Doe"
                    className="input-field"
                    style={{
                      width: "100%",
                      padding: "0.75rem 0.9rem",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "0.9rem",
                    }}
                  />
                </div>

                <div>
                  <label
                    htmlFor="phone-number"
                    style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#1e293b", marginBottom: "0.35rem" }}
                  >
                    Phone / Mobile
                  </label>
                  <input
                    id="phone-number"
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    className="input-field"
                    style={{
                      width: "100%",
                      padding: "0.75rem 0.9rem",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "0.9rem",
                    }}
                  />
                </div>
              </div>

              {/* Headline / Title */}
              <div>
                <label
                  htmlFor="profile-title"
                  style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#1e293b", marginBottom: "0.35rem" }}
                >
                  Professional Title / Specialization
                </label>
                <input
                  id="profile-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Full Stack Developer, Data Science Student"
                  className="input-field"
                  style={{
                    width: "100%",
                    padding: "0.75rem 0.9rem",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "0.9rem",
                  }}
                />
              </div>

              {/* Bio */}
              <div>
                <label
                  htmlFor="profile-bio"
                  style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#1e293b", marginBottom: "0.35rem" }}
                >
                  Bio / About You
                </label>
                <textarea
                  id="profile-bio"
                  rows={2}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Briefly describe your background, learning goals, or experience..."
                  className="input-field"
                  style={{
                    width: "100%",
                    padding: "0.75rem 0.9rem",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "0.88rem",
                    resize: "vertical",
                    fontFamily: "inherit",
                  }}
                />
              </div>

              {/* Social / Professional Links */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem" }}>
                <div>
                  <label
                    htmlFor="linkedin-url"
                    style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#1e293b", marginBottom: "0.35rem" }}
                  >
                    LinkedIn Profile
                  </label>
                  <input
                    id="linkedin-url"
                    type="url"
                    value={linkedinUrl}
                    onChange={(e) => setLinkedinUrl(e.target.value)}
                    placeholder="https://linkedin.com/in/..."
                    className="input-field"
                    style={{
                      width: "100%",
                      padding: "0.75rem 0.9rem",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "0.85rem",
                    }}
                  />
                </div>

                <div>
                  <label
                    htmlFor="github-url"
                    style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#1e293b", marginBottom: "0.35rem" }}
                  >
                    GitHub Profile
                  </label>
                  <input
                    id="github-url"
                    type="url"
                    value={githubUrl}
                    onChange={(e) => setGithubUrl(e.target.value)}
                    placeholder="https://github.com/..."
                    className="input-field"
                    style={{
                      width: "100%",
                      padding: "0.75rem 0.9rem",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "0.85rem",
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
                <button
                  type="button"
                  onClick={() => setStep("RESET")}
                  style={{
                    padding: "0.8rem 1.25rem",
                    borderRadius: "10px",
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    color: "#475569",
                    fontWeight: 600,
                    fontSize: "0.9rem",
                    cursor: "pointer",
                  }}
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={submitting || !fullName.trim()}
                  className="btn-primary"
                  style={{
                    flex: 1,
                    padding: "0.85rem",
                    fontSize: "0.95rem",
                    fontWeight: 700,
                    borderRadius: "10px",
                    background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                    color: "#ffffff",
                    border: "none",
                    cursor: submitting || !fullName.trim() ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.5rem",
                    boxShadow: "0 4px 12px rgba(16, 185, 129, 0.25)",
                  }}
                >
                  {submitting ? (
                    <>
                      <span className="material-symbols-outlined" style={{ animation: "spin 1s linear infinite" }}>
                        progress_activity
                      </span>
                      Saving Profile & Resetting Password...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined" style={{ fontSize: "1.1rem" }}>
                        check
                      </span>
                      Complete Setup & Save
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* STEP 4: Success Confirmation */}
          {step === "SUCCESS" && (
            <div style={{ textAlign: "center", padding: "1rem 0" }}>
              <div
                style={{
                  width: "68px",
                  height: "68px",
                  borderRadius: "50%",
                  background: "rgba(16, 185, 129, 0.12)",
                  color: "#10b981",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 1.5rem",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "2.5rem" }}>
                  check_circle
                </span>
              </div>

              <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#0f172a", marginBottom: "0.75rem" }}>
                Password & Profile Complete!
              </h2>

              <p style={{ fontSize: "0.9rem", color: "#64748b", lineHeight: 1.6, marginBottom: "2rem" }}>
                Your account password and profile details have been saved securely. You can now sign in with your updated credentials.
              </p>

              <button
                type="button"
                onClick={() => router.push(email ? `/login?email=${encodeURIComponent(email)}` : "/login")}
                className="btn-primary"
                style={{
                  width: "100%",
                  padding: "0.85rem",
                  fontSize: "0.95rem",
                  fontWeight: 700,
                  borderRadius: "10px",
                  background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
                  color: "#ffffff",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem",
                  boxShadow: "0 4px 14px rgba(79, 70, 229, 0.3)",
                }}
              >
                Sign In to Dashboard
                <span className="material-symbols-outlined" style={{ fontSize: "1.1rem" }}>
                  arrow_forward
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#0f172a" }} />}>
      <ForgotPasswordContent />
    </Suspense>
  );
}
