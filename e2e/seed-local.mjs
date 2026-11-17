// Prepares the LOCAL test database for the end-to-end tests (run: npm run e2e:seed).
// Needs the local backend (E2E_API_URL, default http://localhost:8081) and the mysql CLI.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { API, DB, MYSQL, ADMIN, PROOFREADER, LISTENER, LECTURE_TITLE } from "./config.mjs";

const sql = (query) => {
  const r = spawnSync(MYSQL[0], [...MYSQL.slice(1), "-N", DB], { input: query, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`mysql failed: ${r.stderr}`);
  return r.stdout.trim();
};
const esc = (s) => s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

for (const u of [ADMIN, PROOFREADER, LISTENER]) {
  const res = await fetch(`${API}/api/auth/register`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: u.name, email: u.email, password: u.password }),
  });
  if (!res.ok && res.status !== 400) throw new Error(`register ${u.email}: HTTP ${res.status} ${await res.text()}`);
  sql(`UPDATE ${DB}.users SET role='${u.role}' WHERE email='${u.email}';`);
}
const proofreaderId = sql(`SELECT id FROM ${DB}.users WHERE email='${PROOFREADER.email}';`);
if (!proofreaderId) throw new Error("proofreader account was not created");

let localeId = sql(`SELECT MIN(id) FROM ${DB}.locale WHERE code='en';`);
if (!localeId || localeId === "NULL") {
  sql(`INSERT INTO ${DB}.locale (code, name) VALUES ('en', 'English');`);
  localeId = sql(`SELECT MIN(id) FROM ${DB}.locale WHERE code='en';`);
}
let videoId = sql(`SELECT MIN(id) FROM ${DB}.video WHERE title='${esc(LECTURE_TITLE)}';`);
if (!videoId || videoId === "NULL") {
  sql(`INSERT INTO ${DB}.video (title, video_url, thumbnail_url, visibility) VALUES ('${esc(LECTURE_TITLE)}', 'https://example.invalid/e2e', 'https://example.invalid/e2e.jpg', 'PRIVATE');`);
  videoId = sql(`SELECT MIN(id) FROM ${DB}.video WHERE title='${esc(LECTURE_TITLE)}';`);
}
const srt = readFileSync(new URL("./fixtures/e2e-lecture.srt", import.meta.url), "utf8");
let vlId = sql(`SELECT MIN(id) FROM ${DB}.video_locale WHERE video_id=${videoId} AND locale_id=${localeId};`);
if (!vlId || vlId === "NULL") {
  sql(`INSERT INTO ${DB}.video_locale (video_id, locale_id, transcript_srt, first_draft_srt, approval_status, l1_review_submitted, l2_review_submitted, deployed)
       VALUES (${videoId}, ${localeId}, '${esc(srt)}', '${esc(srt)}', 'DRAFT', 0, 0, 0);`);
  vlId = sql(`SELECT MIN(id) FROM ${DB}.video_locale WHERE video_id=${videoId} AND locale_id=${localeId};`);
}
// Always start from: original transcript, assigned to the E2E proofreader as L1, nothing submitted
sql(`UPDATE ${DB}.video_locale SET transcript_srt='${esc(srt)}', level1_proofreader_id=${proofreaderId},
     level1_proofreader_name='${esc(PROOFREADER.name)}', approval_status='DRAFT', l1_review_submitted=0, deployed=0 WHERE id=${vlId};`);
console.log(`E2E seed ready: transcript ${vlId} ("${LECTURE_TITLE}"), proofreader ${PROOFREADER.email}, admin ${ADMIN.email}`);
