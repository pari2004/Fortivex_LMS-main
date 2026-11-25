"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { LoadingState } from "@/components/ui/LoadingState";
import { ROLE_REDIRECTS } from "@/lib/auth/roles";

export default function Home() {
  const router = useRouter();
  const { user, status } = useAuth();

  useEffect(() => {
    if (status === "loading") return;
    
    if (!user) {
      router.replace("/login");
      return;
    }

    // Find the appropriate dashboard based on the user's first role
    const primaryRole = user.roles[0];
    const destination = primaryRole ? ROLE_REDIRECTS[primaryRole] || "/student" : "/student";
    router.replace(destination);
    
  }, [user, status, router]);

  return (
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <LoadingState message="Redirecting..." variant="spinner" />
    </div>
  );
}
