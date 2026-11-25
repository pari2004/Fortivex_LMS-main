"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { listEnrollments } from "@/lib/api/endpoints";
import { ApiError } from "@/lib/api/client";
import type { Enrollment } from "@/lib/api/types";

/**
 * Enrollments scoped to the caller by the backend (own enrollments for a
 * STUDENT-role user, org-wide for staff roles — see
 * backend/app/api/v1/endpoints/enrollments.py).
 */
export function useEnrollments() {
  const { token } = useAuth();
  const [enrollments, setEnrollments] = useState<Enrollment[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    listEnrollments(token)
      .then((data) => {
        if (!cancelled) {
          setEnrollments(data);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setEnrollments(null);
          setError(err instanceof ApiError ? err.message : "Unable to load enrollments.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return { enrollments, error };
}
