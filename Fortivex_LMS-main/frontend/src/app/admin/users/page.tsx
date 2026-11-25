"use client";

import { useState } from "react";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PROGRAM_COHORT_ADMIN_ROLES } from "@/lib/auth/roles";
import { useAuth } from "@/lib/auth/AuthContext";
import { useUsers } from "@/lib/api/useUsers";
import {
  createUser,
  updateUser,
  assignUserOrganization,
  removeUserOrganization,
  bulkCreateUsers,
  deleteUser,
  adminResetUserPassword,
} from "@/lib/api/endpoints";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingState } from "@/components/ui/LoadingState";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { DeleteConfirmationModal } from "@/components/ui/DeleteConfirmationModal";
import type { User, BulkUserCreateResponse } from "@/lib/api/types";

const styles = {
  modalOverlay: {
    position: "fixed" as const,
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(0,0,0,0.5)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
    backdropFilter: "blur(4px)",
  },
  modalContent: {
    background: "var(--background)",
    padding: "2rem",
    borderRadius: "16px",
    width: "580px",
    maxWidth: "94%",
    maxHeight: "90vh",
    overflowY: "auto" as const,
    boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
    animation: "fadeIn 0.3s ease-out",
  },
  selectField: {
    width: "100%",
    padding: "0.85rem 1.2rem",
    paddingRight: "2.5rem",
    borderRadius: "10px",
    border: "1px solid rgba(0,0,0,0.12)",
    background: "var(--color-surface)",
    color: "var(--foreground)",
    fontSize: "0.95rem",
    appearance: "none" as const,
    outline: "none",
    boxShadow: "0 2px 4px rgba(0,0,0,0.02) inset",
    cursor: "pointer",
  },
  textareaField: {
    width: "100%",
    padding: "0.75rem 1rem",
    borderRadius: "10px",
    border: "1px solid rgba(0,0,0,0.12)",
    background: "var(--color-surface)",
    color: "var(--foreground)",
    fontSize: "0.95rem",
    outline: "none",
    fontFamily: "inherit",
    resize: "vertical" as const,
    minHeight: "75px",
    boxShadow: "0 2px 4px rgba(0,0,0,0.02) inset",
  },
  label: {
    fontSize: "0.85rem",
    fontWeight: 700,
    marginBottom: "0.4rem",
    display: "block",
    color: "var(--foreground)",
  },
};

