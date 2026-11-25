"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { listCohorts } from "@/lib/api/endpoints";
import { ApiError } from "@/lib/api/client";
import type { Cohort } from "@/lib/api/types";

const globalCohortsCache: Record<string, Cohort[]> = {};

/** Same scoping rule as usePrograms — see backend/app/api/v1/endpoints/cohorts.py. */
export function useCohorts(programId?: number) {
  const { token } = useAuth();
  const cacheKey = programId ? `prog_${programId}` : "all";
  const [cohorts, setCohorts] = useState<Cohort[] | null>(globalCohortsCache[cacheKey] || null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    listCohorts(token, programId)
      .then((data) => {
        if (!cancelled) {
          globalCohortsCache[cacheKey] = data;
          setCohorts(data);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setCohorts(null);
          setError(err instanceof ApiError ? err.message : "Unable to load cohorts.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token, programId, reloadKey, cacheKey]);

  return { cohorts, error, reload };
}
