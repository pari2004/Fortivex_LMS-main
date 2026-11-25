"use client";

import { useState } from "react";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { LoadingState } from "@/components/ui/LoadingState";
import { useStudentChatbot } from "@/lib/chatbot/useStudentChatbot";

function formatSeconds(totalSecs: number): string {
  const m = Math.floor(totalSecs / 60);
  const s = totalSecs % 60;
  return `${m}m ${s < 10 ? "0" : ""}${s}s`;
}

function formatResetTime(isoStr?: string): string {
  if (!isoStr) return "12:00 AM IST";
  try {
    const d = new Date(isoStr);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + " IST";
  } catch {
    return "12:00 AM IST";
  }
}

export default function StudentChatbotPage() {
  const [inputText, setInputText] = useState("");
  const {
    quota,
    messages,
    isLoadingHistory,
    isSending,
    isIdle,
    error,
    sendMessage,
    clearSession,
  } = useStudentChatbot(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isSending) return;
    sendMessage(inputText.trim());
    setInputText("");
  };

  const handlePromptClick = (promptText: string) => {
    if (isSending || (quota && quota.remaining_seconds <= 0)) return;
    sendMessage(promptText);
  };

  const remaining = quota ? quota.remaining_seconds : 300;
  const used = quota ? quota.seconds_used : 0;
  const isExhausted = quota ? quota.is_exhausted : false;
  const percentage = Math.max(0, Math.min(100, (remaining / 300) * 100));

  const starterPrompts = [
    "Explain Python decorators & generators with simple examples",
    "Help me prepare for my upcoming LMS weekly quiz",
    "Summarize clinical research trial phases",
    "Give me a 5-step daily study strategy for this program",
  ];

  return (
    <RequireAuth allowedRoles={["STUDENT"]}>
      <div style={{ maxWidth: "1100px", margin: "0 auto", display: "flex", flexDirection: "column", height: "calc(100vh - 120px)", gap: "1rem" }}>
        
        {/* Header & Allowance Status Bar */}
        <div style={{
          background: "linear-gradient(135deg, rgba(79, 70, 229, 0.08) 0%, rgba(147, 51, 234, 0.08) 100%)",
          border: "1px solid rgba(79, 70, 229, 0.2)",
          borderRadius: "16px",
          padding: "1.25rem 1.5rem",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div style={{
              width: "48px",
              height: "48px",
              borderRadius: "12px",
              background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              boxShadow: "0 4px 12px rgba(79, 70, 229, 0.3)"
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: "1.75rem" }}>smart_toy</span>
            </div>
            <div>
              <h1 style={{ fontSize: "1.35rem", fontWeight: 800, margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                AI Learning Assistant
                <span style={{ fontSize: "0.75rem", padding: "0.2rem 0.6rem", borderRadius: "12px", background: "rgba(79, 70, 229, 0.15)", color: "#4f46e5", fontWeight: 700 }}>
                  Empowers & Medivex AI
                </span>
              </h1>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--color-muted)" }}>
                Personalized 1-on-1 tutor for curriculum concepts, quiz preparation, and study guides.
              </p>
            </div>
          </div>

          {/* Daily Quota Counter */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.35rem", minWidth: "220px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "0.85rem", fontWeight: 700, color: isExhausted ? "#ef4444" : "#4f46e5" }}>
                ⏱️ Daily Allowance: {formatSeconds(remaining)} left
              </span>
              {isIdle && (
                <span style={{ fontSize: "0.7rem", padding: "0.15rem 0.5rem", borderRadius: "10px", background: "#f59e0b", color: "#fff", fontWeight: 700 }}>
                  ⏸️ Paused (Idle)
                </span>
              )}
            </div>

            {/* Allowance Progress Bar */}
            <div style={{ width: "100%", height: "8px", background: "#e2e8f0", borderRadius: "4px", overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: `${percentage}%`,
                background: isExhausted ? "#ef4444" : remaining < 60 ? "#f59e0b" : "linear-gradient(90deg, #10b981, #4f46e5)",
                transition: "width 0.4s ease-in-out"
              }} />
            </div>

            <span style={{ fontSize: "0.72rem", color: "var(--color-muted)" }}>
              {isExhausted ? `Resets at ${formatResetTime(quota?.resets_at)}` : `5 mins / day (${quota?.timezone || "Asia/Kolkata"})`}
            </span>
          </div>
        </div>

        {/* Main Chat Container */}
        <div style={{
          flex: 1,
          background: "var(--color-surface, #ffffff)",
          border: "1px solid var(--color-border, #e2e8f0)",
          borderRadius: "16px",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 4px 20px rgba(0,0,0,0.03)"
        }}>

          {/* Chat Messages Log */}
          <div style={{ flex: 1, overflowY: "auto", padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
            {isLoadingHistory ? (
              <LoadingState message="Loading your AI Tutor conversation..." variant="spinner" />
            ) : messages.length === 0 ? (
              <div style={{ margin: "auto", textAlign: "center", maxWidth: "550px", padding: "2rem 1rem" }}>
                <div style={{
                  width: "60px",
                  height: "60px",
                  borderRadius: "50%",
                  background: "rgba(79, 70, 229, 0.1)",
                  color: "#4f46e5",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "1rem"
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: "2.2rem" }}>chat_spark</span>
                </div>
                <h3 style={{ fontSize: "1.2rem", fontWeight: 700, margin: "0 0 0.5rem 0" }}>How can I help you today?</h3>
                <p style={{ fontSize: "0.9rem", color: "var(--color-muted)", marginBottom: "1.5rem" }}>
                  Ask me anything about your current courses, assignments, medical cases, or technical code. Your daily allowance is 5 active minutes.
                </p>

                {/* Starter Prompts */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", textAlign: "left" }}>
                  {starterPrompts.map((p, idx) => (
                    <button
                      key={idx}
                      onClick={() => handlePromptClick(p)}
                      disabled={isExhausted}
                      style={{
                        padding: "0.85rem 1rem",
                        borderRadius: "12px",
                        border: "1px solid var(--color-border, #e2e8f0)",
                        background: "var(--background, #f8fafc)",
                        fontSize: "0.85rem",
                        color: "var(--foreground)",
                        cursor: isExhausted ? "not-allowed" : "pointer",
                        transition: "all 0.2s",
                        fontWeight: 500,
                        opacity: isExhausted ? 0.6 : 1,
                      }}
                    >
                      💡 {p}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg, index) => {
                const isUser = msg.role === "user";
                return (
                  <div
                    key={index}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: isUser ? "flex-end" : "flex-start",
                      maxWidth: "85%",
                      alignSelf: isUser ? "flex-end" : "flex-start",
                    }}
                  >
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.4rem",
                      marginBottom: "0.25rem",
                      fontSize: "0.75rem",
                      color: "var(--color-muted)",
                      fontWeight: 600
                    }}>
                      <span>{isUser ? "You" : "AI Learning Assistant"}</span>
                    </div>

                    <div style={{
                      padding: "0.9rem 1.25rem",
                      borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                      background: isUser ? "linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)" : "var(--background, #f8fafc)",
                      color: isUser ? "#ffffff" : "var(--foreground, #1e293b)",
                      border: isUser ? "none" : "1px solid var(--color-border, #e2e8f0)",
                      fontSize: "0.92rem",
                      lineHeight: "1.55",
                      whiteSpace: "pre-wrap",
                      boxShadow: isUser ? "0 2px 8px rgba(79, 70, 229, 0.25)" : "none"
                    }}>
                      {msg.content}
                    </div>
                  </div>
                );
              })
            )}

            {isSending && (
              <div style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--color-muted)", fontSize: "0.85rem" }}>
                <span className="material-symbols-outlined" style={{ animation: "spin 1s linear infinite", fontSize: "1.2rem" }}>progress_activity</span>
                AI Assistant is thinking...
              </div>
            )}
          </div>

          {/* Quota Exhaustion Alert or Error Banner */}
          {error && (
            <div style={{ padding: "0.75rem 1.25rem", background: "#fef2f2", borderTop: "1px solid #fecaca", color: "#dc2626", fontSize: "0.85rem", fontWeight: 600 }}>
              ⚠️ {error}
            </div>
          )}

          {isExhausted && (
            <div style={{ padding: "1rem 1.5rem", background: "#fffbebe6", borderTop: "1px solid #fef08a", color: "#b45309", display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "1.5rem" }}>lock_clock</span>
              <div style={{ fontSize: "0.85rem" }}>
                <strong>Daily allowance exhausted (5/5 mins used).</strong> Your AI usage will reset at <strong>{formatResetTime(quota?.resets_at)}</strong>.
              </div>
            </div>
          )}

          {/* Input Form Bar */}
          <form onSubmit={handleSubmit} style={{ padding: "1rem 1.25rem", borderTop: "1px solid var(--color-border, #e2e8f0)", display: "flex", gap: "0.75rem", background: "var(--color-surface, #ffffff)" }}>
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={isExhausted ? "Daily allowance limit reached. Resets at midnight IST..." : "Ask your AI tutor a question..."}
              disabled={isExhausted || isSending}
              style={{
                flex: 1,
                padding: "0.85rem 1.25rem",
                borderRadius: "12px",
                border: "1px solid var(--color-border, #cbd5e1)",
                outline: "none",
                fontSize: "0.95rem",
                background: isExhausted ? "var(--background, #f1f5f9)" : "#ffffff",
                color: "var(--foreground)"
              }}
            />
            
            <button
              type="button"
              onClick={clearSession}
              title="Clear Session"
              style={{
                padding: "0.85rem 1rem",
                borderRadius: "12px",
                border: "1px solid var(--color-border, #cbd5e1)",
                background: "transparent",
                color: "var(--color-muted)",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <span className="material-symbols-outlined">restart_alt</span>
            </button>

            <button
              type="submit"
              disabled={isExhausted || isSending || !inputText.trim()}
              style={{
                padding: "0.85rem 1.5rem",
                borderRadius: "12px",
                border: "none",
                background: isExhausted || !inputText.trim() ? "#cbd5e1" : "linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)",
                color: "#ffffff",
                fontWeight: 700,
                fontSize: "0.9rem",
                cursor: isExhausted || !inputText.trim() ? "not-allowed" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                boxShadow: isExhausted || !inputText.trim() ? "none" : "0 4px 12px rgba(79, 70, 229, 0.3)"
              }}
            >
              <span>Send</span>
              <span className="material-symbols-outlined" style={{ fontSize: "1.1rem" }}>send</span>
            </button>
          </form>

        </div>
      </div>
    </RequireAuth>
  );
}
