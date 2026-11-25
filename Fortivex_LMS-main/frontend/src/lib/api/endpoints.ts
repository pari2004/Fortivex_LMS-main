import { config, buildApiUrl } from "@/lib/config";
import { apiRequest, ApiError } from "@/lib/api/client";
import type {
  Cohort,
  Enrollment,
  Organization,
  Program,
  Token,
  User,
  ProgramModule,
  Week,
  Lesson,
  Activity,
  FullProfileResponse,
  UserUpdatePayload,
  PasswordChangePayload,
  CohortAchievementsResponse,
  PeerComparisonResponse,
  StreakInfo,
  StreakActionResponse,
  AssignmentItem,
  AssignmentCreatePayload,
  StudentAssignmentItem,
  AssignmentSubmissionItem,
  SubmissionGradePayload,
  NotificationItem,
  NotificationListResponse,
  BulkUserCreatePayload,
  BulkUserCreateResponse,
  DiscussionThreadItem,
  DiscussionReplyItem,
  DiscussionThreadCreatePayload,
  DiscussionUpvoteResponse,
} from "@/lib/api/types";

/**
 * Login uses OAuth2PasswordRequestForm (form-encoded), not JSON — the rest
 * of the API is JSON, so this one call bypasses apiRequest's JSON body.
 */
