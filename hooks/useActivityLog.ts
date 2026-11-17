"use client";
// Wires the proofreading editor to the activity log: every change to the transcript (with the
// button that caused it), text typed but not yet confirmed, cancelled edits, saves, logouts,
// leaving / coming back to the page, and a full copy every 10 minutes.
import { useCallback, useEffect, useRef, useState } from "react";
import type { SrtCue } from "@/lib/srtUtils";
import { computeChange, cuesHash, describeChange, type LogCue } from "@/lib/activityDiff";
import {
  ActivityLogger, toLogCues, uploadLeftoverActivity,
  type ActivityType, type EditorMode, type UploadStatus,
} from "@/lib/activityLog";

const SNAPSHOT_EVERY_MS = 10 * 60 * 1000;
const SNAPSHOT_EVERY_CHANGES = 200;
const TYPING_DEBOUNCE_MS = 1500;
/** A button press labels the change that follows it only if that change comes this soon. */
const ACTION_LABEL_TTL_MS = 3000;

interface TypingState {
  line: number;
  before: LogCue;
  typed: LogCue;
  /** "timeline" = marker positions / text inside Timeline Editor Mode, not applied yet */
  source?: "timeline";
}

const short = (s: string, max = 60) => {
  const one = s.replace(/\s+/g, " ").trim();
  return `"${one.length > max ? one.slice(0, max - 1) + "…" : one}"`;
};

