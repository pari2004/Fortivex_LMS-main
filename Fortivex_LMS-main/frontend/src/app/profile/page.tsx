"use client";

import { useEffect, useState, useCallback } from "react";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  getFullProfile,
  updateOwnProfile,
  changePassword as apiChangePassword,
} from "@/lib/api/endpoints";
import type { FullProfileResponse, UserUpdatePayload } from "@/lib/api/types";

type ProfileTab = "overview" | "edit" | "security" | "organizations";

function FullProfileContent() {
  const { user, token, refreshUser, organization } = useAuth();
  const [profileData, setProfileData] = useState<FullProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ProfileTab>("overview");
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Edit form state
  const [editForm, setEditForm] = useState<UserUpdatePayload>({
    full_name: "",
    phone_number: "",
    title: "",
    bio: "",
    github_url: "",
    linkedin_url: "",
    portfolio_url: "",
  });
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Password change state
  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [showPasswords, setShowPasswords] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const fetchProfile = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const data = await getFullProfile(token);
      setProfileData(data);
      setEditForm({
        full_name: data.user.full_name || "",
        phone_number: data.user.phone_number || "",
        title: data.user.title || "",
        bio: data.user.bio || "",
        github_url: data.user.github_url || "",
        linkedin_url: data.user.linkedin_url || "",
        portfolio_url: data.user.portfolio_url || "",
      });
    } catch (err: any) {
      setToastMessage({
        type: "error",
        text: err?.message || "Failed to load profile data",
      });
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const copyToClipboard = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopyFeedback(label);
    showToast(`Copied ${label} to clipboard!`);
    setTimeout(() => setCopyFeedback(null), 2000);
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setIsSavingProfile(true);
    try {
      await updateOwnProfile(token, {
        full_name: editForm.full_name?.trim(),
        phone_number: editForm.phone_number?.trim() || "",
        title: editForm.title?.trim() || "",
        bio: editForm.bio?.trim() || "",
        github_url: editForm.github_url?.trim() || "",
        linkedin_url: editForm.linkedin_url?.trim() || "",
        portfolio_url: editForm.portfolio_url?.trim() || "",
      });
      await refreshUser();
      await fetchProfile();
      showToast("Profile updated successfully!");
      setActiveTab("overview");
    } catch (err: any) {
      showToast(err?.message || "Failed to update profile", "error");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (!passwordForm.current_password) {
      showToast("Please enter your current password", "error");
      return;
    }
    if (passwordForm.new_password.length < 8) {
      showToast("New password must be at least 8 characters long", "error");
      return;
    }
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      showToast("New passwords do not match", "error");
      return;
    }

    setIsChangingPassword(true);
    try {
      await apiChangePassword(token, {
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      });
      setPasswordForm({ current_password: "", new_password: "", confirm_password: "" });
      showToast("Password updated successfully!");
      setActiveTab("overview");
    } catch (err: any) {
      showToast(err?.message || "Failed to change password. Please check your current password.", "error");
    } finally {
      setIsChangingPassword(false);
    }
  };

  const currentUser = profileData?.user || user;
  const isStudent = currentUser?.roles.includes("STUDENT");
  const isInstructor = currentUser?.roles.some((r) => ["TRAINER", "INSTRUCTOR"].includes(r));
  const isAdmin = currentUser?.roles.some((r) =>
    ["SUPER_ADMIN", "ACADEMIC_ADMIN", "PROGRAM_MANAGER"].includes(r)
  );

  const studentData = profileData?.student_profile;
  const instructorData = profileData?.instructor_data;
  const adminData = profileData?.admin_data;
  const orgs = profileData?.organizations || [];

  return (
    <div style={{ maxWidth: "1080px", margin: "0 auto", padding: "2.5rem 1.5rem" }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: "fixed",
            bottom: "2rem",
            right: "2rem",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            background: toastMessage.type === "success" ? "#0f766e" : "#b91c1c",
            color: "#ffffff",
            padding: "0.85rem 1.35rem",
            borderRadius: "10px",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.25)",
            fontWeight: 500,
            fontSize: "0.92rem",
            animation: "fadeIn 0.25s ease-out",
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: "1.25rem" }}>
            {toastMessage.type === "success" ? "check_circle" : "error"}
          </span>
          {toastMessage.text}
        </div>
      )}

      {/* Main Profile Header Card */}
      <div
        style={{
          background: "#ffffff",
          borderRadius: "16px",
          border: "1px solid #e2e8f0",
          boxShadow: "0 2px 8px -2px rgba(0, 0, 0, 0.05)",
          overflow: "hidden",
          marginBottom: "1.75rem",
        }}
      >
        {/* Subtle, refined accent header */}
        <div
          style={{
            height: "110px",
            background: "linear-gradient(135deg, #312e81 0%, #4338ca 50%, #4f46e5 100%)",
            position: "relative",
            padding: "1rem 1.75rem",
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "flex-start",
          }}
        >
          <span
            style={{
              background: "rgba(255, 255, 255, 0.15)",
              backdropFilter: "blur(6px)",
              color: "#ffffff",
              padding: "0.3rem 0.85rem",
              borderRadius: "20px",
              fontSize: "0.8rem",
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              border: "1px solid rgba(255, 255, 255, 0.2)",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "0.95rem" }}>
              domain
            </span>
            {organization?.name || "Fortivex LMS"}
          </span>
        </div>

        {/* Header Profile Body */}
        <div style={{ padding: "0 2rem 1.75rem 2rem" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "1.25rem",
              marginBottom: "1.25rem",
            }}
          >
            {/* Avatar & User Details */}
            <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
              <div
                style={{
                  marginTop: "-50px",
                  width: "96px",
                  height: "96px",
                  borderRadius: "50%",
                  background: "#4f46e5",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "2.4rem",
                  fontWeight: 700,
                  border: "4px solid #ffffff",
                  boxShadow: "0 4px 14px rgba(0,0,0,0.12)",
                  flexShrink: 0,
                  position: "relative",
                  zIndex: 2,
                }}
              >
                {currentUser?.full_name ? currentUser.full_name.charAt(0).toUpperCase() : "U"}
                <div
                  title="Account Active"
                  style={{
                    position: "absolute",
                    bottom: "3px",
                    right: "3px",
                    width: "18px",
                    height: "18px",
                    borderRadius: "50%",
                    background: "#10b981",
                    border: "3px solid #ffffff",
                  }}
                />
              </div>

              <div style={{ paddingTop: "0.85rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", flexWrap: "wrap" }}>
                  <h1 style={{ fontSize: "1.65rem", fontWeight: 700, color: "#0f172a", lineHeight: 1.25, margin: 0 }}>
                    {currentUser?.full_name || "User"}
                  </h1>
                  {currentUser?.roles.map((role) => (
                    <span
                      key={role}
                      style={{
                        padding: "0.2rem 0.65rem",
                        borderRadius: "6px",
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.03em",
                        background:
                          role === "STUDENT"
                            ? "#eef2ff"
                            : role === "TRAINER"
                            ? "#f0f9ff"
                            : "#fef3c7",
                        color:
                          role === "STUDENT"
                            ? "#4338ca"
                            : role === "TRAINER"
                            ? "#0369a1"
                            : "#b45309",
                        border:
                          role === "STUDENT"
                            ? "1px solid #c7d2fe"
                            : role === "TRAINER"
                            ? "1px solid #bae6fd"
                            : "1px solid #fde68a",
                      }}
                    >
                      {role === "TRAINER" ? "Instructor" : role.replace("_", " ")}
                    </span>
                  ))}
                </div>
                <p style={{ color: "#64748b", fontSize: "0.95rem", fontWeight: 500, margin: "0.25rem 0 0 0" }}>
                  {currentUser?.title ||
                    (isStudent
                      ? "Enrolled Academy Learner"
                      : isInstructor
                      ? "Lead Course Trainer"
                      : "Academic Operations Lead")}
                </p>

                {/* Social & Portfolio Quick Links in Header */}
                {(currentUser?.github_url || currentUser?.linkedin_url || currentUser?.portfolio_url) && (
                  <div style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
                    {currentUser?.github_url && (
                      <a
                        href={currentUser.github_url.startsWith("http") ? currentUser.github_url : `https://${currentUser.github_url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="GitHub Profile"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.35rem",
                          padding: "0.25rem 0.65rem",
                          borderRadius: "6px",
                          background: "#0f172a",
                          color: "#ffffff",
                          fontSize: "0.78rem",
                          fontWeight: 600,
                          textDecoration: "none",
                          transition: "opacity 0.15s ease",
                        }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                          <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                        </svg>
                        GitHub
                      </a>
                    )}
                    {currentUser?.linkedin_url && (
                      <a
                        href={currentUser.linkedin_url.startsWith("http") ? currentUser.linkedin_url : `https://${currentUser.linkedin_url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="LinkedIn Profile"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.35rem",
                          padding: "0.25rem 0.65rem",
                          borderRadius: "6px",
                          background: "#0284c7",
                          color: "#ffffff",
                          fontSize: "0.78rem",
                          fontWeight: 600,
                          textDecoration: "none",
                          transition: "opacity 0.15s ease",
                        }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9v8.37H9.2V10.9H6.46M7.83 6.45a1.63 1.63 0 1 0 0 3.26 1.63 1.63 0 0 0 0-3.26z" />
                        </svg>
                        LinkedIn
                      </a>
                    )}
                    {currentUser?.portfolio_url && (
                      <a
                        href={currentUser.portfolio_url.startsWith("http") ? currentUser.portfolio_url : `https://${currentUser.portfolio_url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Portfolio Website"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.35rem",
                          padding: "0.25rem 0.65rem",
                          borderRadius: "6px",
                          background: "#4f46e5",
                          color: "#ffffff",
                          fontSize: "0.78rem",
                          fontWeight: 600,
                          textDecoration: "none",
                          transition: "opacity 0.15s ease",
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>language</span>
                        Portfolio
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Quick action buttons */}
            <div style={{ display: "flex", gap: "0.65rem", paddingTop: "0.85rem" }}>
              <button
                id="btn-edit-profile-quick"
                onClick={() => setActiveTab("edit")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.45rem",
                  padding: "0.55rem 1.15rem",
                  borderRadius: "8px",
                  background: activeTab === "edit" ? "#4f46e5" : "#ffffff",
                  color: activeTab === "edit" ? "#ffffff" : "#1e293b",
                  border: "1px solid #cbd5e1",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "1.05rem" }}>
                  edit
                </span>
                Edit Profile
              </button>
              <button
                id="btn-security-quick"
                onClick={() => setActiveTab("security")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.45rem",
                  padding: "0.55rem 1.15rem",
                  borderRadius: "8px",
                  background: activeTab === "security" ? "#4f46e5" : "#ffffff",
                  color: activeTab === "security" ? "#ffffff" : "#1e293b",
                  border: "1px solid #cbd5e1",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "1.05rem" }}>
                  lock
                </span>
                Security
              </button>
            </div>
          </div>

          {/* User Bio */}
          {currentUser?.bio && (
            <p
              style={{
                fontSize: "0.92rem",
                color: "#475569",
                lineHeight: 1.55,
                background: "#f8fafc",
                padding: "0.85rem 1.15rem",
                borderRadius: "8px",
                border: "1px solid #e2e8f0",
                marginTop: "0.5rem",
              }}
            >
              {currentUser.bio}
            </p>
          )}
        </div>

        {/* Clean, Elegant Tabs Bar (Only 4 standard tabs) */}
        <div
          style={{
            display: "flex",
            borderTop: "1px solid #e2e8f0",
            background: "#fafaf9",
            padding: "0 1rem",
          }}
        >
          <button
            id="tab-overview"
            onClick={() => setActiveTab("overview")}
            style={{
              padding: "0.9rem 1.25rem",
              background: "none",
              border: "none",
              borderBottom: activeTab === "overview" ? "2px solid #4f46e5" : "2px solid transparent",
              color: activeTab === "overview" ? "#4f46e5" : "#64748b",
              fontWeight: activeTab === "overview" ? 700 : 500,
              cursor: "pointer",
              fontSize: "0.92rem",
              display: "flex",
              alignItems: "center",
              gap: "0.45rem",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "1.15rem" }}>
              person
            </span>
            Profile Overview
          </button>

          <button
            id="tab-edit"
            onClick={() => setActiveTab("edit")}
            style={{
              padding: "0.9rem 1.25rem",
              background: "none",
              border: "none",
              borderBottom: activeTab === "edit" ? "2px solid #4f46e5" : "2px solid transparent",
              color: activeTab === "edit" ? "#4f46e5" : "#64748b",
              fontWeight: activeTab === "edit" ? 700 : 500,
              cursor: "pointer",
              fontSize: "0.92rem",
              display: "flex",
              alignItems: "center",
              gap: "0.45rem",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "1.15rem" }}>
              edit_note
            </span>
            Edit Details
          </button>

          <button
            id="tab-security"
            onClick={() => setActiveTab("security")}
            style={{
              padding: "0.9rem 1.25rem",
              background: "none",
              border: "none",
              borderBottom: activeTab === "security" ? "2px solid #4f46e5" : "2px solid transparent",
              color: activeTab === "security" ? "#4f46e5" : "#64748b",
              fontWeight: activeTab === "security" ? 700 : 500,
              cursor: "pointer",
              fontSize: "0.92rem",
              display: "flex",
              alignItems: "center",
              gap: "0.45rem",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "1.15rem" }}>
              security
            </span>
            Security & Password
          </button>

          <button
            id="tab-orgs"
            onClick={() => setActiveTab("organizations")}
            style={{
              padding: "0.9rem 1.25rem",
              background: "none",
              border: "none",
              borderBottom: activeTab === "organizations" ? "2px solid #4f46e5" : "2px solid transparent",
              color: activeTab === "organizations" ? "#4f46e5" : "#64748b",
              fontWeight: activeTab === "organizations" ? 700 : 500,
              cursor: "pointer",
              fontSize: "0.92rem",
              display: "flex",
              alignItems: "center",
              gap: "0.45rem",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "1.15rem" }}>
              domain
            </span>
            Affiliations ({orgs.length || 1})
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "4rem 0" }}>
          <div
            style={{
              display: "inline-block",
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              border: "3px solid #e2e8f0",
              borderTopColor: "#4f46e5",
              animation: "spin 0.8s linear infinite",
            }}
          />
          <p style={{ marginTop: "0.85rem", color: "#64748b", fontSize: "0.95rem" }}>Loading profile details...</p>
        </div>
      ) : (
        <div>
          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              {/* Personal & Contact Details Card */}
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: "14px",
                  border: "1px solid #e2e8f0",
                  padding: "1.75rem",
                  boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.04)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
                  <div>
                    <h2 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#0f172a" }}>
                      Account & Contact Information
                    </h2>
                    <p style={{ color: "#64748b", fontSize: "0.88rem", marginTop: "0.15rem" }}>
                      Verified identity and communication details
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab("edit")}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#4f46e5",
                      fontWeight: 600,
                      fontSize: "0.88rem",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.3rem",
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "1.05rem" }}>
                      edit
                    </span>
                    Edit
                  </button>
                </div>

                {/* Clean Contact Grid with crisp white cards & subtle colored icons */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                    gap: "1rem",
                  }}
                >
                  {/* Name */}
                  <div
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: "10px",
                      padding: "1rem 1.15rem",
                      background: "#ffffff",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", color: "#64748b", fontSize: "0.78rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "0.35rem" }}>
                      <span className="material-symbols-outlined" style={{ fontSize: "1.05rem", color: "#4f46e5" }}>
                        badge
                      </span>
                      Full Name
                    </div>
                    <div style={{ fontSize: "1rem", fontWeight: 600, color: "#0f172a" }}>
                      {currentUser?.full_name || "—"}
                    </div>
                  </div>

                  {/* Email */}
                  <div
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: "10px",
                      padding: "1rem 1.15rem",
                      background: "#ffffff",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", color: "#64748b", fontSize: "0.78rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "0.35rem" }}>
                      <span className="material-symbols-outlined" style={{ fontSize: "1.05rem", color: "#0ea5e9" }}>
                        mail
                      </span>
                      Email Address
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: "0.96rem", fontWeight: 600, color: "#0f172a", wordBreak: "break-all" }}>
                        {currentUser?.email || "—"}
                      </span>
                      <button
                        title="Copy Email"
                        onClick={() => copyToClipboard(currentUser?.email || "", "Email")}
                        style={{
                          background: "none",
                          border: "none",
                          color: copyFeedback === "Email" ? "#10b981" : "#94a3b8",
                          cursor: "pointer",
                          padding: "0.15rem",
                          display: "flex",
                          alignItems: "center",
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: "1.1rem" }}>
                          {copyFeedback === "Email" ? "check" : "content_copy"}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Phone Number */}
                  <div
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: "10px",
                      padding: "1rem 1.15rem",
                      background: "#ffffff",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", color: "#64748b", fontSize: "0.78rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "0.35rem" }}>
                      <span className="material-symbols-outlined" style={{ fontSize: "1.05rem", color: "#10b981" }}>
                        call
                      </span>
                      Phone Number
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: "0.96rem", fontWeight: 600, color: currentUser?.phone_number ? "#0f172a" : "#94a3b8" }}>
                        {currentUser?.phone_number || "Not specified"}
                      </span>
                      {currentUser?.phone_number && (
                        <button
                          title="Copy Phone"
                          onClick={() => copyToClipboard(currentUser.phone_number || "", "Phone")}
                          style={{
                            background: "none",
                            border: "none",
                            color: copyFeedback === "Phone" ? "#10b981" : "#94a3b8",
                            cursor: "pointer",
                            padding: "0.15rem",
                            display: "flex",
                            alignItems: "center",
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: "1.1rem" }}>
                            {copyFeedback === "Phone" ? "check" : "content_copy"}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Account / Student ID */}
                  <div
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: "10px",
                      padding: "1rem 1.15rem",
                      background: "#ffffff",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", color: "#64748b", fontSize: "0.78rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "0.35rem" }}>
                      <span className="material-symbols-outlined" style={{ fontSize: "1.05rem", color: "#8b5cf6" }}>
                        tag
                      </span>
                      {studentData?.student_code ? "Student Code" : "Account ID"}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: "0.96rem", fontWeight: 700, fontFamily: "monospace", color: "#4f46e5" }}>
                        {studentData?.student_code || `#USR-${currentUser?.id}`}
                      </span>
                      <button
                        title="Copy ID"
                        onClick={() =>
                          copyToClipboard(
                            studentData?.student_code || `#USR-${currentUser?.id}`,
                            "ID"
                          )
                        }
                        style={{
                          background: "none",
                          border: "none",
                          color: copyFeedback === "ID" ? "#10b981" : "#94a3b8",
                          cursor: "pointer",
                          padding: "0.15rem",
                          display: "flex",
                          alignItems: "center",
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: "1.1rem" }}>
                          {copyFeedback === "ID" ? "check" : "content_copy"}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Organization */}
                  <div
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: "10px",
                      padding: "1rem 1.15rem",
                      background: "#ffffff",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", color: "#64748b", fontSize: "0.78rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "0.35rem" }}>
                      <span className="material-symbols-outlined" style={{ fontSize: "1.05rem", color: "#f59e0b" }}>
                        corporate_fare
                      </span>
                      Organization
                    </div>
                    <div style={{ fontSize: "0.96rem", fontWeight: 600, color: "#0f172a" }}>
                      {organization?.name || "Global Platform"} ({organization?.code || "FORTIVEX"})
                    </div>
                  </div>

                  {/* Status */}
                  <div
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: "10px",
                      padding: "1rem 1.15rem",
                      background: "#ffffff",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", color: "#64748b", fontSize: "0.78rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "0.35rem" }}>
                      <span className="material-symbols-outlined" style={{ fontSize: "1.05rem", color: "#10b981" }}>
                        verified
                      </span>
                      Account Status
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span
                        style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          background: currentUser?.is_active ? "#10b981" : "#ef4444",
                        }}
                      />
                      <span style={{ fontSize: "0.96rem", fontWeight: 600, color: currentUser?.is_active ? "#059669" : "#dc2626" }}>
                        {currentUser?.is_active ? "Active & Verified" : "Suspended"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Online Presence & Professional Profiles Card */}
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: "14px",
                  border: "1px solid #e2e8f0",
                  padding: "1.75rem",
                  boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.04)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", flexWrap: "wrap", gap: "0.5rem" }}>
                  <div>
                    <h2 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#0f172a" }}>
                      Online Presence & Professional Profiles
                    </h2>
                    <p style={{ color: "#64748b", fontSize: "0.88rem", marginTop: "0.15rem" }}>
                      Public links to your GitHub repositories, LinkedIn profile, and personal portfolio
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab("edit")}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#4f46e5",
                      fontWeight: 600,
                      fontSize: "0.88rem",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.3rem",
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "1.05rem" }}>
                      edit
                    </span>
                    Edit Links
                  </button>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                    gap: "1rem",
                  }}
                >
                  {/* GitHub Profile */}
                  <div
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: "10px",
                      padding: "1rem 1.15rem",
                      background: "#ffffff",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      gap: "0.6rem",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", color: "#64748b", fontSize: "0.78rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="#0f172a">
                        <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                      </svg>
                      GitHub
                    </div>
                    {currentUser?.github_url ? (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                        <a
                          href={currentUser.github_url.startsWith("http") ? currentUser.github_url : `https://${currentUser.github_url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            fontSize: "0.94rem",
                            fontWeight: 600,
                            color: "#0f172a",
                            textDecoration: "none",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.3rem",
                          }}
                        >
                          {currentUser.github_url.replace(/^https?:\/\/(www\.)?github\.com\/?/, "@")}
                          <span className="material-symbols-outlined" style={{ fontSize: "14px", color: "#64748b" }}>open_in_new</span>
                        </a>
                        <button
                          title="Copy GitHub URL"
                          onClick={() => copyToClipboard(currentUser.github_url || "", "GitHub URL")}
                          style={{
                            background: "none",
                            border: "none",
                            color: copyFeedback === "GitHub URL" ? "#10b981" : "#94a3b8",
                            cursor: "pointer",
                            padding: "0.15rem",
                            display: "flex",
                            alignItems: "center",
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: "1.1rem" }}>
                            {copyFeedback === "GitHub URL" ? "check" : "content_copy"}
                          </span>
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: "0.9rem", color: "#94a3b8" }}>Not connected</span>
                        <button
                          onClick={() => setActiveTab("edit")}
                          style={{
                            background: "none",
                            border: "none",
                            color: "#4f46e5",
                            fontSize: "0.82rem",
                            fontWeight: 600,
                            cursor: "pointer",
                            padding: "0",
                          }}
                        >
                          + Add GitHub
                        </button>
                      </div>
                    )}
                  </div>

                  {/* LinkedIn Profile */}
                  <div
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: "10px",
                      padding: "1rem 1.15rem",
                      background: "#ffffff",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      gap: "0.6rem",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", color: "#64748b", fontSize: "0.78rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="#0284c7">
                        <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9v8.37H9.2V10.9H6.46M7.83 6.45a1.63 1.63 0 1 0 0 3.26 1.63 1.63 0 0 0 0-3.26z" />
                      </svg>
                      LinkedIn
                    </div>
                    {currentUser?.linkedin_url ? (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                        <a
                          href={currentUser.linkedin_url.startsWith("http") ? currentUser.linkedin_url : `https://${currentUser.linkedin_url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            fontSize: "0.94rem",
                            fontWeight: 600,
                            color: "#0284c7",
                            textDecoration: "none",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.3rem",
                          }}
                        >
                          {currentUser.linkedin_url.replace(/^https?:\/\/(www\.)?linkedin\.com\/in\/?/, "")}
                          <span className="material-symbols-outlined" style={{ fontSize: "14px", color: "#64748b" }}>open_in_new</span>
                        </a>
                        <button
                          title="Copy LinkedIn URL"
                          onClick={() => copyToClipboard(currentUser.linkedin_url || "", "LinkedIn URL")}
                          style={{
                            background: "none",
                            border: "none",
                            color: copyFeedback === "LinkedIn URL" ? "#10b981" : "#94a3b8",
                            cursor: "pointer",
                            padding: "0.15rem",
                            display: "flex",
                            alignItems: "center",
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: "1.1rem" }}>
                            {copyFeedback === "LinkedIn URL" ? "check" : "content_copy"}
                          </span>
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: "0.9rem", color: "#94a3b8" }}>Not connected</span>
                        <button
                          onClick={() => setActiveTab("edit")}
                          style={{
                            background: "none",
                            border: "none",
                            color: "#4f46e5",
                            fontSize: "0.82rem",
                            fontWeight: 600,
                            cursor: "pointer",
                            padding: "0",
                          }}
                        >
                          + Add LinkedIn
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Portfolio Website */}
                  <div
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: "10px",
                      padding: "1rem 1.15rem",
                      background: "#ffffff",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      gap: "0.6rem",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", color: "#64748b", fontSize: "0.78rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      <span className="material-symbols-outlined" style={{ fontSize: "1.05rem", color: "#7c3aed" }}>
                        language
                      </span>
                      Portfolio Website
                    </div>
                    {currentUser?.portfolio_url ? (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                        <a
                          href={currentUser.portfolio_url.startsWith("http") ? currentUser.portfolio_url : `https://${currentUser.portfolio_url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            fontSize: "0.94rem",
                            fontWeight: 600,
                            color: "#7c3aed",
                            textDecoration: "none",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.3rem",
                          }}
                        >
                          {currentUser.portfolio_url.replace(/^https?:\/\//, "")}
                          <span className="material-symbols-outlined" style={{ fontSize: "14px", color: "#64748b" }}>open_in_new</span>
                        </a>
                        <button
                          title="Copy Portfolio URL"
                          onClick={() => copyToClipboard(currentUser.portfolio_url || "", "Portfolio URL")}
                          style={{
                            background: "none",
                            border: "none",
                            color: copyFeedback === "Portfolio URL" ? "#10b981" : "#94a3b8",
                            cursor: "pointer",
                            padding: "0.15rem",
                            display: "flex",
                            alignItems: "center",
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: "1.1rem" }}>
                            {copyFeedback === "Portfolio URL" ? "check" : "content_copy"}
                          </span>
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: "0.9rem", color: "#94a3b8" }}>Not connected</span>
                        <button
                          onClick={() => setActiveTab("edit")}
                          style={{
                            background: "none",
                            border: "none",
                            color: "#4f46e5",
                            fontSize: "0.82rem",
                            fontWeight: 600,
                            cursor: "pointer",
                            padding: "0",
                          }}
                        >
                          + Add Portfolio
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Role-Specific Metrics Card in Overview */}
              {isStudent && studentData && (
                <div
                  style={{
                    background: "#ffffff",
                    borderRadius: "14px",
                    border: "1px solid #e2e8f0",
                    padding: "1.75rem",
                    boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.04)",
                  }}
                >
                  <h3 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#0f172a", marginBottom: "1.25rem" }}>
                    Learning Overview
                  </h3>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                      gap: "1rem",
                    }}
                  >
                    <div style={{ padding: "1.25rem", borderRadius: "10px", background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                      <div style={{ color: "#64748b", fontSize: "0.8rem", fontWeight: 600, textTransform: "uppercase" }}>
                        Enrolled Programs
                      </div>
                      <div style={{ fontSize: "1.85rem", fontWeight: 700, color: "#4f46e5", marginTop: "0.35rem" }}>
                        {studentData.stats?.total_enrollments ?? 0}
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "0.2rem" }}>
                        {studentData.stats?.active_programs ?? 0} active
                      </div>
                    </div>

                    <div style={{ padding: "1.25rem", borderRadius: "10px", background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                      <div style={{ color: "#64748b", fontSize: "0.8rem", fontWeight: 600, textTransform: "uppercase" }}>
                        Completed Activities
                      </div>
                      <div style={{ fontSize: "1.85rem", fontWeight: 700, color: "#10b981", marginTop: "0.35rem" }}>
                        {studentData.stats?.completed_activities ?? 0}
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "0.2rem" }}>
                        Lessons and exercises
                      </div>
                    </div>

                    <div style={{ padding: "1.25rem", borderRadius: "10px", background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                      <div style={{ color: "#64748b", fontSize: "0.8rem", fontWeight: 600, textTransform: "uppercase" }}>
                        Study Time
                      </div>
                      <div style={{ fontSize: "1.85rem", fontWeight: 700, color: "#0284c7", marginTop: "0.35rem" }}>
                        {studentData.stats?.hours_studied ?? "0h"}
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "0.2rem" }}>
                        Total hours logged
                      </div>
                    </div>

                    <div style={{ padding: "1.25rem", borderRadius: "10px", background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                      <div style={{ color: "#64748b", fontSize: "0.8rem", fontWeight: 600, textTransform: "uppercase" }}>
                        Quiz Score Avg
                      </div>
                      <div style={{ fontSize: "1.85rem", fontWeight: 700, color: "#d97706", marginTop: "0.35rem" }}>
                        {studentData.stats?.average_quiz_score ?? "0%"}
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "0.2rem" }}>
                        {studentData.stats?.quiz_attempts ?? 0} attempts
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {isInstructor && instructorData && (
                <div
                  style={{
                    background: "#ffffff",
                    borderRadius: "14px",
                    border: "1px solid #e2e8f0",
                    padding: "1.75rem",
                    boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.04)",
                  }}
                >
                  <h3 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#0f172a", marginBottom: "1.25rem" }}>
                    Teaching & Cohorts Overview
                  </h3>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                      gap: "1rem",
                    }}
                  >
                    <div style={{ padding: "1.25rem", borderRadius: "10px", background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                      <div style={{ color: "#64748b", fontSize: "0.8rem", fontWeight: 600, textTransform: "uppercase" }}>
                        Assigned Cohorts
                      </div>
                      <div style={{ fontSize: "1.85rem", fontWeight: 700, color: "#0284c7", marginTop: "0.35rem" }}>
                        {instructorData.stats?.assigned_cohorts ?? 0}
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "0.2rem" }}>
                        Active cohorts instructed
                      </div>
                    </div>

                    <div style={{ padding: "1.25rem", borderRadius: "10px", background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                      <div style={{ color: "#64748b", fontSize: "0.8rem", fontWeight: 600, textTransform: "uppercase" }}>
                        Students Mentored
                      </div>
                      <div style={{ fontSize: "1.85rem", fontWeight: 700, color: "#10b981", marginTop: "0.35rem" }}>
                        {instructorData.stats?.total_students ?? 0}
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "0.2rem" }}>
                        Learners enrolled in cohorts
                      </div>
                    </div>

                    <div style={{ padding: "1.25rem", borderRadius: "10px", background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                      <div style={{ color: "#64748b", fontSize: "0.8rem", fontWeight: 600, textTransform: "uppercase" }}>
                        Program Tracks
                      </div>
                      <div style={{ fontSize: "1.85rem", fontWeight: 700, color: "#4f46e5", marginTop: "0.35rem" }}>
                        {instructorData.stats?.programs_available ?? 0}
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "0.2rem" }}>
                        Curriculum courses available
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {isAdmin && adminData && (
                <div
                  style={{
                    background: "#ffffff",
                    borderRadius: "14px",
                    border: "1px solid #e2e8f0",
                    padding: "1.75rem",
                    boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.04)",
                  }}
                >
                  <h3 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#0f172a", marginBottom: "1.25rem" }}>
                    Platform & Institutional Metrics
                  </h3>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                      gap: "1rem",
                    }}
                  >
                    <div style={{ padding: "1.25rem", borderRadius: "10px", background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                      <div style={{ color: "#64748b", fontSize: "0.8rem", fontWeight: 600, textTransform: "uppercase" }}>
                        Managed Users
                      </div>
                      <div style={{ fontSize: "1.85rem", fontWeight: 700, color: "#4f46e5", marginTop: "0.35rem" }}>
                        {adminData.stats?.total_managed_users ?? 0}
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "0.2rem" }}>
                        Registered accounts
                      </div>
                    </div>

                    <div style={{ padding: "1.25rem", borderRadius: "10px", background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                      <div style={{ color: "#64748b", fontSize: "0.8rem", fontWeight: 600, textTransform: "uppercase" }}>
                        Enrolled Students
                      </div>
                      <div style={{ fontSize: "1.85rem", fontWeight: 700, color: "#10b981", marginTop: "0.35rem" }}>
                        {adminData.stats?.total_students ?? 0}
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "0.2rem" }}>
                        Active student records
                      </div>
                    </div>

                    <div style={{ padding: "1.25rem", borderRadius: "10px", background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                      <div style={{ color: "#64748b", fontSize: "0.8rem", fontWeight: 600, textTransform: "uppercase" }}>
                        Active Programs
                      </div>
                      <div style={{ fontSize: "1.85rem", fontWeight: 700, color: "#0284c7", marginTop: "0.35rem" }}>
                        {adminData.stats?.total_programs ?? 0}
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "0.2rem" }}>
                        Available curricula
                      </div>
                    </div>

                    <div style={{ padding: "1.25rem", borderRadius: "10px", background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                      <div style={{ color: "#64748b", fontSize: "0.8rem", fontWeight: 600, textTransform: "uppercase" }}>
                        Running Cohorts
                      </div>
                      <div style={{ fontSize: "1.85rem", fontWeight: 700, color: "#d97706", marginTop: "0.35rem" }}>
                        {adminData.stats?.total_cohorts ?? 0}
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "0.2rem" }}>
                        Active classes
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: EDIT PROFILE */}
          {activeTab === "edit" && (
            <div
              style={{
                background: "#ffffff",
                borderRadius: "14px",
                border: "1px solid #e2e8f0",
                padding: "2rem",
                boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.04)",
                maxWidth: "720px",
                margin: "0 auto",
              }}
            >
              <div style={{ marginBottom: "1.75rem" }}>
                <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#0f172a" }}>
                  Edit Profile Details
                </h2>
                <p style={{ color: "#64748b", fontSize: "0.9rem", marginTop: "0.2rem" }}>
                  Keep your name, phone number, title, and bio up to date.
                </p>
              </div>

              <form onSubmit={handleProfileSave} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                  <label htmlFor="input-full-name" style={{ fontSize: "0.88rem", fontWeight: 600, color: "#334155" }}>
                    Full Legal Name *
                  </label>
                  <input
                    id="input-full-name"
                    type="text"
                    required
                    value={editForm.full_name}
                    onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                    style={{
                      padding: "0.75rem 1rem",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      background: "#ffffff",
                      color: "#0f172a",
                      fontSize: "0.95rem",
                    }}
                  />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                  <label htmlFor="input-email-disabled" style={{ fontSize: "0.88rem", fontWeight: 600, color: "#334155" }}>
                    Email Address
                  </label>
                  <input
                    id="input-email-disabled"
                    type="email"
                    disabled
                    value={currentUser?.email || ""}
                    style={{
                      padding: "0.75rem 1rem",
                      borderRadius: "8px",
                      border: "1px solid #e2e8f0",
                      background: "#f8fafc",
                      color: "#64748b",
                      fontSize: "0.95rem",
                      cursor: "not-allowed",
                    }}
                  />
                  <span style={{ fontSize: "0.78rem", color: "#94a3b8" }}>
                    Contact your administrator if you need to update your registered email address.
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                  <label htmlFor="input-phone-number" style={{ fontSize: "0.88rem", fontWeight: 600, color: "#334155" }}>
                    Phone Number (Number) *
                  </label>
                  <input
                    id="input-phone-number"
                    type="tel"
                    placeholder="+1 (555) 123-4567"
                    value={editForm.phone_number || ""}
                    onChange={(e) => setEditForm({ ...editForm, phone_number: e.target.value })}
                    style={{
                      padding: "0.75rem 1rem",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      background: "#ffffff",
                      color: "#0f172a",
                      fontSize: "0.95rem",
                    }}
                  />
                  <span style={{ fontSize: "0.78rem", color: "#64748b" }}>
                    Used for platform verification and emergency academic notifications.
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                  <label htmlFor="input-title" style={{ fontSize: "0.88rem", fontWeight: 600, color: "#334155" }}>
                    Professional Title / Specialization
                  </label>
                  <input
                    id="input-title"
                    type="text"
                    placeholder="e.g. AI & Machine Learning Scholar / Lead Instructor"
                    value={editForm.title || ""}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    style={{
                      padding: "0.75rem 1rem",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      background: "#ffffff",
                      color: "#0f172a",
                      fontSize: "0.95rem",
                    }}
                  />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                  <label htmlFor="input-bio" style={{ fontSize: "0.88rem", fontWeight: 600, color: "#334155" }}>
                    About / Bio
                  </label>
                  <textarea
                    id="input-bio"
                    rows={4}
                    placeholder="A brief overview of your background, experience, or academic goals..."
                    value={editForm.bio || ""}
                    onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                    style={{
                      padding: "0.75rem 1rem",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      background: "#ffffff",
                      color: "#0f172a",
                      fontSize: "0.95rem",
                      fontFamily: "inherit",
                      resize: "vertical",
                    }}
                  />
                </div>

                {/* Social & Professional Links Section */}
                <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "1.25rem", marginTop: "0.25rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                  <div>
                    <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a" }}>
                      Professional Profiles & Portfolio
                    </h3>
                    <p style={{ color: "#64748b", fontSize: "0.85rem", marginTop: "0.15rem" }}>
                      Add your GitHub, LinkedIn, and personal website to showcase your work and build your professional footprint.
                    </p>
                  </div>

                  {/* GitHub Input */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                    <label htmlFor="input-github-url" style={{ fontSize: "0.88rem", fontWeight: 600, color: "#334155", display: "flex", alignItems: "center", gap: "0.45rem" }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="#0f172a">
                        <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                      </svg>
                      GitHub Profile URL
                    </label>
                    <input
                      id="input-github-url"
                      type="url"
                      placeholder="https://github.com/your-username"
                      value={editForm.github_url || ""}
                      onChange={(e) => setEditForm({ ...editForm, github_url: e.target.value })}
                      style={{
                        padding: "0.75rem 1rem",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        background: "#ffffff",
                        color: "#0f172a",
                        fontSize: "0.95rem",
                      }}
                    />
                    <span style={{ fontSize: "0.78rem", color: "#64748b" }}>
                      Showcase your coding activity, project repositories, and assignment implementations.
                    </span>
                  </div>

                  {/* LinkedIn Input */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                    <label htmlFor="input-linkedin-url" style={{ fontSize: "0.88rem", fontWeight: 600, color: "#334155", display: "flex", alignItems: "center", gap: "0.45rem" }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="#0284c7">
                        <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9v8.37H9.2V10.9H6.46M7.83 6.45a1.63 1.63 0 1 0 0 3.26 1.63 1.63 0 0 0 0-3.26z" />
                      </svg>
                      LinkedIn Profile URL
                    </label>
                    <input
                      id="input-linkedin-url"
                      type="url"
                      placeholder="https://linkedin.com/in/your-profile"
                      value={editForm.linkedin_url || ""}
                      onChange={(e) => setEditForm({ ...editForm, linkedin_url: e.target.value })}
                      style={{
                        padding: "0.75rem 1rem",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        background: "#ffffff",
                        color: "#0f172a",
                        fontSize: "0.95rem",
                      }}
                    />
                    <span style={{ fontSize: "0.78rem", color: "#64748b" }}>
                      Connect with peers, industry mentors, and hiring managers from partner organizations.
                    </span>
                  </div>

                  {/* Portfolio Input */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                    <label htmlFor="input-portfolio-url" style={{ fontSize: "0.88rem", fontWeight: 600, color: "#334155", display: "flex", alignItems: "center", gap: "0.45rem" }}>
                      <span className="material-symbols-outlined" style={{ fontSize: "1.05rem", color: "#7c3aed" }}>
                        language
                      </span>
                      Personal Portfolio / Website URL
                    </label>
                    <input
                      id="input-portfolio-url"
                      type="url"
                      placeholder="https://yourportfolio.com or https://yourname.dev"
                      value={editForm.portfolio_url || ""}
                      onChange={(e) => setEditForm({ ...editForm, portfolio_url: e.target.value })}
                      style={{
                        padding: "0.75rem 1rem",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        background: "#ffffff",
                        color: "#0f172a",
                        fontSize: "0.95rem",
                      }}
                    />
                    <span style={{ fontSize: "0.78rem", color: "#64748b" }}>
                      Link your personal website, case studies, or interactive portfolio work.
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
                  <button
                    id="btn-save-profile"
                    type="submit"
                    disabled={isSavingProfile}
                    style={{
                      padding: "0.75rem 1.6rem",
                      borderRadius: "8px",
                      background: "#4f46e5",
                      color: "#ffffff",
                      border: "none",
                      fontWeight: 600,
                      fontSize: "0.92rem",
                      cursor: isSavingProfile ? "not-allowed" : "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.45rem",
                    }}
                  >
                    {isSavingProfile ? "Saving Changes..." : "Save Details"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("overview")}
                    style={{
                      padding: "0.75rem 1.35rem",
                      borderRadius: "8px",
                      background: "none",
                      border: "1px solid #cbd5e1",
                      color: "#64748b",
                      fontWeight: 600,
                      fontSize: "0.92rem",
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 3: SECURITY */}
          {activeTab === "security" && (
            <div
              style={{
                background: "#ffffff",
                borderRadius: "14px",
                border: "1px solid #e2e8f0",
                padding: "2rem",
                boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.04)",
                maxWidth: "640px",
                margin: "0 auto",
              }}
            >
              <div style={{ marginBottom: "1.75rem" }}>
                <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#0f172a" }}>
                  Change Account Password
                </h2>
                <p style={{ color: "#64748b", fontSize: "0.9rem", marginTop: "0.2rem" }}>
                  Update your security credentials regularly for optimal account security.
                </p>
              </div>

              <form onSubmit={handlePasswordSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                  <label htmlFor="input-current-password" style={{ fontSize: "0.88rem", fontWeight: 600, color: "#334155" }}>
                    Current Password *
                  </label>
                  <input
                    id="input-current-password"
                    type={showPasswords ? "text" : "password"}
                    required
                    placeholder="Enter current password"
                    value={passwordForm.current_password}
                    onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
                    style={{
                      padding: "0.75rem 1rem",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      background: "#ffffff",
                      color: "#0f172a",
                      fontSize: "0.95rem",
                    }}
                  />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                  <label htmlFor="input-new-password" style={{ fontSize: "0.88rem", fontWeight: 600, color: "#334155" }}>
                    New Password *
                  </label>
                  <input
                    id="input-new-password"
                    type={showPasswords ? "text" : "password"}
                    required
                    placeholder="At least 8 characters"
                    value={passwordForm.new_password}
                    onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                    style={{
                      padding: "0.75rem 1rem",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      background: "#ffffff",
                      color: "#0f172a",
                      fontSize: "0.95rem",
                    }}
                  />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                  <label htmlFor="input-confirm-password" style={{ fontSize: "0.88rem", fontWeight: 600, color: "#334155" }}>
                    Confirm New Password *
                  </label>
                  <input
                    id="input-confirm-password"
                    type={showPasswords ? "text" : "password"}
                    required
                    placeholder="Re-enter new password"
                    value={passwordForm.confirm_password}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                    style={{
                      padding: "0.75rem 1rem",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      background: "#ffffff",
                      color: "#0f172a",
                      fontSize: "0.95rem",
                    }}
                  />
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <input
                    id="toggle-show-passwords"
                    type="checkbox"
                    checked={showPasswords}
                    onChange={(e) => setShowPasswords(e.target.checked)}
                    style={{ cursor: "pointer", width: "16px", height: "16px" }}
                  />
                  <label htmlFor="toggle-show-passwords" style={{ fontSize: "0.85rem", color: "#64748b", cursor: "pointer" }}>
                    Show password characters
                  </label>
                </div>

                <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
                  <button
                    id="btn-update-password"
                    type="submit"
                    disabled={isChangingPassword}
                    style={{
                      padding: "0.75rem 1.6rem",
                      borderRadius: "8px",
                      background: "#4f46e5",
                      color: "#ffffff",
                      border: "none",
                      fontWeight: 600,
                      fontSize: "0.92rem",
                      cursor: isChangingPassword ? "not-allowed" : "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.45rem",
                    }}
                  >
                    {isChangingPassword ? "Updating Password..." : "Update Password"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 4: ORGANIZATIONS */}
          {activeTab === "organizations" && (
            <div
              style={{
                background: "#ffffff",
                borderRadius: "14px",
                border: "1px solid #e2e8f0",
                padding: "2rem",
                boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.04)",
              }}
            >
              <div style={{ marginBottom: "1.5rem" }}>
                <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#0f172a" }}>
                  Affiliated Educational Tenants
                </h2>
                <p style={{ color: "#64748b", fontSize: "0.9rem", marginTop: "0.2rem" }}>
                  Academic institutions associated with your account
                </p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {orgs.map((org) => (
                  <div
                    key={org.id}
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: "12px",
                      padding: "1.35rem 1.5rem",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "1rem",
                      background: "#f8fafc",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                      <div
                        style={{
                          width: "48px",
                          height: "48px",
                          borderRadius: "10px",
                          background: "#4f46e5",
                          color: "#ffffff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "1.3rem",
                          fontWeight: 700,
                        }}
                      >
                        {org.code?.charAt(0) || "O"}
                      </div>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#0f172a" }}>{org.name}</h3>
                          <span
                            style={{
                              fontSize: "0.72rem",
                              fontWeight: 700,
                              padding: "0.15rem 0.5rem",
                              borderRadius: "4px",
                              background: "#ecfdf5",
                              color: "#059669",
                              border: "1px solid #a7f3d0",
                            }}
                          >
                            Active Tenant
                          </span>
                        </div>
                        <div style={{ fontSize: "0.82rem", color: "#64748b", marginTop: "0.2rem" }}>
                          Code: <strong>{org.code}</strong> · Domain: <strong>{org.lms_domain || "Standard Portal"}</strong>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap" }}>
                      {org.roles.map((r) => (
                        <span
                          key={r}
                          style={{
                            padding: "0.25rem 0.65rem",
                            borderRadius: "6px",
                            fontSize: "0.78rem",
                            fontWeight: 600,
                            background: "#ffffff",
                            color: "#4338ca",
                            border: "1px solid #c7d2fe",
                          }}
                        >
                          Role: {r.replace("_", " ")}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ProfilePage() {
  return (
    <RequireAuth>
      <FullProfileContent />
    </RequireAuth>
  );
}