export async function login(email: string, password: string): Promise<Token> {
  const body = new URLSearchParams({ username: email, password });
  const response = await fetch(buildApiUrl("/api/v1/auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) {
    let detail = response.statusText || `HTTP ${response.status}`;
    try {
      const data = await response.json();
      detail = data.detail ?? data.message ?? detail;
    } catch {
      // response body wasn't JSON
    }
    throw new ApiError(response.status, detail);
  }
  return response.json() as Promise<Token>;
}

export function logout(token: string): Promise<{ detail: string }> {
  return apiRequest("/api/v1/auth/logout", { method: "POST", token });
}

export function getMe(token: string): Promise<User> {
  return apiRequest("/api/v1/auth/me", { token });
}

export function getFullProfile(token: string): Promise<FullProfileResponse> {
  return apiRequest("/api/v1/users/me/profile", { token });
}

export function updateOwnProfile(token: string, payload: UserUpdatePayload): Promise<User> {
  return apiRequest("/api/v1/users/me", { method: "PATCH", token, body: payload });
}

export function changePassword(token: string, payload: PasswordChangePayload): Promise<{ detail: string }> {
  return apiRequest("/api/v1/users/me/change-password", { method: "POST", token, body: payload });
}

export interface ForgotPasswordResponse {
  detail: string;
  reset_token: string;
  email: string;
  full_name: string;
  phone_number?: string | null;
  title?: string | null;
  bio?: string | null;
  linkedin_url?: string | null;
  github_url?: string | null;
  portfolio_url?: string | null;
}

export function forgotPassword(email: string): Promise<ForgotPasswordResponse> {
  return apiRequest("/api/v1/auth/forgot-password", {
    method: "POST",
    body: { email },
  });
}

export interface ResetPasswordPayload {
  token: string;
  new_password: string;
  full_name?: string;
  phone_number?: string;
  title?: string;
  bio?: string;
  linkedin_url?: string;
  github_url?: string;
  portfolio_url?: string;
}

export function resetPassword(payload: ResetPasswordPayload): Promise<{ detail: string; email?: string; full_name?: string }> {
  return apiRequest("/api/v1/auth/reset-password", {
    method: "POST",
    body: payload,
  });
}

export function adminResetUserPassword(
  token: string,
  userId: number,
  payload: { new_password: string; must_change_password?: boolean }
): Promise<{ detail: string; user_id: number; must_change_password: boolean }> {
  return apiRequest(`/api/v1/users/${userId}/reset-password`, {
    method: "POST",
    token,
    body: {
      new_password: payload.new_password,
      must_change_password: payload.must_change_password ?? true,
    },
  });
}

export function listOrganizations(token: string): Promise<Organization[]> {
  return apiRequest("/api/v1/organizations", { token });
}

export function getOrganization(token: string, organizationId: number): Promise<Organization> {
  return apiRequest(`/api/v1/organizations/${organizationId}`, { token });
}

export function createOrganization(
  token: string,
  payload: {
    name: string;
    slug: string;
    code: string;
    primary_domain?: string | null;
    lms_domain?: string | null;
    status?: string;
    brand_config?: Record<string, unknown>;
  }
): Promise<Organization> {
  return apiRequest("/api/v1/organizations", { method: "POST", token, body: payload });
}

export function updateOrganization(
  token: string,
  organizationId: number,
  payload: {
    name?: string;
    slug?: string;
    code?: string;
    primary_domain?: string | null;
    lms_domain?: string | null;
    status?: string;
    brand_config?: Record<string, unknown>;
  }
): Promise<Organization> {
  return apiRequest(`/api/v1/organizations/${organizationId}`, { method: "PATCH", token, body: payload });
}

export function listEnrollments(token: string): Promise<Enrollment[]> {
  return apiRequest("/api/v1/enrollments", { token });
}

export function listPrograms(token: string, organizationId?: number): Promise<Program[]> {
  const query = organizationId !== undefined ? `?organization_id=${organizationId}` : "";
  return apiRequest(`/api/v1/programs${query}`, { token });
}

export function getProgram(token: string, programId: number): Promise<Program> {
  return apiRequest(`/api/v1/programs/${programId}`, { token });
}

export function createProgram(
  token: string,
  payload: { organization_id: number; name: string; code: string; description?: string }
): Promise<Program> {
  return apiRequest("/api/v1/programs", { method: "POST", token, body: payload });
}

// PATCH /api/v1/programs/{id} (backend/app/api/v1/endpoints/programs.py) has
// existed since the Program/Cohort foundation but had no frontend caller
// until the 2026-09-28 audit — added here so the admin UI can actually use
// it instead of only being reachable via direct API calls.
export function updateProgram(
  token: string,
  programId: number,
  payload: { name?: string; description?: string | null; status?: string }
): Promise<Program> {
  return apiRequest(`/api/v1/programs/${programId}`, { method: "PATCH", token, body: payload });
}

export function listCohorts(token: string, programId?: number): Promise<Cohort[]> {
  const query = programId !== undefined ? `?program_id=${programId}` : "";
  return apiRequest(`/api/v1/cohorts${query}`, { token });
}

export function createCohort(
  token: string,
  payload: {
    program_id: number;
    organization_id: number;
    name: string;
    code: string;
    start_date: string;
    end_date?: string;
  }
): Promise<Cohort> {
  return apiRequest("/api/v1/cohorts", { method: "POST", token, body: payload });
}

// PATCH /api/v1/cohorts/{id} — same gap/fix as updateProgram above.
export function updateCohort(
  token: string,
  cohortId: number,
  payload: { name?: string; code?: string; start_date?: string; end_date?: string | null; status?: string }
): Promise<Cohort> {
  return apiRequest(`/api/v1/cohorts/${cohortId}`, { method: "PATCH", token, body: payload });
}

export function bulkCreateUsers(
  token: string,
  payload: BulkUserCreatePayload
): Promise<BulkUserCreateResponse> {
  return apiRequest("/api/v1/users/bulk", { method: "POST", token, body: payload });
}

export function getCurriculum(token: string, programId: number): Promise<ProgramModule[]> {
  return apiRequest(`/api/v1/programs/${programId}/curriculum`, { token });
}

export function createProgramModule(
  token: string,
  programId: number,
  payload: { title: string; description?: string; order?: number }
): Promise<ProgramModule> {
  return apiRequest(`/api/v1/programs/${programId}/modules`, { method: "POST", token, body: payload });
}

export function createWeek(
  token: string,
  moduleId: number,
  payload: { title: string; week_number: number; order?: number }
): Promise<Week> {
  return apiRequest(`/api/v1/modules/${moduleId}/weeks`, { method: "POST", token, body: payload });
}

export function createLesson(
  token: string,
  weekId: number,
  payload: { title: string; description?: string; order?: number }
): Promise<Lesson> {
  return apiRequest(`/api/v1/weeks/${weekId}/lessons`, { method: "POST", token, body: payload });
}

export function createActivity(
  token: string,
  lessonId: number,
  payload: { title: string; activity_type: string; content?: Record<string, any>; order?: number }
): Promise<Activity> {
  return apiRequest(`/api/v1/lessons/${lessonId}/activities`, { method: "POST", token, body: payload });
}

export async function uploadFile(token: string, file: File): Promise<{ url: string }> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(buildApiUrl("/api/v1/uploads"), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (!response.ok) throw new Error("Upload failed");
  return response.json();
}

export async function uploadFileWithProgress(token: string, file: File, onProgress: (pct: number) => void): Promise<{ url: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", buildApiUrl("/api/v1/uploads"));
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const pct = Math.round((event.loaded / event.total) * 100);
        onProgress(pct);
      }
    };
    
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        reject(new Error("Upload failed"));
      }
    };
    
    xhr.onerror = () => reject(new Error("Network error during upload"));
    
    const formData = new FormData();
    formData.append("file", file);
    xhr.send(formData);
  });
}

