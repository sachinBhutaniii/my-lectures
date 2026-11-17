// Pure helpers for the proofreading activity log: what changed between two versions of a
// transcript, applying that change again (to rebuild any moment), a fingerprint to check the
// rebuilt version, a one-line human description of the change, and replaying a whole session.
// No imports on purpose, so the same code runs in the browser and in `node --test`.

/** One subtitle line as stored in the activity log (times exactly as written in the SRT). */
export interface LogCue {
  s: string; // start, e.g. "00:06:20,000"
  e: string; // end
  t: string; // text
}

/** A change: starting at line index `at`, the lines `removed` were replaced by `added`. */
export interface CueRangeChange {
  at: number;
  removed: LogCue[];
  added: LogCue[];
}

export function sameCue(a: LogCue, b: LogCue): boolean {
  return a.s === b.s && a.e === b.e && a.t === b.t;
}

/** The smallest single block of lines that differs between prev and next, or null if equal. */
export function computeChange(prev: LogCue[], next: LogCue[]): CueRangeChange | null {
  const minLen = Math.min(prev.length, next.length);
  let start = 0;
  while (start < minLen && sameCue(prev[start], next[start])) start++;
  if (start === prev.length && start === next.length) return null;
  let endPrev = prev.length;
  let endNext = next.length;
  while (endPrev > start && endNext > start && sameCue(prev[endPrev - 1], next[endNext - 1])) {
    endPrev--;
    endNext--;
  }
  return { at: start, removed: prev.slice(start, endPrev), added: next.slice(start, endNext) };
}

/**
 * Applies a change to a version of the transcript. Throws if the lines it expects to replace
 * are not there, so a broken rebuild is never mistaken for a correct one.
 */
export function applyChange(cues: LogCue[], ch: CueRangeChange): LogCue[] {
  if (ch.at < 0 || ch.at + ch.removed.length > cues.length) {
    throw new Error(`Change at line ${ch.at + 1} does not fit a transcript of ${cues.length} lines`);
  }
  for (let i = 0; i < ch.removed.length; i++) {
    if (!sameCue(cues[ch.at + i], ch.removed[i])) {
      throw new Error(`Line ${ch.at + i + 1} is not what this change expected`);
    }
  }
  return [...cues.slice(0, ch.at), ...ch.added, ...cues.slice(ch.at + ch.removed.length)];
}

/** Short fingerprint of a whole transcript: "<lines>:<hash>". Same in browser and server-free replay. */
export function cuesHash(cues: LogCue[]): string {
  let h = 5381;
  const feed = (str: string) => {
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  };
  for (const c of cues) {
    feed(c.s);
    feed("|");
    feed(c.e);
    feed("|");
    feed(c.t);
    feed("\n");
  }
  return `${cues.length}:${(h >>> 0).toString(36)}`;
}

/** Builds SRT text from log lines (numbered 1, 2, 3 …), same layout as the editor saves. */
export function logCuesToSrt(cues: LogCue[]): string {
  return cues.map((c, i) => `${i + 1}\n${c.s} --> ${c.e}\n${c.t}`).join("\n\n") + "\n";
}

/** Parses "HH:MM:SS,mmm" (or with "."); NaN if it can't. */
export function srtTimeToMs(t: string): number {
  const m = /^(\d+):(\d{1,2}):(\d{1,2})[,.](\d{1,3})$/.exec(t.trim());
  if (!m) return NaN;
  return ((+m[1] * 60 + +m[2]) * 60 + +m[3]) * 1000 + +m[4].padEnd(3, "0");
}

/** "3m 25s", "0.6s" */
export function formatDuration(ms: number): string {
  const abs = Math.abs(ms);
  if (abs < 60_000) return `${(abs / 1000).toFixed(abs < 10_000 ? 1 : 0)}s`;
  const m = Math.floor(abs / 60_000);
  const s = Math.round((abs % 60_000) / 1000);
  return `${m}m ${s}s`;
}

