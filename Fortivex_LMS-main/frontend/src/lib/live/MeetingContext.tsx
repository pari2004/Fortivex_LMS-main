"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface MeetingState {
  roomName: string;
  isHost: boolean;
  title: string;
}

interface MeetingContextType {
  activeMeeting: MeetingState | null;
  joinMeeting: (roomName: string, isHost: boolean, title: string) => void;
  leaveMeeting: () => void;
  isMinimized: boolean;
  setIsMinimized: (val: boolean) => void;
}

export const MeetingContext = createContext<MeetingContextType | null>(null);

export function MeetingProvider({ children }: { children: ReactNode }) {
  const [activeMeeting, setActiveMeeting] = useState<MeetingState | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);

  const joinMeeting = (roomName: string, isHost: boolean, title: string) => {
    setActiveMeeting({ roomName, isHost, title });
    setIsMinimized(false);
  };

  const leaveMeeting = () => {
    setActiveMeeting(null);
    setIsMinimized(false);
  };

  return (
    <MeetingContext.Provider value={{ activeMeeting, joinMeeting, leaveMeeting, isMinimized, setIsMinimized }}>
      {children}
    </MeetingContext.Provider>
  );
}

export function useMeeting() {
  const ctx = useContext(MeetingContext);
  if (!ctx) throw new Error("useMeeting must be used within MeetingProvider");
  return ctx;
}