export function useActivityLog(opts: {
  transcriptId: number;
  level: 1 | 2;
  mode: EditorMode;
  userId: number | undefined;
  token: string | null;
  sessionLost: boolean;
  cues: SrtCue[];
  editingId: number | null;
  draft: { text: string; startTime: string; endTime: string };
}) {
  const { transcriptId, level, mode, userId, token, sessionLost, cues, editingId, draft } = opts;

  // One logger (one session id) for the life of this editor
  const [logger] = useState(() => new ActivityLogger({ transcriptId, level, mode, userId: userId ?? 0 }));

  const sessionStartedRef = useRef(false);
  const loggedCuesRef = useRef<LogCue[]>([]);
  const pendingActionRef = useRef<{ action: string; at: number } | null>(null);
  const changesSinceSnapshotRef = useRef(0);
  const lastSnapshotAtRef = useRef(0);
  const pendingTypingRef = useRef<TypingState | null>(null);
  const lastTypedRef = useRef<string | null>(null);
  const timelineKeyRef = useRef<string | null>(null);
  const timelineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>(() => logger.status());

  useEffect(() => logger.onStatus(setUploadStatus), [logger]);

  const logEvent = useCallback(
    (type: ActivityType, f: { action?: string; summary: string; payload?: unknown; stateHash?: string; cueCount?: number }, urgent = false) => {
      logger.log(type, f, { urgent });
    },
    [logger]
  );

  const snapshot = useCallback((reason: string) => {
    const lc = loggedCuesRef.current;
    logger.log("SNAPSHOT", {
      action: "snapshot",
      summary: `Full copy kept (${reason}) — ${lc.length} lines`,
      payload: { reason, cues: lc },
      stateHash: cuesHash(lc),
      cueCount: lc.length,
    });
    changesSinceSnapshotRef.current = 0;
    lastSnapshotAtRef.current = Date.now();
  }, [logger]);

  /** Call once the editor knows what it opened with (before any device-copy restore). */
  const startSession = useCallback((initial: SrtCue[], meta: Record<string, unknown>) => {
    loggedCuesRef.current = toLogCues(initial);
    if (sessionStartedRef.current) return; // effects run twice in development
    sessionStartedRef.current = true;
    const lc = loggedCuesRef.current;
    const who = mode === "admin" ? "admin review (L2 draft)" : `L${level} proofreading`;
    logger.log("SESSION_START", {
      action: "open",
      summary: `Opened the editor for ${who} — ${lc.length} lines`,
      payload: { ...meta, page: typeof window !== "undefined" ? window.location.pathname + window.location.search : "", cues: lc },
      stateHash: cuesHash(lc),
      cueCount: lc.length,
    }, { urgent: true });
    lastSnapshotAtRef.current = Date.now();
  }, [logger, mode, level]);

  /** Label the next change with the button that causes it (call right before setCues). */
  const markAction = useCallback((action: string) => {
    pendingActionRef.current = { action, at: Date.now() };
    // Whatever was being typed / dragged is now applied and will be logged as the change itself
    pendingTypingRef.current = null;
    lastTypedRef.current = null;
    timelineKeyRef.current = null;
    if (timelineTimerRef.current) clearTimeout(timelineTimerRef.current);
    timelineTimerRef.current = null;
  }, []);

  // ── Every change to the transcript ─────────────────────────────────────────────
  useEffect(() => {
    if (!sessionStartedRef.current || cues.length === 0) return;
    const next = toLogCues(cues);
    const pending = pendingActionRef.current;
    pendingActionRef.current = null;
    const ch = computeChange(loggedCuesRef.current, next);
    if (!ch) return;
    const action = pending && Date.now() - pending.at < ACTION_LABEL_TTL_MS ? pending.action : "edit";
    loggedCuesRef.current = next;
    logger.log("CHANGE", {
      action,
      summary: describeChange(action, ch),
      payload: ch,
      stateHash: cuesHash(next),
      cueCount: next.length,
    });
    changesSinceSnapshotRef.current++;
    if (changesSinceSnapshotRef.current >= SNAPSHOT_EVERY_CHANGES) snapshot(`after ${SNAPSHOT_EVERY_CHANGES} changes`);
  }, [cues, logger, snapshot]);

  // ── Text typed into a line but not confirmed yet ─────────────────────────────────
  const flushTyping = useCallback(() => {
    const t = pendingTypingRef.current;
    if (!t) return;
    pendingTypingRef.current = null;
    const key = JSON.stringify([t.source ?? "line", t.line, t.typed]);
    if (key === lastTypedRef.current) return;
    lastTypedRef.current = key;
    const timeMoved = t.typed.s !== t.before.s || t.typed.e !== t.before.e;
    const textChanged = t.typed.t !== t.before.t;
    logger.log("TYPING", {
      action: t.source === "timeline" ? "timeline-typing" : "typing",
      summary: t.source === "timeline"
        ? `Timeline Editor, line ${t.line} (not applied yet):${timeMoved ? ` time ${t.typed.s}–${t.typed.e}` : ""}${
            timeMoved && textChanged ? " ·" : ""}${textChanged ? ` text ${short(t.typed.t)}` : ""}`
        : `Typing in line ${t.line} (not confirmed yet): ${short(t.typed.t)}${timeMoved ? ` · time ${t.typed.s}–${t.typed.e}` : ""}`,
      payload: t,
    });
  }, [logger]);

  useEffect(() => {
    if (editingId === null) {
      // Leave pending Timeline Editor work alone; it has its own timer
      if (pendingTypingRef.current?.source !== "timeline") pendingTypingRef.current = null;
      return;
    }
    const idx = cues.findIndex((c) => c.id === editingId);
    if (idx === -1) return;
    const cue = cues[idx];
    if (draft.text === cue.text && draft.startTime === cue.startTime && draft.endTime === cue.endTime) {
      pendingTypingRef.current = null;
      return;
    }
    pendingTypingRef.current = {
      line: idx + 1,
      before: { s: cue.startTime, e: cue.endTime, t: cue.text },
      typed: { s: draft.startTime, e: draft.endTime, t: draft.text },
    };
    const timer = setTimeout(flushTyping, TYPING_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draft, editingId, cues, flushTyping]);

  /**
   * Timeline Editor Mode reports its marker positions / text while they are being changed
   * (before Next / Prev / Done applies them), so that work is logged too.
   */
  const noteTimelineDraft = useCallback((cueId: number, s: string, e: string, t: string) => {
    const idx = cues.findIndex((c) => c.id === cueId);
    if (idx === -1) return;
    const cue = cues[idx];
    if (s === cue.startTime && e === cue.endTime && t === cue.text) {
      if (timelineKeyRef.current !== null) {
        timelineKeyRef.current = null;
        pendingTypingRef.current = null;
        if (timelineTimerRef.current) clearTimeout(timelineTimerRef.current);
        timelineTimerRef.current = null;
      }
      return;
    }
    const key = `${cueId}|${s}|${e}|${t}`;
    if (key === timelineKeyRef.current) return; // unchanged (re-render): keep the pending timer
    timelineKeyRef.current = key;
    pendingTypingRef.current = {
      line: idx + 1,
      before: { s: cue.startTime, e: cue.endTime, t: cue.text },
      typed: { s, e, t },
      source: "timeline",
    };
    if (timelineTimerRef.current) clearTimeout(timelineTimerRef.current);
    timelineTimerRef.current = setTimeout(() => {
      timelineTimerRef.current = null;
      flushTyping();
    }, TYPING_DEBOUNCE_MS);
  }, [cues, flushTyping]);

  /** Call when an edit is cancelled: whatever was typed is kept in the log. */
  const noteCancelEdit = useCallback((cueId: number) => {
    const idx = cues.findIndex((c) => c.id === cueId);
    if (idx === -1) return;
    const cue = cues[idx];
    pendingTypingRef.current = null;
    if (draft.text === cue.text && draft.startTime === cue.startTime && draft.endTime === cue.endTime) return;
    logger.log("CANCEL_EDIT", {
      action: "cancel-edit",
      summary: `Cancelled editing line ${idx + 1} — typed text not applied: ${short(draft.text)}`,
      payload: {
        line: idx + 1,
        before: { s: cue.startTime, e: cue.endTime, t: cue.text },
        typed: { s: draft.startTime, e: draft.endTime, t: draft.text },
      },
    });
  }, [cues, draft, logger]);

  // ── Full copy every 10 minutes while there are changes ───────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      if (changesSinceSnapshotRef.current > 0 && Date.now() - lastSnapshotAtRef.current >= SNAPSHOT_EVERY_MS) {
        snapshot("10-minute full copy");
      }
    }, 60_000);
    return () => clearInterval(id);
  }, [snapshot]);

  // ── Leaving / coming back to the page ───────────────────────────────────────────
  useEffect(() => {
    const onVisibility = () => {
      if (!sessionStartedRef.current) return;
      if (document.visibilityState === "hidden") {
        flushTyping();
        logger.log("UI", { action: "page-hidden", summary: "Left the editor (switched app or tab, locked the phone, or closed it)" }, { urgent: true });
      } else {
        logger.log("UI", { action: "page-visible", summary: "Came back to the editor" });
      }
    };
    const onPageHide = () => flushTyping();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [logger, flushTyping]);

  // ── Login lost / back ─────────────────────────────────────────────────────────────
  const wasLostRef = useRef(false);
  useEffect(() => {
    if (sessionLost && !wasLostRef.current) {
      wasLostRef.current = true;
      flushTyping();
      logger.log("LOGGED_OUT", {
        action: "logged-out",
        summary: "Logged out — editor locked; changes and this history wait on the device until login",
      });
    } else if (!sessionLost && wasLostRef.current && token) {
      wasLostRef.current = false;
      logger.log("LOGGED_IN", { action: "logged-in", summary: "Logged in again" });
    }
    if (token) logger.resume();
  }, [sessionLost, token, logger, flushTyping]);

  // ── Upload history left on this device by earlier sessions ─────────────────────────
  useEffect(() => {
    if (token && userId) void uploadLeftoverActivity(userId, logger.sessionId);
  }, [token, userId, logger]);

  // ── Leaving the editor: log it and try a last upload (anything unsent stays on the device) ──
  useEffect(() => {
    // Development mounts effects twice; a re-mount cancels the "closed" from the first unmount
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
    return () => {
      flushTyping();
      closeTimerRef.current = setTimeout(() => {
        if (sessionStartedRef.current) {
          logger.log("UI", { action: "editor-closed", summary: "Closed the editor" }, { urgent: true });
        }
        logger.dispose();
      }, 0);
    };
  }, [logger, flushTyping]);

  return { logger, startSession, markAction, logEvent, noteCancelEdit, noteTimelineDraft, uploadStatus };
}
