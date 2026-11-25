"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { listNotifications, markNotificationAsRead, markAllNotificationsAsRead } from "@/lib/api/endpoints";
import type { NotificationItem } from "@/lib/api/types";

interface HeaderProps {
  onToggleMobileMenu?: () => void;
}

function formatTimeAgo(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diffSec < 60) return "Just now";
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
    return d.toLocaleDateString();
  } catch {
    return "Recent";
  }
}

function getNotificationIcon(type: string): string {
  switch (type) {
    case "ASSIGNMENT":
      return "assignment";
    case "QUIZ":
      return "quiz";
    case "ANNOUNCEMENT":
      return "notifications";
    default:
      return "notifications";
  }
}

export function Header({ onToggleMobileMenu }: HeaderProps) {
  const { token, user, organization, logout } = useAuth();
  const router = useRouter();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  const notificationRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close popovers when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Global ⌘K / Ctrl+K keyboard shortcut to focus search
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSearchSubmit = () => {
    if (!searchQuery.trim()) return;
    const isStudent = user?.roles.includes("STUDENT") && !user?.roles.some(r => ["SUPER_ADMIN", "ACADEMIC_ADMIN", "PROGRAM_MANAGER"].includes(r));
    const targetUrl = isStudent ? `/student/courses` : `/admin/programs`;
    router.push(targetUrl);
  };

  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    try {
      const res = await listNotifications(token, false, 25);
      setNotifications(res.items);
      setUnreadCount(res.unread_count);
    } catch {
      // background polling catch
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchNotifications();
      const interval = setInterval(() => {
        if (!document.hidden) {
          fetchNotifications();
        }
      }, 45000);
      return () => clearInterval(interval);
    }
  }, [token, fetchNotifications]);

  const handleNotificationClick = async (notif: NotificationItem) => {
    if (!notif.is_read && token) {
      try {
        await markNotificationAsRead(token, notif.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch {
        // continue navigation
      }
    }
    setShowNotifications(false);
    if (notif.link_url) {
      router.push(notif.link_url);
    }
  };

  const handleMarkAllRead = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!token || isMarkingAll) return;
    try {
      setIsMarkingAll(true);
      await markAllNotificationsAsRead(token);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {
      // ignore
    } finally {
      setIsMarkingAll(false);
    }
  };

  if (!user) return null;

  async function handleLogout() {
    setShowUserMenu(false);
    await logout();
    router.push("/login");
  }

  return (
    <header className="app-header">
      {/* Left: Mobile Hamburger & Search Input Bar */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", minWidth: 0 }}>
        {onToggleMobileMenu && (
          <button
            type="button"
            className="mobile-menu-btn"
            onClick={onToggleMobileMenu}
            aria-label="Toggle navigation menu"
          >
            <Icon name="menu" size={24} color="var(--text-main)" />
          </button>
        )}

        <div className="header-search-box">
          <div
            style={{
              position: "absolute",
              left: "12px",
              color: "var(--text-dim)",
              pointerEvents: "none",
              display: "flex",
              alignItems: "center",
            }}
          >
            <Icon name="search" size={18} color="var(--text-dim)" />
          </div>
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search programs, modules, topics..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleSearchSubmit();
              }
            }}
            style={{
              width: "100%",
              padding: "0.55rem 3.5rem 0.55rem 2.4rem",
              fontSize: "0.85rem",
              borderRadius: "10px",
              border: "1px solid var(--border)",
              background: "#f8fafc",
              color: "var(--text-main)",
              outline: "none",
              transition: "all 0.2s ease",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "var(--primary)";
              e.currentTarget.style.background = "#ffffff";
              e.currentTarget.style.boxShadow = "0 0 0 3px var(--primary-light)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "var(--border)";
              e.currentTarget.style.background = "#f8fafc";
              e.currentTarget.style.boxShadow = "none";
            }}
          />
          <kbd
            style={{
              position: "absolute",
              right: "10px",
              padding: "2px 6px",
              fontSize: "0.7rem",
              fontWeight: 600,
              color: "var(--text-dim)",
              background: "#ffffff",
              border: "1px solid var(--border)",
              borderRadius: "4px",
              pointerEvents: "none",
            }}
          >
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Right Actions */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        {/* Notifications Popover */}
        <div ref={notificationRef} style={{ position: "relative" }}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            style={{
              width: "38px",
              height: "38px",
              borderRadius: "10px",
              background: showNotifications ? "var(--primary-light)" : "#f8fafc",
              border: "1px solid var(--border)",
              color: showNotifications ? "var(--primary)" : "var(--text-muted)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              transition: "all 0.15s ease",
            }}
          >
            <Icon name="notifications" size={20} color={showNotifications ? "var(--primary)" : "var(--text-muted)"} />
            {unreadCount > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: "6px",
                  right: "6px",
                  minWidth: "16px",
                  height: "16px",
                  padding: "0 4px",
                  borderRadius: "999px",
                  background: "var(--danger)",
                  border: "2px solid #ffffff",
                  color: "#ffffff",
                  fontSize: "0.65rem",
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div
              style={{
                position: "absolute",
                top: "48px",
                right: "0",
                width: "min(360px, calc(100vw - 20px))",
                background: "#ffffff",
                borderRadius: "14px",
                border: "1px solid var(--border)",
                boxShadow: "var(--shadow-xl)",
                padding: "1rem",
                zIndex: 100,
                animation: "fadeIn 0.2s ease-out",
                maxHeight: "450px",
                overflowY: "auto",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "0.75rem",
                  paddingBottom: "0.5rem",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>Notifications</span>
                  {unreadCount > 0 && (
                    <span className="badge-pill badge-primary" style={{ fontSize: "0.7rem" }}>
                      {unreadCount} Unread
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllRead}
                    disabled={isMarkingAll}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "var(--primary)",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      padding: "2px 6px",
                    }}
                  >
                    {isMarkingAll ? "Marking..." : "Mark all read"}
                  </button>
                )}
              </div>

              {notifications.length === 0 ? (
                <div style={{ padding: "2rem 1rem", textAlign: "center", color: "var(--text-muted)" }}>
                  <div style={{ marginBottom: "0.5rem", opacity: 0.5 }}>
                    <Icon name="notifications" size={32} />
                  </div>
                  <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>No notifications yet</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginTop: "2px" }}>
                    New assignments and quizzes will appear here automatically.
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => handleNotificationClick(n)}
                      style={{
                        padding: "0.65rem",
                        borderRadius: "8px",
                        background: !n.is_read ? "var(--primary-light)" : "transparent",
                        display: "flex",
                        gap: "0.65rem",
                        cursor: "pointer",
                        transition: "background 0.15s ease",
                      }}
                      onMouseEnter={(e) => {
                        if (n.is_read) (e.currentTarget as HTMLElement).style.background = "#f8fafc";
                      }}
                      onMouseLeave={(e) => {
                        if (n.is_read) (e.currentTarget as HTMLElement).style.background = "transparent";
                      }}
                    >
                      <div
                        style={{
                          width: "32px",
                          height: "32px",
                          borderRadius: "8px",
                          background: "#ffffff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "var(--primary)",
                          flexShrink: 0,
                          border: "1px solid var(--border)",
                        }}
                      >
                        <Icon name={getNotificationIcon(n.type)} size={18} color="var(--primary)" />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: "0.82rem",
                            fontWeight: !n.is_read ? 700 : 600,
                            color: "var(--text-main)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {n.title}
                          </span>
                          {!n.is_read && (
                            <span
                              style={{
                                width: "6px",
                                height: "6px",
                                borderRadius: "50%",
                                backgroundColor: "var(--primary)",
                                flexShrink: 0,
                                marginLeft: "4px",
                              }}
                            />
                          )}
                        </div>
                        <div
                          style={{
                            fontSize: "0.75rem",
                            color: "var(--text-muted)",
                            lineHeight: 1.3,
                            marginTop: "2px",
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                        >
                          {n.message}
                        </div>
                        <div style={{ fontSize: "0.7rem", color: "var(--text-dim)", marginTop: "4px" }}>
                          {formatTimeAgo(n.created_at)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* User Pill & Menu */}
        <div ref={userMenuRef} style={{ position: "relative" }}>
          <div
            onClick={() => setShowUserMenu(!showUserMenu)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              padding: "0.35rem 0.65rem 0.35rem 0.4rem",
              borderRadius: "999px",
              background: "#f8fafc",
              border: "1px solid var(--border)",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#f1f5f9";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#f8fafc";
            }}
          >
            <div
              style={{
                width: "34px",
                height: "34px",
                borderRadius: "50%",
                background: "var(--primary-gradient)",
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: "0.85rem",
                boxShadow: "0 2px 6px var(--primary-glow)",
              }}
            >
              {user.full_name?.charAt(0) || "U"}
            </div>
            <div className="desktop-only" style={{ textAlign: "left", lineHeight: 1.2 }}>
              <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--text-main)" }}>
                {user.full_name}
              </div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                {organization?.name || "Global Admin"}
              </div>
            </div>
            <div className="desktop-only">
              <Icon name="expand_more" size={18} color="var(--text-dim)" />
            </div>
          </div>

          {showUserMenu && (
            <div
              style={{
                position: "absolute",
                top: "48px",
                right: 0,
                width: "min(220px, calc(100vw - 20px))",
                background: "#ffffff",
                borderRadius: "14px",
                border: "1px solid var(--border)",
                boxShadow: "var(--shadow-xl)",
                padding: "0.5rem",
                zIndex: 100,
                animation: "fadeIn 0.2s ease-out",
              }}
            >
              <div
                style={{
                  padding: "0.5rem 0.75rem",
                  borderBottom: "1px solid var(--border)",
                  marginBottom: "0.25rem",
                }}
              >
                <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Signed in as</div>
                <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-main)" }}>
                  {user.email}
                </div>
              </div>

              <Link
                href="/profile"
                onClick={() => setShowUserMenu(false)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.6rem",
                  padding: "0.55rem 0.75rem",
                  borderRadius: "8px",
                  fontSize: "0.85rem",
                  color: "var(--text-main)",
                  textDecoration: "none",
                  fontWeight: 500,
                  transition: "background 0.15s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <Icon name="person" size={16} />
                Profile & Settings
              </Link>

              <button
                onClick={handleLogout}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.6rem",
                  padding: "0.55rem 0.75rem",
                  borderRadius: "8px",
                  fontSize: "0.85rem",
                  color: "var(--danger)",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  fontWeight: 600,
                  textAlign: "left",
                  transition: "background 0.15s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--danger-light)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <Icon name="logout" size={16} color="var(--danger)" />
                Log Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
