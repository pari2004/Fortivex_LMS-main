// Mirrors backend/app/schemas/*.py. Keep in sync by hand for now — there's
// no MVP-scope codegen step yet.

export interface UserOrganizationSummary {
  id: number;
  name: string;
  code: string;
  roles: string[];
}

export interface User {
  id: number;
  email: string;
  full_name: string;
  is_active: boolean;
  phone_number?: string | null;
  bio?: string | null;
  title?: string | null;
  avatar_url?: string | null;
  github_url?: string | null;
  linkedin_url?: string | null;
  portfolio_url?: string | null;
  roles: string[];
  organizations?: UserOrganizationSummary[];
  created_at?: string;
  must_change_password?: boolean;
}

export interface BulkUserItem {
  email: string;
  full_name: string;
  password?: string | null;
  phone_number?: string | null;
  title?: string | null;
  role_names?: string[];
}

export interface BulkUserCreatePayload {
  organization_id: number;
  default_password?: string;
  default_role_names?: string[];
  users: BulkUserItem[];
}

export interface BulkUserItemResult {
  email: string;
  full_name: string;
  status: "created" | "already_in_org" | "added_to_org" | "error";
  detail?: string | null;
  user_id?: number | null;
  temporary_password?: string | null;
}

export interface BulkUserCreateResponse {
  total_submitted: number;
  total_created: number;
  total_skipped: number;
  total_errors: number;
  results: BulkUserItemResult[];
}

export interface ProfileOrganizationInfo {
  id: number;
  name: string;
  slug: string;
  code: string;
  primary_domain: string | null;
  lms_domain: string | null;
  roles: string[];
}

export interface StudentProfileEnrollment {
  id: number;
  program_id: number;
  program_name: string;
  program_code: string;
  cohort_id: number | null;
  cohort_name: string | null;
  status: string;
  progress_percentage: number;
  enrolled_at: string | null;
}

export interface StudentProfileData {
  student_id: number;
  student_code: string;
  lifecycle_status: string;
  enrollments: StudentProfileEnrollment[];
  stats: {
    total_enrollments?: number;
    active_programs?: number;
    completed_activities?: number;
    hours_studied?: string;
    quiz_attempts?: number;
    average_quiz_score?: string;
    [key: string]: any;
  };
}

export interface InstructorCohortInfo {
  id: number;
  name: string;
  code: string;
  program_names: string[];
  student_count: number;
  status: string;
  start_date: string | null;
  end_date: string | null;
}

export interface InstructorProfileData {
  cohorts: InstructorCohortInfo[];
  stats: {
    assigned_cohorts?: number;
    total_students?: number;
    programs_available?: number;
    role?: string;
    [key: string]: any;
  };
}

export interface AdminProfileData {
  stats: {
    total_managed_users?: number;
    total_students?: number;
    total_programs?: number;
    total_cohorts?: number;
    scope?: string;
    [key: string]: any;
  };
}

export interface FullProfileResponse {
  user: User;
  organizations: ProfileOrganizationInfo[];
  student_profile: StudentProfileData | null;
  instructor_data: InstructorProfileData | null;
  admin_data: AdminProfileData | null;
}

export interface UserUpdatePayload {
  full_name?: string;
  phone_number?: string;
  bio?: string;
  title?: string;
  avatar_url?: string;
  github_url?: string;
  linkedin_url?: string;
  portfolio_url?: string;
}

export interface PasswordChangePayload {
  current_password: string;
  new_password: string;
}

export interface Student {
  id: number;
  user_id: number;
  organization_id: number;
  student_code: string;
  lifecycle_status: string;
}

export interface Organization {
  id: number;
  name: string;
  slug: string;
  code: string;
  status: string;
  primary_domain: string | null;
  lms_domain: string | null;
  brand_config: Record<string, unknown>;
  total_admins?: number;
  total_instructors?: number;
  total_students?: number;
  total_programs?: number;
}

export interface Program {
  id: number;
  organization_id: number;
  name: string;
  code: string;
  description: string | null;
  status: string;
}

export interface Cohort {
  id: number;
  program_ids: number[];
  organization_id: number;
  name: string;
  code: string;
  start_date: string;
  end_date: string | null;
  status: string;
}

export interface Enrollment {
  id: number;
  student_id: number;
  program_id: number;
  cohort_id: number | null;
  organization_id: number;
  status: string;
  program: Program;
  cohort: Cohort | null;
  created_at?: string;
}

export interface Token {
  access_token: string;
  token_type: string;
}

export interface Activity {
  id: number;
  lesson_id: number;
  title: string;
  activity_type: string;
  content: Record<string, any> | null;
  order: number;
}

export interface Lesson {
  id: number;
  week_id: number;
  title: string;
  description: string | null;
  order: number;
  activities: Activity[];
}

export interface Week {
  id: number;
  program_module_id: number;
  title: string;
  week_number: number;
  order: number;
  lessons: Lesson[];
}

export interface ProgramModule {
  id: number;
  program_id: number;
  title: string;
  description: string | null;
  order: number;
  weeks: Week[];
}

export interface BadgeProgress {
  current: number;
  target: number;
  unit: string;
  percentage: number;
}

export interface AchievementBadge {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  category: string;
  tier: "Bronze" | "Silver" | "Gold" | "Platinum" | string;
  xp_reward: number;
  unlocked: boolean;
  unlocked_at: string | null;
  progress: BadgeProgress;
}

export interface CohortBenchmark {
  cohort_size: number;
  avg_xp: number;
  avg_activities_completed: number;
  avg_quiz_score: number;
  student_percentile: string;
  top_cohort_xp: number;
}

