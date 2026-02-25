"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  searchUsers,
  updateUserRole,
  getProofreaders,
  getAllLocales,
  setUserLocales,
  createLocale,
  deleteLocale,
  UserSearchResult,
  LocaleInfo,
} from "@/services/video.service";

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  ROLE_ADMIN:        { label: "Child Admin",  color: "text-orange-400 bg-orange-500/10 border-orange-500/30" },
  ROLE_PROOFREADER:  { label: "Proofreader",  color: "text-blue-400 bg-blue-500/10 border-blue-500/30" },
  ROLE_USER:         { label: "User",          color: "text-gray-400 bg-gray-800 border-gray-700" },
  ROLE_PARENT_ADMIN: { label: "Parent Admin",  color: "text-amber-300 bg-amber-500/10 border-amber-400/30" },
};

function RoleBadge({ role }: { role: string }) {
  const info = ROLE_LABELS[role] ?? { label: role, color: "text-gray-400 bg-gray-800 border-gray-700" };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${info.color}`}>
      {info.label}
    </span>
  );
}

function LocaleBadge({ locale }: { locale: LocaleInfo }) {
  return (
    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium border border-purple-500/30 bg-purple-500/10 text-purple-400">
      {locale.name}
    </span>
  );
}

type ViewMode = "admins" | "proofreaders";

export default function AdminUserManager() {
  const [view, setView] = useState<ViewMode>("admins");
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<UserSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<{ id: number; role: string } | null>(null);
  const [error, setError] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Locale state
  const [allLocales, setAllLocales] = useState<LocaleInfo[]>([]);
  const [localeFilter, setLocaleFilter] = useState<string>(""); // locale code filter for proofreaders
  const [localeEditUserId, setLocaleEditUserId] = useState<number | null>(null);
  const [localeEditSelection, setLocaleEditSelection] = useState<number[]>([]);
  const [localeEditSaving, setLocaleEditSaving] = useState(false);

  // Language management state
  const [showLangMgmt, setShowLangMgmt] = useState(false);
  const [newLangCode, setNewLangCode] = useState("");
  const [newLangName, setNewLangName] = useState("");
  const [langMgmtLoading, setLangMgmtLoading] = useState(false);
  const [langMgmtError, setLangMgmtError] = useState("");

  // Load all locales on mount
  useEffect(() => {
    getAllLocales().then(setAllLocales).catch(() => {});
  }, []);

  const load = useCallback(async (q?: string, currentView: ViewMode = "admins", filterLocale?: string) => {
    setLoading(true);
    setError("");
    try {
      if (q && q.length >= 2) {
        const results = await searchUsers(q);
        setUsers(results);
      } else if (currentView === "proofreaders") {
        const results = await getProofreaders(filterLocale || undefined);
        setUsers(results);
      } else {
        const results = await searchUsers(undefined);
        setUsers(results);
      }
    } catch (err: unknown) {
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

  // Load when view changes or query is cleared
  useEffect(() => {
    if (query.length === 0) load(undefined, view, localeFilter);
  }, [load, view, query, localeFilter]);

  // Debounced search when query has 2+ chars
  useEffect(() => {
    if (query.length < 2) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(query, view, localeFilter), 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, load, view, localeFilter]);

  const handleRoleChange = async (user: UserSearchResult, newRole: string) => {
    setUpdating({ id: user.id, role: newRole });
    try {
      const updated = await updateUserRole(user.id, newRole);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    } catch {
      setError("Failed to update role. Please try again.");
    } finally {
      setUpdating(null);
    }
  };

  const openLocaleEdit = (user: UserSearchResult) => {
    setLocaleEditUserId(user.id);
    setLocaleEditSelection((user.locales ?? []).map((l) => l.id));
  };

  const saveLocaleEdit = async () => {
    if (localeEditUserId == null) return;
    setLocaleEditSaving(true);
    try {
      const updatedLocales = await setUserLocales(localeEditUserId, localeEditSelection);
      setUsers((prev) =>
        prev.map((u) =>
          u.id === localeEditUserId ? { ...u, locales: updatedLocales } : u
        )
      );
      setLocaleEditUserId(null);
    } catch {
      setError("Failed to save languages. Please try again.");
    } finally {
      setLocaleEditSaving(false);
    }
  };

  const toggleLocaleSelection = (localeId: number) => {
    setLocaleEditSelection((prev) =>
      prev.includes(localeId) ? prev.filter((id) => id !== localeId) : [...prev, localeId]
    );
  };

  const handleCreateLocale = async () => {
    if (!newLangCode.trim() || !newLangName.trim()) {
      setLangMgmtError("Both code and name are required.");
      return;
    }
    setLangMgmtLoading(true);
    setLangMgmtError("");
    try {
      const created = await createLocale(newLangCode.trim(), newLangName.trim());
      setAllLocales((prev) => [...prev, created]);
      setNewLangCode("");
      setNewLangName("");
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setLangMgmtError(axiosErr?.response?.data?.error ?? "Failed to create language.");
    } finally {
      setLangMgmtLoading(false);
    }
  };

  const handleDeleteLocale = async (id: number) => {
    setLangMgmtLoading(true);
    setLangMgmtError("");
    try {
      await deleteLocale(id);
      setAllLocales((prev) => prev.filter((l) => l.id !== id));
    } catch {
      setLangMgmtError("Failed to delete language.");
    } finally {
      setLangMgmtLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-base font-semibold text-white">User Management</h2>
        <p className="text-xs text-gray-500 mt-1">
          Assign Child Admin, Proofreader, or User roles.
        </p>
      </div>

      {/* View toggle */}
      <div className="flex gap-1 p-1 bg-gray-900 border border-gray-800 rounded-xl w-fit">
        <button
          onClick={() => { setView("admins"); setQuery(""); setLocaleFilter(""); }}
          className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            view === "admins"
              ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
              : "text-gray-500 hover:text-gray-300"
          }`}
        >
          Admins
        </button>
        <button
          onClick={() => { setView("proofreaders"); setQuery(""); }}
          className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            view === "proofreaders"
              ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
              : "text-gray-500 hover:text-gray-300"
          }`}
        >
          Proofreaders
        </button>
      </div>

      {/* Locale filter — only in proofreaders view */}
      {view === "proofreaders" && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Filter by language:</span>
          <select
            value={localeFilter}
            onChange={(e) => setLocaleFilter(e.target.value)}
            className="bg-gray-900 border border-gray-700 rounded-lg text-xs text-gray-200 px-2.5 py-1.5 outline-none focus:border-blue-500/50"
          >
            <option value="">All languages</option>
            {allLocales.map((l) => (
              <option key={l.id} value={l.code}>{l.name}</option>
            ))}
          </select>
        </div>
      )}

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
        {query.length >= 2
          ? `Results for "${query}"`
          : view === "admins"
          ? "All users"
          : "Current proofreaders"}
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
            onClick={() => load(query.length >= 2 ? query : undefined, view, localeFilter)}
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
            {query.length >= 2
              ? "No users found. Try a different search."
              : view === "admins"
              ? "No users found."
              : "No proofreaders assigned yet."}
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
              className="rounded-xl bg-gray-900 border border-gray-800 hover:border-gray-700 transition-colors"
            >
              <div className="flex items-center gap-3 p-3">
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

                {/* Locale badges — for proofreaders */}
                {user.role === "ROLE_PROOFREADER" && (user.locales ?? []).length > 0 && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {(user.locales ?? []).map((l) => (
                      <LocaleBadge key={l.id} locale={l} />
                    ))}
                  </div>
                )}

                {/* Languages edit button — for proofreaders */}
                {user.role === "ROLE_PROOFREADER" && (
                  <button
                    onClick={() => openLocaleEdit(user)}
                    className="px-2 py-1 rounded-lg text-[11px] font-medium border border-purple-500/30 text-purple-400 hover:bg-purple-500/10 transition-colors flex-shrink-0"
                  >
                    Languages
                  </button>
                )}

                {/* Role badge */}
                <RoleBadge role={user.role} />

                {/* Action buttons — skip for parent admin */}
                {user.role !== "ROLE_PARENT_ADMIN" && (
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {user.role !== "ROLE_ADMIN" && (
                      <button
                        onClick={() => handleRoleChange(user, "ROLE_ADMIN")}
                        disabled={updating !== null}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-medium border border-orange-500/40 text-orange-400 hover:bg-orange-500/10 transition-colors disabled:opacity-50"
                      >
                        {updating?.id === user.id && updating.role === "ROLE_ADMIN" ? (
                          <div className="w-3.5 h-3.5 border border-orange-400 border-t-transparent rounded-full animate-spin" />
                        ) : "Admin"}
                      </button>
                    )}

                    {user.role !== "ROLE_PROOFREADER" && (
                      <button
                        onClick={() => handleRoleChange(user, "ROLE_PROOFREADER")}
                        disabled={updating !== null}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-medium border border-blue-500/40 text-blue-400 hover:bg-blue-500/10 transition-colors disabled:opacity-50"
                      >
                        {updating?.id === user.id && updating.role === "ROLE_PROOFREADER" ? (
                          <div className="w-3.5 h-3.5 border border-blue-400 border-t-transparent rounded-full animate-spin" />
                        ) : "Proofreader"}
                      </button>
                    )}

                    {(user.role === "ROLE_ADMIN" || user.role === "ROLE_PROOFREADER") && (
                      <button
                        onClick={() => handleRoleChange(user, "ROLE_USER")}
                        disabled={updating !== null}
                        className="px-2.5 py-1.5 rounded-lg text-xs border border-red-500/40 text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                      >
                        {updating?.id === user.id && updating.role === "ROLE_USER" ? (
                          <div className="w-3.5 h-3.5 border border-red-400 border-t-transparent rounded-full animate-spin" />
                        ) : "Revoke"}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Locale edit popover — inline below the user row */}
              {localeEditUserId === user.id && (
                <div className="border-t border-gray-800 px-3 py-3">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Assign languages</p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {allLocales.map((l) => (
                      <button
                        key={l.id}
                        onClick={() => toggleLocaleSelection(l.id)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                          localeEditSelection.includes(l.id)
                            ? "border-purple-500/50 bg-purple-500/20 text-purple-300"
                            : "border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600"
                        }`}
                      >
                        {l.name}
                      </button>
                    ))}
                    {allLocales.length === 0 && (
                      <p className="text-xs text-gray-600">No languages available. Add languages below.</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={saveLocaleEdit}
                      disabled={localeEditSaving}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium border border-purple-500/40 text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 transition-colors disabled:opacity-50"
                    >
                      {localeEditSaving ? (
                        <div className="w-3.5 h-3.5 border border-purple-400 border-t-transparent rounded-full animate-spin" />
                      ) : "Save"}
                    </button>
                    <button
                      onClick={() => setLocaleEditUserId(null)}
                      className="px-3 py-1.5 rounded-lg text-xs border border-gray-700 text-gray-400 hover:bg-gray-800 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Manage Languages section — proofreaders view */}
      {view === "proofreaders" && (
        <div className="border-t border-gray-800 pt-5 mt-5">
          <button
            onClick={() => setShowLangMgmt(!showLangMgmt)}
            className="flex items-center gap-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className={`w-4 h-4 transition-transform ${showLangMgmt ? "rotate-90" : ""}`}
            >
              <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z" clipRule="evenodd" />
            </svg>
            Manage Languages
          </button>

          {showLangMgmt && (
            <div className="mt-3 space-y-3">
              {langMgmtError && (
                <p className="text-red-400 text-xs">{langMgmtError}</p>
              )}

              {/* Existing languages */}
              <div className="space-y-1.5">
                {allLocales.map((l) => (
                  <div
                    key={l.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-gray-900 border border-gray-800"
                  >
                    <div>
                      <span className="text-sm text-gray-200">{l.name}</span>
                      <span className="text-xs text-gray-500 ml-2">({l.code})</span>
                    </div>
                    <button
                      onClick={() => handleDeleteLocale(l.id)}
                      disabled={langMgmtLoading}
                      className="text-xs text-red-400 border border-red-500/30 px-2 py-1 rounded-lg hover:bg-red-500/10 transition-colors disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                ))}
                {allLocales.length === 0 && (
                  <p className="text-xs text-gray-600 py-2">No languages configured yet.</p>
                )}
              </div>

              {/* Add language form */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newLangCode}
                  onChange={(e) => setNewLangCode(e.target.value)}
                  placeholder="Code (e.g. bn)"
                  className="w-24 bg-gray-900 border border-gray-700 rounded-lg text-xs text-gray-200 px-2.5 py-2 outline-none focus:border-purple-500/50 placeholder-gray-600"
                />
                <input
                  type="text"
                  value={newLangName}
                  onChange={(e) => setNewLangName(e.target.value)}
                  placeholder="Name (e.g. Bengali)"
                  className="flex-1 bg-gray-900 border border-gray-700 rounded-lg text-xs text-gray-200 px-2.5 py-2 outline-none focus:border-purple-500/50 placeholder-gray-600"
                />
                <button
                  onClick={handleCreateLocale}
                  disabled={langMgmtLoading}
                  className="px-3 py-2 rounded-lg text-xs font-medium border border-purple-500/40 text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 transition-colors disabled:opacity-50"
                >
                  {langMgmtLoading ? (
                    <div className="w-3.5 h-3.5 border border-purple-400 border-t-transparent rounded-full animate-spin" />
                  ) : "Add"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
