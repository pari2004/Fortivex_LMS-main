import { RequireAuth } from "@/components/auth/RequireAuth";
import { INSTRUCTOR_ROLES, PROGRAM_COHORT_ADMIN_ROLES } from "@/lib/auth/roles";
import { LiveSessions } from "@/components/live/LiveSessions";

export default function InstructorLiveSessionsPage() {
  return (
    <RequireAuth allowedRoles={[...INSTRUCTOR_ROLES, ...PROGRAM_COHORT_ADMIN_ROLES]}>
      <LiveSessions role="INSTRUCTOR" />
    </RequireAuth>
  );
}
