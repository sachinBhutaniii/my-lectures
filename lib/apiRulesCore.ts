// Pure parts of the API rule (no imports), so they can be tested with `node --test`.
// The rule itself is described in lib/apiRules.ts.

/** Endpoints that may be WRITTEN without login. Add one only with a reason. */
export const PUBLIC_WRITE_ENDPOINTS: { prefix: string; reason: string }[] = [
  { prefix: "/api/auth/", reason: "log in and sign up" },
];

const WRITE_METHODS = new Set(["post", "put", "patch", "delete"]);

export function isWrite(method?: string): boolean {
  return WRITE_METHODS.has((method ?? "get").toLowerCase());
}

/** Path part of a request URL ("/api/x?y" for "https://host/api/x?y" or "/api/x?y"). */
export function pathOf(url?: string): string {
  if (!url) return "";
  try {
    return url.startsWith("http") ? new URL(url).pathname : url.split("?")[0];
  } catch {
    return url;
  }
}

export function isPublicWrite(url?: string): boolean {
  const p = pathOf(url);
  return PUBLIC_WRITE_ENDPOINTS.some((e) => p.startsWith(e.prefix));
}

/** Calls that must never carry a (possibly stale) login token: login / sign-up themselves. */
export function isAuthCall(url?: string): boolean {
  return pathOf(url).startsWith("/api/auth/");
}

/** Best human-readable reason for a failed request. */
export function describeFailure(status: number | undefined, data: unknown, fallback?: string): string {
  const body = (data ?? {}) as { error?: unknown; message?: unknown };
  const serverMsg = typeof body.error === "string" ? body.error : typeof body.message === "string" ? body.message : null;
  if (serverMsg) return status ? `${serverMsg} (HTTP ${status})` : serverMsg;
  if (status === 403) return "You don't have permission to do this (HTTP 403)";
  if (status === 404) return "Not found on the server (HTTP 404)";
  if (status === 413) return "The file or data is too large (HTTP 413)";
  if (status && status >= 500) return `The server had a problem (HTTP ${status}). Please try again; if it keeps happening, tell the admin.`;
  if (status) return `Request failed (HTTP ${status})`;
  return fallback ?? "No connection to the server. Check your internet and try again.";
}

/** Short label for a request, e.g. "PUT /api/transcripts/118/save-draft". */
export function requestLabel(method?: string, url?: string): string {
  return `${(method ?? "GET").toUpperCase()} ${pathOf(url)}`;
}
