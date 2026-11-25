"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { useAuth } from "@/lib/auth/AuthContext";
import { PROGRAM_COHORT_ADMIN_ROLES, INSTRUCTOR_ROLES } from "@/lib/auth/roles";
import { usePrograms } from "@/lib/api/usePrograms";
import {
  getAllProgramDocuments,
  uploadProgramDocument,
  deleteProgramDocument,
  updateProgramDocument,
  deleteActivity,
  ResourceDocument,
} from "@/lib/api/endpoints";
import { DeleteConfirmationModal } from "@/components/ui/DeleteConfirmationModal";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Modal } from "@/components/ui/Modal";

type SortOption = "PROGRAM_ASC" | "PROGRAM_DESC" | "NEWEST" | "OLDEST" | "TITLE_ASC" | "TITLE_DESC";
type FormatFilter = "ALL" | "PDF" | "CODE" | "DATA" | "DOCS" | "ARCHIVE";

function getFormatInfo(url: string, title: string) {
  const combined = (url + " " + title).toLowerCase();
  if (combined.includes(".pdf")) {
    return { ext: "PDF", color: "#ef4444", bg: "#fef2f2", icon: "picture_as_pdf", group: "PDF" };
  }
  if (combined.includes(".ipynb") || combined.includes(".py") || combined.includes(".js") || combined.includes(".ts")) {
    return { ext: "CODE", color: "#f59e0b", bg: "#fffbeb", icon: "terminal", group: "CODE" };
  }
  if (combined.includes(".csv") || combined.includes(".xlsx") || combined.includes(".json") || combined.includes(".parquet")) {
    return { ext: "DATA", color: "#10b981", bg: "#ecfdf5", icon: "dataset", group: "DATA" };
  }
  if (combined.includes(".docx") || combined.includes(".doc") || combined.includes(".txt") || combined.includes(".md")) {
    return { ext: "DOCX", color: "#3b82f6", bg: "#eff6ff", icon: "description", group: "DOCS" };
  }
  if (combined.includes(".zip") || combined.includes(".tar") || combined.includes(".gz")) {
    return { ext: "ZIP", color: "#8b5cf6", bg: "#f5f3ff", icon: "folder_zip", group: "ARCHIVE" };
  }
  if (combined.includes(".pptx") || combined.includes(".ppt")) {
    return { ext: "SLIDES", color: "#ec4899", bg: "#fdf2f8", icon: "slideshow", group: "DOCS" };
  }
  return { ext: "FILE", color: "#64748b", bg: "#f8fafc", icon: "attachment", group: "DOCS" };
}

function formatDate(isoStr?: string | null) {
  if (!isoStr) return "Recent";
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return "Recent";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "Recent";
  }
}