export interface ResourceDocument {
  id: number | string;
  document_id?: number;
  activity_id?: number;
  program_id: number;
  program_name: string;
  program_code: string;
  title: string;
  file_url: string;
  use_for_quiz: boolean;
  source: "PROGRAM_DOCUMENT" | "CURRICULUM_ACTIVITY";
  created_at?: string | null;
  updated_at?: string | null;
}

export function getAllProgramDocuments(token: string, organizationId?: number): Promise<ResourceDocument[]> {
  const query = organizationId ? `?organization_id=${organizationId}` : "";
  return apiRequest<ResourceDocument[]>(`/api/v1/programs/documents/all${query}`, { token });
}

export async function uploadProgramDocument(
  token: string,
  programId: number,
  title: string,
  file: File,
  useForQuiz: boolean = true
): Promise<any> {
  const formData = new FormData();
  formData.append("title", title);
  formData.append("use_for_quiz", String(useForQuiz));
  formData.append("file", file);

  const response = await fetch(buildApiUrl(`/api/v1/programs/${programId}/documents`), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || "Failed to upload document");
  }

  return response.json();
}

export function deleteProgramDocument(token: string, documentId: number): Promise<void> {
  return apiRequest<void>(`/api/v1/programs/documents/${documentId}`, {
    method: "DELETE",
    token,
  });
}

export function updateProgramDocument(
  token: string,
  documentId: number,
  payload: { title?: string; use_for_quiz?: boolean }
): Promise<any> {
  return apiRequest(`/api/v1/programs/documents/${documentId}`, {
    method: "PATCH",
    token,
    body: payload,
  });
}

export function createUser(
  token: string,
  payload: {
    email: string;
    full_name: string;
    password: string;
    phone_number?: string | null;
    bio?: string | null;
    title?: string | null;
    avatar_url?: string | null;
    organization_id: number;
    role_names: string[];
  }
): Promise<User> {
  return apiRequest("/api/v1/users", { method: "POST", token, body: payload });
}

export function updateUser(
  token: string,
  userId: number,
  payload: {
    full_name?: string;
    phone_number?: string | null;
    bio?: string | null;
    title?: string | null;
    avatar_url?: string | null;
    is_active?: boolean;
  }
): Promise<User> {
  return apiRequest(`/api/v1/users/${userId}`, { method: "PATCH", token, body: payload });
}

export function assignUserOrganization(
  token: string,
  userId: number,
  payload: { organization_id: number; role_names: string[] }
): Promise<User> {
  return apiRequest(`/api/v1/users/${userId}/organizations`, { method: "POST", token, body: payload });
}

export function removeUserOrganization(
  token: string,
  userId: number,
  organizationId: number
): Promise<User> {
  return apiRequest(`/api/v1/users/${userId}/organizations/${organizationId}`, { method: "DELETE", token });
}

export function deleteUser(token: string, userId: number): Promise<void> {
  return apiRequest(`/api/v1/users/${userId}`, { method: "DELETE", token });
}

export function dismissPasswordPrompt(token: string): Promise<{ detail: string }> {
  return apiRequest("/api/v1/users/me/dismiss-password-prompt", { method: "POST", token });
}

export function deleteProgram(token: string, programId: number): Promise<void> {
  return apiRequest(`/api/v1/programs/${programId}`, { method: "DELETE", token });
}

