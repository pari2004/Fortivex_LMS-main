"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { getMe, login as apiLogin, listOrganizations, logout as apiLogout } from "@/lib/api/endpoints";
import type { Organization, User } from "@/lib/api/types";
import { ApiError } from "@/lib/api/client";

const TOKEN_STORAGE_KEY = "fortivex_access_token";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: AuthStatus;
  token: string | null;
  user: User | null;
  organizations: Organization[];
  /** First active organization membership — today's dashboard has no
   * multi-org switcher yet, so this is "the" organization context. */
  organization: Organization | null;
  error: string | null;
  login: (email: string, password: string) => Promise<User | undefined>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [error, setError] = useState<string | null>(null);

  const hydrate = useCallback(async (activeToken: string) => {
    try {
      const [me, orgs] = await Promise.all([getMe(activeToken), listOrganizations(activeToken)]);
      setUser(me);
      setOrganizations(orgs);
      setToken(activeToken);
      setStatus("authenticated");
      return me;
    } catch (err) {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      setToken(null);
      setUser(null);
      setOrganizations([]);
      setStatus("unauthenticated");
      if (err instanceof ApiError && err.status !== 401) {
        setError(err.message);
      }
    }
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!stored) {
      // localStorage is only readable post-mount (SSR has no access to
      // it), so this status resolution has to happen in an effect, not a
      // lazy useState initializer, or the server/client render would
      // mismatch on hydration.

      setStatus("unauthenticated");
      return;
    }
    // Deferred to a microtask so the initial session check reads as
    // "subscribe, then setState in a callback" rather than a synchronous
    // setState-in-effect — satisfies react-hooks/set-state-in-effect.
    void Promise.resolve().then(() => hydrate(stored));
  }, [hydrate]);

  const login = useCallback(
    async (email: string, password: string) => {
      setError(null);
      const result = await apiLogin(email, password);
      localStorage.setItem(TOKEN_STORAGE_KEY, result.access_token);
      return await hydrate(result.access_token);
    },
    [hydrate]
  );

  const logout = useCallback(async () => {
    if (token) {
      try {
        await apiLogout(token);
      } catch {
        // Best-effort — token is discarded client-side regardless.
      }
    }
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken(null);
    setUser(null);
    setOrganizations([]);
    setStatus("unauthenticated");
  }, [token]);

  const refreshUser = useCallback(async () => {
    if (token) {
      await hydrate(token);
    }
  }, [token, hydrate]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      token,
      user,
      organizations,
      organization: organizations[0] ?? null,
      error,
      login,
      logout,
      refreshUser,
    }),
    [status, token, user, organizations, error, login, logout, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