export default function ResourcesPage() {
  const { token, user, organization } = useAuth();
  const { programs } = usePrograms(organization?.id);

  const [documents, setDocuments] = useState<ResourceDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Sorting state
  const [selectedProgram, setSelectedProgram] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<SortOption>("PROGRAM_ASC");
  const [formatFilter, setFormatFilter] = useState<FormatFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [groupByProgram, setGroupByProgram] = useState(false);

  // Toast notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Upload Modal State (Admin / Instructor)
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadProgramId, setUploadProgramId] = useState<string>("");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadUseQuiz, setUploadUseQuiz] = useState(true);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Delete Confirmation State
  const [deleteTarget, setDeleteTarget] = useState<ResourceDocument | null>(null);

  const isAdmin = user?.roles.some((r) => PROGRAM_COHORT_ADMIN_ROLES.includes(r));
  const isInstructor = user?.roles.some((r) => INSTRUCTOR_ROLES.includes(r));
  const isSuperAdmin = user?.roles.includes("SUPER_ADMIN");
  const canManage = Boolean(isAdmin || isInstructor || isSuperAdmin);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const orgId = organization?.id;

  const fetchDocuments = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError(null);
      const data = await getAllProgramDocuments(token, orgId);
      setDocuments(data);
    } catch (err: any) {
      setError(err?.message || "Failed to load program resources");
    } finally {
      setLoading(false);
    }
  }, [token, orgId]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Unique list of programs for dropdown filter
  const programOptions = useMemo(() => {
    const map = new Map<string, { id: number; name: string; code: string; count: number }>();
    for (const doc of documents) {
      const key = String(doc.program_id);
      if (!map.has(key)) {
        map.set(key, {
          id: doc.program_id,
          name: doc.program_name || `Program #${doc.program_id}`,
          code: doc.program_code || "",
          count: 0,
        });
      }
      map.get(key)!.count += 1;
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [documents]);

  // Filtered and Sorted documents
  const processedDocuments = useMemo(() => {
    let result = [...documents];

    // Filter by Program
    if (selectedProgram !== "ALL") {
      result = result.filter((d) => String(d.program_id) === selectedProgram);
    }

    // Filter by Format
    if (formatFilter !== "ALL") {
      result = result.filter((d) => {
        const info = getFormatInfo(d.file_url, d.title);
        return info.group === formatFilter;
      });
    }

    // Filter by Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          d.program_name.toLowerCase().includes(q) ||
          d.program_code.toLowerCase().includes(q)
      );
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case "PROGRAM_ASC":
          return a.program_name.localeCompare(b.program_name) || a.title.localeCompare(b.title);
        case "PROGRAM_DESC":
          return b.program_name.localeCompare(a.program_name) || a.title.localeCompare(b.title);
        case "NEWEST": {
          const tA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const tB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return tB - tA;
        }
        case "OLDEST": {
          const tA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const tB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return tA - tB;
        }
        case "TITLE_ASC":
          return a.title.localeCompare(b.title);
        case "TITLE_DESC":
          return b.title.localeCompare(a.title);
        default:
          return 0;
      }
    });

    return result;
  }, [documents, selectedProgram, formatFilter, searchQuery, sortBy]);

  // Grouped by Program (when grouped view is on)
  const groupedDocuments = useMemo(() => {
    const groups: { programId: number; programName: string; programCode: string; items: ResourceDocument[] }[] = [];
    const groupMap = new Map<number, { programId: number; programName: string; programCode: string; items: ResourceDocument[] }>();

    for (const doc of processedDocuments) {
      if (!groupMap.has(doc.program_id)) {
        const entry = {
          programId: doc.program_id,
          programName: doc.program_name || `Program #${doc.program_id}`,
          programCode: doc.program_code || "",
          items: [],
        };
        groupMap.set(doc.program_id, entry);
        groups.push(entry);
      }
      groupMap.get(doc.program_id)!.items.push(doc);
    }

    // Sort groups according to sortBy
    if (sortBy === "PROGRAM_DESC") {
      groups.sort((a, b) => b.programName.localeCompare(a.programName));
    } else {
      groups.sort((a, b) => a.programName.localeCompare(b.programName));
    }

    return groups;
  }, [processedDocuments, sortBy]);

  const handleDownload = (doc: ResourceDocument) => {
    showToast(`Opening "${doc.title}"...`);
    window.open(doc.file_url, "_blank", "noopener,noreferrer");
  };

  const handleOpenUploadModal = () => {
    if (programs && programs.length > 0) {
      setUploadProgramId(String(programs[0].id));
    } else if (programOptions.length > 0) {
      setUploadProgramId(String(programOptions[0].id));
    } else {
      setUploadProgramId("");
    }
    setUploadTitle("");
    setUploadFile(null);
    setUploadUseQuiz(true);
    setUploadError(null);
    setIsUploadOpen(true);
  };

  const handleExecuteUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!uploadProgramId) {
      setUploadError("Please select a target program.");
      return;
    }
    if (!uploadTitle.trim()) {
      setUploadError("Please enter a document title.");
      return;
    }
    if (!uploadFile) {
      setUploadError("Please select a file to upload.");
      return;
    }

    try {
      setIsSubmitting(true);
      setUploadError(null);
      await uploadProgramDocument(
        token,
        Number(uploadProgramId),
        uploadTitle.trim(),
        uploadFile,
        uploadUseQuiz
      );
      setIsUploadOpen(false);
      showToast(`Document "${uploadTitle.trim()}" uploaded successfully!`);
      await fetchDocuments();
    } catch (err: any) {
      setUploadError(err?.message || "Failed to upload document.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleQuiz = async (doc: ResourceDocument) => {
    if (!token || !doc.document_id || doc.source !== "PROGRAM_DOCUMENT") return;
    const nextVal = !doc.use_for_quiz;
    try {
      await updateProgramDocument(token, doc.document_id, { use_for_quiz: nextVal });
      setDocuments((prev) =>
        prev.map((d) => (d.id === doc.id ? { ...d, use_for_quiz: nextVal } : d))
      );
      showToast(nextVal ? "AI Quiz generation enabled for this document." : "AI Quiz generation disabled.");
    } catch {
      showToast("Failed to update AI Quiz settings.");
    }
  };

  const handleExecuteDelete = async () => {
    if (!token || !deleteTarget) return;
    try {
      if (deleteTarget.source === "PROGRAM_DOCUMENT" && deleteTarget.document_id) {
        await deleteProgramDocument(token, deleteTarget.document_id);
      } else if (deleteTarget.source === "CURRICULUM_ACTIVITY" && deleteTarget.activity_id) {
        await deleteActivity(token, deleteTarget.activity_id);
      }
      showToast(`Deleted "${deleteTarget.title}".`);
      setDocuments((prev) => prev.filter((d) => d.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err: any) {
      alert(`Error deleting document: ${err?.message || "Server error"}`);
    }
  };

  return (
    <RequireAuth>
      <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "1rem 0", animation: "fadeIn 0.3s ease-out" }}>
        {/* Toast Notification */}
        {toastMessage && (
          <div
            style={{
              position: "fixed",
              bottom: "2rem",
              right: "2rem",
              background: "#0f172a",
              color: "#ffffff",
              padding: "0.85rem 1.5rem",
              borderRadius: "12px",
              boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.3)",
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              zIndex: 3000,
              fontSize: "0.9rem",
              fontWeight: 600,
              border: "1px solid rgba(255, 255, 255, 0.1)",
              animation: "slideInUp 0.25s ease-out",
            }}
          >
            <span className="material-symbols-outlined" style={{ color: "#10b981", fontSize: "1.25rem" }}>
              check_circle
            </span>
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteTarget && (
          <DeleteConfirmationModal
            open={Boolean(deleteTarget)}
            onClose={() => setDeleteTarget(null)}
            onConfirm={handleExecuteDelete}
            itemName={deleteTarget.title}
            itemType="Document"
            itemDetails={`Program: ${deleteTarget.program_name} (${deleteTarget.source === "PROGRAM_DOCUMENT" ? "Program Document" : "Lesson Material"})`}
            warningText="This action will permanently remove this file from the program resource center and curriculum activities."
          />
        )}

        {/* Header & Management CTA */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: "1.5rem",
            marginBottom: "2rem",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
              <div
                style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "10px",
                  background: "linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#ffffff",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "1.5rem" }}>
                  folder_open
                </span>
              </div>
              <h1 style={{ fontSize: "2rem", fontWeight: 800, color: "var(--text-main)", letterSpacing: "-0.02em", margin: 0 }}>
                {canManage ? "Resource Center & Document Manager" : "Learning Resources & Materials"}
              </h1>
            </div>
            <p style={{ color: "var(--text-muted)", fontSize: "0.95rem", margin: 0, maxWidth: "750px" }}>
              {canManage
                ? "Upload, organize, and manage course documents, lecture presentations, and study materials across your programs."
                : "Browse, sort, and download study guides, lecture slides, code notebooks, and reference materials for your enrolled programs."}
            </p>
          </div>

          {canManage && (
            <button
              onClick={handleOpenUploadModal}
              className="btn-primary"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.75rem 1.4rem",
                borderRadius: "10px",
                fontWeight: 700,
                fontSize: "0.95rem",
                background: "linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)",
                boxShadow: "0 4px 14px rgba(79, 70, 229, 0.3)",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "1.2rem" }}>
                upload_file
              </span>
              Upload Document
            </button>
          )}
        </div>

        {/* Stats Summary Bar */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "1rem",
            marginBottom: "2rem",
          }}
        >
          <div
            style={{
              background: "var(--color-surface, #ffffff)",
              border: "1px solid var(--color-border, #e2e8f0)",
              borderRadius: "12px",
              padding: "1.2rem 1.4rem",
              display: "flex",
              alignItems: "center",
              gap: "1rem",
            }}
          >
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "10px",
                background: "#eff6ff",
                color: "#3b82f6",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span className="material-symbols-outlined">library_books</span>
            </div>
            <div>
              <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--text-main)" }}>
                {documents.length}
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>
                Total Resources
              </div>
            </div>
          </div>

          <div
            style={{
              background: "var(--color-surface, #ffffff)",
              border: "1px solid var(--color-border, #e2e8f0)",
              borderRadius: "12px",
              padding: "1.2rem 1.4rem",
              display: "flex",
              alignItems: "center",
              gap: "1rem",
            }}
          >
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "10px",
                background: "#f0fdf4",
                color: "#16a34a",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span className="material-symbols-outlined">school</span>
            </div>
            <div>
              <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--text-main)" }}>
                {programOptions.length}
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>
                Programs Covered
              </div>
            </div>
          </div>

          <div
            style={{
              background: "var(--color-surface, #ffffff)",
              border: "1px solid var(--color-border, #e2e8f0)",
              borderRadius: "12px",
              padding: "1.2rem 1.4rem",
              display: "flex",
              alignItems: "center",
              gap: "1rem",
            }}
          >
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "10px",
                background: "#faf5ff",
                color: "#9333ea",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span className="material-symbols-outlined">psychology</span>
            </div>
            <div>
              <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--text-main)" }}>
                {documents.filter((d) => d.use_for_quiz).length}
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>
                AI Quiz Ready
              </div>
            </div>
          </div>
        </div>

        {/* Filter, Sort & Search Toolbar */}
        <div
          style={{
            background: "var(--color-surface, #ffffff)",
            border: "1px solid var(--color-border, #e2e8f0)",
            borderRadius: "14px",
            padding: "1.25rem 1.5rem",
            marginBottom: "1.5rem",
            display: "flex",
            flexDirection: "column",
            gap: "1.2rem",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          {/* Top row: Search input & Sorting */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "1rem",
            }}
          >
            {/* Search Input */}
            <div style={{ position: "relative", flex: 1, minWidth: "260px" }}>
              <span
                className="material-symbols-outlined"
                style={{
                  position: "absolute",
                  left: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#94a3b8",
                  fontSize: "1.2rem",
                }}
              >
                search
              </span>
              <input
                type="text"
                placeholder="Search documents by title, program name, or code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.7rem 1rem 0.7rem 2.5rem",
                  borderRadius: "10px",
                  border: "1px solid var(--color-border, #cbd5e1)",
                  background: "var(--color-bg, #ffffff)",
                  color: "var(--foreground, #0f172a)",
                  fontSize: "0.9rem",
                  outline: "none",
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  style={{
                    position: "absolute",
                    right: "10px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    color: "#94a3b8",
                    cursor: "pointer",
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "1.1rem" }}>
                    close
                  </span>
                </button>
              )}
            </div>

            {/* Program Dropdown Filter (Key Feature for Students & Admins) */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <label style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                Program:
              </label>
              <select
                value={selectedProgram}
                onChange={(e) => setSelectedProgram(e.target.value)}
                style={{
                  padding: "0.65rem 1rem",
                  borderRadius: "10px",
                  border: "1px solid var(--color-border, #cbd5e1)",
                  background: "var(--color-surface, #ffffff)",
                  color: "var(--foreground, #0f172a)",
                  fontSize: "0.88rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  maxWidth: "260px",
                }}
              >
                <option value="ALL">All Programs ({documents.length})</option>
                {programOptions.map((prog) => (
                  <option key={prog.id} value={String(prog.id)}>
                    {prog.name} ({prog.count})
                  </option>
                ))}
              </select>
            </div>

            {/* Sort Order Dropdown */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <label style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                Sort:
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                style={{
                  padding: "0.65rem 1rem",
                  borderRadius: "10px",
                  border: "1px solid var(--color-border, #cbd5e1)",
                  background: "var(--color-surface, #ffffff)",
                  color: "var(--foreground, #0f172a)",
                  fontSize: "0.88rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <option value="PROGRAM_ASC">Program Name (A → Z)</option>
                <option value="PROGRAM_DESC">Program Name (Z → A)</option>
                <option value="NEWEST">Newest Uploads</option>
                <option value="OLDEST">Oldest Uploads</option>
                <option value="TITLE_ASC">Document Title (A → Z)</option>
                <option value="TITLE_DESC">Document Title (Z → A)</option>
              </select>
            </div>

            {/* Group by Program Toggle */}
            <button
              type="button"
              onClick={() => setGroupByProgram(!groupByProgram)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
                padding: "0.65rem 1rem",
                borderRadius: "10px",
                border: "1px solid var(--color-border, #cbd5e1)",
                background: groupByProgram ? "#4f46e5" : "transparent",
                color: groupByProgram ? "#ffffff" : "var(--foreground)",
                fontWeight: 600,
                fontSize: "0.88rem",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "1.1rem" }}>
                {groupByProgram ? "view_agenda" : "view_list"}
              </span>
              Group by Program
            </button>
          </div>

          {/* Bottom row: Format category pills */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", paddingTop: "0.5rem", borderTop: "1px solid var(--color-border, #f1f5f9)" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-muted)", marginRight: "0.25rem" }}>
              Format:
            </span>
            {[
              { id: "ALL", label: "All Files" },
              { id: "PDF", label: "PDF Documents" },
              { id: "CODE", label: "Code & Notebooks" },
              { id: "DATA", label: "Datasets & CSV" },
              { id: "DOCS", label: "Word & Docs" },
              { id: "ARCHIVE", label: "ZIP Archives" },
            ].map((f) => {
              const active = formatFilter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFormatFilter(f.id as FormatFilter)}
                  style={{
                    padding: "0.35rem 0.85rem",
                    borderRadius: "20px",
                    border: active ? "1px solid #4f46e5" : "1px solid var(--color-border, #e2e8f0)",
                    background: active ? "rgba(79, 70, 229, 0.1)" : "transparent",
                    color: active ? "#4f46e5" : "var(--text-muted)",
                    fontWeight: active ? 700 : 500,
                    fontSize: "0.8rem",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  {f.label}
                </button>
              );
            })}

            <span style={{ marginLeft: "auto", fontSize: "0.82rem", color: "var(--text-dim)", fontWeight: 600 }}>
              Showing {processedDocuments.length} of {documents.length} materials
            </span>
          </div>
        </div>

        {/* Content Section: Loading / Error / Empty / Document List */}
        {loading && <LoadingState message="Loading resource materials from programs..." />}

        {error && !loading && (
          <div style={{ marginBottom: "2rem" }}>
            <ErrorState message={error} onRetry={fetchDocuments} />
          </div>
        )}

        {!loading && !error && processedDocuments.length === 0 && (
          <div
            style={{
              background: "var(--color-surface, #ffffff)",
              border: "1px dashed var(--color-border, #cbd5e1)",
              borderRadius: "16px",
              padding: "4rem 2rem",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: "64px",
                height: "64px",
                borderRadius: "16px",
                background: "#f1f5f9",
                color: "#64748b",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "1rem",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "2rem" }}>
                folder_off
              </span>
            </div>
            <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-main)", marginBottom: "0.5rem" }}>
              No Resources Found
            </h3>
            <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", maxWidth: "500px", margin: "0 auto 1.5rem" }}>
              {searchQuery || selectedProgram !== "ALL" || formatFilter !== "ALL"
                ? "No documents match your active filters or search terms. Try resetting filters."
                : canManage
                ? "There are no files uploaded in your programs yet. Upload your first document to populate the resource center!"
                : "Your instructors haven't uploaded files for your enrolled programs yet. Check back soon!"}
            </p>
            {canManage && (
              <button
                onClick={handleOpenUploadModal}
                className="btn-primary"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.75rem 1.4rem",
                  borderRadius: "10px",
                  fontWeight: 700,
                  fontSize: "0.95rem",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "1.2rem" }}>
                  upload_file
                </span>
                Upload Document Now
              </button>
            )}
          </div>
        )}

        {/* Grouped by Program Mode */}
        {!loading && !error && groupByProgram && groupedDocuments.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "2.5rem" }}>
            {groupedDocuments.map((group) => (
              <section
                key={group.programId}
                style={{
                  background: "var(--color-surface, #ffffff)",
                  borderRadius: "16px",
                  border: "1px solid var(--color-border, #e2e8f0)",
                  padding: "1.5rem",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
                }}
              >
                {/* Program Header */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "1rem",
                    paddingBottom: "1.2rem",
                    borderBottom: "1px solid var(--color-border, #f1f5f9)",
                    marginBottom: "1.25rem",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <div
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "8px",
                        background: "rgba(79, 70, 229, 0.1)",
                        color: "#4f46e5",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "1.25rem" }}>
                        school
                      </span>
                    </div>
                    <div>
                      <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--text-main)", margin: 0 }}>
                        {group.programName}
                      </h2>
                      {group.programCode && (
                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>
                          Code: {group.programCode}
                        </span>
                      )}
                    </div>
                  </div>

                  <span
                    style={{
                      background: "#f1f5f9",
                      color: "#475569",
                      padding: "0.3rem 0.8rem",
                      borderRadius: "20px",
                      fontSize: "0.8rem",
                      fontWeight: 700,
                    }}
                  >
                    {group.items.length} {group.items.length === 1 ? "document" : "documents"}
                  </span>
                </div>

                {/* Document Items in Group */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {group.items.map((doc) => (
                    <DocumentItemCard
                      key={doc.id}
                      doc={doc}
                      canManage={canManage}
                      onDownload={handleDownload}
                      onToggleQuiz={handleToggleQuiz}
                      onDelete={(d) => setDeleteTarget(d)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {/* Flat List Mode (Default sorted view) */}
        {!loading && !error && !groupByProgram && processedDocuments.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
            {processedDocuments.map((doc) => (
              <DocumentItemCard
                key={doc.id}
                doc={doc}
                canManage={canManage}
                onDownload={handleDownload}
                onToggleQuiz={handleToggleQuiz}
                onDelete={(d) => setDeleteTarget(d)}
              />
            ))}
          </div>
        )}

        {/* Upload Modal (for Admin & Instructor) */}
        <Modal open={isUploadOpen} onClose={() => !isSubmitting && setIsUploadOpen(false)} title="Upload Program Document">
          <form onSubmit={handleExecuteUpload} style={{ display: "flex", flexDirection: "column", gap: "1.25rem", marginTop: "1rem" }}>
            {uploadError && (
              <div
                style={{
                  background: "#fef2f2",
                  color: "#b91c1c",
                  padding: "0.75rem 1rem",
                  borderRadius: "8px",
                  fontSize: "0.85rem",
                  border: "1px solid #fecaca",
                }}
              >
                {uploadError}
              </div>
            )}

            {/* Target Program Selection */}
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, color: "var(--text-main)", marginBottom: "0.4rem" }}>
                Target Program *
              </label>
              <select
                value={uploadProgramId}
                onChange={(e) => setUploadProgramId(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  borderRadius: "8px",
                  border: "1px solid var(--color-border, #cbd5e1)",
                  background: "var(--color-surface, #ffffff)",
                  color: "var(--foreground, #0f172a)",
                  fontSize: "0.9rem",
                  outline: "none",
                }}
              >
                <option value="" disabled>
                  Select program to attach document to...
                </option>
                {(programs || []).map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {p.name} ({p.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Document Title */}
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, color: "var(--text-main)", marginBottom: "0.4rem" }}>
                Document Title *
              </label>
              <input
                type="text"
                placeholder="e.g. Deep Learning Architecture Cheatsheet, Lecture 3 Slides"
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  borderRadius: "8px",
                  border: "1px solid var(--color-border, #cbd5e1)",
                  background: "var(--color-surface, #ffffff)",
                  color: "var(--foreground, #0f172a)",
                  fontSize: "0.9rem",
                  outline: "none",
                }}
              />
            </div>

            {/* File Input */}
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, color: "var(--text-main)", marginBottom: "0.4rem" }}>
                File (PDF, DOCX, IPYNB, ZIP, CSV, PPTX) *
              </label>
              <div
                style={{
                  border: "2px dashed var(--color-border, #cbd5e1)",
                  borderRadius: "10px",
                  padding: "1.5rem",
                  textAlign: "center",
                  background: uploadFile ? "#f0fdf4" : "var(--color-bg, #f8fafc)",
                  cursor: "pointer",
                }}
                onClick={() => document.getElementById("program-file-picker")?.click()}
              >
                <input
                  id="program-file-picker"
                  type="file"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setUploadFile(e.target.files[0]);
                      if (!uploadTitle.trim()) {
                        setUploadTitle(e.target.files[0].name.replace(/\.[^/.]+$/, ""));
                      }
                    }
                  }}
                  accept=".pdf,.docx,.doc,.ipynb,.py,.zip,.csv,.xlsx,.pptx,.ppt,.txt"
                />
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: "2rem", color: uploadFile ? "#16a34a" : "#64748b", marginBottom: "0.4rem" }}
                >
                  {uploadFile ? "check_circle" : "cloud_upload"}
                </span>
                <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--text-main)" }}>
                  {uploadFile ? uploadFile.name : "Click to select or drag and drop a file"}
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                  {uploadFile ? `${(uploadFile.size / (1024 * 1024)).toFixed(2)} MB` : "PDF, Word, Jupyter Notebook, CSV, or ZIP up to 50MB"}
                </div>
              </div>
            </div>

            {/* AI Quiz Toggle Option */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                padding: "0.85rem 1rem",
                background: "#f8fafc",
                borderRadius: "10px",
                border: "1px solid #e2e8f0",
              }}
            >
              <input
                id="toggle-use-quiz"
                type="checkbox"
                checked={uploadUseQuiz}
                onChange={(e) => setUploadUseQuiz(e.target.checked)}
                style={{ width: "18px", height: "18px", accentColor: "#4f46e5", cursor: "pointer" }}
              />
              <label htmlFor="toggle-use-quiz" style={{ cursor: "pointer", fontSize: "0.88rem", color: "var(--text-main)", fontWeight: 600 }}>
                Use this document for automated AI Quiz generation
                <span style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 400 }}>
                  Enables the automated weekly quiz engine to generate assessment questions from this syllabus text.
                </span>
              </label>
            </div>

            {/* Action Buttons */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1rem" }}>
              <button
                type="button"
                onClick={() => setIsUploadOpen(false)}
                disabled={isSubmitting}
                style={{
                  padding: "0.75rem 1.25rem",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  color: "#475569",
                  fontWeight: 600,
                  fontSize: "0.9rem",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !uploadFile}
                className="btn-primary"
                style={{
                  padding: "0.75rem 1.5rem",
                  borderRadius: "8px",
                  fontWeight: 700,
                  fontSize: "0.9rem",
                  background: "linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  cursor: isSubmitting || !uploadFile ? "not-allowed" : "pointer",
                }}
              >
                {isSubmitting ? (
                  <>
                    <span className="material-symbols-outlined" style={{ animation: "spin 1s linear infinite", fontSize: "1.1rem" }}>
                      progress_activity
                    </span>
                    Uploading to S3...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined" style={{ fontSize: "1.1rem" }}>
                      upload
                    </span>
                    Upload File
                  </>
                )}
              </button>
            </div>
          </form>
        </Modal>
      </div>
    </RequireAuth>
  );
}

