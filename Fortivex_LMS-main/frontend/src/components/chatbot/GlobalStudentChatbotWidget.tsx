"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { useStudentChatbot } from "@/lib/chatbot/useStudentChatbot";

function formatSeconds(totalSecs: number): string {
  const m = Math.floor(totalSecs / 60);
  const s = totalSecs % 60;
  return `${m}m ${s < 10 ? "0" : ""}${s}s`;
}

export function GlobalStudentChatbotWidget() {
  const { user } = useAuth();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState("");

  const isStudent = user?.roles.includes("STUDENT") ?? false;
  
  // Don't render widget on full chatbot page or for non-students
  const isFullChatbotPage = pathname === "/student/chatbot";
  const shouldRender = isStudent && !isFullChatbotPage && user !== null;

  const {
    quota,
    messages,
    isSending,
    isIdle,
    error,
    sendMessage,
  } = useStudentChatbot(isOpen && shouldRender);

  if (!shouldRender) return null;

  const remaining = quota ? quota.remaining_seconds : 300;
  const isExhausted = quota ? quota.is_exhausted : false;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isSending || isExhausted) return;
    sendMessage(inputText.trim());
    setInputText("");
  };

  return (
    <div
      style={{
        position: "fixed",
        bottom: "16px",
        right: "16px",
        zIndex: 9999,
        fontFamily: "inherit",
        maxWidth: "calc(100vw - 32px)",
      }}
    >
      {/* Floating Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.6rem",
            padding: "0.75rem 1.15rem",
            borderRadius: "30px",
            background: isExhausted ? "#ef4444" : "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
            color: "#ffffff",
            border: "none",
            boxShadow: "0 8px 24px rgba(79, 70, 229, 0.4)",
            cursor: "pointer",
            fontWeight: 700,
            fontSize: "0.88rem",
            transition: "transform 0.2s ease, boxShadow 0.2s ease",
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: "1.25rem" }}>smart_toy</span>
          <span>AI Tutor</span>
          <span style={{
            background: "rgba(255, 255, 255, 0.25)",
            padding: "0.15rem 0.55rem",
            borderRadius: "12px",
            fontSize: "0.75rem"
          }}>
            {isExhausted ? "0m left" : formatSeconds(remaining)}
          </span>
        </button>
      )}

      {/* Mini Chatbot Window */}
      {isOpen && (
        <div style={{
          width: "min(380px, calc(100vw - 32px))",
          height: "min(540px, calc(100vh - 100px))",
          background: "var(--color-surface, #ffffff)",
          border: "1px solid var(--color-border, #e2e8f0)",
          borderRadius: "20px",
          boxShadow: "0 12px 40px rgba(0, 0, 0, 0.18)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          animation: "fadeInUp 0.3s ease-out forwards"
        }}>
          {/* Top Bar */}
          <div style={{
            padding: "1rem 1.25rem",
            background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
            color: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "1.5rem" }}>smart_toy</span>
              <div>
                <div style={{ fontWeight: 800, fontSize: "0.95rem" }}>AI Learning Assistant</div>
                <div style={{ fontSize: "0.75rem", opacity: 0.9 }}>
                  ⏱️ {formatSeconds(remaining)} left today {isIdle ? "(Paused)" : ""}
                </div>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{ background: "transparent", border: "none", color: "#fff", cursor: "pointer" }}
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          {/* Messages Body */}
          <div style={{ flex: 1, padding: "1rem", overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.75rem", background: "var(--background, #f8fafc)" }}>
            {messages.length === 0 ? (
              <div style={{ margin: "auto", textAlign: "center", color: "var(--color-muted)", fontSize: "0.85rem" }}>
                👋 Ask your AI tutor any question about your courses!
              </div>
            ) : (
              messages.map((m, idx) => (
                <div
                  key={idx}
                  style={{
                    alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                    maxWidth: "85%",
                    padding: "0.65rem 0.95rem",
                    borderRadius: m.role === "user" ? "14px 14px 2px 14px" : "14px 14px 14px 2px",
                    background: m.role === "user" ? "#4f46e5" : "#ffffff",
                    color: m.role === "user" ? "#ffffff" : "#1e293b",
                    border: m.role === "user" ? "none" : "1px solid #e2e8f0",
                    fontSize: "0.85rem",
                    lineHeight: "1.4"
                  }}
                >
                  {m.content}
                </div>
              ))
            )}
            {isSending && (
              <div style={{ fontSize: "0.78rem", color: "var(--color-muted)", alignSelf: "flex-start" }}>
                AI Assistant is typing...
              </div>
            )}
          </div>

          {/* Quota Exhaustion Alert */}
          {isExhausted && (
            <div style={{ padding: "0.6rem 1rem", background: "#fef2f2", color: "#dc2626", fontSize: "0.78rem", fontWeight: 600 }}>
              ⚠️ Daily 5-min allowance used up. Resets at 12:00 AM IST.
            </div>
          )}

          {/* Input Bar */}
          <form onSubmit={handleSubmit} style={{ padding: "0.75rem", borderTop: "1px solid #e2e8f0", display: "flex", gap: "0.5rem", background: "#ffffff" }}>
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={isExhausted ? "Quota exhausted..." : "Type your question..."}
              disabled={isExhausted || isSending}
              style={{
                flex: 1,
                padding: "0.65rem 0.9rem",
                borderRadius: "10px",
                border: "1px solid #cbd5e1",
                fontSize: "0.85rem",
                outline: "none"
              }}
            />
            <button
              type="submit"
              disabled={isExhausted || isSending || !inputText.trim()}
              style={{
                padding: "0.65rem 1rem",
                borderRadius: "10px",
                background: "#4f46e5",
                color: "#ffffff",
                border: "none",
                fontWeight: 700,
                cursor: "pointer",
                opacity: isExhausted || !inputText.trim() ? 0.5 : 1
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "1rem" }}>send</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
