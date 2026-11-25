import { RequireAuth } from "@/components/auth/RequireAuth";
import { PROGRAM_COHORT_ADMIN_ROLES } from "@/lib/auth/roles";
import { LiveSessions } from "@/components/live/LiveSessions";

export default function AdminLiveSessionsPage() {
  return (
    <RequireAuth allowedRoles={PROGRAM_COHORT_ADMIN_ROLES}>
      <LiveSessions role="ADMIN" />
    </RequireAuth>
  );
}
