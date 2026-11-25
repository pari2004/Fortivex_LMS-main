import { RequireAuth } from "@/components/auth/RequireAuth";
import { LiveSessions } from "@/components/live/LiveSessions";

export default function StudentLiveSessionsPage() {
  return (
    <RequireAuth allowedRoles={["STUDENT"]}>
      <LiveSessions role="STUDENT" />
    </RequireAuth>
  );
}
