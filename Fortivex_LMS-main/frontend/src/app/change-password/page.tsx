"use client";

import { FormEvent, useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { changePassword, dismissPasswordPrompt, updateOwnProfile } from "@/lib/api/endpoints";
import { ROLE_REDIRECTS } from "@/lib/auth/roles";
import { Button } from "@/components/ui/Button";

export default function ChangePasswordPage() {
  const router = useRouter();
  const { user, token, organization, refreshUser } = useAuth();

  // Wizard Steps: "PASSWORD" -> "PROFILE" -> "COMPLETED"
  const [step, setStep] = useState<"PASSWORD" | "PROFILE" | "COMPLETED">("PASSWORD");

  // Step 1: Password Change States
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Step 2: Profile Completion States
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [title, setTitle] = useState("");
  const [bio, setBio] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize profile fields when user is loaded
  useEffect(() => {
    if (user) {
      setFullName(user.full_name || "");
      setPhoneNumber(user.phone_number || "");
      setTitle(user.title || "");
      setBio(user.bio || "");
      setLinkedinUrl(user.linkedin_url || "");
      setGithubUrl(user.github_url || "");
      setPortfolioUrl(user.portfolio_url || "");
    }
  }, [user]);

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
  const canSubmitPassword = currentPassword.length > 0 && criteria.minLength && passwordsMatch && !isSubmitting;

  const navigateToDashboard = () => {
    const primaryRole = user?.roles?.[0];
    const destination = primaryRole ? ROLE_REDIRECTS[primaryRole] || "/student" : "/student";
    router.replace(destination);
  };

  // Step 1 Submit: Save password and advance to profile completion
  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token || !canSubmitPassword) return;

    setError(null);
    setIsSubmitting(true);

    try {
      await changePassword(token, {
        current_password: currentPassword,
        new_password: newPassword,
      });

      await refreshUser();
      setStep("PROFILE");
    } catch (err: any) {
      setError(err?.message || "Failed to update password. Please check your current password.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 2 Submit: Save profile details and finish setup
  const handleProfileSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setError(null);
    setIsSavingProfile(true);

    try {
      await updateOwnProfile(token, {
        full_name: fullName.trim() || undefined,
        phone_number: phoneNumber.trim() || undefined,
        title: title.trim() || undefined,
        bio: bio.trim() || undefined,
        linkedin_url: linkedinUrl.trim() || undefined,
        github_url: githubUrl.trim() || undefined,
        portfolio_url: portfolioUrl.trim() || undefined,
      });

      await refreshUser();
      setStep("COMPLETED");

      setTimeout(() => {
        navigateToDashboard();
      }, 1500);
    } catch (err: any) {
      setError(err?.message || "Failed to update profile details.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleDismiss = async () => {
    if (!token || isDismissing) return;
    setIsDismissing(true);
    try {
      await dismissPasswordPrompt(token);
      await refreshUser();
      navigateToDashboard();
    } catch {
      navigateToDashboard();
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem 1rem",
        background: "linear-gradient(135deg, #0b0f19 0%, #111827 50%, #1e1b4b 100%)",
        color: "#f8fafc",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background Glows */}
      <div
        style={{
          position: "absolute",
          top: "-15%",
          right: "15%",
          width: "450px",
          height: "450px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(99, 102, 241, 0.22) 0%, transparent 70%)",
          filter: "blur(50px)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "-15%",
          left: "15%",
          width: "450px",
          height: "450px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(14, 165, 233, 0.18) 0%, transparent 70%)",
          filter: "blur(50px)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          width: "100%",
          maxWidth: step === "PROFILE" ? "580px" : "540px",
          background: "rgba(17, 24, 39, 0.85)",
          backdropFilter: "blur(16px)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: "24px",
          padding: "2.5rem",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
          position: "relative",
          zIndex: 10,
          animation: "fadeIn 0.3s ease-out",
          transition: "max-width 0.3s ease",
        }}
      >
        {/* COMPLETED State */}
        {step === "COMPLETED" ? (
          <div style={{ textAlign: "center", padding: "2rem 1rem" }}>
            <div
              style={{
                width: "72px",
                height: "72px",
                borderRadius: "50%",
                background: "rgba(16, 185, 129, 0.15)",
                color: "#10b981",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 1.5rem",
                boxShadow: "0 0 25px rgba(16, 185, 129, 0.3)",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "2.5rem" }}>
                check_circle
              </span>
            </div>
            <h2 style={{ fontSize: "1.75rem", fontWeight: 800, marginBottom: "0.5rem", letterSpacing: "-0.02em" }}>
              Profile & Security Setup Complete!
            </h2>
            <p style={{ color: "#94a3b8", fontSize: "0.95rem", lineHeight: 1.5, marginBottom: "1.5rem" }}>
              Your password has been updated and your profile details have been saved. Preparing your portal...
            </p>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", color: "#818cf8", fontSize: "0.9rem" }}>
              <span className="material-symbols-outlined" style={{ animation: "spin 1s linear infinite", fontSize: "1.2rem" }}>
                progress_activity
              </span>
              Entering dashboard...
            </div>
          </div>
        ) : (
          <div>
            {/* Header Badge & Brand */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <div
                  style={{
                    width: "38px",
                    height: "38px",
                    borderRadius: "10px",
                    background: "var(--primary-gradient)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#ffffff",
                    boxShadow: "0 2px 10px rgba(99, 102, 241, 0.4)",
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "1.2rem" }}>
                    {step === "PASSWORD" ? "lock_reset" : "person_outline"}
                  </span>
                </div>
                <div>
                  <div style={{ fontSize: "1rem", fontWeight: 700, letterSpacing: "-0.01em" }}>
                    Fortivex <span style={{ color: "#818cf8" }}>LMS</span>
                  </div>
                  <div style={{ fontSize: "0.72rem", color: "#94a3b8" }}>
                    {organization?.name || "Academic Learning Portal"}
                  </div>
                </div>
              </div>

              {/* Stepper Pill Indicator */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: "99px",
                  padding: "0.3rem 0.75rem",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                }}
              >
                <span style={{ color: step === "PASSWORD" ? "#38bdf8" : "#10b981", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                  {step === "PROFILE" ? "✓" : "1."} Password
                </span>
                <span style={{ color: "rgba(255, 255, 255, 0.2)" }}>&bull;</span>
                <span style={{ color: step === "PROFILE" ? "#38bdf8" : "#64748b" }}>
                  2. Details
                </span>
              </div>
            </div>

            {/* Title & Narrative */}
            <div style={{ marginBottom: "1.5rem" }}>
              <h1 style={{ fontSize: "1.65rem", fontWeight: 800, marginBottom: "0.35rem", letterSpacing: "-0.02em" }}>
                {step === "PASSWORD" ? "Set Your Personal Password" : "Complete Your Profile Details"}
              </h1>
              <p style={{ color: "#94a3b8", fontSize: "0.9rem", lineHeight: 1.5 }}>
                {step === "PASSWORD"
                  ? "Welcome! To secure your coursework and certificates, please replace your initial temporary password."
                  : "Great! Now enter your contact details and background so instructors and peers can connect with you."}
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  background: "rgba(239, 68, 68, 0.12)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  borderRadius: "10px",
                  padding: "0.75rem 1rem",
                  color: "#fca5a5",
                  fontSize: "0.85rem",
                  marginBottom: "1.5rem",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "1.2rem", color: "#ef4444" }}>
                  error
                </span>
                {error}
              </div>
            )}

            {/* STEP 1: PASSWORD CHANGE FORM */}
            {step === "PASSWORD" && (
              <form onSubmit={handlePasswordSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                {/* Current / Temporary Password */}
                <div>
                  <label
                    htmlFor="current-pwd"
                    style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#cbd5e1", marginBottom: "0.4rem" }}
                  >
                    Current / Temporary Password
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      id="current-pwd"
                      type={showCurrentPassword ? "text" : "password"}
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••"
                      style={{
                        width: "100%",
                        padding: "0.75rem 2.5rem 0.75rem 1rem",
                        borderRadius: "10px",
                        border: "1px solid rgba(255, 255, 255, 0.15)",
                        background: "rgba(0, 0, 0, 0.25)",
                        color: "#ffffff",
                        fontSize: "0.95rem",
                        outline: "none",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
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
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "1.2rem" }}>
                        {showCurrentPassword ? "visibility_off" : "visibility"}
                      </span>
                    </button>
                  </div>
                </div>

                {/* New Password */}
                <div>
                  <label
                    htmlFor="new-pwd"
                    style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#cbd5e1", marginBottom: "0.4rem" }}
                  >
                    New Personal Password
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      id="new-pwd"
                      type={showNewPassword ? "text" : "password"}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter at least 8 characters"
                      style={{
                        width: "100%",
                        padding: "0.75rem 2.5rem 0.75rem 1rem",
                        borderRadius: "10px",
                        border: "1px solid rgba(255, 255, 255, 0.15)",
                        background: "rgba(0, 0, 0, 0.25)",
                        color: "#ffffff",
                        fontSize: "0.95rem",
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
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "1.2rem" }}>
                        {showNewPassword ? "visibility_off" : "visibility"}
                      </span>
                    </button>
                  </div>

                  {/* Strength Bar */}
                  {newPassword && (
                    <div style={{ marginTop: "0.6rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
                        <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Password Strength:</span>
                        <span style={{ fontSize: "0.75rem", color: strengthColor, fontWeight: 700 }}>
                          {strengthLabel}
                        </span>
                      </div>
                      <div style={{ height: "4px", width: "100%", background: "rgba(255, 255, 255, 0.1)", borderRadius: "999px", overflow: "hidden" }}>
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
                    style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#cbd5e1", marginBottom: "0.4rem" }}
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
                      style={{
                        width: "100%",
                        padding: "0.75rem 2.5rem 0.75rem 1rem",
                        borderRadius: "10px",
                        border: `1px solid ${
                          confirmPassword
                            ? passwordsMatch
                              ? "#10b981"
                              : "#ef4444"
                            : "rgba(255, 255, 255, 0.15)"
                        }`,
                        background: "rgba(0, 0, 0, 0.25)",
                        color: "#ffffff",
                        fontSize: "0.95rem",
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
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "1.2rem" }}>
                        {showConfirmPassword ? "visibility_off" : "visibility"}
                      </span>
                    </button>
                  </div>
                  {confirmPassword && !passwordsMatch && (
                    <div style={{ fontSize: "0.75rem", color: "#ef4444", marginTop: "0.35rem" }}>
                      Passwords do not match
                    </div>
                  )}
                </div>

                {/* Requirement Pills */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "0.4rem 0.75rem",
                    background: "rgba(0, 0, 0, 0.2)",
                    padding: "0.75rem 0.9rem",
                    borderRadius: "10px",
                    fontSize: "0.75rem",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", color: criteria.minLength ? "#10b981" : "#94a3b8" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "1rem" }}>
                      {criteria.minLength ? "check_circle" : "radio_button_unchecked"}
                    </span>
                    Min 8 characters
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", color: criteria.hasNumber ? "#10b981" : "#94a3b8" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "1rem" }}>
                      {criteria.hasNumber ? "check_circle" : "radio_button_unchecked"}
                    </span>
                    At least 1 number
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", color: criteria.hasUpper && criteria.hasLower ? "#10b981" : "#94a3b8" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "1rem" }}>
                      {criteria.hasUpper && criteria.hasLower ? "check_circle" : "radio_button_unchecked"}
                    </span>
                    Upper & lower case
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", color: criteria.hasSpecial ? "#10b981" : "#94a3b8" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "1rem" }}>
                      {criteria.hasSpecial ? "check_circle" : "radio_button_unchecked"}
                    </span>
                    Special symbol
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={!canSubmitPassword}
                  style={{
                    width: "100%",
                    padding: "0.85rem",
                    borderRadius: "10px",
                    border: "none",
                    background: canSubmitPassword ? "var(--primary-gradient)" : "rgba(255, 255, 255, 0.1)",
                    color: canSubmitPassword ? "#ffffff" : "#64748b",
                    fontWeight: 700,
                    fontSize: "0.95rem",
                    cursor: canSubmitPassword ? "pointer" : "not-allowed",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.5rem",
                    boxShadow: canSubmitPassword ? "0 4px 15px rgba(79, 70, 229, 0.4)" : "none",
                    transition: "all 0.2s ease",
                    marginTop: "0.5rem",
                  }}
                >
                  {isSubmitting ? (
                    <>
                      <span className="material-symbols-outlined" style={{ animation: "spin 1s linear infinite" }}>
                        progress_activity
                      </span>
                      Securing Account...
                    </>
                  ) : (
                    <>
                      <span>Continue to Profile Details</span>
                      <span className="material-symbols-outlined" style={{ fontSize: "1.1rem" }}>
                        arrow_forward
                      </span>
                    </>
                  )}
                </button>
              </form>
            )}

            {/* STEP 2: PROFILE DETAILS FORM */}
            {step === "PROFILE" && (
              <form onSubmit={handleProfileSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.15rem" }}>
                <div
                  style={{
                    background: "rgba(16, 185, 129, 0.1)",
                    border: "1px solid rgba(16, 185, 129, 0.25)",
                    borderRadius: "10px",
                    padding: "0.75rem 1rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    color: "#a7f3d0",
                    fontSize: "0.82rem",
                  }}
                >
                  <span className="material-symbols-outlined" style={{ color: "#34d399", fontSize: "1.2rem" }}>
                    check_circle
                  </span>
                  <span>Password updated! Please complete your other details to finalize setup.</span>
                </div>

                {/* Full Name & Phone Number */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem" }}>
                  <div>
                    <label
                      htmlFor="full-name"
                      style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "#cbd5e1", marginBottom: "0.35rem" }}
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
                      style={{
                        width: "100%",
                        padding: "0.75rem 0.9rem",
                        borderRadius: "10px",
                        border: "1px solid rgba(255, 255, 255, 0.15)",
                        background: "rgba(0, 0, 0, 0.25)",
                        color: "#ffffff",
                        fontSize: "0.9rem",
                        outline: "none",
                      }}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="phone-number"
                      style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "#cbd5e1", marginBottom: "0.35rem" }}
                    >
                      Contact Number
                    </label>
                    <input
                      id="phone-number"
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="+1 (555) 000-0000"
                      style={{
                        width: "100%",
                        padding: "0.75rem 0.9rem",
                        borderRadius: "10px",
                        border: "1px solid rgba(255, 255, 255, 0.15)",
                        background: "rgba(0, 0, 0, 0.25)",
                        color: "#ffffff",
                        fontSize: "0.9rem",
                        outline: "none",
                      }}
                    />
                  </div>
                </div>

                {/* Headline / Title */}
                <div>
                  <label
                    htmlFor="profile-title"
                    style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "#cbd5e1", marginBottom: "0.35rem" }}
                  >
                    Headline / Specialization
                  </label>
                  <input
                    id="profile-title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Full Stack Developer, Data Science Student"
                    style={{
                      width: "100%",
                      padding: "0.75rem 0.9rem",
                      borderRadius: "10px",
                      border: "1px solid rgba(255, 255, 255, 0.15)",
                      background: "rgba(0, 0, 0, 0.25)",
                      color: "#ffffff",
                      fontSize: "0.9rem",
                      outline: "none",
                    }}
                  />
                </div>

                {/* Bio */}
                <div>
                  <label
                    htmlFor="profile-bio"
                    style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "#cbd5e1", marginBottom: "0.35rem" }}
                  >
                    Bio / About You
                  </label>
                  <textarea
                    id="profile-bio"
                    rows={2}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Tell your instructors and cohort a little about yourself and goals..."
                    style={{
                      width: "100%",
                      padding: "0.75rem 0.9rem",
                      borderRadius: "10px",
                      border: "1px solid rgba(255, 255, 255, 0.15)",
                      background: "rgba(0, 0, 0, 0.25)",
                      color: "#ffffff",
                      fontSize: "0.88rem",
                      outline: "none",
                      resize: "vertical",
                      fontFamily: "inherit",
                    }}
                  />
                </div>

                {/* Professional Links */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem" }}>
                  <div>
                    <label
                      htmlFor="linkedin-url"
                      style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "#cbd5e1", marginBottom: "0.35rem" }}
                    >
                      LinkedIn Profile
                    </label>
                    <input
                      id="linkedin-url"
                      type="url"
                      value={linkedinUrl}
                      onChange={(e) => setLinkedinUrl(e.target.value)}
                      placeholder="https://linkedin.com/in/..."
                      style={{
                        width: "100%",
                        padding: "0.7rem 0.9rem",
                        borderRadius: "10px",
                        border: "1px solid rgba(255, 255, 255, 0.15)",
                        background: "rgba(0, 0, 0, 0.25)",
                        color: "#ffffff",
                        fontSize: "0.85rem",
                        outline: "none",
                      }}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="github-url"
                      style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "#cbd5e1", marginBottom: "0.35rem" }}
                    >
                      GitHub Profile
                    </label>
                    <input
                      id="github-url"
                      type="url"
                      value={githubUrl}
                      onChange={(e) => setGithubUrl(e.target.value)}
                      placeholder="https://github.com/..."
                      style={{
                        width: "100%",
                        padding: "0.7rem 0.9rem",
                        borderRadius: "10px",
                        border: "1px solid rgba(255, 255, 255, 0.15)",
                        background: "rgba(0, 0, 0, 0.25)",
                        color: "#ffffff",
                        fontSize: "0.85rem",
                        outline: "none",
                      }}
                    />
                  </div>
                </div>

                {/* Submit / Finish */}
                <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
                  <button
                    type="submit"
                    disabled={isSavingProfile || !fullName.trim()}
                    style={{
                      flex: 1,
                      padding: "0.85rem",
                      borderRadius: "10px",
                      border: "none",
                      background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                      color: "#ffffff",
                      fontWeight: 700,
                      fontSize: "0.95rem",
                      cursor: isSavingProfile || !fullName.trim() ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "0.5rem",
                      boxShadow: "0 4px 15px rgba(16, 185, 129, 0.4)",
                      transition: "all 0.2s ease",
                    }}
                  >
                    {isSavingProfile ? (
                      <>
                        <span className="material-symbols-outlined" style={{ animation: "spin 1s linear infinite" }}>
                          progress_activity
                        </span>
                        Saving Profile...
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined" style={{ fontSize: "1.1rem" }}>
                          check
                        </span>
                        Save Profile & Enter Portal
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* Skip Option */}
            <div style={{ marginTop: "1.25rem", textAlign: "center" }}>
              <button
                type="button"
                onClick={handleDismiss}
                disabled={isDismissing || isSubmitting || isSavingProfile}
                style={{
                  background: "none",
                  border: "none",
                  color: "#94a3b8",
                  fontSize: "0.8rem",
                  cursor: "pointer",
                  textDecoration: "underline",
                  padding: "0.25rem 0.5rem",
                  transition: "color 0.2s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#cbd5e1")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#94a3b8")}
              >
                {isDismissing ? "Skipping..." : "Remind me later & continue to dashboard"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