// Sub-component for individual Document Card item
interface DocumentItemCardProps {
  doc: ResourceDocument;
  canManage: boolean;
  onDownload: (doc: ResourceDocument) => void;
  onToggleQuiz: (doc: ResourceDocument) => void;
  onDelete: (doc: ResourceDocument) => void;
}

function DocumentItemCard({ doc, canManage, onDownload, onToggleQuiz, onDelete }: DocumentItemCardProps) {
  const formatInfo = getFormatInfo(doc.file_url, doc.title);

  return (
    <div
      className="card-hover"
      style={{
        background: "var(--color-surface, #ffffff)",
        borderRadius: "14px",
        border: "1px solid var(--color-border, #e2e8f0)",
        padding: "1.25rem 1.5rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "1.25rem",
        boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
        transition: "all 0.2s ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "1.25rem", flex: 1, minWidth: 0 }}>
        {/* Format Badge */}
        <div
          style={{
            width: "46px",
            height: "46px",
            borderRadius: "10px",
            background: formatInfo.bg,
            color: formatInfo.color,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            border: `1px solid ${formatInfo.color}30`,
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: "1.3rem" }}>
            {formatInfo.icon}
          </span>
          <span style={{ fontSize: "0.65rem", fontWeight: 800, marginTop: "-2px" }}>{formatInfo.ext}</span>
        </div>

        {/* Document Details */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap", marginBottom: "0.3rem" }}>
            {/* Program Name Tag */}
            <span
              style={{
                background: "rgba(79, 70, 229, 0.08)",
                color: "#4f46e5",
                padding: "0.2rem 0.65rem",
                borderRadius: "6px",
                fontSize: "0.78rem",
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                gap: "0.3rem",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "0.9rem" }}>
                school
              </span>
              {doc.program_name}
            </span>

            {/* Source Tag */}
            <span
              style={{
                background: doc.source === "PROGRAM_DOCUMENT" ? "#f1f5f9" : "#fef3c7",
                color: doc.source === "PROGRAM_DOCUMENT" ? "#475569" : "#92400e",
                padding: "0.15rem 0.55rem",
                borderRadius: "6px",
                fontSize: "0.72rem",
                fontWeight: 600,
              }}
            >
              {doc.source === "PROGRAM_DOCUMENT" ? "Program File" : "Curriculum Lesson"}
            </span>

            {/* AI Quiz Status Badge */}
            {doc.source === "PROGRAM_DOCUMENT" && doc.use_for_quiz && (
              <span
                style={{
                  background: "#ecfdf5",
                  color: "#059669",
                  padding: "0.15rem 0.55rem",
                  borderRadius: "6px",
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.25rem",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "0.85rem" }}>
                  psychology
                </span>
                AI Quiz Ready
              </span>
            )}
          </div>

          <h3
            style={{
              fontSize: "1.05rem",
              fontWeight: 700,
              color: "var(--text-main)",
              margin: "0 0 0.3rem 0",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {doc.title}
          </h3>

          <div style={{ display: "flex", gap: "1rem", fontSize: "0.78rem", color: "var(--text-dim)", flexWrap: "wrap" }}>
            <span>Uploaded: {formatDate(doc.created_at)}</span>
            {doc.program_code && <span>Code: {doc.program_code}</span>}
          </div>
        </div>
      </div>

      {/* Action Buttons: Download & Management */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexShrink: 0 }}>
        {/* If Admin / Instructor: AI Quiz toggle */}
        {canManage && doc.source === "PROGRAM_DOCUMENT" && (
          <button
            type="button"
            onClick={() => onToggleQuiz(doc)}
            title={doc.use_for_quiz ? "Click to disable AI Quiz generation" : "Click to enable AI Quiz generation"}
            style={{
              background: "none",
              border: "1px solid var(--color-border, #cbd5e1)",
              borderRadius: "8px",
              padding: "0.5rem 0.75rem",
              fontSize: "0.78rem",
              fontWeight: 600,
              color: doc.use_for_quiz ? "#059669" : "#64748b",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.3rem",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "1rem" }}>
              {doc.use_for_quiz ? "check_box" : "check_box_outline_blank"}
            </span>
            Quiz
          </button>
        )}

        {/* If Admin / Instructor: Delete button */}
        {canManage && (
          <button
            type="button"
            onClick={() => onDelete(doc)}
            title="Delete this document"
            style={{
              background: "none",
              border: "1px solid #fee2e2",
              borderRadius: "8px",
              padding: "0.5rem",
              color: "#dc2626",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "1.1rem" }}>
              delete
            </span>
          </button>
        )}

        {/* Download / View Button (available to everyone including students) */}
        <button
          type="button"
          onClick={() => onDownload(doc)}
          className="btn-secondary"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
            padding: "0.55rem 1rem",
            borderRadius: "8px",
            fontSize: "0.85rem",
            fontWeight: 700,
            whiteSpace: "nowrap",
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: "1.1rem" }}>
            download
          </span>
          Download
        </button>
      </div>
    </div>
  );
}
