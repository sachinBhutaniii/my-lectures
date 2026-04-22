"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import apiClient from "@/lib/axios";

const BACKEND_URL = "https://bddsm-production.up.railway.app";
const TOKEN_KEY = "bdd_auth_token";
const PARENT_ADMIN_EMAIL = "dasgargamuni@gmail.com";

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  avatarUrl?: string;
  role: string;
  isProofreader?: boolean; // backend sets this when user has both admin + proofreader access
  joinedAt?: string; // YYYY-MM-DD — date of account creation (null for pre-existing users)
}

interface AuthContextType {
  token: string | null;
  user: AuthUser | null;
  authLoading: boolean;
  isAdmin: boolean;
  isParentAdmin: boolean;
  isProofreader: boolean;
  isTranscriptAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  loginWithGoogle: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Pre-fill localStorage profile with Google/backend user data (only empty fields).
  // If stored email belongs to a different user, clear the profile first.
  const syncProfileFromAuth = useCallback((authUser: AuthUser) => {
    try {
      const raw = localStorage.getItem("bdd_user_profile");
      const existing = raw ? JSON.parse(raw) : {};
      // Different user logged in — discard the previous profile
      const base = existing.email && existing.email !== authUser.email ? {} : existing;
      const updates: Record<string, unknown> = {};
      if (!base.legalName?.trim() && authUser.name)
        updates.legalName = authUser.name;
      if (!base.email?.trim() && authUser.email) {
        updates.email = authUser.email;
        updates.emailVerified = true;
      }
      if (!base.profilePicture?.trim() && authUser.avatarUrl)
        updates.profilePicture = authUser.avatarUrl;
      localStorage.setItem("bdd_user_profile", JSON.stringify({ ...base, ...updates }));
    } catch { /* ignore */ }
  }, []);

  const syncStreakFromBackend = useCallback(async (tkn: string) => {
    try {
      const res = await apiClient.get("/api/users/streak", {
        headers: { Authorization: `Bearer ${tkn}` },
      });
      const { streakDates, listenTime } = res.data as {
        streakDates: string[];
        listenTime: Record<string, number>;
      };

      // Merge server data into localStorage (union dates, max per-day seconds)
      const localDatesRaw = localStorage.getItem("bdd_streak_dates");
      const localTimeRaw = localStorage.getItem("bdd_daily_listen_time");
      const localDates: string[] = localDatesRaw ? JSON.parse(localDatesRaw) : [];
      const localTime: Record<string, number> = localTimeRaw ? JSON.parse(localTimeRaw) : {};

      const mergedDates = [...new Set([...localDates, ...(streakDates ?? [])])];
      const mergedTime: Record<string, number> = { ...localTime };
      for (const [day, secs] of Object.entries(listenTime ?? {})) {
        mergedTime[day] = Math.max(mergedTime[day] ?? 0, secs);
      }

      localStorage.setItem("bdd_streak_dates", JSON.stringify(mergedDates));
      localStorage.setItem("bdd_daily_listen_time", JSON.stringify(mergedTime));
      window.dispatchEvent(new Event("bdd-streak-synced"));
    } catch { /* non-critical — streak still works from localStorage */ }
  }, []);

  const fetchMe = useCallback(async (tkn: string) => {
    const res = await apiClient.get("/api/users/me", {
      headers: { Authorization: `Bearer ${tkn}` },
    });
    setUser(res.data);
    syncProfileFromAuth(res.data);
    syncStreakFromBackend(tkn);
  }, [syncProfileFromAuth, syncStreakFromBackend]);

  const handleFetchMe = useCallback(async (tkn: string) => {
    try {
      await fetchMe(tkn);
      setAuthLoading(false);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401 || status === 403) {
        // Token invalid/expired — clear session and let pages redirect to login
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
        setAuthLoading(false);
      }
      // On 5xx / network error (server redeploying): keep token, keep authLoading=true
      // so pages show the spinner. User can refresh once server is back up.
    }
  }, [fetchMe]);

  useEffect(() => {
    // Handle OAuth2 callback — backend redirects to /?token=<jwt>
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get("token");
    if (urlToken) {
      localStorage.setItem(TOKEN_KEY, urlToken);
      window.history.replaceState({}, "", window.location.pathname);
      setToken(urlToken);
      handleFetchMe(urlToken);
      return;
    }

    // Restore from localStorage
    const stored = localStorage.getItem(TOKEN_KEY);
    if (stored) {
      setToken(stored);
      handleFetchMe(stored);
    } else {
      setAuthLoading(false);
    }
  }, [handleFetchMe]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await apiClient.post("/api/auth/login", { email, password });
      const tkn: string = res.data.token;
      localStorage.setItem(TOKEN_KEY, tkn);
      setToken(tkn);
      await fetchMe(tkn);
    },
    [fetchMe]
  );

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      await apiClient.post("/api/auth/register", { name, email, password });
      await login(email, password);
    },
    [login]
  );

  // Redirects to Spring OAuth2 login — backend must have OAuth2 enabled
  const loginWithGoogle = useCallback(() => {
    window.location.href = `${BACKEND_URL}/oauth2/authorization/google`;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem("bdd_user_profile");
    window.dispatchEvent(new Event("bdd-logout"));
    setToken(null);
    setUser(null);
  }, []);

  const isParentAdmin = user?.email === PARENT_ADMIN_EMAIL;
  const isAdmin = isParentAdmin || user?.role === "ROLE_ADMIN";
  const isProofreader = user?.role === "ROLE_PROOFREADER" || user?.isProofreader === true;
  const isTranscriptAdmin = user?.role === "ROLE_TRANSCRIPT_ADMIN";

  return (
    <AuthContext.Provider
      value={{ token, user, authLoading, isAdmin, isParentAdmin, isProofreader, isTranscriptAdmin, login, register, loginWithGoogle, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
