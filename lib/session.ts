// Login-session helpers: token expiry, and "come back here after logging in".

export const TOKEN_KEY = "bdd_auth_token";
/** Fired (on window) when the backend rejects our token with 401. */
export const SESSION_EXPIRED_EVENT = "bdd-session-expired";

const RETURN_TO_KEY = "bdd_return_to";
const RETURN_TO_MAX_AGE_MS = 60 * 60 * 1000;

/** Expiry time (ms since epoch) from a JWT's `exp` claim, or null if unknown. */
export function getTokenExpiryMs(token: string | null): number | null {
  if (!token) return null;
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, "=")));
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

/** Remember a page to return to after the user logs in (e.g. the proofread editor). */
export function rememberReturnTo(path: string) {
  try {
    localStorage.setItem(RETURN_TO_KEY, JSON.stringify({ path, at: Date.now() }));
  } catch { /* storage unavailable */ }
}

/** Read and clear the remembered page. Only same-site paths that are under an hour old. */
export function takeReturnTo(): string | null {
  try {
    const raw = localStorage.getItem(RETURN_TO_KEY);
    localStorage.removeItem(RETURN_TO_KEY);
    if (!raw) return null;
    const { path, at } = JSON.parse(raw) as { path?: unknown; at?: unknown };
    if (typeof path !== "string" || !path.startsWith("/") || path.startsWith("//")) return null;
    if (typeof at !== "number" || Date.now() - at > RETURN_TO_MAX_AGE_MS) return null;
    return path;
  } catch {
    return null;
  }
}
