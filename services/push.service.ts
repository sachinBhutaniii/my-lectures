import apiClient from "@/lib/axios";

const VAPID_PUBLIC_KEY =
  "BEe6Qc8rBQ8LjVYx7-2nSAoiiZX9qsLPA5JOTvXqAebZTQhy_jiAPVrWz8qU7F6mkvFJnasUfEUVfFwd_XwDwQY";

// ── Helpers ────────────────────────────────────────────────────────────────

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const buf = new ArrayBuffer(rawData.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < rawData.length; i++) view[i] = rawData.charCodeAt(i);
  return buf;
}

/** Convert a local HH:mm string to UTC HH:mm using the browser's timezone offset. */
export function localTimeToUtc(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  // getTimezoneOffset() returns minutes behind UTC (negative for UTC+ zones)
  const offsetMins = new Date().getTimezoneOffset();
  const utcMins = ((h * 60 + m + offsetMins) % 1440 + 1440) % 1440;
  return `${String(Math.floor(utcMins / 60)).padStart(2, "0")}:${String(utcMins % 60).padStart(2, "0")}`;
}

/** Convert a UTC HH:mm string back to local HH:mm. */
export function utcTimeToLocal(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const offsetMins = new Date().getTimezoneOffset();
  const localMins = ((h * 60 + m - offsetMins) % 1440 + 1440) % 1440;
  return `${String(Math.floor(localMins / 60)).padStart(2, "0")}:${String(localMins % 60).padStart(2, "0")}`;
}

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

// ── API calls ──────────────────────────────────────────────────────────────

export interface PushStatus {
  active: boolean;
  reminderTimeUtc: string;
}

export async function getPushStatus(): Promise<PushStatus | null> {
  try {
    const res = await apiClient.get<PushStatus>("/api/push/subscription");
    return res.data;
  } catch (e: any) {
    if (e?.response?.status === 204 || e?.response?.status === 404) return null;
    throw e;
  }
}

function arrayBufferToBase64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Wait for a SW registration to reach "activated" state. */
function waitForActivation(reg: ServiceWorkerRegistration): Promise<void> {
  return new Promise((resolve, reject) => {
    if (reg.active) { resolve(); return; }
    const sw = reg.installing || reg.waiting;
    if (!sw) { reject(new Error("No service worker found in registration.")); return; }
    sw.addEventListener("statechange", function handler() {
      if (sw.state === "activated") { sw.removeEventListener("statechange", handler); resolve(); }
      if (sw.state === "redundant") { sw.removeEventListener("statechange", handler); reject(new Error("Service worker became redundant.")); }
    });
  });
}

export async function subscribePush(reminderTimeLocal: string): Promise<void> {
  // Get or create the SW registration — don't rely on navigator.serviceWorker.ready
  // which never resolves if a previous registration attempt failed.
  let reg: ServiceWorkerRegistration;
  try {
    const existing = await navigator.serviceWorker.getRegistration("/");
    if (existing) {
      // Kick any waiting SW into active state
      if (existing.waiting) existing.waiting.postMessage({ type: "SKIP_WAITING" });
      reg = existing;
    } else {
      // No registration at all — try to register fresh
      reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    }
  } catch (err: any) {
    throw new Error(err?.message || "Could not register service worker. Try refreshing the page.");
  }

  // Wait for the SW to become active (with timeout)
  await Promise.race([
    waitForActivation(reg),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("Service worker timed out. Try refreshing the page.")),
        12000,
      )
    ),
  ]);
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });

  // Use getKey() for cross-browser compatibility (toJSON().keys can be null on some browsers)
  const p256dh = arrayBufferToBase64url(sub.getKey("p256dh")!);
  const auth   = arrayBufferToBase64url(sub.getKey("auth")!);

  await apiClient.post("/api/push/subscribe", {
    endpoint: sub.endpoint,
    p256dh,
    auth,
    reminderTimeUtc: localTimeToUtc(reminderTimeLocal),
  });
}

export async function updateReminderTime(reminderTimeLocal: string): Promise<void> {
  await apiClient.put("/api/push/reminder-time", {
    reminderTimeUtc: localTimeToUtc(reminderTimeLocal),
  });
}

export async function unsubscribePush(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) await sub.unsubscribe();
  } catch { /* ignore browser-level errors */ }
  await apiClient.delete("/api/push/subscribe");
}