export interface StreakDayStatus {
  date: string;
  day_name: string;
  status: "ACTIVE" | "SAVED" | "MISSED" | "TODAY_PENDING" | "TODAY_COMPLETED" | string;
}

export interface StreakInfo {
  current_streak: number;
  longest_streak: number;
  last_activity_date: string | null;
  is_active_today: boolean;
  streak_freeze_count: number;
  streak_freeze_replenishes_in_days: number;
  streak_freeze_used_this_week: boolean;
  total_freezes_used: number;
  last_freeze_used_date: string | null;
  streak_saved_recently: boolean;
  alert_message: string | null;
  history: StreakDayStatus[];
}

export interface StreakActionResponse {
  success: boolean;
  message: string;
  streak: StreakInfo;
}

export interface PeerLeaderboardItem {
  rank: number;
  student_id: number;
  user_id: number;
  name: string;
  title: string | null;
  avatar_url: string | null;
  is_current_student: boolean;
  total_xp: number;
  activities_completed: number;
  total_activities: number;
  quiz_average: number;
  quizzes_attempted: number;
  badges_count: number;
  current_streak?: number;
  top_badge_icons: { icon: string; color: string; title: string }[];
}

export interface StudentCohortSummary {
  cohort_id: number;
  cohort_name: string;
  cohort_code: string;
  program_id: number | null;
  program_name: string | null;
  organization_name: string | null;
}

export interface CurrentStudentStats {
  student_id: number;
  full_name: string;
  rank: number;
  total_xp: number;
  activities_completed: number;
  total_activities: number;
  completion_rate: number;
  quiz_average: number;
  quizzes_attempted: number;
  badges_unlocked: number;
  total_possible_badges: number;
  current_streak?: number;
  longest_streak?: number;
  streak_freeze_count?: number;
}

export interface CohortAchievementsResponse {
  has_cohort: boolean;
  student_cohorts: StudentCohortSummary[];
  active_cohort: StudentCohortSummary | null;
  current_student_stats: CurrentStudentStats | null;
  cohort_benchmarks: CohortBenchmark | null;
  badges: AchievementBadge[];
  leaderboard: PeerLeaderboardItem[];
  streak?: StreakInfo | null;
}

export interface PeerComparisonResponse {
  cohort_id: number;
  cohort_name: string;
  current_student: CurrentStudentStats;
  peer_student: CurrentStudentStats;
  peer_badges: AchievementBadge[];
}

export interface RubricItem {
  criterion: string;
  weight: string;
}

export interface AssignmentCreatePayload {
  title: string;
  program_id: number;
  lesson_id?: number | null;
  description: string;
  due_date?: string | null;
  points: number;
  rubric?: RubricItem[];
  submission_type?: string;
}

export interface AssignmentItem {
  id: number;
  title: string;
  program_id: number;
  program_name: string;
  module_title: string;
  week_title: string;
  lesson_id: number;
  lesson_title: string;
  description: string;
  due_date?: string | null;
  due_in_days?: number | null;
  points: number;
  rubric: RubricItem[];
  submission_type: string;
  submissions_count: number;
  graded_count: number;
  pending_count: number;
  created_at?: string | null;
}

export interface StudentAssignmentItem {
  id: number;
  title: string;
  program_id: number;
  program_name: string;
  lesson_id: number;
  lesson_title: string;
  description: string;
  due_date?: string | null;
  due_in_days: number;
  points: number;
  rubric: RubricItem[];
  submission_type: string;
  status: "pending" | "submitted" | "graded";
  submission_id?: number | null;
  submitted_at?: string | null;
  file_name?: string | null;
  file_url?: string | null;
  notes?: string | null;
  score?: number | null;
  instructorFeedback?: string | null;
}

export interface AssignmentSubmissionItem {
  id: number;
  student_id: number;
  student_name: string;
  student_email: string;
  student_code?: string | null;
  submitted_at: string;
  file_name?: string | null;
  file_url?: string | null;
  notes?: string | null;
  status: string;
  score?: number | null;
  feedback?: string | null;
  graded_at?: string | null;
  graded_by_name?: string | null;
}

export interface SubmissionGradePayload {
  score: number;
  feedback?: string;
}

export interface NotificationItem {
  id: number;
  user_id: number;
  organization_id?: number | null;
  title: string;
  message: string;
  type: string;
  link_url?: string | null;
  is_read: boolean;
  read_at?: string | null;
  created_at: string;
}

export interface NotificationListResponse {
  items: NotificationItem[];
  unread_count: number;
  total_count: number;
}

export interface DiscussionReplyItem {
  id: number;
  thread_id: number;
  author_id: number;
  author_name: string;
  author_role: "Instructor" | "TA" | "Student" | "Admin" | string;
  content: string;
  is_verified: boolean;
  created_at: string;
  time_ago: string;
}

export interface DiscussionThreadItem {
  id: number;
  organization_id: number;
  program_id?: number | null;
  program_name?: string | null;
  author_id: number;
  author_name: string;
  author_role: string;
  title: string;
  content: string;
  tags: string[];
  upvotes: number;
  is_upvoted: boolean;
  has_verified_answer: boolean;
  replies_count: number;
  created_at: string;
  time_ago: string;
  replies?: DiscussionReplyItem[];
}

export interface DiscussionThreadCreatePayload {
  title: string;
  content: string;
  program_id?: number | null;
  organization_id?: number | null;
  tags?: string[];
}

export interface DiscussionReplyCreatePayload {
  content: string;
}

export interface DiscussionUpvoteResponse {
  thread_id: number;
  is_upvoted: boolean;
  upvotes: number;
}