function UsersContent() {
  const { token, user: currentUser, organization, organizations } = useAuth();

  // Filters & State
  const [selectedOrgFilter, setSelectedOrgFilter] = useState<number | null>(null);
  const { users, error, reload } = useUsers(selectedOrgFilter ?? undefined);

  const [activeTab, setActiveTab] = useState<"ALL" | "ADMINS" | "INSTRUCTORS" | "STUDENTS">("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Add User Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fullName, setFullName] = useState("");
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [inviteOrgId, setInviteOrgId] = useState<number>(organization?.id || (organizations[0]?.id ?? 1));
  const [role, setRole] = useState("ACADEMIC_ADMIN");

  // Manage / Edit User Modal State
  const [managingUser, setManagingUser] = useState<User | null>(null);
  const [manageTab, setManageTab] = useState<"PROFILE" | "ORGANIZATIONS">("PROFILE");

  // Edit Profile Form State
  const [editFullName, setEditFullName] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editPhoneNumber, setEditPhoneNumber] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editAvatarUrl, setEditAvatarUrl] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Assign Organization State
  const [assignOrgId, setAssignOrgId] = useState<number>(organization?.id || (organizations[0]?.id ?? 1));
  const [assignRole, setAssignRole] = useState<string>("ACADEMIC_ADMIN");
  const [isAssigning, setIsAssigning] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // 2-Step Delete User State
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  const handleDeleteUser = async () => {
    if (!token || !userToDelete) return;
    await deleteUser(token, userToDelete.id);
    if (managingUser?.id === userToDelete.id) {
      setManagingUser(null);
    }
    setUserToDelete(null);
    reload();
  };

  // Reset Password Modal State
  const [userToResetPassword, setUserToResetPassword] = useState<User | null>(null);
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [resetMustChangePassword, setResetMustChangePassword] = useState(true);
  const [showResetNewPassword, setShowResetNewPassword] = useState(false);
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);
  const [copiedPassword, setCopiedPassword] = useState(false);

  const openResetPasswordModal = (user: User) => {
    setUserToResetPassword(user);
    setResetNewPassword("");
    setResetMustChangePassword(true);
    setShowResetNewPassword(false);
    setResetError(null);
    setResetSuccess(null);
    setCopiedPassword(false);
  };

  const generateTemporaryPassword = () => {
    const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let pwd = "";
    for (let i = 0; i < 8; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const temp = `Temp#${pwd}!`;
    setResetNewPassword(temp);
    setResetError(null);
  };

  const handleAdminResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !userToResetPassword) return;
    if (!resetNewPassword || resetNewPassword.trim().length < 6) {
      setResetError("Password must be at least 6 characters long.");
      return;
    }

    setResetSubmitting(true);
    setResetError(null);
    try {
      await adminResetUserPassword(token, userToResetPassword.id, {
        new_password: resetNewPassword.trim(),
        must_change_password: resetMustChangePassword,
      });
      setResetSuccess(resetNewPassword.trim());
    } catch (err: any) {
      setResetError(err.message || "Failed to reset password.");
    } finally {
      setResetSubmitting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPassword(true);
    setTimeout(() => setCopiedPassword(false), 2000);
  };

  const isSuperAdmin = currentUser?.roles.includes("SUPER_ADMIN") || false;

  const openManageModal = (user: User) => {
    setManagingUser(user);
    setManageTab("PROFILE");
    setEditFullName(user.full_name || "");
    setEditTitle(user.title || "");
    setEditPhoneNumber(user.phone_number || "");
    setEditBio(user.bio || "");
    setEditAvatarUrl(user.avatar_url || "");
    setEditIsActive(user.is_active ?? true);
    setAssignOrgId(organization?.id || (organizations[0]?.id ?? 1));
    setAssignRole("ACADEMIC_ADMIN");
    setActionMessage(null);
  };

  const handleCreateUser = async () => {
    if (!token || !email || !fullName || !password) return;
    setIsSubmitting(true);
    try {
      await createUser(token, {
        email,
        full_name: fullName,
        password,
        title: title.trim() || null,
        phone_number: phoneNumber.trim() || null,
        bio: bio.trim() || null,
        avatar_url: avatarUrl.trim() || null,
        organization_id: inviteOrgId,
        role_names: [role],
      });

      setFullName("");
      setTitle("");
      setEmail("");
      setPhoneNumber("");
      setPassword("");
      setBio("");
      setAvatarUrl("");
      setRole("ACADEMIC_ADMIN");
      setIsModalOpen(false);
      reload();
    } catch (e: any) {
      alert("Error creating user: " + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Bulk Import Users Modal State
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkOrgId, setBulkOrgId] = useState<number>(organization?.id || (organizations[0]?.id ?? 1));
  const [bulkDefaultRole, setBulkDefaultRole] = useState("STUDENT");
  const [bulkDefaultPassword, setBulkDefaultPassword] = useState("Welcome123!");
  const [bulkInputText, setBulkInputText] = useState("");
  const [bulkIsSubmitting, setBulkIsSubmitting] = useState(false);
  const [bulkResult, setBulkResult] = useState<BulkUserCreateResponse | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  const parseBulkLines = (raw: string, defRole: string, defPassword: string) => {
    const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const parsed: Array<{ fullName: string; email: string; password?: string; role?: string; phone?: string; isValid: boolean; error?: string }> = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (i === 0 && (line.toLowerCase().includes("name") && line.toLowerCase().includes("email"))) {
        continue;
      }
      const delimiter = line.includes("\t") ? "\t" : line.includes(";") ? ";" : ",";
      const parts = line.split(delimiter).map(p => p.trim().replace(/^["']|["']$/g, ""));
      
      let fName = "";
      let em = "";
      let pw = "";
      let r = defRole;
      let ph = "";

      if (parts.length === 1) {
        const match = parts[0].match(/^(.*?)[<](.*?)[>]$/);
        if (match) {
          fName = match[1].trim();
          em = match[2].trim();
        } else if (parts[0].includes("@")) {
          em = parts[0];
          fName = parts[0].split("@")[0];
        } else {
          fName = parts[0];
        }
      } else {
        fName = parts[0];
        em = parts[1];
        if (parts[2]) pw = parts[2];
        if (parts[3]) r = parts[3].toUpperCase();
        if (parts[4]) ph = parts[4];
      }

      const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em);
      let error = "";
      if (!fName) error = "Missing name";
      else if (!em) error = "Missing email";
      else if (!emailValid) error = "Invalid email format";

      parsed.push({
        fullName: fName,
        email: em,
        password: pw || defPassword,
        role: r,
        phone: ph,
        isValid: !error,
        error
      });
    }
    return parsed;
  };

  const handleBulkSubmit = async () => {
    if (!token) return;
    const items = parseBulkLines(bulkInputText, bulkDefaultRole, bulkDefaultPassword).filter(p => p.isValid);
    if (items.length === 0) {
      alert("No valid users found to import. Please check your text or file format.");
      return;
    }
    setBulkIsSubmitting(true);
    try {
      const res = await bulkCreateUsers(token, {
        organization_id: bulkOrgId,
        default_password: bulkDefaultPassword,
        default_role_names: [bulkDefaultRole],
        users: items.map(it => ({
          email: it.email,
          full_name: it.fullName,
          password: it.password || bulkDefaultPassword,
          role_names: [it.role || bulkDefaultRole],
          phone_number: it.phone || null
        }))
      });
      setBulkResult(res);
      reload();
    } catch (err: any) {
      alert("Bulk user creation failed: " + (err.message || err));
    } finally {
      setBulkIsSubmitting(false);
    }
  };

  const handleCopyCredentials = () => {
    if (!bulkResult) return;
    const valid = bulkResult.results.filter(r => r.status === "created" || r.status === "added_to_org");
    const text = valid.map((r, idx) => 
      `${idx + 1}. Name: ${r.full_name}\n   Email: ${r.email}\n   Password: ${r.temporary_password || bulkDefaultPassword}\n   Role: ${r.status}`
    ).join("\n\n");
    navigator.clipboard.writeText(`Fortivex LMS User Credentials:\n\n${text}`);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 3000);
  };

  const handleDownloadSample = () => {
    const csvContent = "data:text/csv;charset=utf-8," + 
      "Full Name,Email,Password,Role,Phone\n" +
      "John Doe,john.doe@example.com,Welcome123!,STUDENT,+1234567890\n" +
      "Jane Smith,jane.smith@example.com,Welcome123!,STUDENT,+1234567891\n" +
      "Dr. Alan Grant,alan.grant@example.com,Welcome123!,TRAINER,+1234567892\n";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "bulk_users_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleInsertSample = () => {
    setBulkInputText(
      "John Doe, john.doe@example.com, Welcome123!, STUDENT\n" +
      "Jane Smith, jane.smith@example.com, Welcome123!, STUDENT\n" +
      "Dr. Alan Grant, alan.grant@example.com, Welcome123!, TRAINER"
    );
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) setBulkInputText(text);
    };
    reader.readAsText(file);
  };

  const handleUpdateProfile = async () => {
    if (!token || !managingUser) return;
    setIsSavingProfile(true);
    setActionMessage(null);
    try {
      const updatedUser = await updateUser(token, managingUser.id, {
        full_name: editFullName.trim(),
        title: editTitle.trim() || null,
        phone_number: editPhoneNumber.trim() || null,
        bio: editBio.trim() || null,
        avatar_url: editAvatarUrl.trim() || null,
        is_active: editIsActive,
      });
      setManagingUser(updatedUser);
      setActionMessage("Profile details updated successfully!");
      reload();
    } catch (e: any) {
      alert("Error updating profile: " + e.message);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleAssignOrganization = async () => {
    if (!token || !managingUser) return;
    setIsAssigning(true);
    setActionMessage(null);
    try {
      const updatedUser = await assignUserOrganization(token, managingUser.id, {
        organization_id: assignOrgId,
        role_names: [assignRole],
      });
      setManagingUser(updatedUser);
      setActionMessage("Organization & role successfully assigned!");
      reload();
    } catch (e: any) {
      alert("Error assigning organization: " + e.message);
    } finally {
      setIsAssigning(false);
    }
  };

  const handleRemoveMembership = async (orgId: number) => {
    if (!token || !managingUser) return;
    if (!confirm("Are you sure you want to remove this user from this organization?")) return;
    setIsAssigning(true);
    setActionMessage(null);
    try {
      const updatedUser = await removeUserOrganization(token, managingUser.id, orgId);
      setManagingUser(updatedUser);
      setActionMessage("Membership removed successfully.");
      reload();
    } catch (e: any) {
      alert("Error removing membership: " + e.message);
    } finally {
      setIsAssigning(false);
    }
  };

  const filteredUsers = users?.filter((user) => {
    // Tab filter
    if (activeTab === "STUDENTS" && !user.roles.includes("STUDENT")) return false;
    if (activeTab === "INSTRUCTORS" && !user.roles.includes("TRAINER")) return false;
    if (
      activeTab === "ADMINS" &&
      !user.roles.some((r) => ["SUPER_ADMIN", "ACADEMIC_ADMIN", "PROGRAM_MANAGER"].includes(r))
    )
      return false;

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = user.full_name.toLowerCase().includes(q);
      const matchEmail = user.email.toLowerCase().includes(q);
      const matchTitle = user.title?.toLowerCase().includes(q);
      const matchPhone = user.phone_number?.toLowerCase().includes(q);
      if (!matchName && !matchEmail && !matchTitle && !matchPhone) return false;
    }

    return true;
  });

  return (
    <div style={{ maxWidth: "1250px", margin: "0 auto" }}>
      {/* Page Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginBottom: "2rem",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.35rem" }}>
            <h1 style={{ fontSize: "2rem", fontWeight: 700, margin: 0 }}>User Management</h1>
            {isSuperAdmin && (
              <Badge status="active">SUPER ADMIN MODE</Badge>
            )}
          </div>
          <p style={{ color: "var(--color-muted)", fontSize: "1rem", margin: 0 }}>
            Manage learners, instructors, and assign academic administrators across organizations.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <Button
            variant="secondary"
            onClick={() => {
              setBulkOrgId(organization?.id || (organizations[0]?.id ?? 1));
              setBulkResult(null);
              setIsBulkModalOpen(true);
            }}
            style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "1.1rem" }}>
              group_add
            </span>{" "}
            Bulk Add Users
          </Button>
          <Button
            onClick={() => {
              setInviteOrgId(organization?.id || (organizations[0]?.id ?? 1));
              setIsModalOpen(true);
            }}
            style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "1.1rem" }}>
              person_add
            </span>{" "}
            Invite / Add User
          </Button>
        </div>
      </div>

      <div
        style={{
          background: "var(--color-surface)",
          borderRadius: "12px",
          border: "1px solid var(--color-border)",
          padding: "1.5rem",
        }}
      >
        {/* Controls Bar: Tabs + Org Filter + Search */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1.5rem",
            borderBottom: "1px solid var(--color-border)",
            paddingBottom: "1rem",
            flexWrap: "wrap",
            gap: "1rem",
          }}
        >
          {/* Tabs */}
          <div style={{ display: "flex", gap: "1.5rem" }}>
            {[
              { id: "ALL", label: "All Users" },
              { id: "ADMINS", label: "Admins" },
              { id: "INSTRUCTORS", label: "Instructors" },
              { id: "STUDENTS", label: "Students" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  background: "none",
                  border: "none",
                  padding: "0.5rem 0",
                  fontSize: "1rem",
                  fontWeight: 600,
                  color: activeTab === tab.id ? "var(--color-primary)" : "var(--color-muted)",
                  cursor: "pointer",
                  borderBottom: activeTab === tab.id ? "2px solid var(--color-primary)" : "2px solid transparent",
                  transition: "all 0.2s",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Right Toolbar: Organization Filter & Search */}
          <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
            {organizations.length > 1 && (
              <div style={{ position: "relative" }}>
                <select
                  value={selectedOrgFilter ?? ""}
                  onChange={(e) => setSelectedOrgFilter(e.target.value ? Number(e.target.value) : null)}
                  style={{
                    padding: "0.6rem 2.2rem 0.6rem 0.9rem",
                    borderRadius: "8px",
                    border: "1px solid var(--color-border)",
                    background: "var(--background)",
                    color: "var(--foreground)",
                    fontSize: "0.9rem",
                    fontWeight: 500,
                    appearance: "none",
                    cursor: "pointer",
                    outline: "none",
                  }}
                >
                  <option value="">All Organizations</option>
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
                <span
                  className="material-symbols-outlined"
                  style={{
                    position: "absolute",
                    right: "0.6rem",
                    top: "50%",
                    transform: "translateY(-50%)",
                    pointerEvents: "none",
                    color: "var(--color-muted)",
                    fontSize: "1.1rem",
                  }}
                >
                  expand_more
                </span>
              </div>
            )}

            <div style={{ width: "240px" }}>
              <Input
                id="search-users"
                placeholder="Search name, email, title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        {error && <ErrorState message={error} onRetry={reload} />}
        {!error && users === null && <LoadingState message="Loading users..." />}

        {!error && users !== null && (
          <Table
            columns={[
              {
                key: "full_name",
                header: "User Details",
                render: (user: User) => (
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    {user.avatar_url ? (
                      <img
                        src={user.avatar_url}
                        alt={user.full_name}
                        style={{
                          width: "36px",
                          height: "36px",
                          borderRadius: "50%",
                          objectFit: "cover",
                          border: "1px solid var(--color-border)",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "36px",
                          height: "36px",
                          borderRadius: "50%",
                          background: "var(--primary-gradient)",
                          color: "#fff",
                          fontWeight: 700,
                          fontSize: "0.85rem",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        {user.full_name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <div style={{ fontWeight: 600, color: "var(--color-primary)" }}>{user.full_name}</div>
                      {user.title && (
                        <div style={{ fontSize: "0.78rem", color: "var(--color-muted)" }}>{user.title}</div>
                      )}
                    </div>
                  </div>
                ),
              },
              {
                key: "contact",
                header: "Contact",
                render: (user: User) => (
                  <div>
                    <div style={{ fontSize: "0.9rem" }}>{user.email}</div>
                    {user.phone_number && (
                      <div style={{ fontSize: "0.78rem", color: "var(--color-muted)", display: "flex", alignItems: "center", gap: "0.2rem" }}>
                        <span className="material-symbols-outlined" style={{ fontSize: "0.85rem" }}>call</span>
                        {user.phone_number}
                      </div>
                    )}
                  </div>
                ),
              },
              {
                key: "organizations",
                header: "Organizations & Roles",
                render: (user: User) => (
                  <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                    {user.organizations && user.organizations.length > 0 ? (
                      user.organizations.map((org) => (
                        <div
                          key={org.id}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.3rem",
                            background: "rgba(59, 130, 246, 0.08)",
                            border: "1px solid rgba(59, 130, 246, 0.2)",
                            borderRadius: "6px",
                            padding: "0.2rem 0.5rem",
                            fontSize: "0.78rem",
                          }}
                        >
                          <span style={{ fontWeight: 600, color: "var(--foreground)" }}>{org.name}:</span>
                          <span style={{ color: "var(--color-primary)", fontWeight: 500 }}>
                            {org.roles.map((r) => r.replace("_", " ")).join(", ")}
                          </span>
                        </div>
                      ))
                    ) : (
                      <span style={{ color: "var(--color-muted)", fontSize: "0.85rem" }}>None</span>
                    )}
                  </div>
                ),
              },
              {
                key: "status",
                header: "Status",
                render: (user: User) => (
                  <Badge status={user.is_active ? "active" : "draft"}>
                    {user.is_active ? "Active" : "Suspended"}
                  </Badge>
                ),
              },
              {
                key: "actions",
                header: "",
                render: (user: User) => (
                  <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "0.5rem" }}>
                    <button
                      onClick={() => openManageModal(user)}
                      style={{
                        background: "var(--peach-fuzz)",
                        border: "1px solid rgba(0,0,0,0.1)",
                        color: "#000",
                        padding: "0.4rem 0.8rem",
                        borderRadius: "8px",
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.25rem",
                        fontSize: "0.8rem",
                        transition: "opacity 0.2s",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "1rem" }}>
                        edit_note
                      </span>{" "}
                      Edit & Manage
                    </button>
                    <button
                      onClick={() => openResetPasswordModal(user)}
                      title="Reset Password"
                      style={{
                        background: "rgba(99, 102, 241, 0.08)",
                        border: "1px solid rgba(99, 102, 241, 0.25)",
                        color: "#4f46e5",
                        padding: "0.4rem 0.75rem",
                        borderRadius: "8px",
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.25rem",
                        fontSize: "0.8rem",
                        transition: "all 0.2s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "#4f46e5";
                        e.currentTarget.style.color = "#ffffff";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "rgba(99, 102, 241, 0.08)";
                        e.currentTarget.style.color = "#4f46e5";
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "1rem" }}>
                        lock_reset
                      </span>
                      Reset Password
                    </button>
                    {currentUser?.id !== user.id && (
                      <button
                        onClick={() => setUserToDelete(user)}
                        title="Delete User"
                        style={{
                          background: "rgba(239, 68, 68, 0.08)",
                          border: "1px solid rgba(239, 68, 68, 0.2)",
                          color: "#dc2626",
                          padding: "0.4rem 0.65rem",
                          borderRadius: "8px",
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "flex",
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
                ),
              },
            ]}
            rows={filteredUsers || []}
            getRowKey={(u) => u.id}
            emptyMessage={`No ${activeTab.toLowerCase()} found.`}
          />
        )}
      </div>

      {/* Bulk Add Users Modal */}
      {isBulkModalOpen && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalContent, width: "750px", maxWidth: "95%" }}>
            {bulkResult ? (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
                  <div>
                    <h2 style={{ fontSize: "1.4rem", fontWeight: 700, margin: 0, color: "var(--foreground)" }}>Bulk Import Results</h2>
                    <p style={{ color: "var(--color-muted)", fontSize: "0.85rem", margin: "0.2rem 0 0 0" }}>
                      Accounts processed across organization {organizations.find(o => o.id === bulkOrgId)?.name || ""}.
                    </p>
                  </div>
                  <button
                    onClick={() => { setIsBulkModalOpen(false); setBulkResult(null); }}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-muted)" }}
                  >
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>

                {/* Summary Badges */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.75rem", marginBottom: "1.5rem" }}>
                  <div style={{ background: "var(--color-surface)", padding: "0.85rem", borderRadius: "10px", border: "1px solid var(--color-border)", textAlign: "center" }}>
                    <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--foreground)" }}>{bulkResult.total_submitted}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--color-muted)", fontWeight: 600 }}>SUBMITTED</div>
                  </div>
                  <div style={{ background: "rgba(22, 163, 74, 0.08)", padding: "0.85rem", borderRadius: "10px", border: "1px solid rgba(22, 163, 74, 0.2)", textAlign: "center" }}>
                    <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "#16a34a" }}>{bulkResult.total_created}</div>
                    <div style={{ fontSize: "0.75rem", color: "#16a34a", fontWeight: 600 }}>CREATED / ADDED</div>
                  </div>
                  <div style={{ background: "rgba(217, 119, 6, 0.08)", padding: "0.85rem", borderRadius: "10px", border: "1px solid rgba(217, 119, 6, 0.2)", textAlign: "center" }}>
                    <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "#d97706" }}>{bulkResult.total_skipped}</div>
                    <div style={{ fontSize: "0.75rem", color: "#d97706", fontWeight: 600 }}>ALREADY EXISTED</div>
                  </div>
                  <div style={{ background: bulkResult.total_errors > 0 ? "rgba(220, 38, 38, 0.08)" : "var(--color-surface)", padding: "0.85rem", borderRadius: "10px", border: "1px solid var(--color-border)", textAlign: "center" }}>
                    <div style={{ fontSize: "1.3rem", fontWeight: 700, color: bulkResult.total_errors > 0 ? "var(--color-danger)" : "var(--color-muted)" }}>{bulkResult.total_errors}</div>
                    <div style={{ fontSize: "0.75rem", color: bulkResult.total_errors > 0 ? "var(--color-danger)" : "var(--color-muted)", fontWeight: 600 }}>ERRORS</div>
                  </div>
                </div>

                {/* Results Table */}
                <div style={{ maxHeight: "280px", overflowY: "auto", border: "1px solid var(--color-border)", borderRadius: "8px", marginBottom: "1.5rem" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
                    <thead>
                      <tr style={{ background: "var(--color-surface)", borderBottom: "1px solid var(--color-border)", textAlign: "left" }}>
                        <th style={{ padding: "0.6rem 0.8rem", fontWeight: 600 }}>Name</th>
                        <th style={{ padding: "0.6rem 0.8rem", fontWeight: 600 }}>Email</th>
                        <th style={{ padding: "0.6rem 0.8rem", fontWeight: 600 }}>Status</th>
                        <th style={{ padding: "0.6rem 0.8rem", fontWeight: 600 }}>Password</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkResult.results.map((r, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid var(--color-border)" }}>
                          <td style={{ padding: "0.55rem 0.8rem", fontWeight: 500 }}>{r.full_name || "—"}</td>
                          <td style={{ padding: "0.55rem 0.8rem", color: "var(--color-muted)" }}>{r.email}</td>
                          <td style={{ padding: "0.55rem 0.8rem" }}>
                            <span style={{
                              padding: "0.15rem 0.5rem",
                              borderRadius: "999px",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              background: r.status === "created" || r.status === "added_to_org" ? "rgba(22, 163, 74, 0.12)" : r.status === "already_in_org" ? "rgba(217, 119, 6, 0.12)" : "rgba(220, 38, 38, 0.12)",
                              color: r.status === "created" || r.status === "added_to_org" ? "#16a34a" : r.status === "already_in_org" ? "#d97706" : "var(--color-danger)"
                            }}>
                              {r.status === "created" ? "CREATED" : r.status === "added_to_org" ? "ADDED TO ORG" : r.status === "already_in_org" ? "EXISTED" : "ERROR"}
                            </span>
                          </td>
                          <td style={{ padding: "0.55rem 0.8rem", fontFamily: "monospace", fontSize: "0.85rem" }}>
                            {r.temporary_password || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Button
                    variant="secondary"
                    onClick={handleCopyCredentials}
                    style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "1.1rem" }}>
                      {copySuccess ? "check" : "content_copy"}
                    </span>
                    {copySuccess ? "Credentials Copied!" : "Copy Created Credentials"}
                  </Button>

                  <div style={{ display: "flex", gap: "0.75rem" }}>
                    <Button variant="secondary" onClick={() => { setBulkResult(null); setBulkInputText(""); }}>
                      Import More
                    </Button>
                    <Button onClick={() => { setIsBulkModalOpen(false); setBulkResult(null); }}>
                      Done
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
                  <div>
                    <h2 style={{ fontSize: "1.4rem", fontWeight: 700, margin: 0, color: "var(--foreground)" }}>Bulk Add / Import Users</h2>
                    <p style={{ color: "var(--color-muted)", fontSize: "0.85rem", margin: "0.2rem 0 0 0" }}>
                      Paste comma-separated rows or upload a CSV file to provision multiple accounts at once.
                    </p>
                  </div>
                  <button
                    onClick={() => setIsBulkModalOpen(false)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-muted)" }}
                  >
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>

                {/* Configuration Options */}
                <div style={{ display: "grid", gridTemplateColumns: organizations.length > 1 ? "1fr 1fr 1fr" : "1fr 1fr", gap: "1rem", marginBottom: "1.25rem" }}>
                  {organizations.length > 1 && (
                    <div>
                      <label style={styles.label}>Target Organization</label>
                      <select
                        value={bulkOrgId}
                        onChange={(e) => setBulkOrgId(Number(e.target.value))}
                        style={styles.selectField}
                      >
                        {organizations.map((org) => (
                          <option key={org.id} value={org.id}>{org.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label style={styles.label}>Default Role</label>
                    <select
                      value={bulkDefaultRole}
                      onChange={(e) => setBulkDefaultRole(e.target.value)}
                      style={styles.selectField}
                    >
                      <option value="STUDENT">STUDENT (Learner)</option>
                      <option value="TRAINER">TRAINER (Instructor)</option>
                      <option value="MENTOR">MENTOR (Mentor)</option>
                      <option value="PROGRAM_MANAGER">PROGRAM_MANAGER</option>
                      <option value="ACADEMIC_ADMIN">ACADEMIC_ADMIN</option>
                    </select>
                  </div>

                  <div>
                    <label style={styles.label}>Default Password</label>
                    <input
                      type="text"
                      value={bulkDefaultPassword}
                      onChange={(e) => setBulkDefaultPassword(e.target.value)}
                      placeholder="e.g. Welcome123!"
                      style={{
                        width: "100%",
                        padding: "0.85rem 1.2rem",
                        borderRadius: "10px",
                        border: "1px solid rgba(0,0,0,0.12)",
                        background: "var(--color-surface)",
                        color: "var(--foreground)",
                        fontSize: "0.95rem",
                        outline: "none"
                      }}
                    />
                  </div>
                </div>

                {/* Quick Action Helpers */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                  <label style={{ ...styles.label, marginBottom: 0 }}>
                    User Data (CSV / Comma Separated / Tab Separated)
                  </label>
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    <label
                      style={{
                        fontSize: "0.8rem",
                        color: "var(--color-primary)",
                        cursor: "pointer",
                        fontWeight: 600,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.2rem"
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "1rem" }}>upload_file</span>
                      Upload CSV
                      <input
                        type="file"
                        accept=".csv,.txt"
                        onChange={handleFileUpload}
                        style={{ display: "none" }}
                      />
                    </label>
                    <span style={{ color: "var(--color-border)" }}>|</span>
                    <button
                      type="button"
                      onClick={handleDownloadSample}
                      style={{ background: "none", border: "none", color: "var(--color-primary)", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "0.2rem" }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "1rem" }}>download</span>
                      Download Template
                    </button>
                    <span style={{ color: "var(--color-border)" }}>|</span>
                    <button
                      type="button"
                      onClick={handleInsertSample}
                      style={{ background: "none", border: "none", color: "var(--color-muted)", fontSize: "0.8rem", cursor: "pointer" }}
                    >
                      Fill Sample
                    </button>
                  </div>
                </div>

                <textarea
                  rows={6}
                  value={bulkInputText}
                  onChange={(e) => setBulkInputText(e.target.value)}
                  placeholder={`Format: Full Name, Email, Password (optional), Role (optional), Phone (optional)\n\nExample:\nJohn Doe, john.doe@example.com\nJane Smith, jane.smith@example.com, SecretPass123!, STUDENT\nDr. Alan Grant, alan.grant@example.com, , TRAINER, +1234567890`}
                  style={{
                    width: "100%",
                    padding: "0.75rem 1rem",
                    borderRadius: "10px",
                    border: "1px solid var(--color-border)",
                    background: "var(--color-surface)",
                    color: "var(--foreground)",
                    fontSize: "0.9rem",
                    fontFamily: "monospace",
                    lineHeight: 1.5,
                    resize: "vertical",
                    outline: "none",
                    marginBottom: "1rem"
                  }}
                />

                {/* Live Preview Count */}
                {(() => {
                  const parsed = parseBulkLines(bulkInputText, bulkDefaultRole, bulkDefaultPassword);
                  const validCount = parsed.filter(p => p.isValid).length;
                  const invalidCount = parsed.length - validCount;

                  return (
                    <div>
                      {parsed.length > 0 && (
                        <div style={{
                          background: "var(--color-surface)",
                          borderRadius: "8px",
                          border: "1px solid var(--color-border)",
                          padding: "0.75rem 1rem",
                          marginBottom: "1.25rem",
                          fontSize: "0.85rem"
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.35rem" }}>
                            <span style={{ fontWeight: 600 }}>
                              Detected: <strong>{parsed.length}</strong> users ({validCount} valid{invalidCount > 0 ? `, ${invalidCount} with issues` : ""})
                            </span>
                            <span style={{ color: "var(--color-muted)" }}>Previewing first {Math.min(3, parsed.length)}</span>
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                            {parsed.slice(0, 3).map((p, idx) => (
                              <div key={idx} style={{ display: "flex", alignItems: "center", gap: "0.75rem", color: p.isValid ? "var(--foreground)" : "var(--color-danger)" }}>
                                <span className="material-symbols-outlined" style={{ fontSize: "1rem", color: p.isValid ? "#16a34a" : "var(--color-danger)" }}>
                                  {p.isValid ? "check_circle" : "error"}
                                </span>
                                <span style={{ fontWeight: 500 }}>{p.fullName || "(no name)"}</span>
                                <span style={{ color: "var(--color-muted)" }}>&lt;{p.email || "(no email)"}&gt;</span>
                                <span style={{ fontSize: "0.75rem", padding: "0.1rem 0.4rem", borderRadius: "4px", background: "rgba(0,0,0,0.06)" }}>{p.role}</span>
                                {p.error && <span style={{ color: "var(--color-danger)", fontSize: "0.8rem" }}>— {p.error}</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
                        <Button variant="secondary" onClick={() => setIsBulkModalOpen(false)}>
                          Cancel
                        </Button>
                        <Button
                          onClick={handleBulkSubmit}
                          disabled={bulkIsSubmitting || validCount === 0}
                        >
                          {bulkIsSubmitting
                            ? "Importing Users..."
                            : validCount > 0
                            ? `Import ${validCount} Users`
                            : "Import Users"}
                        </Button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add New User Modal */}
      {isModalOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
              <div>
                <h2 style={{ fontSize: "1.4rem", fontWeight: 700, margin: 0 }}>Add New User</h2>
                <p style={{ color: "var(--color-muted)", fontSize: "0.85rem", margin: "0.2rem 0 0 0" }}>
                  Provide user profile fields, assign organization, and designate roles.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-muted)" }}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {/* Full Name & Title (2-Col) */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <Input
                  id="new-name"
                  label="Full Name *"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. John Doe"
                />
                <Input
                  id="new-title"
                  label="Professional Title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Academic Administrator"
                />
              </div>

              {/* Email & Phone (2-Col) */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <Input
                  id="new-email"
                  label="Email Address *"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. admin@empowers.com"
                />
                <Input
                  id="new-phone"
                  label="Phone Number"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="e.g. +1 (555) 987-6543"
                />
              </div>

              {/* Temporary Password & Avatar URL (2-Col) */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <Input
                  id="new-pass"
                  label="Temporary Password *"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 8 characters"
                />
                <Input
                  id="new-avatar"
                  label="Avatar / Photo URL"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://example.com/avatar.jpg"
                />
              </div>

              {/* Bio */}
              <div>
                <label style={styles.label}>Bio / Summary</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Brief biography, background, or operational scope..."
                  style={styles.textareaField}
                />
              </div>

              {/* Organization & Role (2-Col) */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={styles.label}>Assign to Organization *</label>
                  <div style={{ position: "relative" }}>
                    <select
                      value={inviteOrgId}
                      onChange={(e) => setInviteOrgId(Number(e.target.value))}
                      style={styles.selectField}
                    >
                      {organizations.map((org) => (
                        <option key={org.id} value={org.id}>
                          {org.name} ({org.code})
                        </option>
                      ))}
                    </select>
                    <span
                      className="material-symbols-outlined"
                      style={{ position: "absolute", right: "1rem", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--text-muted)" }}
                    >
                      expand_more
                    </span>
                  </div>
                </div>

                <div>
                  <label style={styles.label}>User Role *</label>
                  <div style={{ position: "relative" }}>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      style={styles.selectField}
                    >
                      <option value="ACADEMIC_ADMIN">Academic Administrator</option>
                      <option value="TRAINER">Instructor / Trainer</option>
                      <option value="STUDENT">Student</option>
                      {isSuperAdmin && <option value="SUPER_ADMIN">Platform Super Administrator</option>}
                    </select>
                    <span
                      className="material-symbols-outlined"
                      style={{ position: "absolute", right: "1rem", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--text-muted)" }}
                    >
                      expand_more
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: "1rem", marginTop: "1rem" }}>
                <Button variant="secondary" style={{ flex: 1 }} onClick={() => setIsModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  style={{ flex: 1 }}
                  onClick={handleCreateUser}
                  disabled={!fullName || !email || password.length < 8 || isSubmitting}
                >
                  {isSubmitting ? "Creating..." : "Create User"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit User & Manage Organizations Modal */}
      {managingUser && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            {/* Modal Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.2rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                {managingUser.avatar_url ? (
                  <img
                    src={managingUser.avatar_url}
                    alt={managingUser.full_name}
                    style={{
                      width: "44px",
                      height: "44px",
                      borderRadius: "50%",
                      objectFit: "cover",
                      border: "1px solid var(--color-border)",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: "44px",
                      height: "44px",
                      borderRadius: "50%",
                      background: "var(--primary-gradient)",
                      color: "#fff",
                      fontWeight: 700,
                      fontSize: "1rem",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {managingUser.full_name.charAt(0)}
                  </div>
                )}
                <div>
                  <h2 style={{ fontSize: "1.3rem", fontWeight: 700, margin: 0 }}>{managingUser.full_name}</h2>
                  <div style={{ fontSize: "0.85rem", color: "var(--color-muted)", marginTop: "0.1rem" }}>
                    {managingUser.email} &bull; ID: #{managingUser.id}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setManagingUser(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-muted)" }}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Modal Navigation Tabs */}
            <div
              style={{
                display: "flex",
                gap: "1.5rem",
                borderBottom: "1px solid var(--color-border)",
                marginBottom: "1.2rem",
              }}
            >
              <button
                onClick={() => setManageTab("PROFILE")}
                style={{
                  background: "none",
                  border: "none",
                  padding: "0.5rem 0",
                  fontSize: "0.95rem",
                  fontWeight: 600,
                  color: manageTab === "PROFILE" ? "var(--color-primary)" : "var(--color-muted)",
                  cursor: "pointer",
                  borderBottom: manageTab === "PROFILE" ? "2px solid var(--color-primary)" : "2px solid transparent",
                }}
              >
                Edit Profile Fields
              </button>
              <button
                onClick={() => setManageTab("ORGANIZATIONS")}
                style={{
                  background: "none",
                  border: "none",
                  padding: "0.5rem 0",
                  fontSize: "0.95rem",
                  fontWeight: 600,
                  color: manageTab === "ORGANIZATIONS" ? "var(--color-primary)" : "var(--color-muted)",
                  cursor: "pointer",
                  borderBottom: manageTab === "ORGANIZATIONS" ? "2px solid var(--color-primary)" : "2px solid transparent",
                }}
              >
                Organization Affiliations ({managingUser.organizations?.length || 0})
              </button>
            </div>

            {actionMessage && (
              <div
                style={{
                  background: "rgba(16, 185, 129, 0.1)",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                  color: "#059669",
                  padding: "0.6rem 0.9rem",
                  borderRadius: "8px",
                  fontSize: "0.88rem",
                  marginBottom: "1rem",
                }}
              >
                {actionMessage}
              </div>
            )}

            {/* TAB 1: Edit Profile Fields */}
            {manageTab === "PROFILE" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {/* Full Name & Title (2-Col) */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <Input
                    id="edit-name"
                    label="Full Name *"
                    value={editFullName}
                    onChange={(e) => setEditFullName(e.target.value)}
                  />
                  <Input
                    id="edit-title"
                    label="Professional Title"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="e.g. Lead Instructor"
                  />
                </div>

                {/* Phone & Status (2-Col) */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <Input
                    id="edit-phone"
                    label="Phone Number"
                    value={editPhoneNumber}
                    onChange={(e) => setEditPhoneNumber(e.target.value)}
                    placeholder="e.g. +1 (555) 987-6543"
                  />
                  <div>
                    <label style={styles.label}>Account Status</label>
                    <div style={{ position: "relative" }}>
                      <select
                        value={editIsActive ? "ACTIVE" : "SUSPENDED"}
                        onChange={(e) => setEditIsActive(e.target.value === "ACTIVE")}
                        style={styles.selectField}
                      >
                        <option value="ACTIVE">Active</option>
                        <option value="SUSPENDED">Suspended</option>
                      </select>
                      <span
                        className="material-symbols-outlined"
                        style={{ position: "absolute", right: "1rem", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--text-muted)" }}
                      >
                        expand_more
                      </span>
                    </div>
                  </div>
                </div>

                {/* Avatar URL */}
                <Input
                  id="edit-avatar"
                  label="Avatar / Photo URL"
                  value={editAvatarUrl}
                  onChange={(e) => setEditAvatarUrl(e.target.value)}
                  placeholder="https://example.com/avatar.jpg"
                />

                {/* Bio */}
                <div>
                  <label style={styles.label}>Bio / Summary</label>
                  <textarea
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    placeholder="User biography, certifications, or notes..."
                    style={styles.textareaField}
                  />
                </div>

                <div style={{ display: "flex", gap: "1rem", marginTop: "0.5rem" }}>
                  <Button variant="secondary" style={{ flex: 1 }} onClick={() => setManagingUser(null)}>
                    Cancel
                  </Button>
                  <Button
                    style={{ flex: 1 }}
                    onClick={handleUpdateProfile}
                    disabled={!editFullName.trim() || isSavingProfile}
                  >
                    {isSavingProfile ? "Saving Profile..." : "Save Profile Changes"}
                  </Button>
                </div>
              </div>
            )}

            {/* TAB 2: Organization Affiliations */}
            {manageTab === "ORGANIZATIONS" && (
              <div>
                {/* Active Memberships List */}
                <div style={{ marginBottom: "1.5rem" }}>
                  <label style={{ fontSize: "0.85rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-muted)", display: "block", marginBottom: "0.6rem" }}>
                    Active Organization Memberships
                  </label>

                  {managingUser.organizations && managingUser.organizations.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                      {managingUser.organizations.map((org) => (
                        <div
                          key={org.id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "0.75rem 1rem",
                            borderRadius: "8px",
                            border: "1px solid var(--color-border)",
                            background: "var(--color-surface)",
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>{org.name}</div>
                            <div style={{ fontSize: "0.8rem", color: "var(--color-muted)", marginTop: "0.15rem" }}>
                              Roles: <span style={{ color: "var(--color-primary)", fontWeight: 500 }}>{org.roles.map((r) => r.replace("_", " ")).join(", ")}</span>
                            </div>
                          </div>
                          {isSuperAdmin && (
                            <button
                              onClick={() => handleRemoveMembership(org.id)}
                              disabled={isAssigning}
                              style={{
                                background: "#fee2e2",
                                color: "#dc2626",
                                border: "none",
                                padding: "0.35rem 0.7rem",
                                borderRadius: "6px",
                                cursor: "pointer",
                                fontSize: "0.8rem",
                                fontWeight: 600,
                              }}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ color: "var(--color-muted)", fontSize: "0.9rem", margin: 0 }}>
                      No organization memberships currently assigned.
                    </p>
                  )}
                </div>

                {/* Assign / Update Organization Form */}
                <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: "1.2rem" }}>
                  <h3 style={{ fontSize: "1.05rem", fontWeight: 700, margin: "0 0 0.85rem 0" }}>
                    Assign or Update Membership
                  </h3>

                  <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    <div>
                      <label style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.35rem", display: "block" }}>
                        Select Organization
                      </label>
                      <div style={{ position: "relative" }}>
                        <select
                          value={assignOrgId}
                          onChange={(e) => setAssignOrgId(Number(e.target.value))}
                          style={styles.selectField}
                        >
                          {organizations.map((org) => (
                            <option key={org.id} value={org.id}>
                              {org.name} ({org.code})
                            </option>
                          ))}
                        </select>
                        <span
                          className="material-symbols-outlined"
                          style={{ position: "absolute", right: "1rem", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--text-muted)" }}
                        >
                          expand_more
                        </span>
                      </div>
                    </div>

                    <div>
                      <label style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.35rem", display: "block" }}>
                        Assigned Role
                      </label>
                      <div style={{ position: "relative" }}>
                        <select
                          value={assignRole}
                          onChange={(e) => setAssignRole(e.target.value)}
                          style={styles.selectField}
                        >
                          <option value="ACADEMIC_ADMIN">Academic Administrator</option>
                          <option value="TRAINER">Instructor / Trainer</option>
                          <option value="STUDENT">Student</option>
                          {isSuperAdmin && <option value="SUPER_ADMIN">Platform Super Administrator</option>}
                        </select>
                        <span
                          className="material-symbols-outlined"
                          style={{ position: "absolute", right: "1rem", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--text-muted)" }}
                        >
                          expand_more
                        </span>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: "1rem", marginTop: "0.5rem" }}>
                      <Button variant="secondary" style={{ flex: 1 }} onClick={() => setManagingUser(null)}>
                        Done
                      </Button>
                      <Button
                        style={{ flex: 1 }}
                        onClick={handleAssignOrganization}
                        disabled={isAssigning}
                      >
                        {isAssigning ? "Saving..." : "Assign / Update Role"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {/* Security & Password Reset */}
            <div
              style={{
                marginTop: "2rem",
                paddingTop: "1.25rem",
                borderTop: "1px solid var(--color-border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "1rem",
              }}
            >
              <div>
                <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--foreground)" }}>
                  Security & Credentials
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--color-muted)" }}>
                  Reset password and issue temporary credentials for this user
                </div>
              </div>
              <button
                type="button"
                onClick={() => openResetPasswordModal(managingUser)}
                style={{
                  background: "rgba(99, 102, 241, 0.08)",
                  border: "1px solid rgba(99, 102, 241, 0.25)",
                  color: "#4f46e5",
                  padding: "0.45rem 0.85rem",
                  borderRadius: "8px",
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.3rem",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "1rem" }}>
                  lock_reset
                </span>
                Reset Password
              </button>
            </div>

            {currentUser?.id !== managingUser.id && (
              <div
                style={{
                  marginTop: "1.5rem",
                  paddingTop: "1.25rem",
                  borderTop: "1px solid var(--color-border)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "1rem",
                }}
              >
                <div>
                  <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#ef4444" }}>Danger Zone</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    Permanently delete this user and all associated data
                  </div>
                </div>
                <button
                  onClick={() => setUserToDelete(managingUser)}
                  style={{
                    background: "rgba(239, 68, 68, 0.08)",
                    border: "1px solid rgba(239, 68, 68, 0.25)",
                    color: "#dc2626",
                    padding: "0.45rem 0.85rem",
                    borderRadius: "8px",
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.3rem",
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
                  Delete User Account
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {userToDelete && (
        <DeleteConfirmationModal
          open={!!userToDelete}
          onClose={() => setUserToDelete(null)}
          onConfirm={handleDeleteUser}
          itemName={userToDelete.full_name}
          itemType="User"
          itemDetails={userToDelete.email}
          warningText="This action will permanently delete this user account, their organization affiliations, student enrollment records, submissions, and discussion posts. This action cannot be undone."
        />
      )}

      {/* Admin Reset Password Modal */}
      {userToResetPassword && (
        <div style={styles.modalOverlay} onClick={() => !resetSubmitting && setUserToResetPassword(null)}>
          <div style={{ ...styles.modalContent, width: "520px" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "10px",
                    background: "rgba(99, 102, 241, 0.12)",
                    color: "#4f46e5",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "1.3rem" }}>
                    lock_reset
                  </span>
                </div>
                <div>
                  <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>Reset User Password</h2>
                  <div style={{ fontSize: "0.8rem", color: "var(--color-muted)" }}>
                    {userToResetPassword.full_name} ({userToResetPassword.email})
                  </div>
                </div>
              </div>
              <button
                onClick={() => !resetSubmitting && setUserToResetPassword(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-muted)" }}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {resetError && (
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
                {resetError}
              </div>
            )}

            {resetSuccess ? (
              <div>
                <div
                  style={{
                    padding: "1rem",
                    background: "rgba(16, 185, 129, 0.08)",
                    border: "1px solid rgba(16, 185, 129, 0.25)",
                    borderRadius: "12px",
                    marginBottom: "1.5rem",
                    textAlign: "center",
                  }}
                >
                  <span className="material-symbols-outlined" style={{ color: "#10b981", fontSize: "2rem", marginBottom: "0.5rem" }}>
                    check_circle
                  </span>
                  <div style={{ fontSize: "1rem", fontWeight: 700, color: "#065f46", marginBottom: "0.25rem" }}>
                    Password Reset Successful!
                  </div>
                  <div style={{ fontSize: "0.82rem", color: "#047857" }}>
                    The new credentials for <strong>{userToResetPassword.full_name}</strong> are ready.
                  </div>
                </div>

                <div style={{ marginBottom: "1.5rem" }}>
                  <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "0.4rem" }}>
                    Temporary Password
                  </label>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "0.75rem 1rem",
                      borderRadius: "10px",
                      background: "var(--color-surface)",
                      border: "1px solid var(--color-border)",
                      fontFamily: "monospace",
                      fontSize: "1.1rem",
                      fontWeight: 700,
                      color: "var(--foreground)",
                    }}
                  >
                    <span>{resetSuccess}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(resetSuccess)}
                      style={{
                        background: copiedPassword ? "#10b981" : "var(--color-primary)",
                        color: "#ffffff",
                        border: "none",
                        padding: "0.35rem 0.75rem",
                        borderRadius: "6px",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.3rem",
                        transition: "all 0.2s",
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "0.95rem" }}>
                        {copiedPassword ? "check" : "content_copy"}
                      </span>
                      {copiedPassword ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>

                {resetMustChangePassword && (
                  <div style={{ fontSize: "0.8rem", color: "var(--color-muted)", marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "1rem", color: "#3b82f6" }}>
                      info
                    </span>
                    User will be prompted to change this password immediately upon their next login.
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <Button
                    onClick={() => {
                      setUserToResetPassword(null);
                      setResetSuccess(null);
                    }}
                  >
                    Done
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleAdminResetPassword}>
                <div style={{ marginBottom: "1.25rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                    <label style={styles.label}>New Password</label>
                    <button
                      type="button"
                      onClick={generateTemporaryPassword}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#4f46e5",
                        fontSize: "0.78rem",
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.2rem",
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "0.95rem" }}>
                        auto_fix_high
                      </span>
                      Quick Generate
                    </button>
                  </div>
                  <div style={{ position: "relative" }}>
                    <input
                      type={showResetNewPassword ? "text" : "password"}
                      required
                      value={resetNewPassword}
                      onChange={(e) => setResetNewPassword(e.target.value)}
                      placeholder="Enter at least 6 characters"
                      style={{
                        ...styles.selectField,
                        paddingRight: "2.5rem",
                        fontFamily: showResetNewPassword ? "monospace" : "inherit",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowResetNewPassword(!showResetNewPassword)}
                      tabIndex={-1}
                      style={{
                        position: "absolute",
                        right: "0.75rem",
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "none",
                        border: "none",
                        color: "var(--color-muted)",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "1.1rem" }}>
                        {showResetNewPassword ? "visibility_off" : "visibility"}
                      </span>
                    </button>
                  </div>
                </div>

                <div style={{ marginBottom: "1.5rem" }}>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.6rem",
                      cursor: "pointer",
                      fontSize: "0.88rem",
                      fontWeight: 500,
                      color: "var(--foreground)",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={resetMustChangePassword}
                      onChange={(e) => setResetMustChangePassword(e.target.checked)}
                      style={{ width: "16px", height: "16px", accentColor: "var(--color-primary)" }}
                    />
                    Require user to change password on next sign in
                  </label>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={resetSubmitting}
                    onClick={() => setUserToResetPassword(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={resetSubmitting || !resetNewPassword || resetNewPassword.trim().length < 6}
                  >
                    {resetSubmitting ? "Resetting..." : "Reset Password"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function UsersPage() {
  return (
    <RequireAuth allowedRoles={PROGRAM_COHORT_ADMIN_ROLES}>
      <UsersContent />
    </RequireAuth>
  );
}
