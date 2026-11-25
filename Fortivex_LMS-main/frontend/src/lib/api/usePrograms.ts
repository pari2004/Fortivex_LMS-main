"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { listPrograms } from "@/lib/api/endpoints";
import { ApiError } from "@/lib/api/client";
import type { Program } from "@/lib/api/types";

/**
 * Programs scoped to the caller by the backend (org-wide for staff roles,
 * enrollment-only for STUDENT — see
 * backend/app/api/v1/endpoints/programs.py). organizationId is optional
 * extra server-side filtering, not a client-side trust boundary.
 */
const globalProgramsCache: Record<string, { data: Program[], timestamp: number }> = {};
const CACHE_TTL = 1000 * 60 * 5; // 5 minutes

export function usePrograms(organizationId?: number) {
  const { token } = useAuth();
  
  const cacheKey = organizationId ? `org_${organizationId}` : "all";
  const initialCache = globalProgramsCache[cacheKey]?.data || null;
  
  const [programs, setPrograms] = useState<Program[] | null>(initialCache);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    if (!token) return;
    
    const cached = globalProgramsCache[cacheKey];
    const isStale = !cached || (Date.now() - cached.timestamp > CACHE_TTL);
    
    // If we have a cache and we're not explicitly reloading, we can skip fetching if it's fresh.
    // However, it's safer to always fetch in the background to revalidate (SWR style).
    
    let cancelled = false;

    listPrograms(token, organizationId)
      .then((data) => {
        if (!cancelled) {
          globalProgramsCache[cacheKey] = { data, timestamp: Date.now() };
          setPrograms(data);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setPrograms(null);
          setError(err instanceof ApiError ? err.message : "Unable to load programs.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token, organizationId, reloadKey, cacheKey]);

  return { programs, error, reload };
}
