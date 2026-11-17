// Proofreading activity log — the browser side.
//
// Everything the editor reports is first written to this device (localStorage) and then
// uploaded to the server in the background. Events leave the device only after the server
// confirms it stored them, so nothing is lost if the network drops, the login expires, the
// tab is closed or the phone dies: whatever is still waiting is uploaded the next time this
// person opens the proofreading pages on this device.
import { AxiosError } from "axios";
import apiClient from "@/lib/axios";
import type { SrtCue } from "@/lib/srtUtils";
import type { LogCue } from "@/lib/activityDiff";

export type ActivityType =
  | "SESSION_START" | "CHANGE" | "TYPING" | "CANCEL_EDIT" | "SNAPSHOT"
  | "SAVE_OK" | "SAVE_FAILED" | "SUBMIT" | "SUBMIT_FAILED" | "PUBLISH" | "PUBLISH_FAILED"
  | "LOGGED_OUT" | "LOGGED_IN" | "UI";

export type EditorMode = "l1" | "l2" | "admin";

export interface ActivityEvent {
  seq: number;
  type: ActivityType;
  action?: string;
  summary: string;
  clientTime: number;
  payloadJson?: string;
  stateHash?: string;
  cueCount?: number;
}

interface OutboxRecord {
  v: 1;
  transcriptId: number;
  sessionId: string;
  level: 1 | 2;
  mode: EditorMode;
  device: string;
  userId: number;
  events: ActivityEvent[];
}

export interface UploadStatus {
  /** ok: everything is on the server · waiting: being uploaded · offline: will retry ·
   *  loggedOut: waits for login · refused: server said no (kept on device) · deviceFull: couldn't store on device */
  state: "ok" | "waiting" | "offline" | "loggedOut" | "refused" | "deviceFull";
  waiting: number;
}

const OUTBOX_PREFIX = "bdd_activity_outbox_";
const MAX_BATCH_EVENTS = 100;
const MAX_BATCH_CHARS = 900_000;

export function toLogCues(cues: SrtCue[]): LogCue[] {
  return cues.map((c) => ({ s: c.startTime, e: c.endTime, t: c.text }));
}

