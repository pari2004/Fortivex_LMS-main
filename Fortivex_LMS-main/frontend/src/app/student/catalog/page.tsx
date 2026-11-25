"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoadingState } from "@/components/ui/LoadingState";

export default function CatalogRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/student/courses");
  }, [router]);

  return <LoadingState message="Redirecting to My Courses..." />;
}
