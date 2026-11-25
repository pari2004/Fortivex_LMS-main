import { useState, useEffect, useCallback } from "react";
import { apiRequest } from "./client";

export function useProgress(token: string | null, programId: number) {
  const [completedActivityIds, setCompletedActivityIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProgress = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiRequest<{ completed_activity_ids: number[] }>(`/api/v1/progress/${programId}`, { token });
      setCompletedActivityIds(data.completed_activity_ids);
    } catch (err) {
      console.error("Failed to fetch progress", err);
    } finally {
      setLoading(false);
    }
  }, [token, programId]);

  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

  const markComplete = async (activityId: number) => {
    if (!token) return;
    try {
      await apiRequest(`/api/v1/progress/${activityId}`, { method: "POST", token });
      setCompletedActivityIds(prev => [...new Set([...prev, activityId])]);
    } catch (err) {
      console.error("Failed to mark complete", err);
    }
  };

  return { completedActivityIds, markComplete, reload: fetchProgress, loading };
}
