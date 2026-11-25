"use client";

import { useMeeting } from "@/lib/live/MeetingContext";
import { EmbeddedJitsi } from "./EmbeddedJitsi";
import { CSSProperties } from "react";

export function GlobalMeetingPlayer() {
  const { activeMeeting, isMinimized, setIsMinimized, leaveMeeting } = useMeeting();

  if (!activeMeeting) return null;

  const wrapperStyle: CSSProperties = isMinimized
    ? { 
        position: "fixed", bottom: "20px", right: "20px", 
        width: "360px", height: "240px", zIndex: 999999, 
        borderRadius: "12px", overflow: "hidden", 
        boxShadow: "0 10px 40px rgba(0,0,0,0.6)", 
        display: "flex", flexDirection: "column", 
        background: "#000", border: "1px solid var(--color-border)",
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
      }
    : { 
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0, 
        zIndex: 999999, background: "var(--bg-main)", 
        display: "flex", flexDirection: "column",
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
      };

  return (
    <div style={wrapperStyle}>
      {/* Header */}
      <div style={{ 
        padding: isMinimized ? "0.4rem 0.8rem" : "1rem 2rem", 
        background: "#ffffff", 
        borderBottom: "1px solid var(--color-border)", 
        display: "flex", justifyContent: "space-between", alignItems: "center" 
      }}>
        {isMinimized ? (
          <>
            <span style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "200px" }}>
              {activeMeeting.title}
            </span>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button onClick={() => setIsMinimized(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center" }}>
                <span className="material-symbols-outlined" style={{ fontSize: "1.2rem" }}>open_in_full</span>
              </button>
              <button onClick={leaveMeeting} style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", display: "flex", alignItems: "center" }}>
                <span className="material-symbols-outlined" style={{ fontSize: "1.2rem" }}>close</span>
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700 }}>{activeMeeting.title}</h2>
            <div style={{ display: "flex", gap: "1rem" }}>
              <button onClick={() => setIsMinimized(true)} style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "var(--color-border)", border: "none", padding: "0.5rem 1rem", borderRadius: "8px", fontWeight: 600, cursor: "pointer", color: "var(--foreground)" }}>
                <span className="material-symbols-outlined">picture_in_picture_alt</span> Minimize
              </button>
              <button onClick={leaveMeeting} style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "var(--danger)", color: "#fff", border: "none", padding: "0.5rem 1rem", borderRadius: "8px", fontWeight: 600, cursor: "pointer" }}>
                <span className="material-symbols-outlined">call_end</span> End Call
              </button>
            </div>
          </>
        )}
      </div>
      
      {/* Jitsi Player Container */}
      <div style={{ flex: 1, background: "#000", position: "relative" }}>
        <EmbeddedJitsi 
          roomName={activeMeeting.roomName} 
          isHost={activeMeeting.isHost} 
          onLeave={leaveMeeting} 
        />
        {/* Cover overlay for PiP to allow dragging without interacting with iframe (future enhancement) */}
      </div>
    </div>
  );
}
