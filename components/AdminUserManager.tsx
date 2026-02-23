"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { searchUsers, updateUserRole, UserSearchResult } from "@/services/video.service";

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  ROLE_ADMIN:  { label: "Child Admin", color: "text-orange-400 bg-orange-500/10 border-orange-500/30" },
  ROLE_USER:   { label: "User",        color: "text-gray-400 bg-gray-800 border-gray-700" },
  ROLE_PARENT_ADMIN: { label: "Parent Admin", color: "text-amber-300 bg-amber-500/10 border-amber-400/30" },
};

function RoleBadge({ role }: { role: string }) {
  const info = ROLE_LABELS[role] ?? { label: role, color: "text-gray-400 bg-gray-800 border-gray-700" };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${info.color}`}>
      {info.label}
    </span>
  );
}

export default function AdminUserManager() {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<UserSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState<number | null>(null);
  const [error, setError] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const load = useCallback(async (q?: string) => {
    setLoading(true);
    setError("");
    try {
      const results = await searchUsers(q);
      setUsers(results);
    } catch (err: unknown) {
      // Surface the actual HTTP status so it's easier to diagnose
      const axiosErr = err as { response?: { status: number; data?: { error?: string } } };
      const status = axiosErr?.response?.status;
      const msg = axiosErr?.response?.data?.error;
      if (status === 403) {
        setError("Access denied (403). Make sure you are logged in as the parent admin.");
      } else if (status === 404) {
        setError("Endpoint not found (404). The backend may still be deploying — please wait a minute and retry.");
      } else if (status) {
        setError(`Server error (${status})${msg ? `: ${msg}` : ""}. Check Railway logs.`);
      } else {
        setError("Network error — backend may be starting up. Please retry in a moment.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load: show current child admins
  useEffect(() => { load(); }, [load]);

  // Debounced search
  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (query.length === 0) {
      load();
      return;
    }
    if (query.length < 2) return;
    debounceRef.current = setTimeout(() => load(query), 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, load]);

  const handleRoleToggle = async (user: UserSearchResult) => {
    const newRole = user.role === "ROLE_ADMIN" ? "ROLE_USER" : "ROLE_ADMIN";
    setUpdating(user.id);
    try {
      const updated = await updateUserRole(user.id, newRole);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    } catch {
      setError("Failed to update role. Please try again.");
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-base font-semibold text-white">User Management</h2>
        <p className="text-xs text-gray-500 mt-1">
          Assign or revoke the Child Admin role. Child admins can edit lectures and approve transcripts (Level 1).
        </p>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-xl px-3 py-2.5">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or email…"
          className="flex-1 bg-transparent text-sm text-gray-200 placeholder-gray-600 outline-none"
        />
        {query && (
          <button onClick={() => setQuery("")} className="text-gray-600 hover:text-gray-400">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        )}
      </div>

      {/* Section label */}
      <p className="text-xs text-gray-600 uppercase tracking-wide">
        {query.length >= 2 ? `Results for "${query}"` : "Current child admins"}
      </p>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
          <div className="flex-1">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
          <button
            onClick={() => load(query.length >= 2 ? query : undefined)}
            className="flex-shrink-0 text-xs text-red-400 hover:text-red-200 border border-red-500/30 rounded-lg px-2.5 py-1 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* User list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-7 h-7 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-12 text-gray-600">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-10 h-10 mx-auto mb-3">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
          </svg>
          <p className="text-sm">
            {query.length >= 2 ? "No users found. Try a different search." : "No child admins assigned yet."}
          </p>
          {query.length >= 2 && (
            <p className="text-xs mt-1 text-gray-700">The user must have registered in the app first.</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {users.map((user) => (
            <div
              key={user.id}
              className="flex items-center gap-3 p-3 rounded-xl bg-gray-900 border border-gray-800 hover:border-gray-700 transition-colors"
            >
              {/* Avatar */}
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.name} className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-medium text-gray-400">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-100 truncate">{user.name}</p>
                <p className="text-xs text-gray-500 truncate">{user.email}</p>
              </div>

              {/* Role badge */}
              <RoleBadge role={user.role} />

              {/* Action button — don't show for parent admin */}
              {user.role !== "ROLE_PARENT_ADMIN" && (
                <button
                  onClick={() => handleRoleToggle(user)}
                  disabled={updating === user.id}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50 ${
                    user.role === "ROLE_ADMIN"
                      ? "border-red-500/40 text-red-400 hover:bg-red-500/10"
                      : "border-orange-500/40 text-orange-400 hover:bg-orange-500/10"
                  }`}
                >
                  {updating === user.id ? (
                    <div className="w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin" />
                  ) : user.role === "ROLE_ADMIN" ? (
                    "Revoke"
                  ) : (
                    "Make Admin"
                  )}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
