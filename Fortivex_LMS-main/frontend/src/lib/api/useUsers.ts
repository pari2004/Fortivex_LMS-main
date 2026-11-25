import { useState, useEffect, useCallback } from "react";
import { User } from "./types";
import { apiRequest } from "./client";
import { useAuth } from "@/lib/auth/AuthContext";

const globalUsersCache: Record<string, User[]> = {};

export function useUsers(organizationId?: number) {
  const { token } = useAuth();
  const cacheKey = organizationId ? `org_${organizationId}` : "all";
  const [users, setUsers] = useState<User[] | null>(globalUsersCache[cacheKey] || null);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    if (!token) return;
    try {
      setError(null);
      const query = organizationId ? `?organization_id=${organizationId}` : "";
      const data = await apiRequest<User[]>(`/api/v1/users${query}`, { token });
      globalUsersCache[cacheKey] = data;
      setUsers(data);
    } catch (err: any) {
      setError(err.message || "Failed to fetch users.");
    }
  }, [token, organizationId, cacheKey]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  return { users, error, reload: fetchUsers };
}
