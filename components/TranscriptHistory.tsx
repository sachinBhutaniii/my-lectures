"use client";
// Admin: the full edit history of one transcript — every editor session (who, when, which
// device), every step inside it, and any moment rebuilt, checked, downloaded or restored.
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getActivityHistory, getActivitySession, restoreFromActivity, type ActivityHistory,
} from "@/services/activity.service";
import {
  replaySession, withTyping, logCuesToSrt,
  type HistoryRow, type LogCue, type ReplayPoint, type TypingInfo,
} from "@/lib/activityDiff";
import { parseSrt } from "@/lib/srtUtils";

const SERVER = "server";

interface SessionSummary {
  sessionId: string;
  userName: string;
  mode: string;
  level: number | null;
  device: string;
  first: number;
  last: number;
  count: number;
  changes: number;
  typing: number;
  troubles: number;
  missing: number;
}

const TYPE_STYLE: Record<string, { label: string; cls: string }> = {
  SESSION_START: { label: "Opened", cls: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
  CHANGE: { label: "Change", cls: "bg-orange-500/15 text-orange-300 border-orange-500/30" },
  TYPING: { label: "Typing", cls: "bg-violet-500/15 text-violet-300 border-violet-500/30" },
  CANCEL_EDIT: { label: "Cancelled", cls: "bg-violet-500/15 text-violet-300 border-violet-500/30" },
  SNAPSHOT: { label: "Full copy", cls: "bg-gray-500/15 text-gray-300 border-gray-500/30" },
  SAVE_OK: { label: "Saved", cls: "bg-green-500/10 text-green-400 border-green-500/25" },
  SAVE_FAILED: { label: "Save failed", cls: "bg-red-500/15 text-red-300 border-red-500/30" },
  SUBMIT: { label: "Submitted", cls: "bg-green-500/15 text-green-300 border-green-500/30" },
  SUBMIT_FAILED: { label: "Submit failed", cls: "bg-red-500/15 text-red-300 border-red-500/30" },
  PUBLISH: { label: "Published", cls: "bg-green-500/15 text-green-300 border-green-500/30" },
  PUBLISH_FAILED: { label: "Publish failed", cls: "bg-red-500/15 text-red-300 border-red-500/30" },
  LOGGED_OUT: { label: "Logged out", cls: "bg-red-500/15 text-red-300 border-red-500/30" },
  LOGGED_IN: { label: "Logged in", cls: "bg-gray-500/15 text-gray-300 border-gray-500/30" },
  UI: { label: "Screen", cls: "bg-gray-500/10 text-gray-400 border-gray-600/30" },
  SERVER_SNAPSHOT: { label: "Server copy", cls: "bg-teal-500/15 text-teal-300 border-teal-500/30" },
  SERVER_EVENT: { label: "Workflow", cls: "bg-sky-500/15 text-sky-300 border-sky-500/30" },
};
const MINOR_TYPES = new Set(["SAVE_OK", "UI", "LOGGED_IN"]);
const TROUBLE_TYPES = new Set(["SAVE_FAILED", "SUBMIT_FAILED", "PUBLISH_FAILED", "LOGGED_OUT"]);

const fmtTime = (ms: number | null) =>
  ms == null ? "—" : new Date(ms).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", second: "2-digit" });
const fmtDateTime = (ms: number | null) =>
  ms == null ? "—" : new Date(ms).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const when = (r: HistoryRow) => r.clientTime ?? r.serverTime;

function shortDevice(ua: string | null): string {
  if (!ua) return "";
  const os = /iPhone|iPad/.test(ua) ? "iPhone/iPad" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "";
  const br = /Edg\//.test(ua) ? "Edge" : /CriOS|Chrome\//.test(ua) ? "Chrome" : /FxiOS|Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "";
  return [os, br].filter(Boolean).join(" · ") || ua.slice(0, 40);
}

function summarizeSessions(rows: HistoryRow[]): SessionSummary[] {
  const map = new Map<string, SessionSummary & { seqs: Set<number>; maxSeq: number }>();
  for (const r of rows) {
    let s = map.get(r.sessionId);
    if (!s) {
      s = {
        sessionId: r.sessionId, userName: r.sessionId === SERVER ? "Kept by the server" : r.userName ?? "?",
        mode: r.mode ?? "", level: r.level, device: shortDevice(r.device), first: when(r) ?? 0, last: when(r) ?? 0,
        count: 0, changes: 0, typing: 0, troubles: 0, missing: 0, seqs: new Set(), maxSeq: 0,
      };
      map.set(r.sessionId, s);
    }
    const t = when(r) ?? 0;
    s.first = Math.min(s.first, t);
    s.last = Math.max(s.last, t);
    s.count++;
    if (r.type === "CHANGE") s.changes++;
    if (r.type === "TYPING" || r.type === "CANCEL_EDIT") s.typing++;
    if (TROUBLE_TYPES.has(r.type)) s.troubles++;
    if (r.seq != null) { s.seqs.add(r.seq); s.maxSeq = Math.max(s.maxSeq, r.seq); }
  }
  return [...map.values()]
    .map(({ seqs, maxSeq, ...s }) => ({ ...s, missing: s.sessionId === SERVER ? 0 : maxSeq - seqs.size }))
    .sort((a, b) => (a.sessionId === SERVER ? 1 : b.sessionId === SERVER ? -1 : b.last - a.last));
}

function TypeBadge({ type }: { type: string }) {
  const st = TYPE_STYLE[type] ?? { label: type, cls: "bg-gray-500/10 text-gray-400 border-gray-600/30" };
  return <span className={`px-1.5 py-0.5 rounded border text-[10px] font-medium whitespace-nowrap ${st.cls}`}>{st.label}</span>;
}

function CueLine({ c, n, tone }: { c: LogCue; n?: number; tone?: "old" | "new" }) {
  const color = tone === "old" ? "text-red-300/80 line-through decoration-red-400/40" : tone === "new" ? "text-green-300" : "text-gray-300";
  return (
    <div className="flex gap-2 text-[11px] leading-snug">
      {n != null && <span className="w-8 flex-shrink-0 text-right text-gray-600 tabular-nums">{n}</span>}
      <span className="flex-shrink-0 text-gray-500 tabular-nums">{c.s.replace(/^00:/, "")}–{c.e.replace(/^00:/, "")}</span>
      <span className={`min-w-0 break-words ${color}`}>{c.t || <em className="text-gray-600">(empty)</em>}</span>
    </div>
  );
}

function ChangeView({ point }: { point: ReplayPoint }) {
  const ch = point.change;
  if (!ch) return null;
  const MAX = 30;
  const first = ch.at + 1;
  if (ch.removed.length === ch.added.length) {
    const pairs = ch.removed.map((r, i) => ({ r, a: ch.added[i], n: first + i }));
    return (
      <div className="space-y-1.5">
        {pairs.slice(0, MAX).map(({ r, a, n }) => (
          <div key={n} className="space-y-0.5">
            <CueLine c={r} n={n} tone="old" />
            <CueLine c={a} n={n} tone="new" />
          </div>
        ))}
        {pairs.length > MAX && <p className="text-[11px] text-gray-500">…and {pairs.length - MAX} more changed lines</p>}
      </div>
    );
  }
  return (
    <div className="space-y-1">
      {ch.removed.slice(0, MAX).map((r, i) => <CueLine key={`r${i}`} c={r} n={first + i} tone="old" />)}
      {ch.removed.length > MAX && <p className="text-[11px] text-gray-500">…and {ch.removed.length - MAX} more removed</p>}
      {ch.added.slice(0, MAX).map((a, i) => <CueLine key={`a${i}`} c={a} n={first + i} tone="new" />)}
      {ch.added.length > MAX && <p className="text-[11px] text-gray-500">…and {ch.added.length - MAX} more added</p>}
    </div>
  );
}

function TypingView({ typing }: { typing: TypingInfo }) {
  return (
    <div className="space-y-0.5">
      <CueLine c={typing.before} n={typing.line} tone="old" />
      <CueLine c={typing.typed} n={typing.line} tone="new" />
    </div>
  );
}

function downloadSrt(cues: LogCue[], name: string) {
  const blob = new Blob([logCuesToSrt(cues)], { type: "application/x-subrip;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export default function TranscriptHistory({
  transcriptId, canRestore, onBack,
}: { transcriptId: number; canRestore: boolean; onBack: () => void }) {
  const [history, setHistory] = useState<ActivityHistory | null>(null);
  const [error, setError] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionRows, setSessionRows] = useState<HistoryRow[] | null>(null);
  const [sessionError, setSessionError] = useState("");
  const [selectedRowId, setSelectedRowId] = useState<number | null>(null);
  const [showMinor, setShowMinor] = useState(false);
  const [showWhole, setShowWhole] = useState(false);
  const [includeTyping, setIncludeTyping] = useState(false);
  const [confirmLevel, setConfirmLevel] = useState<1 | 2 | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const loadHistory = useCallback(() => {
    getActivityHistory(transcriptId)
      .then((h) => { setHistory(h); setError(""); })
      .catch((e) => {
        console.error(`Loading edit history of transcript ${transcriptId} failed`, e);
        setError(e?.response?.data?.error ?? "Could not load the edit history. Please try again.");
      });
  }, [transcriptId]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const openSession = useCallback((sid: string) => {
    setSessionId(sid);
    setSessionRows(null);
    setSessionError("");
    setSelectedRowId(null);
    setShowWhole(false);
    getActivitySession(transcriptId, sid)
      .then((rows) => {
        setSessionRows(rows);
        const last = [...rows].reverse().find((r) => r.type === "CHANGE" || r.type === "SERVER_SNAPSHOT") ?? rows[rows.length - 1];
        setSelectedRowId(last?.id ?? null);
      })
      .catch((e) => {
        console.error(`Loading session ${sid} of transcript ${transcriptId} failed`, e);
        setSessionError(e?.response?.data?.error ?? "Could not load this session. Please try again.");
      });
  }, [transcriptId]);

  const sessions = useMemo(() => (history ? summarizeSessions(history.rows) : []), [history]);
  const replay = useMemo(
    () => (sessionRows && sessionId !== SERVER ? replaySession(sessionRows) : null),
    [sessionRows, sessionId]
  );
  const selectedRow = useMemo(
    () => sessionRows?.find((r) => r.id === selectedRowId) ?? null,
    [sessionRows, selectedRowId]
  );
  const point: ReplayPoint | null = useMemo(() => {
    if (!selectedRow) return null;
    if (selectedRow.type === "SERVER_EVENT") {
      return { rowId: selectedRow.id, cues: null, verified: false, problem: "workflow" };
    }
    if (selectedRow.sessionId === SERVER) {
      const cues = parseSrt(selectedRow.srtContent ?? "").map((c) => ({ s: c.startTime, e: c.endTime, t: c.text }));
      return { rowId: selectedRow.id, cues: cues.length ? cues : null, verified: cues.length > 0, problem: cues.length ? undefined : "This server copy is empty" };
    }
    return replay?.get(selectedRow.id) ?? null;
  }, [selectedRow, replay]);

  const versionCues: LogCue[] | null = useMemo(() => {
    if (!point?.cues) return null;
    if (includeTyping && point.typing) {
      try { return withTyping(point.cues, point.typing); } catch { return point.cues; }
    }
    return point.cues;
  }, [point, includeTyping]);

  const visibleRows = useMemo(
    () => (sessionRows ?? []).filter((r) => showMinor || !MINOR_TYPES.has(r.type) || r.id === selectedRowId),
    [sessionRows, showMinor, selectedRowId]
  );

  const sourceLabel = selectedRow
    ? `${selectedRow.sessionId === SERVER ? "server copy" : selectedRow.userName ?? "?"}, ${fmtDateTime(when(selectedRow))}${selectedRow.seq != null ? ` (step ${selectedRow.seq})` : ""}${includeTyping && point?.typing ? " incl. unconfirmed typing" : ""}`
    : "";

  const doRestore = async () => {
    if (!confirmLevel || !versionCues || !selectedRow) return;
    setRestoring(true);
    try {
      await restoreFromActivity(transcriptId, {
        level: confirmLevel,
        srtContent: logCuesToSrt(versionCues),
        sourceEventId: selectedRow.id,
        sourceSessionId: selectedRow.sessionId,
        sourceSeq: selectedRow.seq,
        sourceLabel,
      });
      setNotice({ ok: true, text: `Restored the L${confirmLevel} draft to the version from ${sourceLabel}. The draft it replaced is kept under "Kept by the server".` });
      setConfirmLevel(null);
      loadHistory();
    } catch (e) {
      console.error(`Restoring transcript ${transcriptId} L${confirmLevel} failed`, e);
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setNotice({ ok: false, text: `Restore failed: ${msg ?? "please try again"}. Nothing was changed.` });
      setConfirmLevel(null);
    } finally {
      setRestoring(false);
    }
  };

  const lastSaved = (lvl: 1 | 2) => {
    if (!history) return null;
    const at = lvl === 1 ? history.l1LastSavedAt : history.l2LastSavedAt;
    const by = lvl === 1 ? history.l1LastSavedByName : history.l2LastSavedByName;
    return at ? `last saved ${fmtDateTime(at)} by ${by}` : "no save tracked yet";
  };

  const currentSession = sessions.find((s) => s.sessionId === sessionId) ?? null;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-12 pb-3 border-b border-gray-800">
        <button onClick={sessionId ? () => { setSessionId(null); setSessionRows(null); } : onBack} className="text-gray-400 hover:text-white" title="Back">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <div className="min-w-0">
          <h1 className="text-base font-bold truncate">Edit history</h1>
          <p className="text-[11px] text-gray-500 truncate">
            {history ? `${history.videoTitle ?? "Transcript"} · ${history.localeName ?? ""}` : `Transcript #${transcriptId}`}
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">
        {error && <p className="text-sm text-red-400">{error}</p>}
        {notice && (
          <div className={`px-3 py-2 rounded-xl border text-xs ${notice.ok ? "border-green-500/30 bg-green-500/10 text-green-300" : "border-red-500/30 bg-red-500/10 text-red-300"}`}>
            {notice.text}
            <button onClick={() => setNotice(null)} className="ml-2 underline opacity-70">dismiss</button>
          </div>
        )}
        {!history && !error && (
          <div className="flex justify-center py-12"><div className="w-7 h-7 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>
        )}

        {history && (
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            {([1, 2] as const).map((lvl) => (
              <div key={lvl} className="px-3 py-2 rounded-xl border border-gray-800 bg-gray-900/40">
                <p className="text-gray-300 font-medium">
                  L{lvl} draft · {(lvl === 1 ? history.level1ProofreaderName : history.level2ProofreaderName) ?? "unassigned"}
                </p>
                <p className="text-gray-500 mt-0.5">{lastSaved(lvl)}</p>
              </div>
            ))}
          </div>
        )}

        {/* Sessions */}
        {history && !sessionId && (
          <div className="space-y-2">
            <p className="text-xs text-gray-400">
              {sessions.length === 0
                ? "No history yet. Everything done in the editor from now on will appear here."
                : `${sessions.length} editor session${sessions.length === 1 ? "" : "s"} · ${history.rowCount} recorded steps`}
            </p>
            {sessions.map((s) => (
              <button
                key={s.sessionId}
                onClick={() => openSession(s.sessionId)}
                className="w-full text-left px-3 py-2.5 rounded-xl border border-gray-800 bg-gray-900/40 hover:border-gray-600 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className={`text-sm font-medium truncate ${s.sessionId === SERVER ? "text-teal-300" : "text-white"}`}>
                    {s.userName}
                    {s.sessionId !== SERVER && (
                      <span className="ml-1.5 text-[10px] text-gray-400 font-normal">
                        {s.mode === "admin" ? "admin review" : `L${s.level} proofreading`}
                      </span>
                    )}
                  </p>
                  <span className="text-[10px] text-gray-500 flex-shrink-0">{s.device}</span>
                </div>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {fmtDateTime(s.first)} → {fmtTime(s.last)}
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {s.sessionId === SERVER
                    ? `${s.count} entries: workflow steps (assign, submit, approve, publish …) and full copies kept before drafts or the live transcript were overwritten, cleared or deleted`
                    : `${s.changes} changes · ${s.typing} typing · ${s.count} steps`}
                  {s.troubles > 0 && <span className="text-red-400"> · {s.troubles} problems</span>}
                  {s.missing > 0 && <span className="text-amber-400"> · {s.missing} steps not uploaded yet</span>}
                </p>
              </button>
            ))}
          </div>
        )}

        {/* One session */}
        {sessionId && (
          <div className="space-y-2">
            {currentSession && (
              <p className="text-xs text-gray-400">
                <span className="text-white font-medium">{currentSession.userName}</span>
                {currentSession.sessionId !== SERVER && <> · {currentSession.device}</>} · {fmtDateTime(currentSession.first)} → {fmtTime(currentSession.last)}
              </p>
            )}
            {sessionError && <p className="text-sm text-red-400">{sessionError}</p>}
            {!sessionRows && !sessionError && (
              <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>
            )}
            {sessionRows && sessionId !== SERVER && (
              <label className="flex items-center gap-2 text-[11px] text-gray-400">
                <input type="checkbox" checked={showMinor} onChange={(e) => setShowMinor(e.target.checked)} />
                Show saves and screen events
              </label>
            )}

            <div className="space-y-1">
              {visibleRows.map((r) => {
                const p = sessionId === SERVER ? null : replay?.get(r.id);
                const selected = r.id === selectedRowId;
                return (
                  <div key={r.id} className={`rounded-xl border ${selected ? "border-orange-500/40 bg-orange-500/5" : "border-gray-800/80"}`}>
                    <button
                      onClick={() => { setSelectedRowId(selected ? null : r.id); setShowWhole(false); setIncludeTyping(false); }}
                      className="w-full text-left px-3 py-2 flex items-start gap-2"
                    >
                      <span className="text-[10px] text-gray-500 tabular-nums w-[68px] flex-shrink-0 pt-0.5">{fmtTime(when(r))}</span>
                      <TypeBadge type={r.type} />
                      <span className="text-[11px] text-gray-200 min-w-0 break-words">
                        {r.summary}
                        {p && !p.verified && r.type === "CHANGE" && <span className="text-amber-400"> ⚠</span>}
                      </span>
                    </button>

                    {selected && (
                      <div className="px-3 pb-3 space-y-2.5 border-t border-gray-800/80 pt-2.5">
                        {point?.change && <ChangeView point={point} />}
                        {point?.typing && <TypingView typing={point.typing} />}

                        {point?.problem === "workflow" ? (
                          <p className="text-[11px] text-gray-400">
                            Workflow step by {r.userName ?? "an unknown user"}. No transcript text is attached to it;
                            the copies kept around it are listed as “Server copy”.
                          </p>
                        ) : point?.cues ? (
                          <p className={`text-[11px] ${point.verified ? "text-green-400" : "text-amber-400"}`}>
                            {point.verified
                              ? `✓ Rebuilt and checked — ${point.cues.length} lines at this moment`
                              : `Rebuilt (${point.cues.length} lines), but ${point.problem ?? "it could not be checked"}`}
                          </p>
                        ) : (
                          <p className="text-[11px] text-amber-400">
                            Can&apos;t rebuild the whole transcript at this moment: {point?.problem ?? "unknown reason"}.
                            {" "}The change itself is shown above; pick a later “Full copy” to restore.
                          </p>
                        )}

                        {versionCues && (
                          <div className="flex flex-wrap items-center gap-2">
                            {point?.typing && (
                              <label className="flex items-center gap-1.5 text-[11px] text-violet-300 w-full">
                                <input type="checkbox" checked={includeTyping} onChange={(e) => setIncludeTyping(e.target.checked)} />
                                Include the unconfirmed typing in line {point.typing.line}
                              </label>
                            )}
                            <button
                              onClick={() => downloadSrt(versionCues, `transcript-${transcriptId}-${r.sessionId === SERVER ? "server" : `step-${r.seq}`}.srt`)}
                              className="px-2.5 py-1.5 rounded-lg text-[11px] border border-gray-700 text-gray-300 hover:border-gray-500"
                            >
                              Download .srt
                            </button>
                            <button
                              onClick={() => setShowWhole((v) => !v)}
                              className="px-2.5 py-1.5 rounded-lg text-[11px] border border-gray-700 text-gray-300 hover:border-gray-500"
                            >
                              {showWhole ? "Hide" : "Show"} whole transcript
                            </button>
                            {canRestore && ([1, 2] as const).map((lvl) => (
                              <button
                                key={lvl}
                                onClick={() => setConfirmLevel(lvl)}
                                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium border ${
                                  lvl === (r.level === 2 ? 2 : 1)
                                    ? "border-orange-500/50 bg-orange-500/15 text-orange-200 hover:bg-orange-500/25"
                                    : "border-gray-700 text-gray-400 hover:border-gray-500"
                                }`}
                              >
                                Restore into L{lvl} draft
                              </button>
                            ))}
                          </div>
                        )}

                        {showWhole && versionCues && (
                          <div className="max-h-[60vh] overflow-y-auto space-y-1 rounded-lg border border-gray-800 p-2">
                            {versionCues.map((c, i) => <CueLine key={i} c={c} n={i + 1} />)}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Restore confirmation */}
      {confirmLevel && versionCues && history && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-5 bg-black/80">
          <div className="w-full max-w-sm rounded-2xl border border-gray-700 bg-[#141414] p-5 space-y-3">
            <p className="text-sm font-semibold">Replace the L{confirmLevel} draft?</p>
            <p className="text-xs text-gray-400 leading-relaxed">
              The current L{confirmLevel} draft ({lastSaved(confirmLevel)}) will be replaced by the version from{" "}
              <span className="text-gray-200">{sourceLabel}</span> ({versionCues.length} lines).
              The current draft is kept in the history first, so this can be undone.
            </p>
            <p className="text-xs text-amber-300/90 leading-relaxed">
              If {(confirmLevel === 1 ? history.level1ProofreaderName : history.level2ProofreaderName) ?? "someone"} has
              this transcript open, ask them to close it first. Otherwise their next auto-save replaces this again
              (that save is also kept in the history).
            </p>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setConfirmLevel(null)} disabled={restoring} className="flex-1 py-2 rounded-xl border border-gray-700 text-xs text-gray-300">
                Cancel
              </button>
              <button onClick={doRestore} disabled={restoring} className="flex-1 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-xs font-semibold disabled:opacity-60">
                {restoring ? "Restoring…" : `Restore L${confirmLevel} draft`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
