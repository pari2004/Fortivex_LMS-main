"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { useAuth } from "@/lib/auth/AuthContext";
import { listOrganizations, createOrganization, updateOrganization } from "@/lib/api/endpoints";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import type { Organization } from "@/lib/api/types";

const styles = {
  modalOverlay: {
    position: "fixed" as const,
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(0,0,0,0.55)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
    backdropFilter: "blur(5px)",
  },
  modalContent: {
    background: "var(--background)",
    padding: "2.2rem",
    borderRadius: "16px",
    width: "560px",
    maxWidth: "94%",
    maxHeight: "90vh",
    overflowY: "auto" as const,
    boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
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
  statCard: {
    background: "var(--color-surface)",
    border: "1px solid var(--color-border)",
    borderRadius: "12px",
    padding: "1.25rem 1.5rem",
    display: "flex",
    alignItems: "center",
    gap: "1.2rem",
    boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
  },
  orgCard: {
    background: "var(--color-surface)",
    border: "1px solid var(--color-border)",
    borderRadius: "14px",
    padding: "1.75rem",
    display: "flex",
    flexDirection: "column" as const,
    justifyContent: "space-between",
    boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
    transition: "transform 0.2s ease, box-shadow 0.2s ease",
  },
};

function OrganizationManagementContent() {
  const { token, refreshUser } = useAuth();

  const [organizations, setOrganizations] = useState<Organization[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Create Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [code, setCode] = useState("");
  const [primaryDomain, setPrimaryDomain] = useState("");
  const [lmsDomain, setLmsDomain] = useState("");
  const [statusVal, setStatusVal] = useState("ACTIVE");

  // Edit Modal State
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editName, setEditName] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editPrimaryDomain, setEditPrimaryDomain] = useState("");
  const [editLmsDomain, setEditLmsDomain] = useState("");
  const [editStatus, setEditStatus] = useState("ACTIVE");

  const fetchOrgs = useCallback(async () => {
    if (!token) return;
    try {
      setError(null);
      const data = await listOrganizations(token);
      setOrganizations(data);
    } catch (e: any) {
      setError(e.message || "Failed to load organizations");
    }
  }, [token]);

  useEffect(() => {
    fetchOrgs();
  }, [fetchOrgs]);

  const autoGenerateSlugAndCode = (val: string) => {
    setName(val);
    if (!slug) {
      setSlug(
        val
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "")
      );
    }
    if (!code) {
      setCode(
        val
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, "")
          .slice(0, 10)
      );
    }
  };

  const handleCreateOrg = async () => {
    if (!token || !name || !slug || !code) return;
    setIsCreating(true);
    try {
      await createOrganization(token, {
        name: name.trim(),
        slug: slug.trim().toLowerCase(),
        code: code.trim().toUpperCase(),
        primary_domain: primaryDomain.trim() || null,
        lms_domain: lmsDomain.trim() || null,
        status: statusVal,
      });

      setName("");
      setSlug("");
      setCode("");
      setPrimaryDomain("");
      setLmsDomain("");
      setStatusVal("ACTIVE");
      setIsCreateOpen(false);
      await fetchOrgs();
      await refreshUser();
    } catch (e: any) {
      alert("Error creating organization: " + e.message);
    } finally {
      setIsCreating(false);
    }
  };

  const openEditModal = (org: Organization) => {
    setEditingOrg(org);
    setEditName(org.name);
    setEditSlug(org.slug);
    setEditCode(org.code);
    setEditPrimaryDomain(org.primary_domain || "");
    setEditLmsDomain(org.lms_domain || "");
    setEditStatus(org.status);
  };

  const handleUpdateOrg = async () => {
    if (!token || !editingOrg) return;
    setIsUpdating(true);
    try {
      await updateOrganization(token, editingOrg.id, {
        name: editName.trim(),
        slug: editSlug.trim().toLowerCase(),
        code: editCode.trim().toUpperCase(),
        primary_domain: editPrimaryDomain.trim() || null,
        lms_domain: editLmsDomain.trim() || null,
        status: editStatus,
      });

      setEditingOrg(null);
      await fetchOrgs();
      await refreshUser();
    } catch (e: any) {
      alert("Error updating organization: " + e.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const filteredOrgs = organizations?.filter((org) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      org.name.toLowerCase().includes(q) ||
      org.code.toLowerCase().includes(q) ||
      org.slug.toLowerCase().includes(q) ||
      (org.lms_domain && org.lms_domain.toLowerCase().includes(q))
    );
  });

  // Calculate platform aggregations
  const totalOrgs = organizations?.length || 0;
  const totalAdmins = organizations?.reduce((acc, o) => acc + (o.total_admins || 0), 0) || 0;
  const totalInstructors = organizations?.reduce((acc, o) => acc + (o.total_instructors || 0), 0) || 0;
  const totalStudents = organizations?.reduce((acc, o) => acc + (o.total_students || 0), 0) || 0;
  const totalPrograms = organizations?.reduce((acc, o) => acc + (o.total_programs || 0), 0) || 0;

  return (
    <div style={{ maxWidth: "1280px", margin: "0 auto", paddingBottom: "3rem" }}>
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
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.4rem" }}>
            <h1 style={{ fontSize: "2rem", fontWeight: 700, margin: 0 }}>Organization Management</h1>
            <Badge status="active">SUPER ADMIN</Badge>
          </div>
          <p style={{ color: "var(--color-muted)", fontSize: "1rem", margin: 0 }}>
            Configure multi-tenant institutions, assign academic directors, and manage custom domains.
          </p>
        </div>
        <Button
          onClick={() => setIsCreateOpen(true)}
          style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: "1.2rem" }}>
            domain_add
          </span>{" "}
          New Organization
        </Button>
      </div>

      {/* Aggregate Overview Bar */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "1.2rem",
          marginBottom: "2rem",
        }}
      >
        <div style={styles.statCard}>
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "12px",
              background: "rgba(59, 130, 246, 0.1)",
              color: "var(--color-primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "1.7rem" }}>
              corporate_fare
            </span>
          </div>
          <div>
            <div style={{ fontSize: "0.85rem", color: "var(--color-muted)", fontWeight: 600 }}>Institutions</div>
            <div style={{ fontSize: "1.6rem", fontWeight: 700 }}>{totalOrgs}</div>
          </div>
        </div>

        <div style={styles.statCard}>
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "12px",
              background: "rgba(16, 185, 129, 0.1)",
              color: "#10b981",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "1.7rem" }}>
              admin_panel_settings
            </span>
          </div>
          <div>
            <div style={{ fontSize: "0.85rem", color: "var(--color-muted)", fontWeight: 600 }}>Academic Admins</div>
            <div style={{ fontSize: "1.6rem", fontWeight: 700 }}>{totalAdmins}</div>
          </div>
        </div>

        <div style={styles.statCard}>
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "12px",
              background: "rgba(245, 158, 11, 0.1)",
              color: "#f59e0b",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "1.7rem" }}>
              school
            </span>
          </div>
          <div>
            <div style={{ fontSize: "0.85rem", color: "var(--color-muted)", fontWeight: 600 }}>Enrolled Learners</div>
            <div style={{ fontSize: "1.6rem", fontWeight: 700 }}>{totalStudents}</div>
          </div>
        </div>

        <div style={styles.statCard}>
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "12px",
              background: "rgba(139, 92, 246, 0.1)",
              color: "#8b5cf6",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "1.7rem" }}>
              library_books
            </span>
          </div>
          <div>
            <div style={{ fontSize: "0.85rem", color: "var(--color-muted)", fontWeight: 600 }}>Total Programs</div>
            <div style={{ fontSize: "1.6rem", fontWeight: 700 }}>{totalPrograms}</div>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1.5rem",
          gap: "1rem",
        }}
      >
        <div style={{ width: "320px" }}>
          <Input
            id="search-orgs"
            placeholder="Search organizations or domains..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div style={{ fontSize: "0.9rem", color: "var(--color-muted)", fontWeight: 500 }}>
          Showing {filteredOrgs?.length || 0} of {totalOrgs} organizations
        </div>
      </div>

      {error && <ErrorState message={error} onRetry={fetchOrgs} />}
      {!error && organizations === null && <LoadingState message="Loading organizations..." />}

      {/* Organizations Grid */}
      {!error && organizations !== null && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
            gap: "1.5rem",
          }}
        >
          {filteredOrgs && filteredOrgs.length > 0 ? (
            filteredOrgs.map((org) => (
              <div key={org.id} style={styles.orgCard}>
                <div>
                  {/* Card Header */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: "1rem",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                        <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>{org.name}</h2>
                        <span
                          style={{
                            background: "rgba(0,0,0,0.06)",
                            padding: "0.15rem 0.5rem",
                            borderRadius: "6px",
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            letterSpacing: "0.05em",
                            color: "var(--foreground)",
                          }}
                        >
                          {org.code}
                        </span>
                      </div>
                      <div style={{ fontSize: "0.82rem", color: "var(--color-muted)", marginTop: "0.25rem" }}>
                        Slug: <code>{org.slug}</code> &bull; ID: #{org.id}
                      </div>
                    </div>
                    <Badge status={org.status === "ACTIVE" ? "active" : "inactive"}>
                      {org.status}
                    </Badge>
                  </div>

                  {/* Domain Badges */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", marginBottom: "1.25rem" }}>
                    {org.lms_domain && (
                      <div
                        style={{
                          fontSize: "0.82rem",
                          color: "var(--foreground)",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.4rem",
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: "1rem", color: "var(--color-primary)" }}>
                          public
                        </span>
                        <span>LMS Domain: <strong>{org.lms_domain}</strong></span>
                      </div>
                    )}
                    {org.primary_domain && (
                      <div
                        style={{
                          fontSize: "0.82rem",
                          color: "var(--color-muted)",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.4rem",
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: "1rem" }}>
                          link
                        </span>
                        <span>Web Domain: {org.primary_domain}</span>
                      </div>
                    )}
                  </div>

                  {/* Metrics Row */}
                  <div
                    style={{
                      background: "rgba(0,0,0,0.02)",
                      border: "1px solid var(--color-border)",
                      borderRadius: "10px",
                      padding: "0.85rem 1rem",
                      display: "grid",
                      gridTemplateColumns: "repeat(4, 1fr)",
                      gap: "0.5rem",
                      textAlign: "center",
                      marginBottom: "1.5rem",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--foreground)" }}>
                        {org.total_admins || 0}
                      </div>
                      <div style={{ fontSize: "0.72rem", color: "var(--color-muted)", fontWeight: 600 }}>Admins</div>
                    </div>
                    <div>
                      <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--foreground)" }}>
                        {org.total_instructors || 0}
                      </div>
                      <div style={{ fontSize: "0.72rem", color: "var(--color-muted)", fontWeight: 600 }}>Instructors</div>
                    </div>
                    <div>
                      <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--foreground)" }}>
                        {org.total_students || 0}
                      </div>
                      <div style={{ fontSize: "0.72rem", color: "var(--color-muted)", fontWeight: 600 }}>Students</div>
                    </div>
                    <div>
                      <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--color-primary)" }}>
                        {org.total_programs || 0}
                      </div>
                      <div style={{ fontSize: "0.72rem", color: "var(--color-muted)", fontWeight: 600 }}>Programs</div>
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div
                  style={{
                    display: "flex",
                    gap: "0.75rem",
                    borderTop: "1px solid var(--color-border)",
                    paddingTop: "1rem",
                  }}
                >
                  <Button
                    variant="secondary"
                    style={{ flex: 1, fontSize: "0.85rem", padding: "0.5rem 0.8rem" }}
                    onClick={() => openEditModal(org)}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "1rem", marginRight: "0.3rem" }}>
                      edit
                    </span>
                    Edit Tenant
                  </Button>
                  <Link
                    href={`/admin/users`}
                    style={{
                      flex: 1,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "0.3rem",
                      padding: "0.5rem 0.8rem",
                      borderRadius: "8px",
                      background: "var(--color-primary)",
                      color: "#fff",
                      textDecoration: "none",
                      fontSize: "0.85rem",
                      fontWeight: 600,
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "1rem" }}>
                      group
                    </span>
                    Manage Users
                  </Link>
                </div>
              </div>
            ))
          ) : (
            <div
              style={{
                gridColumn: "1 / -1",
                textAlign: "center",
                padding: "3rem",
                color: "var(--color-muted)",
              }}
            >
              No organizations found matching "{searchQuery}".
            </div>
          )}
        </div>
      )}

      {/* CREATE ORGANIZATION MODAL */}
      {isCreateOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1.5rem",
              }}
            >
              <div>
                <h2 style={{ fontSize: "1.4rem", fontWeight: 700, margin: 0 }}>Add New Organization</h2>
                <p style={{ color: "var(--color-muted)", fontSize: "0.85rem", margin: "0.2rem 0 0 0" }}>
                  Provision an independent academic entity within the platform.
                </p>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-muted)" }}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <Input
                id="org-name"
                label="Organization Name *"
                value={name}
                onChange={(e) => autoGenerateSlugAndCode(e.target.value)}
                placeholder="e.g. HealthTech Institute"
              />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <Input
                  id="org-code"
                  label="Code Identifier *"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. HEALTHTECH"
                />
                <Input
                  id="org-slug"
                  label="URL Slug *"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase())}
                  placeholder="e.g. healthtech-institute"
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <Input
                  id="org-lms-domain"
                  label="LMS Custom Domain"
                  value={lmsDomain}
                  onChange={(e) => setLmsDomain(e.target.value)}
                  placeholder="e.g. lms.healthtech.edu"
                />
                <Input
                  id="org-primary-domain"
                  label="Primary Website Domain"
                  value={primaryDomain}
                  onChange={(e) => setPrimaryDomain(e.target.value)}
                  placeholder="e.g. healthtech.edu"
                />
              </div>

              <div>
                <label
                  style={{
                    fontSize: "0.85rem",
                    fontWeight: 700,
                    marginBottom: "0.4rem",
                    display: "block",
                    color: "var(--foreground)",
                  }}
                >
                  Initial Status
                </label>
                <div style={{ position: "relative" }}>
                  <select
                    value={statusVal}
                    onChange={(e) => setStatusVal(e.target.value)}
                    style={styles.selectField}
                  >
                    <option value="ACTIVE">Active (Live Tenant)</option>
                    <option value="INACTIVE">Inactive (Pending Setup)</option>
                  </select>
                  <span
                    className="material-symbols-outlined"
                    style={{
                      position: "absolute",
                      right: "1rem",
                      top: "50%",
                      transform: "translateY(-50%)",
                      pointerEvents: "none",
                      color: "var(--text-muted)",
                    }}
                  >
                    expand_more
                  </span>
                </div>
              </div>

              <div style={{ display: "flex", gap: "1rem", marginTop: "1rem" }}>
                <Button variant="secondary" style={{ flex: 1 }} onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button
                  style={{ flex: 1 }}
                  onClick={handleCreateOrg}
                  disabled={!name.trim() || !slug.trim() || !code.trim() || isCreating}
                >
                  {isCreating ? "Creating..." : "Provision Organization"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EDIT ORGANIZATION MODAL */}
      {editingOrg && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1.5rem",
              }}
            >
              <div>
                <h2 style={{ fontSize: "1.4rem", fontWeight: 700, margin: 0 }}>Edit Organization</h2>
                <p style={{ color: "var(--color-muted)", fontSize: "0.85rem", margin: "0.2rem 0 0 0" }}>
                  Modify organization configuration and tenant domains for #{editingOrg.id}.
                </p>
              </div>
              <button
                onClick={() => setEditingOrg(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-muted)" }}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <Input
                id="edit-org-name"
                label="Organization Name *"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <Input
                  id="edit-org-code"
                  label="Code Identifier *"
                  value={editCode}
                  onChange={(e) => setEditCode(e.target.value.toUpperCase())}
                />
                <Input
                  id="edit-org-slug"
                  label="URL Slug *"
                  value={editSlug}
                  onChange={(e) => setEditSlug(e.target.value.toLowerCase())}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <Input
                  id="edit-org-lms-domain"
                  label="LMS Custom Domain"
                  value={editLmsDomain}
                  onChange={(e) => setEditLmsDomain(e.target.value)}
                  placeholder="e.g. lms.empowersacademy.com"
                />
                <Input
                  id="edit-org-primary-domain"
                  label="Primary Website Domain"
                  value={editPrimaryDomain}
                  onChange={(e) => setEditPrimaryDomain(e.target.value)}
                  placeholder="e.g. empowersacademy.com"
                />
              </div>

              <div>
                <label
                  style={{
                    fontSize: "0.85rem",
                    fontWeight: 700,
                    marginBottom: "0.4rem",
                    display: "block",
                    color: "var(--foreground)",
                  }}
                >
                  Tenant Status
                </label>
                <div style={{ position: "relative" }}>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    style={styles.selectField}
                  >
                    <option value="ACTIVE">Active (Live Tenant)</option>
                    <option value="INACTIVE">Inactive (Suspended / Closed)</option>
                  </select>
                  <span
                    className="material-symbols-outlined"
                    style={{
                      position: "absolute",
                      right: "1rem",
                      top: "50%",
                      transform: "translateY(-50%)",
                      pointerEvents: "none",
                      color: "var(--text-muted)",
                    }}
                  >
                    expand_more
                  </span>
                </div>
              </div>

              <div style={{ display: "flex", gap: "1rem", marginTop: "1rem" }}>
                <Button variant="secondary" style={{ flex: 1 }} onClick={() => setEditingOrg(null)}>
                  Cancel
                </Button>
                <Button
                  style={{ flex: 1 }}
                  onClick={handleUpdateOrg}
                  disabled={!editName.trim() || !editSlug.trim() || !editCode.trim() || isUpdating}
                >
                  {isUpdating ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function OrganizationManagementPage() {
  return (
    <RequireAuth allowedRoles={["SUPER_ADMIN"]}>
      <OrganizationManagementContent />
    </RequireAuth>
  );
}