function newSessionId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  } catch { /* fall through */ }
  return `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

function deviceDescription(): string {
  if (typeof navigator === "undefined") return "unknown";
  const w = typeof window !== "undefined" ? ` · screen ${window.screen?.width ?? "?"}×${window.screen?.height ?? "?"}` : "";
  return `${navigator.userAgent}${w}`.slice(0, 255);
}

function takeBatch(events: ActivityEvent[]): ActivityEvent[] {
  const batch: ActivityEvent[] = [];
  let chars = 0;
  for (const e of events) {
    const size = (e.payloadJson?.length ?? 0) + e.summary.length + 200;
    if (batch.length > 0 && (batch.length >= MAX_BATCH_EVENTS || chars + size > MAX_BATCH_CHARS)) break;
    batch.push(e);
    chars += size;
  }
  return batch;
}

interface BatchResponse { received: number; stored: number; alreadyStored: number; maxSeq: number }

async function postBatch(rec: OutboxRecord, batch: ActivityEvent[]): Promise<void> {
  const res = await apiClient.post<BatchResponse>(`/api/transcripts/${rec.transcriptId}/activity`, {
    sessionId: rec.sessionId,
    level: rec.level,
    mode: rec.mode,
    device: rec.device,
    events: batch,
  });
  const expectedMax = batch[batch.length - 1].seq;
  if (res.data?.received !== batch.length || res.data?.maxSeq !== expectedMax) {
    throw new Error(
      `Server confirmed ${res.data?.received} events up to seq ${res.data?.maxSeq}, expected ${batch.length} up to ${expectedMax}`
    );
  }
}

type FailureKind = "retry" | "auth" | "refused";
function classify(err: unknown): FailureKind {
  const status = (err as AxiosError)?.response?.status;
  if (status === 401) return "auth";
  if (status === 400 || status === 403 || status === 413) return "refused";
  // no response (offline), 404 (e.g. the server is still being updated), 5xx, 408, 429,
  // or a confirmation mismatch: keep the events on the device and try again later
  return "retry";
}

function readRecord(key: string): OutboxRecord | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const rec = JSON.parse(raw) as OutboxRecord;
    return rec && rec.v === 1 && Array.isArray(rec.events) ? rec : null;
  } catch (e) {
    console.error(`[activity-log] Could not read kept history ${key}`, e);
    return null;
  }
}

/** Keeps a record on the device; false if the device refused (storage full / blocked). */
function writeRecord(key: string, rec: OutboxRecord): boolean {
  try {
    if (rec.events.length === 0) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(rec));
    return true;
  } catch (e) {
    console.error(`[activity-log] Could not keep ${rec.events.length} history events on this device`, e);
    return false;
  }
}

/** One editor session's log. Create once per editor opening. */
export class ActivityLogger {
  readonly sessionId: string;
  private readonly key: string;
  private readonly rec: OutboxRecord;
  private seq = 0;
  private sending = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private backoffMs = 0;
  private blocked: "auth" | "refused" | null = null;
  private lastFailure: "retry" | null = null;
  private deviceFull = false;
  private listeners = new Set<(s: UploadStatus) => void>();

  constructor(opts: { transcriptId: number; level: 1 | 2; mode: EditorMode; userId: number }) {
    this.sessionId = newSessionId();
    this.key = `${OUTBOX_PREFIX}${opts.userId}_${this.sessionId}`;
    this.rec = {
      v: 1,
      transcriptId: opts.transcriptId,
      sessionId: this.sessionId,
      level: opts.level,
      mode: opts.mode,
      device: deviceDescription(),
      userId: opts.userId,
      events: [],
    };
  }

  log(
    type: ActivityType,
    f: { action?: string; summary: string; payload?: unknown; stateHash?: string; cueCount?: number },
    opts?: { urgent?: boolean }
  ): void {
    const ev: ActivityEvent = {
      seq: ++this.seq,
      type,
      action: f.action,
      summary: f.summary.slice(0, 1000),
      clientTime: Date.now(),
      payloadJson: f.payload === undefined ? undefined : JSON.stringify(f.payload),
      stateHash: f.stateHash,
      cueCount: f.cueCount,
    };
    this.rec.events.push(ev);
    this.deviceFull = !writeRecord(this.key, this.rec);
    this.schedule(opts?.urgent ? 0 : 1500);
    this.emit();
  }

  /** Upload now (e.g. the login came back, or the page is being hidden). */
  resume(): void {
    if (this.blocked === "auth") this.blocked = null;
    this.schedule(0);
  }

  status(): UploadStatus {
    const waiting = this.rec.events.length;
    if (this.deviceFull) return { state: "deviceFull", waiting };
    if (this.blocked === "refused") return { state: "refused", waiting };
    if (this.blocked === "auth" && waiting > 0) return { state: "loggedOut", waiting };
    if (waiting === 0) return { state: "ok", waiting };
    return { state: this.lastFailure ? "offline" : "waiting", waiting };
  }

  onStatus(cb: (s: UploadStatus) => void): () => void {
    this.listeners.add(cb);
    return () => { this.listeners.delete(cb); };
  }

  /** Stop the timer and try one last upload (whatever fails stays on the device). */
  dispose(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    void this.flush();
  }

  private emit() {
    const s = this.status();
    this.listeners.forEach((cb) => cb(s));
  }

  private schedule(delayMs: number) {
    if (this.timer) {
      if (delayMs > 0) return; // one is already coming
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, delayMs);
  }

  async flush(): Promise<void> {
    if (this.sending || this.rec.events.length === 0 || this.blocked) return;
    this.sending = true;
    try {
      while (this.rec.events.length > 0) {
        const batch = takeBatch(this.rec.events);
        try {
          await postBatch(this.rec, batch);
        } catch (err) {
          const kind = classify(err);
          const status = (err as AxiosError)?.response?.status;
          if (kind === "auth") {
            this.blocked = "auth";
            console.warn(`[activity-log] Logged out: ${this.rec.events.length} history events wait on this device`);
          } else if (kind === "refused") {
            this.blocked = "refused";
            console.error(
              `[activity-log] Server refused history upload (HTTP ${status}) for transcript ${this.rec.transcriptId}, ` +
                `session ${this.sessionId}; ${this.rec.events.length} events kept on this device`,
              (err as AxiosError)?.response?.data ?? err
            );
          } else {
            this.lastFailure = "retry";
            this.backoffMs = Math.min(60_000, this.backoffMs ? this.backoffMs * 2 : 5_000);
            console.warn(
              `[activity-log] Upload failed (${status ?? "no connection"}); retrying in ${this.backoffMs / 1000}s. ` +
                `${this.rec.events.length} events kept on this device`,
              err
            );
            this.schedule(this.backoffMs);
          }
          return;
        }
        const sent = new Set(batch.map((e) => e.seq));
        this.rec.events = this.rec.events.filter((e) => !sent.has(e.seq));
        this.deviceFull = !writeRecord(this.key, this.rec);
        this.backoffMs = 0;
        this.lastFailure = null;
      }
    } finally {
      this.sending = false;
      this.emit();
    }
  }
}

let leftoversRunning = false;

/**
 * Uploads history kept on this device from earlier editor sessions of this user (closed tab,
 * dead battery, expired login …). Records leave the device only once the server confirms them.
 */
export async function uploadLeftoverActivity(userId: number, skipSessionId?: string): Promise<void> {
  if (leftoversRunning || typeof localStorage === "undefined") return;
  leftoversRunning = true;
  try {
    const prefix = `${OUTBOX_PREFIX}${userId}_`;
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix) && !k.endsWith(`_${skipSessionId}`)) keys.push(k);
    }
    if (keys.length === 0) return;
    console.info(`[activity-log] Uploading history kept on this device from ${keys.length} earlier session(s)`);
    for (const key of keys) {
      const rec = readRecord(key);
      if (!rec) continue;
      const total = rec.events.length;
      while (rec.events.length > 0) {
        const batch = takeBatch(rec.events);
        try {
          await postBatch(rec, batch);
        } catch (err) {
          console.warn(
            `[activity-log] Could not upload kept history ${key} (${rec.events.length} events left); will try again later`,
            err
          );
          return;
        }
        const sent = new Set(batch.map((e) => e.seq));
        rec.events = rec.events.filter((e) => !sent.has(e.seq));
        writeRecord(key, rec);
      }
      console.info(`[activity-log] Uploaded ${total} kept events for transcript ${rec.transcriptId}, session ${rec.sessionId}`);
    }
  } finally {
    leftoversRunning = false;
  }
}
