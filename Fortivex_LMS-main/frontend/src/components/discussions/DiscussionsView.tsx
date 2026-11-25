"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  listDiscussions,
  getDiscussion,
  createDiscussion,
  addDiscussionReply,
  toggleDiscussionUpvote,
  toggleReplyVerified,
  deleteDiscussion,
  deleteDiscussionReply,
  listPrograms,
} from "@/lib/api/endpoints";
import type { DiscussionThreadItem, Program } from "@/lib/api/types";
import { DeleteConfirmationModal } from "@/components/ui/DeleteConfirmationModal";

const SUGGESTED_TAGS = [
  "General",
  "Curriculum",
  "Assignment",
  "Technical Issue",
  "Exam & Quiz",
  "Project",
  "Career & Advice",
];

export function DiscussionsView() {
  const { user, token, organization } = useAuth();

  // Thread listing and programs
  const [threads, setThreads] = useState<DiscussionThreadItem[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "solved" | "open">("all");
  const [selectedTag, setSelectedTag] = useState<string>("All");
  const [selectedProgram, setSelectedProgram] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"newest" | "votes" | "replies" | "oldest">("newest");

  // Thread Detail Modal
  const [activeThread, setActiveThread] = useState<DiscussionThreadItem | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);

  // New Thread Modal
  const [showNewModal, setShowNewModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newProgramId, setNewProgramId] = useState<string>("");
  const [tagInput, setTagInput] = useState("");
  const [tagsList, setTagsList] = useState<string[]>(["General"]);
  const [isPublishing, setIsPublishing] = useState(false);

  // Delete Thread State
  const [threadToDelete, setThreadToDelete] = useState<DiscussionThreadItem | null>(null);

  const orgId = organization?.id;

  const fetchThreads = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await listDiscussions(token, {
        organization_id: orgId,
      });
      setThreads(data);
    } catch (err: any) {
      console.error("Failed to load discussions:", err);
      setError(err.message || "Failed to load discussions.");
    } finally {
      setIsLoading(false);
    }
  }, [token, orgId]);

  const fetchProgramsList = useCallback(async () => {
    if (!token) return;
    try {
      const progs = await listPrograms(token, orgId);
      setPrograms(progs);
    } catch (err) {
      console.error("Failed to load programs for discussion filter:", err);
    }
  }, [token, orgId]);

  useEffect(() => {
    fetchThreads();
    fetchProgramsList();
  }, [fetchThreads, fetchProgramsList]);

  const isStaff = useMemo(() => {
    return user?.roles?.some((r) =>
      [
        "SUPER_ADMIN",
        "ACADEMIC_ADMIN",
        "INSTRUCTOR",
        "LEAD_TRAINER",
        "TRAINER",
        "MENTOR",
        "TEACHING_ASSISTANT",
      ].includes(r)
    );
  }, [user?.roles]);

  // Dynamic tags extracted from existing threads
  const dynamicTags = useMemo(() => {
    const set = new Set<string>();
    threads.forEach((t) => {
      (t.tags || []).forEach((tg) => {
        if (tg && tg.trim()) set.add(tg.trim());
      });
    });
    return Array.from(set);
  }, [threads]);

  // Filtered & Sorted Threads
  const filteredThreads = useMemo(() => {
    let result = [...threads];

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.content.toLowerCase().includes(q) ||
          t.author_name.toLowerCase().includes(q) ||
          t.tags?.some((tg) => tg.toLowerCase().includes(q))
      );
    }

    // Status filter
    if (statusFilter === "solved") {
      result = result.filter((t) => t.has_verified_answer);
    } else if (statusFilter === "open") {
      result = result.filter((t) => !t.has_verified_answer);
    }

    // Program filter
    if (selectedProgram !== "all") {
      const pid = parseInt(selectedProgram, 10);
      result = result.filter((t) => t.program_id === pid);
    }

    // Tag filter
    if (selectedTag !== "All") {
      result = result.filter((t) =>
        t.tags?.some((tg) => tg.toLowerCase() === selectedTag.toLowerCase())
      );
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === "votes") return b.upvotes - a.upvotes;
      if (sortBy === "replies") return b.replies_count - a.replies_count;
      if (sortBy === "oldest")
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      // default newest
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return result;
  }, [threads, searchQuery, statusFilter, selectedProgram, selectedTag, sortBy]);

  // Tag helper in modal
  function handleAddTag(tag: string) {
    const trimmed = tag.trim().replace(/^#+/, "");
    if (!trimmed) return;
    if (!tagsList.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
      setTagsList([...tagsList, trimmed]);
    }
    setTagInput("");
  }

  function handleRemoveTag(tagToRemove: string) {
    setTagsList(tagsList.filter((t) => t.toLowerCase() !== tagToRemove.toLowerCase()));
  }

  // Open thread detail modal
  async function handleOpenThread(thread: DiscussionThreadItem) {
    setActiveThread(thread);
    if (!token) return;
    setIsDetailLoading(true);
    try {
      const full = await getDiscussion(token, thread.id);
      setActiveThread(full);
    } catch (err) {
      console.error("Failed to load thread details:", err);
    } finally {
      setIsDetailLoading(false);
    }
  }

  // Toggle upvote
  async function handleUpvote(id: number, e: React.MouseEvent) {
    e.stopPropagation();
    if (!token) return;
    try {
      const res = await toggleDiscussionUpvote(token, id);
      setThreads((list) =>
        list.map((t) =>
          t.id === id ? { ...t, upvotes: res.upvotes, is_upvoted: res.is_upvoted } : t
        )
      );
      if (activeThread && activeThread.id === id) {
        setActiveThread((prev) =>
          prev ? { ...prev, upvotes: res.upvotes, is_upvoted: res.is_upvoted } : null
        );
      }
    } catch (err: any) {
      console.error("Failed to upvote:", err);
    }
  }

  // Create thread
  async function handleCreateThread() {
    if (!token || !newTitle.trim() || !newContent.trim()) return;
    setIsPublishing(true);
    try {
      const created = await createDiscussion(token, {
        title: newTitle.trim(),
        content: newContent.trim(),
        program_id: newProgramId ? parseInt(newProgramId, 10) : null,
        organization_id: orgId || null,
        tags: tagsList.length > 0 ? tagsList : ["General"],
      });
      setThreads((prev) => [created, ...prev]);
      setShowNewModal(false);
      setNewTitle("");
      setNewContent("");
      setNewProgramId("");
      setTagsList(["General"]);
      setTagInput("");
    } catch (err: any) {
      alert(err.message || "Failed to post question");
    } finally {
      setIsPublishing(false);
    }
  }

  // Add reply
  async function handleAddReply() {
    if (!token || !activeThread || !replyText.trim()) return;
    setIsSubmittingReply(true);
    try {
      const newReply = await addDiscussionReply(token, activeThread.id, replyText.trim());
      const updatedReplies = [...(activeThread.replies || []), newReply];
      const updatedThread: DiscussionThreadItem = {
        ...activeThread,
        replies: updatedReplies,
        replies_count: updatedReplies.length,
      };

      setActiveThread(updatedThread);
      setThreads((list) => list.map((t) => (t.id === activeThread.id ? updatedThread : t)));
      setReplyText("");
    } catch (err: any) {
      alert(err.message || "Failed to post reply");
    } finally {
      setIsSubmittingReply(false);
    }
  }

  // Toggle verify solution
  async function handleToggleVerify(replyId: number) {
    if (!token || !activeThread) return;
    try {
      const updatedReply = await toggleReplyVerified(token, replyId);
      const updatedReplies = (activeThread.replies || []).map((r) =>
        r.id === replyId ? updatedReply : r
      );
      const hasVerified = updatedReplies.some((r) => r.is_verified);
      const updatedThread: DiscussionThreadItem = {
        ...activeThread,
        has_verified_answer: hasVerified,
        replies: updatedReplies,
      };
      setActiveThread(updatedThread);
      setThreads((list) => list.map((t) => (t.id === activeThread.id ? updatedThread : t)));
    } catch (err: any) {
      console.error("Failed to verify reply:", err);
    }
  }

  // Delete reply
  async function handleDeleteReply(replyId: number) {
    if (!token || !activeThread) return;
    if (!window.confirm("Are you sure you want to delete this reply?")) return;
    try {
      await deleteDiscussionReply(token, replyId);
      const updatedReplies = (activeThread.replies || []).filter((r) => r.id !== replyId);
      const hasVerified = updatedReplies.some((r) => r.is_verified);
      const updatedThread: DiscussionThreadItem = {
        ...activeThread,
        has_verified_answer: hasVerified,
        replies: updatedReplies,
        replies_count: updatedReplies.length,
      };
      setActiveThread(updatedThread);
      setThreads((list) => list.map((t) => (t.id === activeThread.id ? updatedThread : t)));
    } catch (err: any) {
      alert(err.message || "Failed to delete reply");
    }
  }

  // Delete thread
  async function confirmDeleteThread() {
    if (!token || !threadToDelete) return;
    try {
      await deleteDiscussion(token, threadToDelete.id);
      setThreads((list) => list.filter((t) => t.id !== threadToDelete.id));
      if (activeThread?.id === threadToDelete.id) {
        setActiveThread(null);
      }
      setThreadToDelete(null);
    } catch (err: any) {
      alert(err.message || "Failed to delete discussion thread");
    }
  }

  return (
    <RequireAuth>
      <div style={{ maxWidth: "1240px", margin: "0 auto", animation: "fadeIn 0.35s ease-out" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: "2rem",
            flexWrap: "wrap",
            gap: "1.25rem",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <span
                className="material-symbols-outlined"
                style={{ fontSize: "2.2rem", color: "var(--primary)" }}
              >
                forum
              </span>
              <h1
                style={{
                  fontSize: "2rem",
                  fontWeight: 800,
                  color: "var(--text-main)",
                  letterSpacing: "-0.02em",
                }}
              >
                Community & Technical Discussions
              </h1>
            </div>
            <p style={{ color: "var(--text-muted)", fontSize: "0.95rem", marginTop: "0.35rem" }}>
              Ask questions, discuss curriculum topics, collaborate with peers, and get verified solutions from instructors.
            </p>
          </div>

          <button
            onClick={() => setShowNewModal(true)}
            className="btn-primary"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.65rem 1.25rem",
              fontSize: "0.95rem",
              fontWeight: 700,
              boxShadow: "0 4px 14px rgba(79, 70, 229, 0.25)",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "1.25rem" }}>
              add
            </span>
            Ask a Question
          </button>
        </div>

        {/* Search & Top Controls */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "0.75rem",
            marginBottom: "1rem",
            background: "var(--color-surface)",
            padding: "1rem 1.25rem",
            borderRadius: "14px",
            border: "1px solid var(--color-border)",
            alignItems: "center",
          }}
        >
          {/* Search Box */}
          <div style={{ position: "relative", gridColumn: "span 2" }}>
            <span
              className="material-symbols-outlined"
              style={{
                position: "absolute",
                left: "0.75rem",
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text-muted)",
                fontSize: "1.25rem",
              }}
            >
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, topic, author, or keyword..."
              style={{
                width: "100%",
                padding: "0.6rem 0.75rem 0.6rem 2.5rem",
                borderRadius: "8px",
                border: "1px solid var(--color-border)",
                background: "var(--background)",
                color: "var(--foreground)",
                fontSize: "0.9rem",
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                style={{
                  position: "absolute",
                  right: "0.75rem",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-muted)",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "1.1rem" }}>
                  close
                </span>
              </button>
            )}
          </div>

          {/* Program Filter */}
          <div>
            <select
              value={selectedProgram}
              onChange={(e) => setSelectedProgram(e.target.value)}
              style={{
                width: "100%",
                padding: "0.6rem 0.75rem",
                borderRadius: "8px",
                border: "1px solid var(--color-border)",
                background: "var(--background)",
                color: "var(--foreground)",
                fontSize: "0.9rem",
                cursor: "pointer",
              }}
            >
              <option value="all">All Programs</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Sort Selector */}
          <div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              style={{
                width: "100%",
                padding: "0.6rem 0.75rem",
                borderRadius: "8px",
                border: "1px solid var(--color-border)",
                background: "var(--background)",
                color: "var(--foreground)",
                fontSize: "0.9rem",
                cursor: "pointer",
              }}
            >
              <option value="newest">Sort: Newest First</option>
              <option value="votes">Sort: Most Upvoted</option>
              <option value="replies">Sort: Most Active</option>
              <option value="oldest">Sort: Oldest</option>
            </select>
          </div>
        </div>

        {/* Versatile Filter Pills (Status & Dynamic Tags) */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "0.75rem",
            marginBottom: "1.75rem",
          }}
        >
          {/* Status Tabs */}
          <div style={{ display: "flex", gap: "0.4rem" }}>
            <button
              onClick={() => setStatusFilter("all")}
              className={`tab-button ${statusFilter === "all" ? "active" : ""}`}
              style={{ padding: "0.4rem 0.9rem", fontSize: "0.85rem" }}
            >
              All Questions ({threads.length})
            </button>
            <button
              onClick={() => setStatusFilter("solved")}
              className={`tab-button ${statusFilter === "solved" ? "active" : ""}`}
              style={{ padding: "0.4rem 0.9rem", fontSize: "0.85rem" }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "1rem" }}>
                verified
              </span>
              Solved ({threads.filter((t) => t.has_verified_answer).length})
            </button>
            <button
              onClick={() => setStatusFilter("open")}
              className={`tab-button ${statusFilter === "open" ? "active" : ""}`}
              style={{ padding: "0.4rem 0.9rem", fontSize: "0.85rem" }}
            >
              Open / Unsolved ({threads.filter((t) => !t.has_verified_answer).length})
            </button>
          </div>

          {/* Dynamic Topic Tag Chips */}
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>
              Filter by topic:
            </span>
            <button
              onClick={() => setSelectedTag("All")}
              style={{
                fontSize: "0.78rem",
                padding: "3px 10px",
                borderRadius: "16px",
                background: selectedTag === "All" ? "var(--primary)" : "rgba(0,0,0,0.05)",
                color: selectedTag === "All" ? "white" : "var(--text-muted)",
                border: "none",
                cursor: "pointer",
                fontWeight: 600,
                transition: "all 0.15s ease",
              }}
            >
              All Topics
            </button>
            {dynamicTags.map((tg) => (
              <button
                key={tg}
                onClick={() => setSelectedTag(selectedTag === tg ? "All" : tg)}
                style={{
                  fontSize: "0.78rem",
                  padding: "3px 10px",
                  borderRadius: "16px",
                  background:
                    selectedTag.toLowerCase() === tg.toLowerCase()
                      ? "var(--primary)"
                      : "rgba(0,0,0,0.05)",
                  color:
                    selectedTag.toLowerCase() === tg.toLowerCase()
                      ? "white"
                      : "var(--text-muted)",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 600,
                  transition: "all 0.15s ease",
                }}
              >
                #{tg}
              </button>
            ))}
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div
            style={{
              padding: "1rem 1.25rem",
              borderRadius: "10px",
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.3)",
              color: "var(--danger)",
              marginBottom: "1.5rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span className="material-symbols-outlined">error</span>
              <span>{error}</span>
            </div>
            <button
              onClick={fetchThreads}
              className="btn-secondary"
              style={{ padding: "0.3rem 0.8rem", fontSize: "0.8rem" }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div style={{ textAlign: "center", padding: "5rem 2rem" }}>
            <span
              className="material-symbols-outlined"
              style={{
                fontSize: "2.8rem",
                animation: "spin 1s linear infinite",
                color: "var(--primary)",
              }}
            >
              progress_activity
            </span>
            <p style={{ color: "var(--text-muted)", marginTop: "0.75rem", fontSize: "0.95rem" }}>
              Loading discussions...
            </p>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && filteredThreads.length === 0 && (
          <div
            style={{
              textAlign: "center",
              padding: "4.5rem 2rem",
              background: "var(--color-surface)",
              borderRadius: "16px",
              border: "1px solid var(--color-border)",
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{
                fontSize: "3.8rem",
                color: "var(--text-muted)",
                marginBottom: "0.75rem",
                opacity: 0.6,
              }}
            >
              forum
            </span>
            <h3 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.35rem" }}>
              {searchQuery || selectedTag !== "All" || selectedProgram !== "all" || statusFilter !== "all"
                ? "No matching discussions found"
                : "No discussions yet"}
            </h3>
            <p
              style={{
                color: "var(--text-muted)",
                fontSize: "0.95rem",
                marginBottom: "1.5rem",
                maxWidth: "460px",
                margin: "0 auto 1.5rem auto",
              }}
            >
              {searchQuery || selectedTag !== "All" || selectedProgram !== "all" || statusFilter !== "all"
                ? "Try adjusting your search terms or clearing the selected filters to see all topics."
                : "Be the first to start a conversation, share insights, or ask questions to instructors and peers!"}
            </p>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
              {(searchQuery || selectedTag !== "All" || selectedProgram !== "all" || statusFilter !== "all") && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedTag("All");
                    setSelectedProgram("all");
                    setStatusFilter("all");
                  }}
                  className="btn-secondary"
                >
                  Clear Filters
                </button>
              )}
              <button
                onClick={() => setShowNewModal(true)}
                className="btn-primary"
                style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}
              >
                <span className="material-symbols-outlined">add</span>
                Ask a Question
              </button>
            </div>
          </div>
        )}

        {/* Threads List */}
        {!isLoading && filteredThreads.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {filteredThreads.map((thread) => {
              const canDelete = thread.author_id === user?.id || isStaff;

              return (
                <div
                  key={thread.id}
                  onClick={() => handleOpenThread(thread)}
                  className="card-hover"
                  style={{
                    background: "var(--color-surface)",
                    borderRadius: "14px",
                    border: "1px solid var(--color-border)",
                    padding: "1.4rem 1.5rem",
                    display: "flex",
                    gap: "1.25rem",
                    alignItems: "flex-start",
                    boxShadow: "var(--shadow-sm)",
                    cursor: "pointer",
                    transition: "border-color 0.15s ease, transform 0.15s ease",
                  }}
                >
                  {/* Upvote Button */}
                  <button
                    onClick={(e) => handleUpvote(thread.id, e)}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "48px",
                      padding: "0.5rem 0.25rem",
                      background: thread.is_upvoted
                        ? "rgba(79, 70, 229, 0.12)"
                        : "rgba(0,0,0,0.03)",
                      border: thread.is_upvoted
                        ? "1px solid var(--primary)"
                        : "1px solid var(--color-border)",
                      borderRadius: "10px",
                      cursor: "pointer",
                      color: thread.is_upvoted ? "var(--primary)" : "var(--text-muted)",
                      flexShrink: 0,
                      transition: "all 0.15s ease",
                    }}
                    title={thread.is_upvoted ? "Remove upvote" : "Upvote question"}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "1.2rem" }}>
                      keyboard_arrow_up
                    </span>
                    <span style={{ fontSize: "0.85rem", fontWeight: 800 }}>{thread.upvotes}</span>
                  </button>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Badges Bar */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        marginBottom: "0.45rem",
                        flexWrap: "wrap",
                      }}
                    >
                      <span
                        className="badge-pill badge-primary"
                        style={{ fontSize: "0.72rem", padding: "2px 8px" }}
                      >
                        {thread.program_name || "General Discussion"}
                      </span>

                      {thread.has_verified_answer && (
                        <span
                          className="badge-pill badge-success"
                          style={{
                            fontSize: "0.72rem",
                            padding: "2px 8px",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.2rem",
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: "0.85rem" }}>
                            verified
                          </span>
                          Instructor Solved
                        </span>
                      )}

                      {thread.tags?.map((tg, i) => (
                        <span
                          key={i}
                          style={{
                            fontSize: "0.72rem",
                            padding: "2px 8px",
                            background: "rgba(0,0,0,0.05)",
                            color: "var(--text-muted)",
                            borderRadius: "6px",
                            fontWeight: 600,
                          }}
                        >
                          #{tg}
                        </span>
                      ))}
                    </div>

                    {/* Question Title */}
                    <h3
                      style={{
                        fontSize: "1.15rem",
                        fontWeight: 700,
                        color: "var(--text-main)",
                        marginBottom: "0.4rem",
                        lineHeight: 1.4,
                      }}
                    >
                      {thread.title}
                    </h3>

                    {/* Content Excerpt */}
                    <p
                      style={{
                        fontSize: "0.88rem",
                        color: "var(--text-muted)",
                        lineHeight: 1.55,
                        marginBottom: "0.85rem",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {thread.content}
                    </p>

                    {/* Author & Stats Footer */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "1.25rem",
                        fontSize: "0.8rem",
                        color: "var(--text-dim)",
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                        <span className="material-symbols-outlined" style={{ fontSize: "1rem" }}>
                          person
                        </span>
                        <strong>{thread.author_name}</strong>
                        <span
                          style={{
                            fontSize: "0.7rem",
                            padding: "1px 6px",
                            borderRadius: "4px",
                            background:
                              thread.author_role === "Admin"
                                ? "rgba(239, 68, 68, 0.15)"
                                : thread.author_role === "Instructor"
                                ? "rgba(59, 130, 246, 0.15)"
                                : "rgba(0,0,0,0.06)",
                            color:
                              thread.author_role === "Admin"
                                ? "var(--danger)"
                                : thread.author_role === "Instructor"
                                ? "var(--primary)"
                                : "var(--text-muted)",
                            fontWeight: 700,
                          }}
                        >
                          {thread.author_role}
                        </span>
                      </div>

                      <div>• {thread.time_ago}</div>

                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.3rem",
                          color: "var(--primary)",
                          fontWeight: 700,
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: "1rem" }}>
                          chat_bubble
                        </span>
                        {thread.replies_count} {thread.replies_count === 1 ? "reply" : "replies"}
                      </div>

                      {canDelete && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setThreadToDelete(thread);
                          }}
                          style={{
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            color: "var(--danger)",
                            display: "flex",
                            alignItems: "center",
                            gap: "0.2rem",
                            fontSize: "0.78rem",
                            marginLeft: "auto",
                          }}
                          title="Delete thread"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: "0.95rem" }}>
                            delete
                          </span>
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Thread Detail Modal */}
        {activeThread && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(15, 23, 42, 0.65)",
              backdropFilter: "blur(4px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
              padding: "1rem",
            }}
          >
            <div
              style={{
                background: "var(--color-surface)",
                borderRadius: "16px",
                maxWidth: "760px",
                width: "100%",
                maxHeight: "92vh",
                overflowY: "auto",
                border: "1px solid var(--color-border)",
                boxShadow: "var(--shadow-2xl)",
                padding: "2rem",
                display: "flex",
                flexDirection: "column",
                position: "relative",
              }}
            >
              {/* Close Button */}
              <button
                onClick={() => setActiveThread(null)}
                style={{
                  position: "absolute",
                  top: "1.5rem",
                  right: "1.5rem",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-muted)",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "1.5rem" }}>
                  close
                </span>
              </button>

              {/* Thread Info */}
              <div
                style={{
                  marginBottom: "1.5rem",
                  paddingBottom: "1.5rem",
                  borderBottom: "1px solid var(--color-border)",
                }}
              >
                <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem", flexWrap: "wrap" }}>
                  <span className="badge-pill badge-primary">
                    {activeThread.program_name || "General Discussion"}
                  </span>
                  {activeThread.has_verified_answer && (
                    <span className="badge-pill badge-success">
                      <span className="material-symbols-outlined" style={{ fontSize: "0.9rem" }}>
                        verified
                      </span>
                      Instructor Solved
                    </span>
                  )}
                  {activeThread.tags?.map((tg, i) => (
                    <span
                      key={i}
                      style={{
                        fontSize: "0.72rem",
                        padding: "2px 8px",
                        background: "rgba(0,0,0,0.05)",
                        color: "var(--text-muted)",
                        borderRadius: "6px",
                        fontWeight: 600,
                      }}
                    >
                      #{tg}
                    </span>
                  ))}
                </div>

                <h2 style={{ fontSize: "1.4rem", fontWeight: 800, marginBottom: "0.5rem" }}>
                  {activeThread.title}
                </h2>

                <div
                  style={{
                    fontSize: "0.85rem",
                    color: "var(--text-muted)",
                    marginBottom: "1rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.4rem",
                    flexWrap: "wrap",
                  }}
                >
                  Posted by <strong>{activeThread.author_name}</strong>
                  <span
                    style={{
                      fontSize: "0.7rem",
                      padding: "1px 6px",
                      borderRadius: "4px",
                      background: "rgba(0,0,0,0.06)",
                      color: "var(--text-muted)",
                      fontWeight: 700,
                    }}
                  >
                    {activeThread.author_role}
                  </span>
                  <span>• {activeThread.time_ago}</span>
                </div>

                <p
                  style={{
                    fontSize: "0.95rem",
                    lineHeight: 1.6,
                    color: "var(--foreground)",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {activeThread.content}
                </p>
              </div>

              {/* Replies Section */}
              <div style={{ flex: 1, marginBottom: "1.5rem" }}>
                <h3
                  style={{
                    fontSize: "1.1rem",
                    fontWeight: 700,
                    marginBottom: "1rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.4rem",
                  }}
                >
                  Replies & Discussion ({activeThread.replies?.length || 0})
                  {isDetailLoading && (
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: "1rem", animation: "spin 1s linear infinite" }}
                    >
                      progress_activity
                    </span>
                  )}
                </h3>

                {!activeThread.replies || activeThread.replies.length === 0 ? (
                  <p
                    style={{
                      color: "var(--text-muted)",
                      fontStyle: "italic",
                      fontSize: "0.9rem",
                      padding: "1rem 0",
                    }}
                  >
                    No responses yet. Be the first to share an answer or insight!
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    {activeThread.replies.map((reply) => {
                      const canVerify = isStaff || activeThread.author_id === user?.id;
                      const canDeleteReply =
                        reply.author_id === user?.id ||
                        activeThread.author_id === user?.id ||
                        isStaff;

                      return (
                        <div
                          key={reply.id}
                          style={{
                            padding: "1.1rem 1.25rem",
                            borderRadius: "12px",
                            background: reply.is_verified
                              ? "rgba(16, 185, 129, 0.08)"
                              : "var(--background)",
                            border: reply.is_verified
                              ? "1px solid #10b981"
                              : "1px solid var(--color-border)",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              marginBottom: "0.5rem",
                              flexWrap: "wrap",
                              gap: "0.5rem",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                              <strong style={{ fontSize: "0.9rem" }}>{reply.author_name}</strong>
                              <span
                                style={{
                                  fontSize: "0.72rem",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  background: ["Instructor", "Admin"].includes(reply.author_role)
                                    ? "var(--primary)"
                                    : "rgba(0,0,0,0.06)",
                                  color: ["Instructor", "Admin"].includes(reply.author_role)
                                    ? "white"
                                    : "var(--text-muted)",
                                  fontWeight: 700,
                                }}
                              >
                                {reply.author_role}
                              </span>
                              {reply.is_verified && (
                                <span
                                  style={{
                                    fontSize: "0.75rem",
                                    color: "#10b981",
                                    fontWeight: 700,
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "0.2rem",
                                  }}
                                >
                                  <span className="material-symbols-outlined" style={{ fontSize: "0.9rem" }}>
                                    verified
                                  </span>
                                  Verified Solution
                                </span>
                              )}
                            </div>

                            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                              {canVerify && (
                                <button
                                  onClick={() => handleToggleVerify(reply.id)}
                                  style={{
                                    background: "transparent",
                                    border: "none",
                                    cursor: "pointer",
                                    fontSize: "0.75rem",
                                    color: reply.is_verified ? "var(--danger)" : "var(--primary)",
                                    fontWeight: 700,
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "0.2rem",
                                  }}
                                >
                                  <span className="material-symbols-outlined" style={{ fontSize: "0.9rem" }}>
                                    {reply.is_verified ? "remove_done" : "check_circle"}
                                  </span>
                                  {reply.is_verified ? "Unmark Solution" : "Mark as Verified"}
                                </button>
                              )}

                              {canDeleteReply && (
                                <button
                                  onClick={() => handleDeleteReply(reply.id)}
                                  style={{
                                    background: "transparent",
                                    border: "none",
                                    cursor: "pointer",
                                    fontSize: "0.75rem",
                                    color: "var(--danger)",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "0.15rem",
                                  }}
                                  title="Delete reply"
                                >
                                  <span className="material-symbols-outlined" style={{ fontSize: "0.9rem" }}>
                                    delete
                                  </span>
                                </button>
                              )}

                              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                {reply.time_ago}
                              </span>
                            </div>
                          </div>

                          <p
                            style={{
                              fontSize: "0.9rem",
                              lineHeight: 1.55,
                              color: "var(--foreground)",
                              margin: 0,
                              whiteSpace: "pre-wrap",
                            }}
                          >
                            {reply.content}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Reply Input Form */}
              <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: "1.25rem" }}>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, marginBottom: "0.4rem" }}>
                  Write a Response:
                </label>
                <textarea
                  rows={3}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Share a solution, explanation, troubleshooting steps, or code snippet..."
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    borderRadius: "8px",
                    border: "1px solid var(--color-border)",
                    background: "var(--background)",
                    color: "var(--foreground)",
                    fontSize: "0.9rem",
                    marginBottom: "0.75rem",
                    resize: "vertical",
                  }}
                />
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                  <button
                    onClick={() => setActiveThread(null)}
                    className="btn-secondary"
                    style={{ padding: "0.45rem 1rem" }}
                  >
                    Close
                  </button>
                  <button
                    onClick={handleAddReply}
                    className="btn-primary"
                    disabled={!replyText.trim() || isSubmittingReply}
                    style={{ padding: "0.45rem 1.25rem", display: "flex", alignItems: "center", gap: "0.4rem" }}
                  >
                    {isSubmittingReply && (
                      <span className="material-symbols-outlined" style={{ fontSize: "1rem", animation: "spin 1s linear infinite" }}>
                        progress_activity
                      </span>
                    )}
                    {isSubmittingReply ? "Submitting..." : "Submit Reply"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Ask Question Modal (Replaced Rigid Dropdown with Versatile Topic / Tag System) */}
        {showNewModal && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(15, 23, 42, 0.65)",
              backdropFilter: "blur(4px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
              padding: "1rem",
            }}
          >
            <div
              style={{
                background: "var(--color-surface)",
                borderRadius: "16px",
                maxWidth: "620px",
                width: "100%",
                padding: "2rem",
                position: "relative",
                border: "1px solid var(--color-border)",
                boxShadow: "var(--shadow-2xl)",
              }}
            >
              <button
                onClick={() => setShowNewModal(false)}
                style={{
                  position: "absolute",
                  top: "1.5rem",
                  right: "1.5rem",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-muted)",
                }}
              >
                <span className="material-symbols-outlined">close</span>
              </button>

              <h2 style={{ fontSize: "1.4rem", fontWeight: 800, marginBottom: "0.35rem" }}>
                Post Question to Community Forum
              </h2>
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "1.5rem" }}>
                Be clear and specific so peers and instructors can provide helpful answers quickly.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
                {/* Question Title */}
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, marginBottom: "0.3rem" }}>
                    Question Title: *
                  </label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. How to resolve state synchronization between parent and child components?"
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      borderRadius: "8px",
                      border: "1px solid var(--color-border)",
                      background: "var(--background)",
                      color: "var(--foreground)",
                      fontSize: "0.9rem",
                    }}
                  />
                </div>

                {/* Program Selector (Optional) */}
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, marginBottom: "0.3rem" }}>
                    Associated Program (Optional):
                  </label>
                  <select
                    value={newProgramId}
                    onChange={(e) => setNewProgramId(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      borderRadius: "8px",
                      border: "1px solid var(--color-border)",
                      background: "var(--background)",
                      color: "var(--foreground)",
                      fontSize: "0.9rem",
                      cursor: "pointer",
                    }}
                  >
                    <option value="">General Discussion (All Programs)</option>
                    {programs.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.code})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Versatile Topic / Tags Input (Replaced the hardcoded select dropdown) */}
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, marginBottom: "0.3rem" }}>
                    Topic Tags:
                  </label>

                  {/* Active Tags Pills */}
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "0.4rem",
                      marginBottom: "0.6rem",
                    }}
                  >
                    {tagsList.map((tag) => (
                      <span
                        key={tag}
                        style={{
                          fontSize: "0.78rem",
                          padding: "3px 8px",
                          background: "var(--primary)",
                          color: "white",
                          borderRadius: "14px",
                          fontWeight: 600,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.3rem",
                        }}
                      >
                        #{tag}
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "white",
                            cursor: "pointer",
                            padding: 0,
                            display: "flex",
                            alignItems: "center",
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: "0.85rem" }}>
                            close
                          </span>
                        </button>
                      </span>
                    ))}
                  </div>

                  {/* Tag Input */}
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === ",") {
                          e.preventDefault();
                          handleAddTag(tagInput);
                        }
                      }}
                      placeholder="Type a custom tag and press Enter (e.g. React, Week 2, Python)..."
                      style={{
                        flex: 1,
                        padding: "0.65rem 0.75rem",
                        borderRadius: "8px",
                        border: "1px solid var(--color-border)",
                        background: "var(--background)",
                        color: "var(--foreground)",
                        fontSize: "0.85rem",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => handleAddTag(tagInput)}
                      className="btn-secondary"
                      style={{ padding: "0.65rem 1rem", fontSize: "0.85rem" }}
                    >
                      Add Tag
                    </button>
                  </div>

                  {/* Suggested Tag Quick Chips */}
                  <div style={{ marginTop: "0.6rem" }}>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginRight: "0.4rem" }}>
                      Suggested:
                    </span>
                    {SUGGESTED_TAGS.map((st) => {
                      const isAdded = tagsList.some((t) => t.toLowerCase() === st.toLowerCase());
                      return (
                        <button
                          key={st}
                          type="button"
                          onClick={() => (isAdded ? handleRemoveTag(st) : handleAddTag(st))}
                          style={{
                            fontSize: "0.72rem",
                            padding: "2px 7px",
                            marginRight: "0.35rem",
                            marginBottom: "0.35rem",
                            borderRadius: "10px",
                            background: isAdded ? "rgba(79, 70, 229, 0.15)" : "rgba(0,0,0,0.05)",
                            color: isAdded ? "var(--primary)" : "var(--text-muted)",
                            border: isAdded ? "1px solid var(--primary)" : "1px solid transparent",
                            cursor: "pointer",
                            fontWeight: 600,
                          }}
                        >
                          {isAdded ? "✓ " : "+ "}
                          {st}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Explanation / Content */}
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, marginBottom: "0.3rem" }}>
                    Explanation, Details or Code Snippet: *
                  </label>
                  <textarea
                    rows={4}
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    placeholder="Provide full context, what you have attempted so far, and any error message..."
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      borderRadius: "8px",
                      border: "1px solid var(--color-border)",
                      background: "var(--background)",
                      color: "var(--foreground)",
                      resize: "vertical",
                      fontSize: "0.9rem",
                    }}
                  />
                </div>

                {/* Actions */}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
                  <button
                    type="button"
                    onClick={() => setShowNewModal(false)}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateThread}
                    className="btn-primary"
                    disabled={!newTitle.trim() || !newContent.trim() || isPublishing}
                    style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
                  >
                    {isPublishing && (
                      <span className="material-symbols-outlined" style={{ fontSize: "1rem", animation: "spin 1s linear infinite" }}>
                        progress_activity
                      </span>
                    )}
                    {isPublishing ? "Publishing..." : "Publish Question"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {threadToDelete && (
          <DeleteConfirmationModal
            open={true}
            title="Delete Discussion Thread"
            itemName={threadToDelete.title}
            itemType="Discussion Thread"
            warningText="This action will permanently remove this discussion thread and all its replies from the forum. This action cannot be undone."
            onConfirm={confirmDeleteThread}
            onClose={() => setThreadToDelete(null)}
          />
        )}
      </div>
    </RequireAuth>
  );
}
