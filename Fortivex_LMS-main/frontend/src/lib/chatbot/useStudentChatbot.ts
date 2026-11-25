"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  ChatbotHistoryResponse,
  ChatbotQuotaResponse,
  ChatMessageItem,
  fetchChatbotHistory,
  fetchChatbotQuota,
  sendChatbotHeartbeat,
  sendChatbotMessage,
} from "@/lib/api/chatbot";

export function useStudentChatbot(isOpen: boolean = true) {
  const { token, user } = useAuth();
  const isStudent = user?.roles.includes("STUDENT") ?? false;

  const [quota, setQuota] = useState<ChatbotQuotaResponse | null>(null);
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [sessionId, setSessionId] = useState<string>("");
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isIdle, setIsIdle] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lastActivityRef = useRef<number>(0);
  const heartbeatAccumulatorRef = useRef<number>(0);
  const quotaRef = useRef<ChatbotQuotaResponse | null>(quota);
  useEffect(() => {
    quotaRef.current = quota;
  }, [quota]);

  // Load history & quota from server
  const loadInitialData = useCallback(async () => {
    if (!token || !isStudent || !isOpen) return;
    setIsLoadingHistory(true);
    setError(null);
    try {
      const data: ChatbotHistoryResponse = await fetchChatbotHistory(token);
      setSessionId(data.session_id);
      setMessages(data.messages);
      setQuota(data.quota);
    } catch (err: any) {
      console.error("Failed to load chatbot history:", err);
      setError(err.message || "Failed to load chatbot data.");
    } finally {
      setIsLoadingHistory(false);
    }
  }, [token, isStudent, isOpen]);

  useEffect(() => {
    if (isOpen) {
      loadInitialData();
    }
  }, [isOpen, loadInitialData]);

  // Track user activity for idle detection (30 second timeout)
  useEffect(() => {
    lastActivityRef.current = Date.now();
    const handleUserActivity = () => {
      lastActivityRef.current = Date.now();
      if (isIdle) {
        setIsIdle(false);
      }
    };

    window.addEventListener("mousemove", handleUserActivity);
    window.addEventListener("keydown", handleUserActivity);
    window.addEventListener("scroll", handleUserActivity);
    window.addEventListener("click", handleUserActivity);

    const idleCheckInterval = setInterval(() => {
      if (lastActivityRef.current > 0 && Date.now() - lastActivityRef.current > 30000 && !isIdle) {
        setIsIdle(true);
      }
    }, 5000);

    return () => {
      window.removeEventListener("mousemove", handleUserActivity);
      window.removeEventListener("keydown", handleUserActivity);
      window.removeEventListener("scroll", handleUserActivity);
      window.removeEventListener("click", handleUserActivity);
      clearInterval(idleCheckInterval);
    };
  }, [isIdle]);

  const isExhaustedVal = quota?.is_exhausted ?? false;

  // Active time countdown & heartbeat sync loop
  useEffect(() => {
    if (!token || !isOpen || isIdle || isExhaustedVal || (quotaRef.current && quotaRef.current.remaining_seconds <= 0)) {
      return;
    }

    const timer = setInterval(() => {
      if (quotaRef.current && quotaRef.current.remaining_seconds <= 0) {
        clearInterval(timer);
        return;
      }

      setQuota((prev) => {
        if (!prev || prev.remaining_seconds <= 0) return prev;
        const nextRemaining = prev.remaining_seconds - 1;
        const nextUsed = prev.seconds_used + 1;
        return {
          ...prev,
          remaining_seconds: Math.max(0, nextRemaining),
          seconds_used: nextUsed,
          is_exhausted: nextRemaining <= 0,
        };
      });

      heartbeatAccumulatorRef.current += 1;

      // Every 10 seconds, push heartbeat tick to backend server
      if (heartbeatAccumulatorRef.current >= 10) {
        const secsToSend = heartbeatAccumulatorRef.current;
        heartbeatAccumulatorRef.current = 0;
        sendChatbotHeartbeat(token, sessionId, secsToSend)
          .then((res) => {
            setQuota((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                remaining_seconds: res.remaining_seconds,
                seconds_used: res.seconds_used,
                is_exhausted: res.is_exhausted,
                resets_at: res.resets_at,
              };
            });
          })
          .catch((err) => {
            console.error("Heartbeat sync error:", err);
          });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [token, isOpen, isIdle, isExhaustedVal, sessionId]);

  // Send message
  const sendMessage = async (text: string) => {
    if (!token || !text.trim() || isSending) return;

    if (quota && quota.remaining_seconds <= 0) {
      setError("Your daily 5-minute allowance is exhausted. It will reset at midnight IST.");
      return;
    }

    const userMessage: ChatMessageItem = {
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsSending(true);
    setError(null);

    try {
      const res = await sendChatbotMessage(token, text, sessionId);
      setSessionId(res.session_id);
      
      const assistantMessage: ChatMessageItem = {
        role: "assistant",
        content: res.reply,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMessage]);

      setQuota((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          remaining_seconds: res.remaining_seconds,
          seconds_used: res.seconds_used,
          is_exhausted: res.is_exhausted,
          resets_at: res.resets_at,
        };
      });
    } catch (err: any) {
      console.error("Error sending message:", err);
      setError(err.message || "Failed to send message.");
      // Refresh quota in case it failed due to 429
      if (token) {
        fetchChatbotQuota(token).then(setQuota).catch(console.error);
      }
    } finally {
      setIsSending(false);
    }
  };

  const clearSession = () => {
    setMessages([]);
    setSessionId(crypto.randomUUID());
  };

  return {
    quota,
    messages,
    sessionId,
    isLoadingHistory,
    isSending,
    isIdle,
    error,
    sendMessage,
    clearSession,
    refreshQuota: loadInitialData,
  };
}