/** What each editor action is called in the history. */
export const ACTION_LABELS: Record<string, string> = {
  "edit-line": "Edited line",
  delete: "Deleted line",
  insert: "Added line",
  merge: "Merged lines",
  "timeline-next": "Timeline Editor: Next",
  "timeline-prev": "Timeline Editor: Prev",
  "timeline-done": "Timeline Editor: Done",
  "timeline-undo": "Timeline Editor: Undo",
  shift: "Shifted timestamps",
  "ai-regenerate": "AI re-transcribed lines",
  "ai-timestamps": "AI re-timed lines",
  "accept-l1": "Accepted L1 change",
  "accept-all-l1": "Accepted all L1 changes",
  "undo-accept-all": "Undid accept-all",
  "admin-accept-l1": "Admin accepted L1 change",
  "admin-reject-l1": "Admin rejected L1 change",
  "admin-reject-l2": "Admin rejected L2 change",
  "admin-accept-all-l1": "Admin accepted all L1 changes",
  "admin-reject-all-l1": "Admin rejected all L1 changes",
  "admin-reject-all-l2": "Admin rejected all L2 changes",
  "device-copy-restored": "Restored unsaved changes kept on this device",
  "device-copy-applied": "Chose this device's unsaved changes",
  "device-copy-discarded": "Discarded this device's unsaved changes",
  edit: "Changed",
};

const quote = (s: string, max = 60) => {
  const one = s.replace(/\s+/g, " ").trim();
  return `"${one.length > max ? one.slice(0, max - 1) + "…" : one}"`;
};

/** One sentence describing a change, e.g. "Timeline Editor: Next — line 39 time …; 407 later lines moved up to 3m 25s earlier". */
export function describeChange(action: string, ch: CueRangeChange): string {
  const label = ACTION_LABELS[action] ?? action;
  const first = ch.at + 1;
  const { removed, added } = ch;

  if (removed.length === added.length) {
    if (removed.length === 1) {
      const a = removed[0];
      const b = added[0];
      const parts: string[] = [];
      if (a.t !== b.t) parts.push(`text ${quote(a.t)} → ${quote(b.t)}`);
      if (a.s !== b.s || a.e !== b.e) parts.push(`time ${a.s}–${a.e} → ${b.s}–${b.e}`);
      return `${label} — line ${first}: ${parts.join("; ")}`;
    }
    let textChanged = 0;
    let timeChanged = 0;
    let maxEarlier = 0;
    let maxLater = 0;
    for (let i = 0; i < removed.length; i++) {
      if (removed[i].t !== added[i].t) textChanged++;
      if (removed[i].s !== added[i].s || removed[i].e !== added[i].e) {
        timeChanged++;
        const d = srtTimeToMs(added[i].s) - srtTimeToMs(removed[i].s);
        if (!Number.isNaN(d)) {
          if (d < maxEarlier) maxEarlier = d;
          if (d > maxLater) maxLater = d;
        }
      }
    }
    const parts: string[] = [];
    if (timeChanged) {
      const moved: string[] = [];
      if (maxEarlier < 0) moved.push(`up to ${formatDuration(maxEarlier)} earlier`);
      if (maxLater > 0) moved.push(`up to ${formatDuration(maxLater)} later`);
      parts.push(`timing changed on ${timeChanged} lines${moved.length ? ` (${moved.join(", ")})` : ""}`);
    }
    if (textChanged) parts.push(`text changed on ${textChanged} lines`);
    return `${label} — lines ${first}–${first + removed.length - 1}: ${parts.join("; ")}`;
  }

  if (removed.length === 0) {
    return `${label} — ${added.length === 1 ? "1 new line" : `${added.length} new lines`} after line ${ch.at}${
      added.length === 1 && added[0].t ? `: ${quote(added[0].t)}` : ""
    }`;
  }
  if (added.length === 0) {
    return `${label} — removed ${removed.length === 1 ? `line ${first}: ${quote(removed[0].t)}` : `lines ${first}–${first + removed.length - 1}`}`;
  }
  if (removed.length === 2 && added.length === 1 && added[0].t === `${removed[0].t.trim()} ${removed[1].t.trim()}`) {
    return `${label} — lines ${first} and ${first + 1} joined: ${quote(added[0].t)}`;
  }
  return `${label} — lines ${first}–${first + removed.length - 1} (${removed.length}) replaced by ${added.length} line${added.length === 1 ? "" : "s"}`;
}

// ── Replaying a session ─────────────────────────────────────────────────────────

/** A history row as the server returns it (times in ms since epoch). */
export interface HistoryRow {
  id: number;
  sessionId: string;
  seq: number | null;
  type: string;
  action: string | null;
  summary: string | null;
  level: number | null;
  mode: string | null;
  userId: number | null;
  userName: string | null;
  device: string | null;
  clientTime: number | null;
  serverTime: number | null;
  stateHash: string | null;
  cueCount: number | null;
  payloadJson?: string | null;
  srtContent?: string | null;
}

