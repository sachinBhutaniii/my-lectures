"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  searchUsers,
  updateUserRole,
  getProofreaders,
  getAllLocales,
  getAllTranscripts,
  setUserLocales,
  createLocale,
  deleteLocale,
  UserSearchResult,
  LocaleInfo,
  TranscriptReviewItem,
} from "@/services/video.service";
import {
  getAllVolunteerRequests,
  approveVolunteerRequest,
  rejectVolunteerRequest,
  getAllVolunteerServices,
  createVolunteerService,
  updateVolunteerService,
  deleteVolunteerService,
  getVolunteerConfig,
  updateVolunteerConfig,
  VolunteerRequestItem,
  VolunteerServiceItem,
} from "@/services/volunteer.service";

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

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function formatCountdown(dateStr: string): string {
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff <= 0) return "now";
  const h = Math.floor(diff / 3600000);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? "" : "s"}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function getAssignmentStatus(t: TranscriptReviewItem, level: 1 | 2): "In Progress" | "Submitted" | "Approved" | "Deployed" {
  if (t.deployed) return "Deployed";
  if (level === 1) {
    if (t.approvalStatus === "APPROVED" || t.approvalStatus === "LEVEL1_APPROVED") return "Approved";
    if (t.l1ReviewSubmitted) return "Submitted";
    return "In Progress";
  } else {
    if (t.approvalStatus === "APPROVED") return "Approved";
    if (t.l2ReviewSubmitted) return "Submitted";
    return "In Progress";
  }
}

function getProofreaderAssignments(userId: number, transcripts: TranscriptReviewItem[]) {
  const result: { transcript: TranscriptReviewItem; level: 1 | 2 }[] = [];
  for (const t of transcripts) {
    if (t.level1ProofreaderId === userId) result.push({ transcript: t, level: 1 });
    if (t.level2ProofreaderId === userId) result.push({ transcript: t, level: 2 });
  }
  return result;
}

function getActiveAssignmentCount(userId: number, transcripts: TranscriptReviewItem[]): number {
  return getProofreaderAssignments(userId, transcripts).filter(({ transcript: t, level }) => {
    const s = getAssignmentStatus(t, level);
    return s === "In Progress" || s === "Submitted";
  }).length;
}

const STATUS_STYLE: Record<string, string> = {
  "In Progress": "border-amber-500/40 bg-amber-500/10 text-amber-400",
  "Submitted":   "border-blue-500/40 bg-blue-500/10 text-blue-400",
  "Approved":    "border-green-500/40 bg-green-500/10 text-green-400",
  "Deployed":    "border-green-400/50 bg-green-400/15 text-green-300",
};

// ── Outer tab type ────────────────────────────────────────────────────────────

type OuterTab = "users" | "requests" | "services";
type UserViewMode = "admins" | "proofreaders";

