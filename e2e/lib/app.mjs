// Helpers that talk to the local backend directly (to prepare and to check the database).
import { API, APP, ADMIN, LECTURE_TITLE } from "../config.mjs";

export async function api(method, path, token, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path}: HTTP ${res.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

export async function login(user) {
  return (await api("POST", "/api/auth/login", null, { email: user.email, password: user.password })).token;
}

export async function testTranscriptId(adminToken) {
  const all = await api("GET", "/api/transcripts/all", adminToken);
  const t = all.find((x) => x.videoTitle === LECTURE_TITLE);
  if (!t) throw new Error(`Test lecture not found — run: npm run e2e:seed`);
  return t.id;
}

/** Puts the L1 draft back to the original transcript (through the app's own restore). */
export async function resetDraft(adminToken, id) {
  const ed = await api("GET", `/api/transcripts/${id}/editor`, adminToken);
  await api("PUT", `/api/transcripts/${id}/activity/restore`, adminToken, {
    level: 1, srtContent: ed.originalSrt, sourceLabel: "E2E reset",
  });
}

export async function draftText(adminToken, id) {
  return (await api("GET", `/api/transcripts/${id}/editor`, adminToken)).level1Srt ?? "";
}

/** Polls the saved L1 draft until check(text) is true. */
export async function waitForDraft(adminToken, id, check, what, timeoutMs = 20000) {
  const end = Date.now() + timeoutMs;
  let text = "";
  while (Date.now() < end) {
    text = await draftText(adminToken, id);
    if (check(text)) return text;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Saved draft never got: ${what}`);
}

export async function activity(adminToken, id) {
  return (await api("GET", `/api/transcripts/${id}/activity`, adminToken)).rows;
}

/** Opens the app, logs the page in as `user` (token in localStorage), then opens `path`. */
export async function openAs(page, token, path) {
  await page.goto(`${APP}/`);
  await page.eval(`localStorage.setItem("bdd_auth_token", ${JSON.stringify(token)})`);
  await page.goto(`${APP}${path}`);
}

export { ADMIN, APP };
