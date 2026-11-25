import { apiRequest } from "./client";

export interface ChatbotQuotaResponse {
  usage_date: string;
  total_allowance_seconds: number;
  seconds_used: number;
  remaining_seconds: number;
  is_exhausted: boolean;
  timezone: string;
  resets_at: string;
  seconds_until_reset: number;
}

export interface ChatbotHeartbeatResponse {
  remaining_seconds: number;
  seconds_used: number;
  is_exhausted: boolean;
  resets_at: string;
}

export interface ChatMessageItem {
  role: "user" | "assistant" | "system";
  content: string;
  created_at?: string;
}

export interface ChatbotResponse {
  reply: string;
  session_id: string;
  remaining_seconds: number;
  seconds_used: number;
  is_exhausted: boolean;
  resets_at: string;
}

export interface ChatbotHistoryResponse {
  session_id: string;
  messages: ChatMessageItem[];
  quota: ChatbotQuotaResponse;
}

export async function fetchChatbotQuota(token: string): Promise<ChatbotQuotaResponse> {
  return apiRequest<ChatbotQuotaResponse>("/api/v1/chatbot/quota", { token });
}

export async function sendChatbotHeartbeat(
  token: string,
  sessionId: string,
  activeSeconds: number = 10
): Promise<ChatbotHeartbeatResponse> {
  return apiRequest<ChatbotHeartbeatResponse>("/api/v1/chatbot/heartbeat", {
    token,
    method: "POST",
    body: { session_id: sessionId, active_seconds: activeSeconds },
  });
}

export async function sendChatbotMessage(
  token: string,
  message: string,
  sessionId?: string
): Promise<ChatbotResponse> {
  return apiRequest<ChatbotResponse>("/api/v1/chatbot/message", {
    token,
    method: "POST",
    body: { message, session_id: sessionId },
  });
}

export async function fetchChatbotHistory(
  token: string,
  sessionId?: string
): Promise<ChatbotHistoryResponse> {
  const query = sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : "";
  return apiRequest<ChatbotHistoryResponse>(`/api/v1/chatbot/history${query}`, { token });
}
