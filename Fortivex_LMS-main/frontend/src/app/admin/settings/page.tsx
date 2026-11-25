"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PROGRAM_COHORT_ADMIN_ROLES } from "@/lib/auth/roles";
import { useAuth } from "@/lib/auth/AuthContext";
import { getOrganization, updateOrganization, listOrganizations } from "@/lib/api/endpoints";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { LoadingState } from "@/components/ui/LoadingState";
import type { Organization } from "@/lib/api/types";

type SettingsTab = "general" | "branding" | "governance" | "ai_integrations";

const PRESET_COLORS = [
  { name: "Indigo", hex: "#4f46e5" },
  { name: "Ocean Blue", hex: "#0284c7" },
  { name: "Emerald", hex: "#10b981" },
  { name: "Royal Purple", hex: "#7c3aed" },
  { name: "Rose", hex: "#e11d48" },
  { name: "Amber", hex: "#d97706" },
  { name: "Dark Slate", hex: "#1e293b" },
];

function SettingsContent() {
  const { token, user, organizations: authOrgs, refreshUser } = useAuth();
  const isSuperAdmin = user?.roles.includes("SUPER_ADMIN") || false;

  // Multi-organization selection
  const [allOrgs, setAllOrgs] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null);
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form Fields - General
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [code, setCode] = useState("");
  const [primaryDomain, setPrimaryDomain] = useState("");
  const [lmsDomain, setLmsDomain] = useState("");
  const [statusVal, setStatusVal] = useState("ACTIVE");
  const [tagline, setTagline] = useState("");
  const [supportEmail, setSupportEmail] = useState("");

  // Form Fields - Branding
  const [primaryColor, setPrimaryColor] = useState("#4f46e5");
  const [secondaryColor, setSecondaryColor] = useState("#0ea5e9");
  const [logoUrl, setLogoUrl] = useState("");
  const [faviconUrl, setFaviconUrl] = useState("");
  const [defaultTheme, setDefaultTheme] = useState<"system" | "dark" | "light">("system");

  // Form Fields - Governance
  const [passPercentage, setPassPercentage] = useState(70);
  const [defaultDueDays, setDefaultDueDays] = useState(7);
  const [streakFreezeLimit, setStreakFreezeLimit] = useState(1);
  const [allowSelfEnrollment, setAllowSelfEnrollment] = useState(true);
  const [enableLeaderboard, setEnableLeaderboard] = useState(true);
  const [enableCertificates, setEnableCertificates] = useState(true);
  const [latePolicy, setLatePolicy] = useState("penalty");

  // Form Fields - AI & Features
  const [aiTutorEnabled, setAiTutorEnabled] = useState(true);
  const [dailyAiQuotaMinutes, setDailyAiQuotaMinutes] = useState(60);
  const [aiQuizFeedback, setAiQuizFeedback] = useState(true);
  const [liveClassroomsEnabled, setLiveClassroomsEnabled] = useState(true);
  const [announcementActive, setAnnouncementActive] = useState(false);
  const [announcementMessage, setAnnouncementMessage] = useState("");
  const [announcementType, setAnnouncementType] = useState<"info" | "warning" | "alert">("info");

  // Load organizations list
  const loadOrganizations = useCallback(async () => {
    if (!token) return;
    try {
      setIsLoading(true);
      const orgs = await listOrganizations(token);
      setAllOrgs(orgs);
      if (orgs.length > 0) {
        // Keep current selected if valid, otherwise pick first
        setSelectedOrgId((prev) => (prev && orgs.some((o) => o.id === prev) ? prev : orgs[0].id));
      }
    } catch (err) {
      setStatusMessage({ type: "error", text: "Failed to load organizations." });
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadOrganizations();
  }, [loadOrganizations]);

  // Sync form fields from organization
  const syncOrgToForm = useCallback((org: Organization) => {
    setCurrentOrg(org);
    setName(org.name || "");
    setSlug(org.slug || "");
    setCode(org.code || "");
    setPrimaryDomain(org.primary_domain || "");
    setLmsDomain(org.lms_domain || "");
    setStatusVal(org.status || "ACTIVE");

    const brand = (org.brand_config || {}) as Record<string, any>;
    setTagline(brand.tagline || "");
    setSupportEmail(brand.support_email || "");
    setPrimaryColor(brand.primary_color || "#4f46e5");
    setSecondaryColor(brand.secondary_color || "#0ea5e9");
    setLogoUrl(brand.logo_url || "");
    setFaviconUrl(brand.favicon_url || "");
    setDefaultTheme(brand.default_theme || "system");

    const gov = (brand.governance || {}) as Record<string, any>;
    setPassPercentage(typeof gov.pass_percentage === "number" ? gov.pass_percentage : 70);
    setDefaultDueDays(typeof gov.default_due_days === "number" ? gov.default_due_days : 7);
    setStreakFreezeLimit(typeof gov.streak_freeze_limit === "number" ? gov.streak_freeze_limit : 1);
    setAllowSelfEnrollment(gov.allow_self_enrollment !== false);
    setEnableLeaderboard(gov.enable_leaderboard !== false);
    setEnableCertificates(gov.enable_certificates !== false);
    setLatePolicy(gov.late_policy || "penalty");

    const ai = (brand.ai_features || {}) as Record<string, any>;
    setAiTutorEnabled(ai.tutor_enabled !== false);
    setDailyAiQuotaMinutes(typeof ai.daily_quota_minutes === "number" ? ai.daily_quota_minutes : 60);
    setAiQuizFeedback(ai.quiz_feedback !== false);

    const intg = (brand.integrations || {}) as Record<string, any>;
    setLiveClassroomsEnabled(intg.live_classrooms !== false);

    const ann = (brand.announcement || {}) as Record<string, any>;
    setAnnouncementActive(Boolean(ann.active));
    setAnnouncementMessage(ann.message || "");
    setAnnouncementType(ann.type || "info");
  }, []);

  // Fetch full details whenever selectedOrgId changes
  useEffect(() => {
    if (!token || !selectedOrgId) return;

    let active = true;
    getOrganization(token, selectedOrgId)
      .then((org) => {
        if (active) {
          syncOrgToForm(org);
        }
      })
      .catch((err) => {
        if (active) {
          setStatusMessage({ type: "error", text: "Could not fetch details for selected organization." });
        }
      });

    return () => {
      active = false;
    };
  }, [token, selectedOrgId, syncOrgToForm]);

  // Compute dirty state
  const isDirty = useMemo(() => {
    if (!currentOrg) return false;
    const brand = (currentOrg.brand_config || {}) as Record<string, any>;
    const gov = (brand.governance || {}) as Record<string, any>;
    const ai = (brand.ai_features || {}) as Record<string, any>;
    const intg = (brand.integrations || {}) as Record<string, any>;
    const ann = (brand.announcement || {}) as Record<string, any>;

    if (name !== (currentOrg.name || "")) return true;
    if (primaryDomain !== (currentOrg.primary_domain || "")) return true;
    if (lmsDomain !== (currentOrg.lms_domain || "")) return true;
    if (tagline !== (brand.tagline || "")) return true;
    if (supportEmail !== (brand.support_email || "")) return true;
    if (primaryColor !== (brand.primary_color || "#4f46e5")) return true;
    if (secondaryColor !== (brand.secondary_color || "#0ea5e9")) return true;
    if (logoUrl !== (brand.logo_url || "")) return true;
    if (faviconUrl !== (brand.favicon_url || "")) return true;
    if (defaultTheme !== (brand.default_theme || "system")) return true;

    if (passPercentage !== (gov.pass_percentage ?? 70)) return true;
    if (defaultDueDays !== (gov.default_due_days ?? 7)) return true;
    if (streakFreezeLimit !== (gov.streak_freeze_limit ?? 1)) return true;
    if (allowSelfEnrollment !== (gov.allow_self_enrollment ?? true)) return true;
    if (enableLeaderboard !== (gov.enable_leaderboard ?? true)) return true;
    if (enableCertificates !== (gov.enable_certificates ?? true)) return true;
    if (latePolicy !== (gov.late_policy || "penalty")) return true;

    if (aiTutorEnabled !== (ai.tutor_enabled ?? true)) return true;
    if (dailyAiQuotaMinutes !== (ai.daily_quota_minutes ?? 60)) return true;
    if (aiQuizFeedback !== (ai.quiz_feedback ?? true)) return true;
    if (liveClassroomsEnabled !== (intg.live_classrooms ?? true)) return true;
    if (announcementActive !== Boolean(ann.active)) return true;
    if (announcementMessage !== (ann.message || "")) return true;
    if (announcementType !== (ann.type || "info")) return true;

    if (isSuperAdmin) {
      if (slug !== (currentOrg.slug || "")) return true;
      if (code !== (currentOrg.code || "")) return true;
      if (statusVal !== (currentOrg.status || "ACTIVE")) return true;
    }

    return false;
  }, [
    currentOrg,
    name,
    primaryDomain,
    lmsDomain,
    tagline,
    supportEmail,
    primaryColor,
    secondaryColor,
    logoUrl,
    faviconUrl,
    defaultTheme,
    passPercentage,
    defaultDueDays,
    streakFreezeLimit,
    allowSelfEnrollment,
    enableLeaderboard,
    enableCertificates,
    latePolicy,
    aiTutorEnabled,
    dailyAiQuotaMinutes,
    aiQuizFeedback,
    liveClassroomsEnabled,
    announcementActive,
    announcementMessage,
    announcementType,
    isSuperAdmin,
    slug,
    code,
    statusVal,
  ]);

  // Handle Save
  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!token || !selectedOrgId) return;

    if (!name.trim()) {
      setStatusMessage({ type: "error", text: "Organization name cannot be empty." });
      return;
    }

    try {
      setIsSaving(true);
      setStatusMessage(null);

      const payload: {
        name: string;
        primary_domain: string | null;
        lms_domain: string | null;
        slug?: string;
        code?: string;
        status?: string;
        brand_config: Record<string, unknown>;
      } = {
        name: name.trim(),
        primary_domain: primaryDomain.trim() || null,
        lms_domain: lmsDomain.trim() || null,
        brand_config: {
          tagline: tagline.trim(),
          support_email: supportEmail.trim(),
          primary_color: primaryColor,
          secondary_color: secondaryColor,
          logo_url: logoUrl.trim(),
          favicon_url: faviconUrl.trim(),
          default_theme: defaultTheme,
          governance: {
            pass_percentage: Number(passPercentage),
            default_due_days: Number(defaultDueDays),
            streak_freeze_limit: Number(streakFreezeLimit),
            allow_self_enrollment: allowSelfEnrollment,
            enable_leaderboard: enableLeaderboard,
            enable_certificates: enableCertificates,
            late_policy: latePolicy,
          },
          ai_features: {
            tutor_enabled: aiTutorEnabled,
            daily_quota_minutes: Number(dailyAiQuotaMinutes),
            quiz_feedback: aiQuizFeedback,
          },
          integrations: {
            live_classrooms: liveClassroomsEnabled,
          },
          announcement: {
            active: announcementActive,
            message: announcementMessage.trim(),
            type: announcementType,
          },
        },
      };

      if (isSuperAdmin) {
        if (slug.trim()) payload.slug = slug.trim().toLowerCase();
        if (code.trim()) payload.code = code.trim().toUpperCase();
        payload.status = statusVal;
      }

      const updated = await updateOrganization(token, selectedOrgId, payload);
      syncOrgToForm(updated);

      // Update in organizations list as well
      setAllOrgs((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));

      // Refresh auth context so top navigation immediately updates
      await refreshUser();

      setStatusMessage({
        type: "success",
        text: "Platform & organization settings saved successfully! Changes are now active.",
      });

      // Auto-hide success message after 5 seconds
      setTimeout(() => {
        setStatusMessage((current) => (current?.type === "success" ? null : current));
      }, 5000);
    } catch (err: any) {
      const msg = err?.message || "Failed to update platform settings.";
      setStatusMessage({ type: "error", text: msg });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscard = () => {
    if (currentOrg) {
      syncOrgToForm(currentOrg);
      setStatusMessage(null);
    }
  };

  if (isLoading) {
    return <LoadingState message="Loading platform configuration..." />;
  }

  if (!currentOrg) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <p style={{ color: "var(--color-muted)", fontSize: "1.1rem" }}>
          No organization accessible to configure.
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "1140px", margin: "0 auto", paddingBottom: "5rem" }}>
      {/* Top Banner / Header */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "1.5rem",
          marginBottom: "2rem",
          paddingBottom: "1.5rem",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                background: "var(--primary-light)",
                color: "var(--primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="tune" size={22} />
            </div>
            <div>
              <h1 style={{ fontSize: "1.85rem", fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>
                Platform Settings
              </h1>
              <p style={{ color: "var(--text-muted)", fontSize: "0.95rem", margin: 0 }}>
                Configure multi-tenant branding, academic governance, and system-wide AI capabilities.
              </p>
            </div>
          </div>
        </div>

        {/* Tenant Scope / Selector */}
        <div
          style={{
            background: "var(--bg-surface)",
            padding: "0.75rem 1.25rem",
            borderRadius: "12px",
            border: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div>
            <div style={{ fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.05em" }}>
              Scope & Tenant
            </div>
            {isSuperAdmin && allOrgs.length > 1 ? (
              <select
                value={selectedOrgId || ""}
                onChange={(e) => setSelectedOrgId(Number(e.target.value))}
                style={{
                  background: "transparent",
                  border: "none",
                  fontWeight: 600,
                  fontSize: "1rem",
                  color: "var(--foreground)",
                  cursor: "pointer",
                  outline: "none",
                  paddingRight: "1rem",
                }}
              >
                {allOrgs.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name} ({org.code})
                  </option>
                ))}
              </select>
            ) : (
              <div style={{ fontWeight: 600, fontSize: "1rem", color: "var(--foreground)" }}>
                {currentOrg.name} ({currentOrg.code})
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <Badge status={currentOrg.status}>
              {currentOrg.status}
            </Badge>
            <Badge>
              {isSuperAdmin ? "Super Admin" : "Academic Admin"}
            </Badge>
          </div>
        </div>
      </div>

      {/* Status Notifications */}
      {statusMessage && (
        <div
          style={{
            padding: "1rem 1.25rem",
            borderRadius: "10px",
            marginBottom: "1.5rem",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            background: statusMessage.type === "success" ? "var(--success-light)" : "var(--danger-light)",
            border: `1px solid ${statusMessage.type === "success" ? "var(--success)" : "var(--danger)"}`,
            color: statusMessage.type === "success" ? "#065f46" : "#991b1b",
            fontSize: "0.95rem",
            fontWeight: 500,
            animation: "fadeIn 0.2s ease-out",
          }}
        >
          <Icon name={statusMessage.type === "success" ? "check_circle" : "close"} size={20} />
          <span style={{ flex: 1 }}>{statusMessage.text}</span>
          <button
            onClick={() => setStatusMessage(null)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "inherit",
              opacity: 0.8,
              padding: "2px",
            }}
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      )}

      {/* Tabs Bar */}
      <div
        style={{
          display: "flex",
          borderBottom: "2px solid var(--border)",
          gap: "0.5rem",
          marginBottom: "2rem",
          overflowX: "auto",
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab("general")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.85rem 1.25rem",
            fontWeight: 600,
            fontSize: "0.95rem",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            borderBottom: activeTab === "general" ? "3px solid var(--primary)" : "3px solid transparent",
            color: activeTab === "general" ? "var(--primary)" : "var(--text-muted)",
            marginBottom: "-2px",
            transition: "all 0.15s ease",
          }}
        >
          <Icon name="corporate_fare" size={18} />
          General & Identity
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("branding")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.85rem 1.25rem",
            fontWeight: 600,
            fontSize: "0.95rem",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            borderBottom: activeTab === "branding" ? "3px solid var(--primary)" : "3px solid transparent",
            color: activeTab === "branding" ? "var(--primary)" : "var(--text-muted)",
            marginBottom: "-2px",
            transition: "all 0.15s ease",
          }}
        >
          <Icon name="auto_stories" size={18} />
          Branding & Theming
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("governance")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.85rem 1.25rem",
            fontWeight: 600,
            fontSize: "0.95rem",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            borderBottom: activeTab === "governance" ? "3px solid var(--primary)" : "3px solid transparent",
            color: activeTab === "governance" ? "var(--primary)" : "var(--text-muted)",
            marginBottom: "-2px",
            transition: "all 0.15s ease",
          }}
        >
          <Icon name="school" size={18} />
          Academic Governance
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("ai_integrations")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.85rem 1.25rem",
            fontWeight: 600,
            fontSize: "0.95rem",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            borderBottom: activeTab === "ai_integrations" ? "3px solid var(--primary)" : "3px solid transparent",
            color: activeTab === "ai_integrations" ? "var(--primary)" : "var(--text-muted)",
            marginBottom: "-2px",
            transition: "all 0.15s ease",
          }}
        >
          <Icon name="insights" size={18} />
          AI & Features
        </button>
      </div>

      {/* Main Settings Form Container */}
      <form onSubmit={handleSave}>
        {/* ========================================================= */}
        {/* TAB 1: GENERAL & IDENTITY */}
        {/* ========================================================= */}
        {activeTab === "general" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
            <div
              style={{
                background: "var(--bg-surface)",
                borderRadius: "14px",
                border: "1px solid var(--border)",
                padding: "2rem",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <div style={{ marginBottom: "1.5rem" }}>
                <h3 style={{ fontSize: "1.2rem", fontWeight: 700, margin: "0 0 0.35rem 0" }}>
                  Organization Profile
                </h3>
                <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", margin: 0 }}>
                  Basic identity information for this tenant instance.
                </p>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                  gap: "1.5rem",
                }}
              >
                <div>
                  <label style={{ display: "block", fontSize: "0.88rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                    Organization Display Name *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    style={{
                      width: "100%",
                      padding: "0.75rem 1rem",
                      borderRadius: "8px",
                      border: "1px solid var(--border)",
                      background: "var(--background)",
                      color: "var(--foreground)",
                      fontSize: "0.95rem",
                      outline: "none",
                    }}
                  />
                  <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                    Used on certificates, emails, and student portals.
                  </span>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.88rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                    Portal Tagline / Mission
                  </label>
                  <input
                    type="text"
                    value={tagline}
                    onChange={(e) => setTagline(e.target.value)}
                    placeholder="e.g. Empowering next-generation tech leaders"
                    style={{
                      width: "100%",
                      padding: "0.75rem 1rem",
                      borderRadius: "8px",
                      border: "1px solid var(--border)",
                      background: "var(--background)",
                      color: "var(--foreground)",
                      fontSize: "0.95rem",
                      outline: "none",
                    }}
                  />
                  <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                    Displayed on login banners and catalog homepages.
                  </span>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.88rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                    Support / Helpdesk Email
                  </label>
                  <input
                    type="email"
                    value={supportEmail}
                    onChange={(e) => setSupportEmail(e.target.value)}
                    placeholder="support@organization.edu"
                    style={{
                      width: "100%",
                      padding: "0.75rem 1rem",
                      borderRadius: "8px",
                      border: "1px solid var(--border)",
                      background: "var(--background)",
                      color: "var(--foreground)",
                      fontSize: "0.95rem",
                      outline: "none",
                    }}
                  />
                  <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                    Contact address provided to learners encountering technical problems.
                  </span>
                </div>

                {isSuperAdmin && (
                  <div>
                    <label style={{ display: "block", fontSize: "0.88rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                      Instance Status (Super Admin)
                    </label>
                    <select
                      value={statusVal}
                      onChange={(e) => setStatusVal(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "0.75rem 1rem",
                        borderRadius: "8px",
                        border: "1px solid var(--border)",
                        background: "var(--background)",
                        color: "var(--foreground)",
                        fontSize: "0.95rem",
                        outline: "none",
                        cursor: "pointer",
                      }}
                    >
                      <option value="ACTIVE">ACTIVE (Fully operational)</option>
                      <option value="SUSPENDED">SUSPENDED (Access locked)</option>
                      <option value="PENDING">PENDING (Onboarding)</option>
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Domains & Routing Section */}
            <div
              style={{
                background: "var(--bg-surface)",
                borderRadius: "14px",
                border: "1px solid var(--border)",
                padding: "2rem",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <div style={{ marginBottom: "1.5rem" }}>
                <h3 style={{ fontSize: "1.2rem", fontWeight: 700, margin: "0 0 0.35rem 0" }}>
                  Domain Routing & Identifiers
                </h3>
                <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", margin: 0 }}>
                  Unique tenant identifiers and custom hostname routing.
                </p>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                  gap: "1.5rem",
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                    <label style={{ fontSize: "0.88rem", fontWeight: 600 }}>Unique Slug</label>
                    {!isSuperAdmin && <Badge>Super Admin Only</Badge>}
                  </div>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    disabled={!isSuperAdmin}
                    style={{
                      width: "100%",
                      padding: "0.75rem 1rem",
                      borderRadius: "8px",
                      border: "1px solid var(--border)",
                      background: isSuperAdmin ? "var(--background)" : "var(--bg-subtle)",
                      color: isSuperAdmin ? "var(--foreground)" : "var(--text-muted)",
                      fontSize: "0.95rem",
                      cursor: isSuperAdmin ? "text" : "not-allowed",
                      outline: "none",
                    }}
                  />
                  <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                    URL path identifier (e.g., /org/{slug})
                  </span>
                </div>

                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                    <label style={{ fontSize: "0.88rem", fontWeight: 600 }}>Organization Code</label>
                    {!isSuperAdmin && <Badge>Super Admin Only</Badge>}
                  </div>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    disabled={!isSuperAdmin}
                    style={{
                      width: "100%",
                      padding: "0.75rem 1rem",
                      borderRadius: "8px",
                      border: "1px solid var(--border)",
                      background: isSuperAdmin ? "var(--background)" : "var(--bg-subtle)",
                      color: isSuperAdmin ? "var(--foreground)" : "var(--text-muted)",
                      fontSize: "0.95rem",
                      cursor: isSuperAdmin ? "text" : "not-allowed",
                      outline: "none",
                    }}
                  />
                  <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                    Student code and enrollment prefix (e.g., {code}-0001)
                  </span>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.88rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                    Primary Web Domain
                  </label>
                  <input
                    type="text"
                    value={primaryDomain}
                    onChange={(e) => setPrimaryDomain(e.target.value)}
                    placeholder="e.g. empowersacademy.com"
                    style={{
                      width: "100%",
                      padding: "0.75rem 1rem",
                      borderRadius: "8px",
                      border: "1px solid var(--border)",
                      background: "var(--background)",
                      color: "var(--foreground)",
                      fontSize: "0.95rem",
                      outline: "none",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.88rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                    Dedicated LMS Domain
                  </label>
                  <input
                    type="text"
                    value={lmsDomain}
                    onChange={(e) => setLmsDomain(e.target.value)}
                    placeholder="e.g. learn.empowersacademy.com"
                    style={{
                      width: "100%",
                      padding: "0.75rem 1rem",
                      borderRadius: "8px",
                      border: "1px solid var(--border)",
                      background: "var(--background)",
                      color: "var(--foreground)",
                      fontSize: "0.95rem",
                      outline: "none",
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: BRANDING & THEME */}
        {/* ========================================================= */}
        {activeTab === "branding" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                gap: "1.75rem",
              }}
            >
              {/* Left Column: Brand Configuration */}
              <div
                style={{
                  background: "var(--bg-surface)",
                  borderRadius: "14px",
                  border: "1px solid var(--border)",
                  padding: "2rem",
                  boxShadow: "var(--shadow-sm)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "1.5rem",
                }}
              >
                <div>
                  <h3 style={{ fontSize: "1.2rem", fontWeight: 700, margin: "0 0 0.35rem 0" }}>
                    Brand Colors & Logos
                  </h3>
                  <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", margin: 0 }}>
                    Customize portal branding for students and instructors.
                  </p>
                </div>

                {/* Primary Color Picker */}
                <div>
                  <label style={{ display: "block", fontSize: "0.88rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                    Primary Brand Color
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      style={{
                        width: "48px",
                        height: "40px",
                        padding: 0,
                        border: "1px solid var(--border)",
                        borderRadius: "8px",
                        cursor: "pointer",
                        background: "none",
                      }}
                    />
                    <input
                      type="text"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      style={{
                        flex: 1,
                        padding: "0.75rem 1rem",
                        borderRadius: "8px",
                        border: "1px solid var(--border)",
                        background: "var(--background)",
                        color: "var(--foreground)",
                        fontFamily: "var(--font-geist-mono), monospace",
                        fontSize: "0.95rem",
                        outline: "none",
                      }}
                    />
                  </div>

                  {/* Preset Swatches */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                    {PRESET_COLORS.map((preset) => (
                      <button
                        key={preset.hex}
                        type="button"
                        onClick={() => setPrimaryColor(preset.hex)}
                        title={preset.name}
                        style={{
                          width: "24px",
                          height: "24px",
                          borderRadius: "6px",
                          backgroundColor: preset.hex,
                          border: primaryColor.toLowerCase() === preset.hex.toLowerCase() ? "2px solid #000" : "1px solid rgba(0,0,0,0.1)",
                          cursor: "pointer",
                          transform: primaryColor.toLowerCase() === preset.hex.toLowerCase() ? "scale(1.15)" : "none",
                          transition: "all 0.1s ease",
                        }}
                      />
                    ))}
                  </div>
                </div>

                {/* Secondary Accent Color */}
                <div>
                  <label style={{ display: "block", fontSize: "0.88rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                    Secondary Accent Color
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <input
                      type="color"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      style={{
                        width: "48px",
                        height: "40px",
                        padding: 0,
                        border: "1px solid var(--border)",
                        borderRadius: "8px",
                        cursor: "pointer",
                        background: "none",
                      }}
                    />
                    <input
                      type="text"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      style={{
                        flex: 1,
                        padding: "0.75rem 1rem",
                        borderRadius: "8px",
                        border: "1px solid var(--border)",
                        background: "var(--background)",
                        color: "var(--foreground)",
                        fontFamily: "var(--font-geist-mono), monospace",
                        fontSize: "0.95rem",
                        outline: "none",
                      }}
                    />
                  </div>
                </div>

                {/* Logo URL */}
                <div>
                  <label style={{ display: "block", fontSize: "0.88rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                    Institution Logo Image URL
                  </label>
                  <input
                    type="url"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="https://example.com/assets/logo.png"
                    style={{
                      width: "100%",
                      padding: "0.75rem 1rem",
                      borderRadius: "8px",
                      border: "1px solid var(--border)",
                      background: "var(--background)",
                      color: "var(--foreground)",
                      fontSize: "0.95rem",
                      outline: "none",
                    }}
                  />
                  <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                    Supports PNG, SVG, or WebP (recommended height: 40px - 80px).
                  </span>
                </div>

                {/* Favicon URL */}
                <div>
                  <label style={{ display: "block", fontSize: "0.88rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                    Browser Favicon URL
                  </label>
                  <input
                    type="url"
                    value={faviconUrl}
                    onChange={(e) => setFaviconUrl(e.target.value)}
                    placeholder="https://example.com/assets/favicon.ico"
                    style={{
                      width: "100%",
                      padding: "0.75rem 1rem",
                      borderRadius: "8px",
                      border: "1px solid var(--border)",
                      background: "var(--background)",
                      color: "var(--foreground)",
                      fontSize: "0.95rem",
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              {/* Right Column: Live Interactive Preview */}
              <div
                style={{
                  background: "var(--bg-surface)",
                  borderRadius: "14px",
                  border: "1px solid var(--border)",
                  padding: "2rem",
                  boxShadow: "var(--shadow-sm)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "1.5rem",
                }}
              >
                <div>
                  <h3 style={{ fontSize: "1.2rem", fontWeight: 700, margin: "0 0 0.35rem 0" }}>
                    Live Brand Preview
                  </h3>
                  <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", margin: 0 }}>
                    Instant preview of how your students see this branding.
                  </p>
                </div>

                {/* Live Mock Header */}
                <div
                  style={{
                    borderRadius: "12px",
                    border: "1px solid var(--border)",
                    overflow: "hidden",
                    background: "var(--bg-main)",
                  }}
                >
                  <div
                    style={{
                      background: "var(--bg-surface)",
                      padding: "1rem 1.5rem",
                      borderBottom: "1px solid var(--border)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      {logoUrl ? (
                        <img
                          src={logoUrl}
                          alt="Org Logo"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = "none";
                          }}
                          style={{ maxHeight: "36px", objectFit: "contain" }}
                        />
                      ) : (
                        <div
                          style={{
                            width: "36px",
                            height: "36px",
                            borderRadius: "8px",
                            backgroundColor: primaryColor,
                            color: "#fff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 700,
                            fontSize: "1.1rem",
                          }}
                        >
                          {name ? name.charAt(0).toUpperCase() : "O"}
                        </div>
                      )}
                      <div>
                        <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>{name || "Your Organization"}</div>
                        <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                          {tagline || "Portal Experience Preview"}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      style={{
                        backgroundColor: primaryColor,
                        color: "#fff",
                        border: "none",
                        borderRadius: "8px",
                        padding: "0.5rem 1rem",
                        fontWeight: 600,
                        fontSize: "0.85rem",
                        cursor: "pointer",
                      }}
                    >
                      Enroll Now
                    </button>
                  </div>

                  <div style={{ padding: "1.5rem" }}>
                    <div
                      style={{
                        background: "var(--bg-surface)",
                        borderRadius: "10px",
                        border: "1px solid var(--border)",
                        padding: "1.25rem",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "0.95rem", marginBottom: "0.25rem" }}>
                          Full Stack AI Engineering Program
                        </div>
                        <div style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                          12 Modules • 14 Quizzes • Verified Certification
                        </div>
                      </div>
                      <span
                        style={{
                          backgroundColor: secondaryColor,
                          color: "#fff",
                          padding: "0.3rem 0.75rem",
                          borderRadius: "20px",
                          fontSize: "0.78rem",
                          fontWeight: 600,
                        }}
                      >
                        Featured
                      </span>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    padding: "1rem",
                    borderRadius: "10px",
                    background: "var(--bg-subtle)",
                    fontSize: "0.85rem",
                    color: "var(--text-muted)",
                    lineHeight: 1.5,
                  }}
                >
                  💡 <strong>Tip:</strong> Colors chosen here are stored in the organization's JSON metadata and
                  dynamically customized across student cohort certificates, badges, and learning dashboards.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 3: ACADEMIC GOVERNANCE */}
        {/* ========================================================= */}
        {activeTab === "governance" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
            <div
              style={{
                background: "var(--bg-surface)",
                borderRadius: "14px",
                border: "1px solid var(--border)",
                padding: "2rem",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <div style={{ marginBottom: "1.5rem" }}>
                <h3 style={{ fontSize: "1.2rem", fontWeight: 700, margin: "0 0 0.35rem 0" }}>
                  Curriculum & Grading Standards
                </h3>
                <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", margin: 0 }}>
                  Define passing thresholds, due date rules, and cohort achievement policies.
                </p>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                  gap: "1.75rem",
                }}
              >
                {/* Passing Threshold */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                    <label style={{ fontSize: "0.88rem", fontWeight: 600 }}>Default Passing Grade</label>
                    <span style={{ fontWeight: 700, color: "var(--primary)" }}>{passPercentage}%</span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="100"
                    step="5"
                    value={passPercentage}
                    onChange={(e) => setPassPercentage(Number(e.target.value))}
                    style={{ width: "100%", accentColor: "var(--primary)", cursor: "pointer" }}
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    <span>50% (Lenient)</span>
                    <span>70% (Standard)</span>
                    <span>90% (Honors)</span>
                  </div>
                </div>

                {/* Default Due Days */}
                <div>
                  <label style={{ display: "block", fontSize: "0.88rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                    Assignment Due Window (Days)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={defaultDueDays}
                    onChange={(e) => setDefaultDueDays(Number(e.target.value))}
                    style={{
                      width: "100%",
                      padding: "0.75rem 1rem",
                      borderRadius: "8px",
                      border: "1px solid var(--border)",
                      background: "var(--background)",
                      color: "var(--foreground)",
                      fontSize: "0.95rem",
                      outline: "none",
                    }}
                  />
                  <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                    Number of days from publication until an assignment is due.
                  </span>
                </div>

                {/* Streak Freezes */}
                <div>
                  <label style={{ display: "block", fontSize: "0.88rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                    Weekly Streak Freeze Limit
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="7"
                    value={streakFreezeLimit}
                    onChange={(e) => setStreakFreezeLimit(Number(e.target.value))}
                    style={{
                      width: "100%",
                      padding: "0.75rem 1rem",
                      borderRadius: "8px",
                      border: "1px solid var(--border)",
                      background: "var(--background)",
                      color: "var(--foreground)",
                      fontSize: "0.95rem",
                      outline: "none",
                    }}
                  />
                  <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                    Max times students can protect their daily study streak per week.
                  </span>
                </div>

                {/* Late Policy */}
                <div>
                  <label style={{ display: "block", fontSize: "0.88rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                    Late Submissions Policy
                  </label>
                  <select
                    value={latePolicy}
                    onChange={(e) => setLatePolicy(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.75rem 1rem",
                      borderRadius: "8px",
                      border: "1px solid var(--border)",
                      background: "var(--background)",
                      color: "var(--foreground)",
                      fontSize: "0.95rem",
                      outline: "none",
                      cursor: "pointer",
                    }}
                  >
                    <option value="penalty">Accept with standard late penalty (-10%/day)</option>
                    <option value="accept">Accept without penalty (Full credit eligible)</option>
                    <option value="reject">Strict deadline (Reject late submissions)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Student Experience Toggles */}
            <div
              style={{
                background: "var(--bg-surface)",
                borderRadius: "14px",
                border: "1px solid var(--border)",
                padding: "2rem",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <div style={{ marginBottom: "1.5rem" }}>
                <h3 style={{ fontSize: "1.2rem", fontWeight: 700, margin: "0 0 0.35rem 0" }}>
                  Student Features & Self-Service
                </h3>
                <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", margin: 0 }}>
                  Enable or restrict student-facing features across cohorts.
                </p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                {/* Self Enrollment */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "1rem",
                    borderRadius: "10px",
                    background: "var(--bg-subtle)",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>Catalog Self-Enrollment</div>
                    <div style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                      Allow registered students to discover and enroll into active programs without admin intervention.
                    </div>
                  </div>
                  <label style={{ position: "relative", display: "inline-block", width: "48px", height: "26px", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={allowSelfEnrollment}
                      onChange={(e) => setAllowSelfEnrollment(e.target.checked)}
                      style={{ opacity: 0, width: 0, height: 0 }}
                    />
                    <span
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: allowSelfEnrollment ? "var(--primary)" : "#cbd5e1",
                        borderRadius: "26px",
                        transition: "0.2s",
                      }}
                    >
                      <span
                        style={{
                          position: "absolute",
                          content: "",
                          height: "20px",
                          width: "20px",
                          left: allowSelfEnrollment ? "25px" : "3px",
                          bottom: "3px",
                          backgroundColor: "#fff",
                          borderRadius: "50%",
                          transition: "0.2s",
                        }}
                      />
                    </span>
                  </label>
                </div>

                {/* Leaderboard */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "1rem",
                    borderRadius: "10px",
                    background: "var(--bg-subtle)",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>Cohort Leaderboard & XP Points</div>
                    <div style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                      Display public cohort peer ranking, gamified badges, and study activity milestones.
                    </div>
                  </div>
                  <label style={{ position: "relative", display: "inline-block", width: "48px", height: "26px", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={enableLeaderboard}
                      onChange={(e) => setEnableLeaderboard(e.target.checked)}
                      style={{ opacity: 0, width: 0, height: 0 }}
                    />
                    <span
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: enableLeaderboard ? "var(--primary)" : "#cbd5e1",
                        borderRadius: "26px",
                        transition: "0.2s",
                      }}
                    >
                      <span
                        style={{
                          position: "absolute",
                          content: "",
                          height: "20px",
                          width: "20px",
                          left: enableLeaderboard ? "25px" : "3px",
                          bottom: "3px",
                          backgroundColor: "#fff",
                          borderRadius: "50%",
                          transition: "0.2s",
                        }}
                      />
                    </span>
                  </label>
                </div>

                {/* Certificates */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "1rem",
                    borderRadius: "10px",
                    background: "var(--bg-subtle)",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>Automated Completion Certificates</div>
                    <div style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                      Automatically issue cryptographically verifiable graduation certificates upon 100% curriculum completion.
                    </div>
                  </div>
                  <label style={{ position: "relative", display: "inline-block", width: "48px", height: "26px", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={enableCertificates}
                      onChange={(e) => setEnableCertificates(e.target.checked)}
                      style={{ opacity: 0, width: 0, height: 0 }}
                    />
                    <span
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: enableCertificates ? "var(--primary)" : "#cbd5e1",
                        borderRadius: "26px",
                        transition: "0.2s",
                      }}
                    >
                      <span
                        style={{
                          position: "absolute",
                          content: "",
                          height: "20px",
                          width: "20px",
                          left: enableCertificates ? "25px" : "3px",
                          bottom: "3px",
                          backgroundColor: "#fff",
                          borderRadius: "50%",
                          transition: "0.2s",
                        }}
                      />
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 4: AI & SYSTEM FEATURES */}
        {/* ========================================================= */}
        {activeTab === "ai_integrations" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
            {/* AI Tutor & Learning Copilot */}
            <div
              style={{
                background: "var(--bg-surface)",
                borderRadius: "14px",
                border: "1px solid var(--border)",
                padding: "2rem",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <div style={{ marginBottom: "1.5rem" }}>
                <h3 style={{ fontSize: "1.2rem", fontWeight: 700, margin: "0 0 0.35rem 0" }}>
                  Fortivex AI Tutor & Intelligent Feedback
                </h3>
                <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", margin: 0 }}>
                  Manage generative AI copilots and automated coaching quotas for this organization.
                </p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                {/* AI Tutor Toggle */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "1rem",
                    borderRadius: "10px",
                    background: "var(--bg-subtle)",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>Student AI Copilot Tutor</div>
                    <div style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                      Enables the floating 24/7 AI tutor widget in student dashboards for curriculum Q&A and coding hints.
                    </div>
                  </div>
                  <label style={{ position: "relative", display: "inline-block", width: "48px", height: "26px", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={aiTutorEnabled}
                      onChange={(e) => setAiTutorEnabled(e.target.checked)}
                      style={{ opacity: 0, width: 0, height: 0 }}
                    />
                    <span
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: aiTutorEnabled ? "var(--primary)" : "#cbd5e1",
                        borderRadius: "26px",
                        transition: "0.2s",
                      }}
                    >
                      <span
                        style={{
                          position: "absolute",
                          content: "",
                          height: "20px",
                          width: "20px",
                          left: aiTutorEnabled ? "25px" : "3px",
                          bottom: "3px",
                          backgroundColor: "#fff",
                          borderRadius: "50%",
                          transition: "0.2s",
                        }}
                      />
                    </span>
                  </label>
                </div>

                {/* AI Quota & Feedback Inputs */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                    gap: "1.5rem",
                  }}
                >
                  <div>
                    <label style={{ display: "block", fontSize: "0.88rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                      Daily Student AI Quota (Minutes)
                    </label>
                    <input
                      type="number"
                      min="10"
                      max="480"
                      value={dailyAiQuotaMinutes}
                      onChange={(e) => setDailyAiQuotaMinutes(Number(e.target.value))}
                      style={{
                        width: "100%",
                        padding: "0.75rem 1rem",
                        borderRadius: "8px",
                        border: "1px solid var(--border)",
                        background: "var(--background)",
                        color: "var(--foreground)",
                        fontSize: "0.95rem",
                        outline: "none",
                      }}
                    />
                    <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                      Allocated active conversational assistance window per student per calendar day.
                    </span>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.88rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                      Automated Quiz & Assignment AI Explanations
                    </label>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "0.5rem" }}>
                      <input
                        type="checkbox"
                        id="aiQuizFeedback"
                        checked={aiQuizFeedback}
                        onChange={(e) => setAiQuizFeedback(e.target.checked)}
                        style={{ width: "18px", height: "18px", accentColor: "var(--primary)", cursor: "pointer" }}
                      />
                      <label htmlFor="aiQuizFeedback" style={{ fontSize: "0.92rem", cursor: "pointer" }}>
                        Generate step-by-step explanations on incorrect quiz answers.
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Live Classrooms & Integrations */}
            <div
              style={{
                background: "var(--bg-surface)",
                borderRadius: "14px",
                border: "1px solid var(--border)",
                padding: "2rem",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <div style={{ marginBottom: "1.5rem" }}>
                <h3 style={{ fontSize: "1.2rem", fontWeight: 700, margin: "0 0 0.35rem 0" }}>
                  Live Classrooms & Broadcast Announcements
                </h3>
                <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", margin: 0 }}>
                  Enable real-time video sessions and broadcast administrative banners.
                </p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                {/* Live Classrooms Toggle */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "1rem",
                    borderRadius: "10px",
                    background: "var(--bg-subtle)",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>WebRTC Live Classrooms</div>
                    <div style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                      Enables interactive video calls, screen sharing, and audio rooms between instructors and cohorts.
                    </div>
                  </div>
                  <label style={{ position: "relative", display: "inline-block", width: "48px", height: "26px", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={liveClassroomsEnabled}
                      onChange={(e) => setLiveClassroomsEnabled(e.target.checked)}
                      style={{ opacity: 0, width: 0, height: 0 }}
                    />
                    <span
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: liveClassroomsEnabled ? "var(--primary)" : "#cbd5e1",
                        borderRadius: "26px",
                        transition: "0.2s",
                      }}
                    >
                      <span
                        style={{
                          position: "absolute",
                          content: "",
                          height: "20px",
                          width: "20px",
                          left: liveClassroomsEnabled ? "25px" : "3px",
                          bottom: "3px",
                          backgroundColor: "#fff",
                          borderRadius: "50%",
                          transition: "0.2s",
                        }}
                      />
                    </span>
                  </label>
                </div>

                {/* Announcement Banner Section */}
                <div
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: "10px",
                    padding: "1.25rem",
                    background: "var(--background)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>Portal Announcement Banner</div>
                      <div style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                        Display a notice across the top of all user screens in this organization.
                      </div>
                    </div>
                    <label style={{ position: "relative", display: "inline-block", width: "48px", height: "26px", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={announcementActive}
                        onChange={(e) => setAnnouncementActive(e.target.checked)}
                        style={{ opacity: 0, width: 0, height: 0 }}
                      />
                      <span
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          backgroundColor: announcementActive ? "var(--primary)" : "#cbd5e1",
                          borderRadius: "26px",
                          transition: "0.2s",
                        }}
                      >
                        <span
                          style={{
                            position: "absolute",
                            content: "",
                            height: "20px",
                            width: "20px",
                            left: announcementActive ? "25px" : "3px",
                            bottom: "3px",
                            backgroundColor: "#fff",
                            borderRadius: "50%",
                            transition: "0.2s",
                          }}
                        />
                      </span>
                    </label>
                  </div>

                  {announcementActive && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                      <input
                        type="text"
                        value={announcementMessage}
                        onChange={(e) => setAnnouncementMessage(e.target.value)}
                        placeholder="e.g. Scheduled platform maintenance this Saturday from 2 AM to 4 AM UTC."
                        style={{
                          width: "100%",
                          padding: "0.75rem 1rem",
                          borderRadius: "8px",
                          border: "1px solid var(--border)",
                          background: "var(--bg-surface)",
                          color: "var(--foreground)",
                          fontSize: "0.95rem",
                          outline: "none",
                        }}
                      />

                      <div style={{ display: "flex", gap: "1.5rem", alignItems: "center" }}>
                        <span style={{ fontSize: "0.88rem", fontWeight: 600 }}>Banner Style:</span>
                        <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer" }}>
                          <input
                            type="radio"
                            name="annType"
                            value="info"
                            checked={announcementType === "info"}
                            onChange={() => setAnnouncementType("info")}
                          />
                          Info (Blue)
                        </label>
                        <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer" }}>
                          <input
                            type="radio"
                            name="annType"
                            value="warning"
                            checked={announcementType === "warning"}
                            onChange={() => setAnnouncementType("warning")}
                          />
                          Warning (Amber)
                        </label>
                        <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer" }}>
                          <input
                            type="radio"
                            name="annType"
                            value="alert"
                            checked={announcementType === "alert"}
                            onChange={() => setAnnouncementType("alert")}
                          />
                          Critical (Red)
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* Sticky Action Footer */}
        {/* ========================================================= */}
        <div
          style={{
            position: "fixed",
            bottom: "1.5rem",
            right: "2rem",
            left: "auto",
            zIndex: 40,
            background: "var(--bg-surface)",
            padding: "0.85rem 1.5rem",
            borderRadius: "16px",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-xl)",
            display: "flex",
            alignItems: "center",
            gap: "1.25rem",
          }}
        >
          {isDirty && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  backgroundColor: "var(--warning)",
                  display: "inline-block",
                }}
              />
              <span style={{ fontSize: "0.88rem", color: "var(--text-muted)", fontWeight: 500 }}>
                Unsaved changes
              </span>
            </div>
          )}

          <div style={{ display: "flex", gap: "0.75rem" }}>
            <Button
              type="button"
              variant="secondary"
              onClick={handleDiscard}
              disabled={!isDirty || isSaving}
              style={{ padding: "0.6rem 1.25rem" }}
            >
              Discard
            </Button>

            <Button
              type="submit"
              disabled={!isDirty || isSaving}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.6rem 1.5rem",
                opacity: !isDirty && !isSaving ? 0.6 : 1,
              }}
            >
              {isSaving ? (
                <>
                  <Icon name="tune" size={16} /> Saving...
                </>
              ) : (
                <>
                  <Icon name="check" size={16} /> Save Changes
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <RequireAuth allowedRoles={PROGRAM_COHORT_ADMIN_ROLES}>
      <SettingsContent />
    </RequireAuth>
  );
}
