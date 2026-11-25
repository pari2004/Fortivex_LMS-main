"use client";

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";

export function RequireAuth({
  children,
  allowedRoles,
}: {
  children: ReactNode;
  /** Role names permitted to view this page (e.g. ["SUPER_ADMIN",
   * "ACADEMIC_ADMIN"]). Omit to only require login, no role check — the
   * pre-2026-09-28 behavior. Checked against `user.roles`
   * (backend/app/schemas/user.py), the same set `require_roles` enforces
   * server-side, so this only ever hides UI a call would 403 on anyway. */
  allowedRoles?: string[];
}) {
  const { status, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    } else if (status === "authenticated" && user?.must_change_password) {
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/change-password")) {
        router.replace("/change-password");
      }
    }
  }, [status, user, router]);

  if (status === "loading" || status === "unauthenticated") {
    return <LoadingState message="Checking your session…" variant="spinner" />;
  }

  if (allowedRoles && !allowedRoles.some((role) => user?.roles.includes(role))) {
    return <ErrorState message="You don't have access to this page." />;
  }

  return <>{children}</>;
}