export function deleteCohort(token: string, cohortId: number): Promise<void> {
  return apiRequest(`/api/v1/cohorts/${cohortId}`, { method: "DELETE", token });
}

export function updateProgramModule(token: string, moduleId: number, payload: any) {
  return apiRequest(`/api/v1/modules/${moduleId}`, { method: 'PUT', token, body: payload });
}
export function deleteProgramModule(token: string, moduleId: number) {
  return apiRequest(`/api/v1/modules/${moduleId}`, { method: 'DELETE', token });
}

export function updateWeek(token: string, weekId: number, payload: any) {
  return apiRequest(`/api/v1/weeks/${weekId}`, { method: 'PUT', token, body: payload });
}
export function deleteWeek(token: string, weekId: number) {
  return apiRequest(`/api/v1/weeks/${weekId}`, { method: 'DELETE', token });
}

export function updateLesson(token: string, lessonId: number, payload: any) {
  return apiRequest(`/api/v1/lessons/${lessonId}`, { method: 'PUT', token, body: payload });
}
export function deleteLesson(token: string, lessonId: number) {
  return apiRequest(`/api/v1/lessons/${lessonId}`, { method: 'DELETE', token });
}

export function updateActivity(token: string, activityId: number, payload: any) {
  return apiRequest(`/api/v1/activities/${activityId}`, { method: 'PUT', token, body: payload });
}
export function deleteActivity(token: string, activityId: number) {
  return apiRequest(`/api/v1/activities/${activityId}`, { method: 'DELETE', token });
}

export function getCohortAchievements(
  token: string,
  cohortId?: number
): Promise<CohortAchievementsResponse> {
  const query = cohortId ? `?cohort_id=${cohortId}` : "";
  return apiRequest(`/api/v1/progress/cohort-achievements${query}`, { token });
}

export function compareCohortPeer(
  token: string,
  peerStudentId: number,
  cohortId: number
): Promise<PeerComparisonResponse> {
  return apiRequest(
    `/api/v1/progress/cohort-achievements/compare/${peerStudentId}?cohort_id=${cohortId}`,
    { token }
  );
}

export interface StudentNavCounts {
  pending_assignments: number;
  unattempted_quizzes: number;
  is_live_now: boolean;
  has_upcoming_live_today: boolean;
  upcoming_live_count: number;
  active_session_title?: string | null;
}

export function getStudentNavCounts(token: string): Promise<StudentNavCounts> {
  return apiRequest<StudentNavCounts>("/api/v1/students/me/nav-counts", { token });
}

export interface LiveStatusSession {
  id: number;
  title: string;
  start_time: string;
  end_time: string;
}

export interface LiveStatusResponse {
  is_live_now: boolean;
  live_today: number;
  active_count: number;
  active_title?: string | null;
  sessions?: LiveStatusSession[];
}

export function getLiveStatus(token: string): Promise<LiveStatusResponse> {
  return apiRequest<LiveStatusResponse>("/api/v1/curriculum/live-status", { token });
}

export function getStudentStreak(token: string): Promise<StreakInfo> {
  return apiRequest(`/api/v1/progress/streak`, { token });
}

export function recordStreakHeartbeat(token: string): Promise<StreakActionResponse> {
  return apiRequest(`/api/v1/progress/streak/heartbeat`, {
    method: "POST",
    token,
  });
}

export function performStreakSave(token: string): Promise<StreakActionResponse> {
  return apiRequest(`/api/v1/progress/streak/use-save`, {
    method: "POST",
    token,
  });
}

export function getAllAssignments(token: string, programId?: number): Promise<AssignmentItem[]> {
  const query = programId ? `?program_id=${programId}` : "";
  return apiRequest(`/api/v1/assignments${query}`, { token });
}

export function createAssignment(token: string, payload: AssignmentCreatePayload): Promise<AssignmentItem> {
  return apiRequest(`/api/v1/assignments`, {
    method: "POST",
    token,
    body: payload,
  });
}

export function deleteAssignment(token: string, activityId: number): Promise<void> {
  return apiRequest(`/api/v1/assignments/${activityId}`, {
    method: "DELETE",
    token,
  });
}

export function getAssignmentSubmissions(token: string, activityId: number): Promise<AssignmentSubmissionItem[]> {
  return apiRequest(`/api/v1/assignments/${activityId}/submissions`, { token });
}