export default function AdminUserManager() {
  const [outerTab, setOuterTab] = useState<OuterTab>("users");

  // ── Users tab state ──────────────────────────────────────────────────────
  const [view, setView] = useState<UserViewMode>("admins");
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<UserSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<{ id: number; role: string } | null>(null);
  const [error, setError] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const [allLocales, setAllLocales] = useState<LocaleInfo[]>([]);
  const [localeFilter, setLocaleFilter] = useState<string>("");
  const [localeEditUserId, setLocaleEditUserId] = useState<number | null>(null);
  const [localeEditSelection, setLocaleEditSelection] = useState<number[]>([]);
  const [localeEditSaving, setLocaleEditSaving] = useState(false);

  const [showLangMgmt, setShowLangMgmt] = useState(false);
  const [newLangCode, setNewLangCode] = useState("");
  const [newLangName, setNewLangName] = useState("");
  const [langMgmtLoading, setLangMgmtLoading] = useState(false);
  const [langMgmtError, setLangMgmtError] = useState("");

  // ── Proofreader assignment panel state ────────────────────────────────────
  const [allTranscripts, setAllTranscripts] = useState<TranscriptReviewItem[]>([]);
  const [transcriptsLoading, setTranscriptsLoading] = useState(false);
  const transcriptsLoadedRef = useRef(false);
  const [expandedProofreaderId, setExpandedProofreaderId] = useState<number | null>(null);

  useEffect(() => {
    getAllLocales().then(setAllLocales).catch(() => {});
  }, []);

  useEffect(() => {
    if (view === "proofreaders" && !transcriptsLoadedRef.current) {
      setTranscriptsLoading(true);
      getAllTranscripts()
        .then((t) => { setAllTranscripts(t); transcriptsLoadedRef.current = true; })
        .catch(() => {})
        .finally(() => setTranscriptsLoading(false));
    }
  }, [view]);

  const load = useCallback(async (q?: string, currentView: UserViewMode = "admins", filterLocale?: string) => {
    setLoading(true);
    setError("");
    try {
      if (q && q.length >= 2) {
        setUsers(await searchUsers(q));
      } else if (currentView === "proofreaders") {
        setUsers(await getProofreaders(filterLocale || undefined));
      } else {
        setUsers(await searchUsers(undefined));
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

  useEffect(() => {
    if (query.length === 0) load(undefined, view, localeFilter);
  }, [load, view, query, localeFilter]);

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
        prev.map((u) => (u.id === localeEditUserId ? { ...u, locales: updatedLocales } : u))
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

  // ── Requests tab state ───────────────────────────────────────────────────
  const [volRequests, setVolRequests] = useState<VolunteerRequestItem[]>([]);
  const [volReqLoading, setVolReqLoading] = useState(false);
  const [volReqError, setVolReqError] = useState("");
  const volReqLoaded = useRef(false);

  type ReqAction = { id: number; action: "approve" | "reject"; message: string; saving: boolean; requestedLanguages: string[]; approvedLanguages: string[] };
  const [reqAction, setReqAction] = useState<ReqAction | null>(null);

  const loadVolRequests = useCallback(async () => {
    setVolReqLoading(true);
    setVolReqError("");
    try {
      setVolRequests(await getAllVolunteerRequests());
      volReqLoaded.current = true;
    } catch {
      setVolReqError("Failed to load requests. Please retry.");
    } finally {
      setVolReqLoading(false);
    }
  }, []);

  useEffect(() => {
    if (outerTab === "requests" && !volReqLoaded.current) {
      loadVolRequests();
    }
  }, [outerTab, loadVolRequests]);

  const startReqAction = (id: number, action: "approve" | "reject", req: VolunteerRequestItem) => {
    const requestedLanguages = req.languages
      ? req.languages.split(",").map((c) => c.trim()).filter(Boolean)
      : [];
    setReqAction({
      id,
      action,
      message: "",
      saving: false,
      requestedLanguages,
      // Default: approve all requested languages
      approvedLanguages: action === "approve" ? [...requestedLanguages] : [],
    });
  };

  const handleReqConfirm = async () => {
    if (!reqAction) return;
    if (reqAction.action === "reject" && !reqAction.message.trim()) return;
    setReqAction((prev) => prev ? { ...prev, saving: true } : null);
    try {
      let updated: VolunteerRequestItem;
      if (reqAction.action === "approve") {
        const approvedLangs = reqAction.approvedLanguages.length > 0
          ? reqAction.approvedLanguages.join(",")
          : undefined;
        updated = await approveVolunteerRequest(reqAction.id, reqAction.message.trim() || undefined, approvedLangs);
      } else {
        updated = await rejectVolunteerRequest(reqAction.id, reqAction.message.trim());
      }
      setVolRequests((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setReqAction(null);
    } catch {
      setReqAction((prev) => prev ? { ...prev, saving: false } : null);
      setVolReqError("Action failed. Please try again.");
    }
  };

  // ── Services tab state ────────────────────────────────────────────────────
  const [volServices, setVolServices] = useState<VolunteerServiceItem[]>([]);
  const [volSvcLoading, setVolSvcLoading] = useState(false);
  const [volSvcError, setVolSvcError] = useState("");
  const volSvcLoaded = useRef(false);
  const [cooldownDays, setCooldownDays] = useState(1);
  const [cooldownSaving, setCooldownSaving] = useState(false);

  type SvcEdit = { id: number | null; name: string; description: string; slug: string; active: boolean; sortOrder: number; saving: boolean };
  const [svcEdit, setSvcEdit] = useState<SvcEdit | null>(null);

  const loadVolServices = useCallback(async () => {
    setVolSvcLoading(true);
    setVolSvcError("");
    try {
      const [svcs, cfg] = await Promise.all([getAllVolunteerServices(), getVolunteerConfig()]);
      setVolServices(svcs);
      setCooldownDays(cfg.rejectionCooldownDays);
      volSvcLoaded.current = true;
    } catch {
      setVolSvcError("Failed to load services. Please retry.");
    } finally {
      setVolSvcLoading(false);
    }
  }, []);

  useEffect(() => {
    if (outerTab === "services" && !volSvcLoaded.current) {
      loadVolServices();
    }
  }, [outerTab, loadVolServices]);

  const openSvcEdit = (svc?: VolunteerServiceItem) => {
    setSvcEdit(
      svc
        ? { id: svc.id, name: svc.name, description: svc.description, slug: svc.slug, active: svc.active, sortOrder: svc.sortOrder, saving: false }
        : { id: null, name: "", description: "", slug: "", active: true, sortOrder: 0, saving: false }
    );
  };

  const handleSvcSave = async () => {
    if (!svcEdit) return;
    setSvcEdit((prev) => prev ? { ...prev, saving: true } : null);
    try {
      if (svcEdit.id == null) {
        const created = await createVolunteerService({ name: svcEdit.name, description: svcEdit.description, slug: svcEdit.slug, sortOrder: svcEdit.sortOrder });
        setVolServices((prev) => [...prev, created]);
      } else {
        const updated = await updateVolunteerService(svcEdit.id, { name: svcEdit.name, description: svcEdit.description, slug: svcEdit.slug, active: svcEdit.active, sortOrder: svcEdit.sortOrder });
        setVolServices((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      }
      setSvcEdit(null);
    } catch {
      setSvcEdit((prev) => prev ? { ...prev, saving: false } : null);
      setVolSvcError("Failed to save service.");
    }
  };

  const handleSvcDelete = async (id: number) => {
    try {
      await deleteVolunteerService(id);
      setVolServices((prev) => prev.filter((s) => s.id !== id));
    } catch {
      setVolSvcError("Failed to delete service.");
    }
  };

  const handleCooldownSave = async () => {
    setCooldownSaving(true);
    try {
      const res = await updateVolunteerConfig(cooldownDays);
      setCooldownDays(res.rejectionCooldownDays);
    } catch {
      setVolSvcError("Failed to save cooldown setting.");
    } finally {
      setCooldownSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 overflow-x-hidden w-full">
      {/* Header */}
      <div>
        <h2 className="text-base font-semibold text-white">User Management</h2>
        <p className="text-xs text-gray-500 mt-1">Manage users, volunteer requests, and services.</p>
      </div>

      {/* Outer tab bar */}
      <div className="flex gap-1 p-1 bg-gray-900 border border-gray-800 rounded-xl w-fit">
        {(["users", "requests", "services"] as OuterTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setOuterTab(tab)}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
              outerTab === tab
                ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ═══════════════════ USERS TAB ═══════════════════ */}
      {outerTab === "users" && (
        <>
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

          {/* Locale filter */}
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

          <p className="text-xs text-gray-600 uppercase tracking-wide">
            {query.length >= 2 ? `Results for "${query}"` : view === "admins" ? "All users" : "Current proofreaders"}
          </p>

          {error && (
            <div className="flex items-start gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
              <p className="text-red-400 text-sm flex-1">{error}</p>
              <button
                onClick={() => load(query.length >= 2 ? query : undefined, view, localeFilter)}
                className="flex-shrink-0 text-xs text-red-400 hover:text-red-200 border border-red-500/30 rounded-lg px-2.5 py-1"
              >
                Retry
              </button>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-7 h-7 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12 text-gray-600 text-sm">
              {query.length >= 2 ? "No users found." : view === "admins" ? "No users found." : "No proofreaders assigned yet."}
            </div>
          ) : (
            <div className="space-y-2">
              {users.map((user) => (
                <div key={user.id} className="rounded-xl bg-gray-900 border border-gray-800 hover:border-gray-700 transition-colors">
                  <div className="p-3 space-y-2">
                    {/* Row 1: avatar + name/email + role badge */}
                    <div className="flex items-center gap-3">
                      {user.avatarUrl ? (
                        <img src={user.avatarUrl} alt={user.name} className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-medium text-gray-400">{user.name.charAt(0).toUpperCase()}</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-100 truncate">{user.name}</p>
                        <p className="text-xs text-gray-500 truncate">{user.email}</p>
                      </div>
                      <RoleBadge role={user.role} />
                    </div>

                    {/* Row 2: locale badges + action buttons (wraps on mobile) */}
                    <div className="flex items-center gap-1.5 flex-wrap w-full pl-12">
                      {user.role === "ROLE_PROOFREADER" && (user.locales ?? []).length > 0 &&
                        (user.locales ?? []).map((l) => <LocaleBadge key={l.id} locale={l} />)
                      }
                      {user.role === "ROLE_PROOFREADER" && (
                        <button
                          onClick={() => openLocaleEdit(user)}
                          className="px-2 py-1 rounded-lg text-[11px] font-medium border border-purple-500/30 text-purple-400 hover:bg-purple-500/10 transition-colors"
                        >
                          Languages
                        </button>
                      )}
                      {user.role !== "ROLE_PARENT_ADMIN" && (
                        <>
                          {user.role !== "ROLE_ADMIN" && (
                            <button
                              onClick={() => handleRoleChange(user, "ROLE_ADMIN")}
                              disabled={updating !== null}
                              className="px-2.5 py-1 rounded-lg text-xs font-medium border border-orange-500/40 text-orange-400 hover:bg-orange-500/10 transition-colors disabled:opacity-50"
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
                              className="px-2.5 py-1 rounded-lg text-xs font-medium border border-blue-500/40 text-blue-400 hover:bg-blue-500/10 transition-colors disabled:opacity-50"
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
                              className="px-2.5 py-1 rounded-lg text-xs border border-red-500/40 text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                            >
                              {updating?.id === user.id && updating.role === "ROLE_USER" ? (
                                <div className="w-3.5 h-3.5 border border-red-400 border-t-transparent rounded-full animate-spin" />
                              ) : "Revoke"}
                            </button>
                          )}
                        </>
                      )}
                      {/* Assignments expand toggle — proofreaders view only */}
                      {view === "proofreaders" && user.role === "ROLE_PROOFREADER" && (() => {
                        const activeCount = transcriptsLoadedRef.current
                          ? getActiveAssignmentCount(user.id, allTranscripts)
                          : null;
                        const isExpanded = expandedProofreaderId === user.id;
                        return (
                          <button
                            onClick={() => setExpandedProofreaderId(isExpanded ? null : user.id)}
                            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium border transition-colors ${
                              isExpanded
                                ? "border-blue-500/50 bg-blue-500/15 text-blue-300"
                                : "border-gray-700 text-gray-500 hover:border-gray-600 hover:text-gray-300"
                            }`}
                          >
                            {transcriptsLoading ? (
                              <div className="w-3 h-3 border border-gray-500 border-t-transparent rounded-full animate-spin" />
                            ) : activeCount !== null && activeCount > 0 ? (
                              <span className="w-4 h-4 rounded-full bg-blue-500/30 text-blue-300 text-[10px] flex items-center justify-center font-bold">
                                {activeCount}
                              </span>
                            ) : null}
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
                              className={`w-3.5 h-3.5 transition-transform ${isExpanded ? "rotate-90" : ""}`}>
                              <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z" clipRule="evenodd" />
                            </svg>
                          </button>
                        );
                      })()}
                    </div>
                  </div>
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
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={saveLocaleEdit}
                          disabled={localeEditSaving}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium border border-purple-500/40 text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 transition-colors disabled:opacity-50"
                        >
                          {localeEditSaving ? <div className="w-3.5 h-3.5 border border-purple-400 border-t-transparent rounded-full animate-spin" /> : "Save"}
                        </button>
                        <button onClick={() => setLocaleEditUserId(null)} className="px-3 py-1.5 rounded-lg text-xs border border-gray-700 text-gray-400 hover:bg-gray-800 transition-colors">
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ── Assignment detail panel ── */}
                  {expandedProofreaderId === user.id && view === "proofreaders" && (() => {
                    const assignments = getProofreaderAssignments(user.id, allTranscripts);
                    const active = assignments.filter(({ transcript: t, level }) => {
                      const s = getAssignmentStatus(t, level);
                      return s === "In Progress" || s === "Submitted";
                    });
                    const completed = assignments.filter(({ transcript: t, level }) => {
                      const s = getAssignmentStatus(t, level);
                      return s === "Approved" || s === "Deployed";
                    });

                    if (transcriptsLoading) {
                      return (
                        <div className="border-t border-gray-800 flex items-center justify-center py-6">
                          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                      );
                    }
                    if (assignments.length === 0) {
                      return (
                        <div className="border-t border-gray-800 px-3 py-4 text-center text-xs text-gray-600">
                          No transcripts assigned yet.
                        </div>
                      );
                    }

                    const AssignmentRow = ({ transcript: t, level }: { transcript: TranscriptReviewItem; level: 1 | 2 }) => {
                      const status = getAssignmentStatus(t, level);
                      const assignedAt = level === 1 ? t.l1AssignedAt : t.l2AssignedAt;
                      const submittedAt = level === 1 ? t.l1SubmittedAt : t.l2SubmittedAt;
                      return (
                        <div className="flex items-start gap-2.5 py-2.5 border-b border-gray-800/60 last:border-0">
                          {t.videoThumbnailUrl && (
                            <img src={t.videoThumbnailUrl} alt="" className="w-12 h-7 object-cover rounded flex-shrink-0 mt-0.5 opacity-80" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-gray-200 leading-snug truncate font-medium">{t.videoTitle}</p>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 border border-gray-700 text-gray-400">
                                {t.localeName}
                              </span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold border ${
                                level === 1
                                  ? "border-orange-500/40 bg-orange-500/10 text-orange-400"
                                  : "border-purple-500/40 bg-purple-500/10 text-purple-400"
                              }`}>
                                L{level}
                              </span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${STATUS_STYLE[status]}`}>
                                {status}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                              <span className="text-[10px] text-gray-600">
                                Assigned: <span className="text-gray-500">{formatDate(assignedAt)}</span>
                              </span>
                              {submittedAt && (
                                <span className="text-[10px] text-gray-600">
                                  Submitted: <span className="text-gray-500">{formatDate(submittedAt)}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    };

                    return (
                      <div className="border-t border-gray-800">
                        {active.length > 0 && (
                          <div className="px-3 pt-3 pb-1">
                            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                              Active — {active.length}
                            </p>
                            {active.map(({ transcript: t, level }) => (
                              <AssignmentRow key={`${t.id}-${level}`} transcript={t} level={level} />
                            ))}
                          </div>
                        )}
                        {completed.length > 0 && (
                          <div className="px-3 pt-2 pb-3">
                            <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-wide mb-1">
                              Completed — {completed.length}
                            </p>
                            {completed.map(({ transcript: t, level }) => (
                              <AssignmentRow key={`${t.id}-${level}`} transcript={t} level={level} />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              ))}
            </div>
          )}

          {/* Manage Languages section */}
          {view === "proofreaders" && (
            <div className="border-t border-gray-800 pt-5 mt-5">
              <button
                onClick={() => setShowLangMgmt(!showLangMgmt)}
                className="flex items-center gap-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={`w-4 h-4 transition-transform ${showLangMgmt ? "rotate-90" : ""}`}>
                  <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z" clipRule="evenodd" />
                </svg>
                Manage Languages
              </button>
              {showLangMgmt && (
                <div className="mt-3 space-y-3">
                  {langMgmtError && <p className="text-red-400 text-xs">{langMgmtError}</p>}
                  <div className="space-y-1.5">
                    {allLocales.map((l) => (
                      <div key={l.id} className="flex items-center justify-between p-2.5 rounded-xl bg-gray-900 border border-gray-800">
                        <div>
                          <span className="text-sm text-gray-200">{l.name}</span>
                          <span className="text-xs text-gray-500 ml-2">({l.code})</span>
                        </div>
                        <button onClick={() => handleDeleteLocale(l.id)} disabled={langMgmtLoading} className="text-xs text-red-400 border border-red-500/30 px-2 py-1 rounded-lg hover:bg-red-500/10 transition-colors disabled:opacity-50">
                          Delete
                        </button>
                      </div>
                    ))}
                    {allLocales.length === 0 && <p className="text-xs text-gray-600 py-2">No languages configured yet.</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="text" value={newLangCode} onChange={(e) => setNewLangCode(e.target.value)} placeholder="Code (e.g. bn)" className="w-24 bg-gray-900 border border-gray-700 rounded-lg text-xs text-gray-200 px-2.5 py-2 outline-none focus:border-purple-500/50 placeholder-gray-600" />
                    <input type="text" value={newLangName} onChange={(e) => setNewLangName(e.target.value)} placeholder="Name (e.g. Bengali)" className="flex-1 bg-gray-900 border border-gray-700 rounded-lg text-xs text-gray-200 px-2.5 py-2 outline-none focus:border-purple-500/50 placeholder-gray-600" />
                    <button onClick={handleCreateLocale} disabled={langMgmtLoading} className="px-3 py-2 rounded-lg text-xs font-medium border border-purple-500/40 text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 transition-colors disabled:opacity-50">
                      {langMgmtLoading ? <div className="w-3.5 h-3.5 border border-purple-400 border-t-transparent rounded-full animate-spin" /> : "Add"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ═══════════════════ REQUESTS TAB ═══════════════════ */}
      {outerTab === "requests" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">
              Volunteer applications from users. Approve to grant access, reject with a message.
            </p>
            <button onClick={loadVolRequests} className="text-xs text-gray-500 hover:text-gray-300 border border-gray-800 rounded-lg px-2.5 py-1 transition-colors">
              Refresh
            </button>
          </div>

          {volReqError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{volReqError}</div>
          )}

          {volReqLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-7 h-7 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : volRequests.length === 0 ? (
            <div className="text-center py-12 text-gray-600 text-sm">No volunteer requests yet.</div>
          ) : (
            <div className="space-y-2">
              {/* Pending first */}
              {[...volRequests].sort((a, b) => {
                if (a.status === "PENDING" && b.status !== "PENDING") return -1;
                if (b.status === "PENDING" && a.status !== "PENDING") return 1;
                return new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime();
              }).map((req) => {
                const isPending = req.status === "PENDING";
                const isActing = reqAction?.id === req.id;
                return (
                  <div key={req.id} className={`rounded-xl border transition-colors ${
                    isPending ? "bg-gray-900 border-gray-700" : "bg-gray-900/50 border-gray-800"
                  }`}>
                    <div className="flex items-start gap-3 p-3">
                      {/* Avatar */}
                      {req.userAvatarUrl ? (
                        <img src={req.userAvatarUrl} alt={req.userName} className="w-9 h-9 rounded-full object-cover flex-shrink-0 mt-0.5" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-sm font-medium text-gray-400">{req.userName.charAt(0).toUpperCase()}</span>
                        </div>
                      )}

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium text-gray-100">{req.userName}</p>
                            <p className="text-xs text-gray-500">{req.userEmail}</p>
                          </div>
                          {/* Status badge */}
                          <span className={`flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            req.status === "PENDING"  ? "border-amber-500/40 bg-amber-500/10 text-amber-400" :
                            req.status === "APPROVED" ? "border-green-500/40 bg-green-500/10 text-green-400" :
                                                        "border-red-500/40 bg-red-500/10 text-red-400"
                          }`}>
                            {req.status}
                          </span>
                        </div>

                        <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] font-medium text-orange-400">{req.serviceName}</span>
                          <span className="text-[10px] text-gray-600">Applied {timeAgo(req.requestedAt)}</span>
                          {req.reviewedAt && (
                            <span className="text-[10px] text-gray-600">• Reviewed {timeAgo(req.reviewedAt)}</span>
                          )}
                        </div>

                        {/* Requested languages */}
                        {req.languages && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            <span className="text-[10px] text-gray-600 mr-0.5">Requested:</span>
                            {req.languages.split(",").map((c) => c.trim()).filter(Boolean).map((code) => (
                              <span key={code} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 border border-gray-700 text-gray-400">{code}</span>
                            ))}
                          </div>
                        )}

                        {/* Approved languages (if approved) */}
                        {req.status === "APPROVED" && req.approvedLanguages && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            <span className="text-[10px] text-green-600 mr-0.5">Approved for:</span>
                            {req.approvedLanguages.split(",").map((c) => c.trim()).filter(Boolean).map((code) => (
                              <span key={code} className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 border border-green-500/30 text-green-400">{code}</span>
                            ))}
                          </div>
                        )}

                        {req.adminMessage && (
                          <p className="text-xs text-gray-500 mt-1.5 italic">"{req.adminMessage}"</p>
                        )}
                        {req.status === "REJECTED" && req.canReapplyAt && (
                          <p className="text-[10px] text-gray-700 mt-1">Reapply opens in {formatCountdown(req.canReapplyAt)}</p>
                        )}
                      </div>
                    </div>

                    {/* Approve / Reject buttons for pending */}
                    {isPending && !isActing && (
                      <div className="flex gap-2 px-3 pb-3">
                        <button
                          onClick={() => startReqAction(req.id, "approve", req)}
                          className="flex-1 py-1.5 rounded-lg text-xs font-semibold border border-green-500/40 text-green-400 bg-green-500/10 hover:bg-green-500/15 transition-colors"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => startReqAction(req.id, "reject", req)}
                          className="flex-1 py-1.5 rounded-lg text-xs font-semibold border border-red-500/40 text-red-400 bg-red-500/10 hover:bg-red-500/15 transition-colors"
                        >
                          Decline
                        </button>
                      </div>
                    )}

                    {/* Inline action form */}
                    {isActing && (
                      <div className="border-t border-gray-800 px-3 py-3 space-y-2.5">
                        {/* Language selector — approve only, proofreading requests with languages */}
                        {reqAction.action === "approve" && reqAction.requestedLanguages.length > 0 && (
                          <div>
                            <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1.5">
                              Approve for languages
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {reqAction.requestedLanguages.map((code) => {
                                const checked = reqAction.approvedLanguages.includes(code);
                                return (
                                  <button
                                    key={code}
                                    onClick={() =>
                                      setReqAction((prev) =>
                                        prev
                                          ? {
                                              ...prev,
                                              approvedLanguages: checked
                                                ? prev.approvedLanguages.filter((c) => c !== code)
                                                : [...prev.approvedLanguages, code],
                                            }
                                          : null
                                      )
                                    }
                                    className={`px-2 py-0.5 rounded text-[11px] font-medium border transition-colors ${
                                      checked
                                        ? "border-green-500/50 bg-green-500/15 text-green-400"
                                        : "border-gray-700 bg-gray-800 text-gray-500"
                                    }`}
                                  >
                                    {code}
                                  </button>
                                );
                              })}
                            </div>
                            <p className="text-[10px] text-gray-700 mt-1">
                              {reqAction.approvedLanguages.length === 0
                                ? "No languages selected — user will be approved without specific language access."
                                : `Approving for: ${reqAction.approvedLanguages.join(", ")}`}
                            </p>
                          </div>
                        )}

                        <p className="text-xs font-medium text-gray-300">
                          {reqAction.action === "approve" ? "Message for user (optional)" : "Reason for declining (required)"}
                        </p>
                        <textarea
                          value={reqAction.message}
                          onChange={(e) => setReqAction((prev) => prev ? { ...prev, message: e.target.value } : null)}
                          rows={2}
                          placeholder={reqAction.action === "approve" ? "e.g. Welcome aboard! We're excited to have you." : "e.g. Please improve your language skills first."}
                          className="w-full bg-gray-800 border border-gray-700 rounded-xl text-xs text-gray-200 px-3 py-2.5 outline-none placeholder-gray-600 resize-none focus:border-gray-600"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={handleReqConfirm}
                            disabled={reqAction.saving || (reqAction.action === "reject" && !reqAction.message.trim())}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors disabled:opacity-50 ${
                              reqAction.action === "approve"
                                ? "border-green-500/40 text-green-400 bg-green-500/10 hover:bg-green-500/20"
                                : "border-red-500/40 text-red-400 bg-red-500/10 hover:bg-red-500/20"
                            }`}
                          >
                            {reqAction.saving ? (
                              <div className="w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin mx-auto" />
                            ) : (
                              reqAction.action === "approve" ? "Confirm Approval" : "Confirm Decline"
                            )}
                          </button>
                          <button
                            onClick={() => setReqAction(null)}
                            disabled={reqAction.saving}
                            className="px-4 py-1.5 rounded-lg text-xs border border-gray-700 text-gray-400 hover:bg-gray-800 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════ SERVICES TAB ═══════════════════ */}
      {outerTab === "services" && (
        <div className="space-y-5">
          <p className="text-xs text-gray-500">
            Manage volunteer service categories shown to users on their profile page.
          </p>

          {volSvcError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{volSvcError}</div>
          )}

          {volSvcLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-7 h-7 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-2">
              {volServices.map((svc) => {
                const isEditing = svcEdit?.id === svc.id;
                return (
                  <div key={svc.id} className="rounded-xl bg-gray-900 border border-gray-800">
                    <div className="flex items-start gap-3 p-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-gray-100">{svc.name}</p>
                          <span className="text-[10px] text-gray-600 font-mono">/{svc.slug}</span>
                          {!svc.active && (
                            <span className="text-[10px] border border-gray-700 rounded px-1.5 py-0.5 text-gray-600">Inactive</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 truncate">{svc.description}</p>
                      </div>
                      <div className="flex gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => openSvcEdit(svc)}
                          className="px-2.5 py-1.5 rounded-lg text-xs border border-gray-700 text-gray-400 hover:bg-gray-800 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleSvcDelete(svc.id)}
                          className="px-2.5 py-1.5 rounded-lg text-xs border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    {/* Inline edit form */}
                    {isEditing && svcEdit && (
                      <div className="border-t border-gray-800 px-3 py-3 space-y-2.5">
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            value={svcEdit.name}
                            onChange={(e) => setSvcEdit((p) => p ? { ...p, name: e.target.value } : null)}
                            placeholder="Name"
                            className="bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-200 px-2.5 py-2 outline-none focus:border-gray-600 placeholder-gray-600"
                          />
                          <input
                            value={svcEdit.slug}
                            onChange={(e) => setSvcEdit((p) => p ? { ...p, slug: e.target.value } : null)}
                            placeholder="slug (e.g. proofreading)"
                            className="bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-200 px-2.5 py-2 outline-none focus:border-gray-600 placeholder-gray-600"
                          />
                        </div>
                        <textarea
                          value={svcEdit.description}
                          onChange={(e) => setSvcEdit((p) => p ? { ...p, description: e.target.value } : null)}
                          rows={2}
                          placeholder="Short description shown to users"
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-200 px-2.5 py-2 outline-none focus:border-gray-600 placeholder-gray-600 resize-none"
                        />
                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={svcEdit.active}
                              onChange={(e) => setSvcEdit((p) => p ? { ...p, active: e.target.checked } : null)}
                              className="w-3.5 h-3.5 accent-orange-500"
                            />
                            <span className="text-xs text-gray-400">Active</span>
                          </label>
                          <input
                            type="number"
                            value={svcEdit.sortOrder}
                            onChange={(e) => setSvcEdit((p) => p ? { ...p, sortOrder: parseInt(e.target.value) || 0 } : null)}
                            placeholder="Order"
                            className="w-20 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-200 px-2.5 py-2 outline-none focus:border-gray-600"
                          />
                          <span className="text-xs text-gray-600">Sort order</span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={handleSvcSave}
                            disabled={svcEdit.saving || !svcEdit.name.trim()}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-orange-500/40 text-orange-400 bg-orange-500/10 hover:bg-orange-500/20 transition-colors disabled:opacity-50"
                          >
                            {svcEdit.saving ? <div className="w-3.5 h-3.5 border border-orange-400 border-t-transparent rounded-full animate-spin" /> : "Save"}
                          </button>
                          <button onClick={() => setSvcEdit(null)} className="px-3 py-1.5 rounded-lg text-xs border border-gray-700 text-gray-400 hover:bg-gray-800 transition-colors">
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Add new service */}
              {svcEdit?.id === null ? (
                <div className="rounded-xl bg-gray-900 border border-dashed border-gray-700 p-3 space-y-2.5">
                  <p className="text-xs font-medium text-gray-400">New Service</p>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={svcEdit.name}
                      onChange={(e) => setSvcEdit((p) => p ? { ...p, name: e.target.value } : null)}
                      placeholder="Name"
                      className="bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-200 px-2.5 py-2 outline-none focus:border-gray-600 placeholder-gray-600"
                    />
                    <input
                      value={svcEdit.slug}
                      onChange={(e) => setSvcEdit((p) => p ? { ...p, slug: e.target.value } : null)}
                      placeholder="slug"
                      className="bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-200 px-2.5 py-2 outline-none focus:border-gray-600 placeholder-gray-600"
                    />
                  </div>
                  <textarea
                    value={svcEdit.description}
                    onChange={(e) => setSvcEdit((p) => p ? { ...p, description: e.target.value } : null)}
                    rows={2}
                    placeholder="Short description"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-200 px-2.5 py-2 outline-none focus:border-gray-600 placeholder-gray-600 resize-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleSvcSave}
                      disabled={svcEdit.saving || !svcEdit.name.trim()}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium border border-orange-500/40 text-orange-400 bg-orange-500/10 hover:bg-orange-500/20 transition-colors disabled:opacity-50"
                    >
                      {svcEdit.saving ? <div className="w-3.5 h-3.5 border border-orange-400 border-t-transparent rounded-full animate-spin" /> : "Create"}
                    </button>
                    <button onClick={() => setSvcEdit(null)} className="px-3 py-1.5 rounded-lg text-xs border border-gray-700 text-gray-400 hover:bg-gray-800 transition-colors">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => openSvcEdit()}
                  className="w-full py-2.5 rounded-xl border border-dashed border-gray-700 text-xs text-gray-500 hover:text-gray-300 hover:border-gray-600 transition-colors"
                >
                  + Add new service
                </button>
              )}
            </div>
          )}

          {/* Cooldown days config */}
          <div className="border-t border-gray-800 pt-5">
            <p className="text-xs font-semibold text-gray-400 mb-1">Rejection Cooldown</p>
            <p className="text-xs text-gray-600 mb-3">How many days a user must wait before reapplying after rejection.</p>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={0}
                value={cooldownDays}
                onChange={(e) => setCooldownDays(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-24 bg-gray-900 border border-gray-700 rounded-xl text-sm text-gray-200 px-3 py-2 outline-none focus:border-orange-500/50 text-center"
              />
              <span className="text-xs text-gray-500">days</span>
              <button
                onClick={handleCooldownSave}
                disabled={cooldownSaving}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-orange-500/40 text-orange-400 bg-orange-500/10 hover:bg-orange-500/20 transition-colors disabled:opacity-50"
              >
                {cooldownSaving ? <div className="w-3.5 h-3.5 border border-orange-400 border-t-transparent rounded-full animate-spin" /> : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