export interface TypingInfo {
  line: number;
  before: LogCue;
  typed: LogCue;
}

export interface ReplayPoint {
  rowId: number;
  /** The whole transcript right after this step, or null if it can't be rebuilt. */
  cues: LogCue[] | null;
  /** True when the rebuilt transcript matches the fingerprint the editor recorded. */
  verified: boolean;
  problem?: string;
  change?: CueRangeChange;
  typing?: TypingInfo;
}

function parsePayload(row: HistoryRow): unknown {
  if (!row.payloadJson) return undefined;
  try {
    return JSON.parse(row.payloadJson);
  } catch {
    return undefined;
  }
}

/**
 * Replays one editor session (rows of a single sessionId). Full copies (SESSION_START, SNAPSHOT)
 * set the transcript; each CHANGE is applied on top and checked against its fingerprint. If a step
 * is missing (never reached the server) or doesn't fit, the following moments are marked as not
 * rebuildable until the next full copy.
 */
export function replaySession(rows: HistoryRow[]): Map<number, ReplayPoint> {
  const sorted = [...rows].filter((r) => r.seq != null).sort((a, b) => (a.seq as number) - (b.seq as number));
  const points = new Map<number, ReplayPoint>();
  let state: LogCue[] | null = null;
  let stateProblem: string | undefined = "This session's opening copy never reached the server";
  let prevSeq: number | null = null;

  for (const row of sorted) {
    const seq = row.seq as number;
    if (prevSeq !== null && seq !== prevSeq + 1) {
      state = null;
      stateProblem = `Steps ${prevSeq + 1}–${seq - 1} of this session never reached the server`;
    }
    prevSeq = seq;
    const payload = parsePayload(row);

    if (row.type === "SESSION_START" || row.type === "SNAPSHOT") {
      const cues = (payload as { cues?: LogCue[] } | undefined)?.cues;
      if (Array.isArray(cues)) {
        state = cues;
        const ok = !row.stateHash || cuesHash(cues) === row.stateHash;
        stateProblem = ok ? undefined : "This full copy does not match its fingerprint";
        points.set(row.id, { rowId: row.id, cues: state, verified: ok, problem: stateProblem });
      } else {
        state = null;
        stateProblem = "This full copy could not be read";
        points.set(row.id, { rowId: row.id, cues: null, verified: false, problem: stateProblem });
      }
      continue;
    }

    if (row.type === "CHANGE") {
      const change = payload as CueRangeChange | undefined;
      if (!change || !Array.isArray(change.removed) || !Array.isArray(change.added)) {
        state = null;
        stateProblem = "A change in this session could not be read";
        points.set(row.id, { rowId: row.id, cues: null, verified: false, problem: stateProblem });
        continue;
      }
      if (state === null) {
        points.set(row.id, { rowId: row.id, cues: null, verified: false, problem: stateProblem, change });
        continue;
      }
      try {
        const next = applyChange(state, change);
        if (row.stateHash && cuesHash(next) !== row.stateHash) {
          state = null;
          stateProblem = "The rebuilt version stopped matching the editor's fingerprint here";
          points.set(row.id, { rowId: row.id, cues: null, verified: false, problem: stateProblem, change });
        } else {
          state = next;
          points.set(row.id, { rowId: row.id, cues: state, verified: true, change });
        }
      } catch (e) {
        state = null;
        stateProblem = `Could not apply this change: ${(e as Error).message}`;
        points.set(row.id, { rowId: row.id, cues: null, verified: false, problem: stateProblem, change });
      }
      continue;
    }

    // Everything else (typing, saves, logouts, page events …) leaves the transcript as it was
    const typing = (row.type === "TYPING" || row.type === "CANCEL_EDIT") ? (payload as TypingInfo | undefined) : undefined;
    const verified = state !== null && (!row.stateHash || cuesHash(state) === row.stateHash);
    points.set(row.id, {
      rowId: row.id,
      cues: state,
      verified,
      problem: state === null ? stateProblem : verified ? undefined : "The editor's fingerprint differs here",
      typing,
    });
  }
  return points;
}

/** The transcript at a moment with someone's unconfirmed typing applied to its line. */
export function withTyping(cues: LogCue[], typing: TypingInfo): LogCue[] {
  const i = typing.line - 1;
  if (i < 0 || i >= cues.length) throw new Error(`Line ${typing.line} is not in this version (${cues.length} lines)`);
  const next = [...cues];
  next[i] = { ...typing.typed };
  return next;
}