export function gradeSubmission(
  token: string,
  submissionId: number,
  payload: SubmissionGradePayload
): Promise<{ success: boolean; message: string; submission_id: number; status: string }> {
  return apiRequest(`/api/v1/assignments/submissions/${submissionId}/grade`, {
    method: "POST",
    token,
    body: payload,
  });
}

export function getMyAssignments(token: string): Promise<StudentAssignmentItem[]> {
  return apiRequest(`/api/v1/assignments/my-assignments`, { token });
}

export async function submitAssignment(
  token: string,
  activityId: number,
  formData: FormData
): Promise<{ success: boolean; message: string; submission_id: number }> {
  const response = await fetch(buildApiUrl(`/api/v1/assignments/${activityId}/submit`), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });
  if (!response.ok) {
    let detail = response.statusText || `HTTP ${response.status}`;
    try {
      const data = await response.json();
      detail = data.detail ?? data.message ?? detail;
    } catch {
      // response body wasn't JSON
    }
    throw new ApiError(response.status, detail);
  }
  return response.json();
}

export function listNotifications(
  token: string,
  unreadOnly = false,
  limit = 30
): Promise<NotificationListResponse> {
  return apiRequest(`/api/v1/notifications?unread_only=${unreadOnly}&limit=${limit}`, { token });
}

export function markNotificationAsRead(token: string, notificationId: number): Promise<NotificationItem> {
  return apiRequest(`/api/v1/notifications/${notificationId}/read`, { method: "PATCH", token });
}

export function markAllNotificationsAsRead(token: string): Promise<{ marked_read_count: number }> {
  return apiRequest("/api/v1/notifications/mark-all-read", { method: "POST", token });
}

export function deleteNotification(token: string, notificationId: number): Promise<void> {
  return apiRequest(`/api/v1/notifications/${notificationId}`, { method: "DELETE", token });
}

export function listDiscussions(
  token: string,
  params?: { tag?: string; solved?: boolean; program_id?: number; organization_id?: number; search?: string }
): Promise<DiscussionThreadItem[]> {
  const query = new URLSearchParams();
  if (params?.tag && params.tag !== "All") query.set("tag", params.tag);
  if (params?.solved !== undefined) query.set("solved", String(params.solved));
  if (params?.program_id !== undefined) query.set("program_id", String(params.program_id));
  if (params?.organization_id !== undefined) query.set("organization_id", String(params.organization_id));
  if (params?.search) query.set("search", params.search);
  const qs = query.toString();
  return apiRequest(`/api/v1/discussions${qs ? `?${qs}` : ""}`, { token });
}

export function getDiscussion(token: string, threadId: number): Promise<DiscussionThreadItem> {
  return apiRequest(`/api/v1/discussions/${threadId}`, { token });
}

export function createDiscussion(
  token: string,
  payload: DiscussionThreadCreatePayload
): Promise<DiscussionThreadItem> {
  return apiRequest("/api/v1/discussions", {
    method: "POST",
    body: payload,
    token,
  });
}

export function addDiscussionReply(
  token: string,
  threadId: number,
  content: string
): Promise<DiscussionReplyItem> {
  return apiRequest(`/api/v1/discussions/${threadId}/replies`, {
    method: "POST",
    body: { content },
    token,
  });
}

export function toggleDiscussionUpvote(
  token: string,
  threadId: number
): Promise<DiscussionUpvoteResponse> {
  return apiRequest(`/api/v1/discussions/${threadId}/upvote`, {
    method: "POST",
    token,
  });
}

export function toggleReplyVerified(
  token: string,
  replyId: number
): Promise<DiscussionReplyItem> {
  return apiRequest(`/api/v1/discussions/replies/${replyId}/verify`, {
    method: "PUT",
    token,
  });
}

export function deleteDiscussion(
  token: string,
  threadId: number
): Promise<void> {
  return apiRequest(`/api/v1/discussions/${threadId}`, {
    method: "DELETE",
    token,
  });
}

export function deleteDiscussionReply(
  token: string,
  replyId: number
): Promise<void> {
  return apiRequest(`/api/v1/discussions/replies/${replyId}`, {
    method: "DELETE",
    token,
  });
}





