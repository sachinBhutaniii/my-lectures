// ─────────────────────────────────────────────────────────────────────────────
// THE RULE for every API call that saves, updates or deletes anything:
//
//   1. Login required by default. A logged-out user who tries to save is sent to
//      the login page (and brought back afterwards). Only the endpoints listed in
//      PUBLIC_WRITE_ENDPOINTS may be written without login.
//   2. Fail loudly. If a save fails, the user sees a red notice with the reason
//      (and it is logged to the console). Never swallow a failed save.
//
// Both happen automatically in lib/axios.ts for every request made with apiClient,
// so new APIs get this without doing anything. Opt-outs are per request and must
// say why (see the AxiosRequestConfig flags in lib/axios.ts):
//   • skipLoginRedirect – background calls that must never bounce the user away
//                         (e.g. listening-streak sync, proofreading activity log).
//   • skipLoudError     – the caller already shows its own error for this failure.
// Do not call fetch() for writes; use apiClient, or authedWriteFetch() below for
// file uploads that need the browser's own multipart handling.
// ─────────────────────────────────────────────────────────────────────────────
import { API_BASE_URL } from "@/lib/apiBase";
import { TOKEN_KEY, SESSION_EXPIRED_EVENT, rememberReturnTo, rememberLoginReason } from "@/lib/session";
import { showLoudError } from "@/lib/notices";
import { isPublicWrite, describeFailure, requestLabel } from "@/lib/apiRulesCore";

export {
  PUBLIC_WRITE_ENDPOINTS, isWrite, pathOf, isPublicWrite, isAuthCall, describeFailure, requestLabel,
} from "@/lib/apiRulesCore";

/** A screen (e.g. the proofreading editor) can take over "login required": it shows its own
 *  lock screen and keeps unsaved work instead of the page being sent to /login. */
let loginRequiredOverride: (() => void) | null = null;
export function overrideLoginRequired(handler: () => void): () => void {
  loginRequiredOverride = handler;
  return () => { if (loginRequiredOverride === handler) loginRequiredOverride = null; };
}

let redirecting = false;
/** Send the user to the login page (once), remembering where they were and why. */
export function requireLogin(reason: string): void {
  if (typeof window === "undefined") return;
  if (loginRequiredOverride) {
    console.warn(`[login required] ${reason} — handled by the current screen`);
    loginRequiredOverride();
    return;
  }
  if (redirecting || window.location.pathname.startsWith("/login")) return;
  redirecting = true;
  console.warn(`[login required] ${reason} — going to the login page`);
  rememberReturnTo(window.location.pathname + window.location.search);
  rememberLoginReason(reason);
  window.location.assign("/login");
}

/**
 * fetch() for multipart uploads, with the same rules as apiClient: login required (else
 * go to login), Authorization attached, and any failure shown loudly and thrown.
 */
export async function authedWriteFetch(path: string, init: RequestInit & { method: string }): Promise<Response> {
  const label = requestLabel(init.method, path);
  const token = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
  if (!token && !isPublicWrite(path)) {
    requireLogin("Please log in to save. Your change was not saved.");
    throw new Error(`Login required for ${label}`);
  }
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  } catch (e) {
    const reason = describeFailure(undefined, undefined);
    showLoudError("Could not save", `${reason} · ${label}`);
    throw e;
  }
  if (!res.ok) {
    const data = await res.clone().json().catch(() => ({}));
    if (res.status === 401) {
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
      requireLogin("Your login has ended. Please log in again — your change was not saved.");
    } else {
      showLoudError("Could not save", `${describeFailure(res.status, data)} · ${label}`);
    }
    throw new Error(describeFailure(res.status, data));
  }
  return res;
}
