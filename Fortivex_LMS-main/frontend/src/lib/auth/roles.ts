// Mirrors the role sets backend/app/api/v1/endpoints/programs.py and
// cohorts.py pass to require_roles(...) for the write endpoints these
// admin pages call. Keep in sync by hand, same as src/lib/api/types.ts.
export const PROGRAM_COHORT_ADMIN_ROLES = ["SUPER_ADMIN", "ACADEMIC_ADMIN", "PROGRAM_MANAGER"];
export const INSTRUCTOR_ROLES = [
  "TRAINER",
  "INSTRUCTOR",
  "MENTOR",
  "LEAD_TRAINER",
  "PROGRAM_DIRECTOR",
  "TEACHING_ASSISTANT"
];

export const ROLE_REDIRECTS: Record<string, string> = {
  SUPER_ADMIN: "/admin",
  ACADEMIC_ADMIN: "/admin",
  PROGRAM_MANAGER: "/admin",
  INSTRUCTOR: "/instructor",
  TRAINER: "/instructor",
  MENTOR: "/instructor",
  LEAD_TRAINER: "/instructor",
  PROGRAM_DIRECTOR: "/instructor",
  TEACHING_ASSISTANT: "/instructor",
  STUDENT: "/student",
};
