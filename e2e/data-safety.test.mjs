// End-to-end data-safety tests: a real browser (headless Chrome) against the LOCAL app + backend.
// Run: npm run test:e2e   (see e2e/README.md — needs the local backend, MySQL and `npm run e2e:seed`)
//
// Each test proves one way proofreading work could be lost does NOT lose it.
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { launchBrowser } from "./lib/cdp.mjs";
import { api, login, testTranscriptId, resetDraft, waitForDraft, draftText, activity, openAs, APP } from "./lib/app.mjs";
import { ADMIN, PROOFREADER } from "./config.mjs";

let browser, adminToken, proofToken, id;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

before(async () => {
  adminToken = await login(ADMIN);
  proofToken = await login(PROOFREADER);
  id = await testTranscriptId(adminToken);
  browser = await launchBrowser();
});
after(async () => { await browser?.close(); });
beforeEach(async () => { await resetDraft(adminToken, id); });

const editorPath = () => `/proofread/editor?id=${id}`;

async function openEditor(page) {
  await openAs(page, proofToken, editorPath());
  await page.waitForSelector('[data-cue="5"]', 60000);
  await sleep(4000); // the editor saves what it opened 3 s after loading; let that settle
}

async function editLine(page, n, text) {
  await page.click(`[data-cue="${n}"] button[title="Click to edit"]`);
  await page.fill(`[data-cue="${n}"] textarea`, text);
  await page.clickButton("Save", `document.querySelector('[data-cue="${n}"]')`);
}

test("an edited line is saved and is still there after reopening", async () => {
  const page = await browser.newPage();
  try {
    await openEditor(page);
    await editLine(page, 3, "Line three corrected (E2E)");
    await waitForDraft(adminToken, id, (t) => t.includes("Line three corrected (E2E)"), "line 3 edit");
    await page.goto(`${APP}${editorPath()}`);
    await page.waitForText("Line three corrected (E2E)", 30000);
  } finally { await page.close(); }
});

test("a change made in Timeline Editor Mode is saved when pressing Next", async () => {
  const page = await browser.newPage();
  try {
    await openEditor(page);
    await page.click('[data-cue="5"] button[title="Timeline Editor Mode"]');
    await page.waitForSelector("textarea");
    await page.fill("textarea", "Line five fixed in Timeline Editor (E2E)");
    await sleep(2000); // the unapplied text is logged after 1.5 s
    await page.clickButton("Next");
    await waitForDraft(adminToken, id, (t) => t.includes("Line five fixed in Timeline Editor (E2E)"), "timeline edit");
    const rows = await activity(adminToken, id);
    assert.ok(rows.some((r) => r.type === "TYPING" && /Timeline Editor, line 5/.test(r.summary ?? "")), "unapplied Timeline Editor text was logged");
    assert.ok(rows.some((r) => r.type === "CHANGE" && r.action === "timeline-next"), "the Next press was logged");
  } finally { await page.close(); }
});

/** Lines confirmed in Timeline Editor Mode, as saved on the server (1-based line numbers). */
async function reviewedOnServer(token, transcriptId) {
  const v = (await api("GET", `/api/transcripts/${transcriptId}/editor`, token)).level1ReviewedLines ?? "";
  const ranges = v.split(":")[1] ?? "";
  return ranges.split(",").filter(Boolean).flatMap((r) => {
    const [a, b] = r.split("-").map(Number);
    return Array.from({ length: (b ?? a) - a + 1 }, (_, i) => a + i);
  });
}
async function waitForReviewed(token, transcriptId, lines, what) {
  const end = Date.now() + 20000;
  while (Date.now() < end) {
    const got = await reviewedOnServer(token, transcriptId);
    if (lines.every((n) => got.includes(n))) return got;
    await sleep(500);
  }
  throw new Error(`Reviewed lines never saved: ${what}`);
}

test("a line confirmed with Timeline Editor Next is not moved by Next on an earlier line, on any device", async () => {
  const page = await browser.newPage();
  try {
    await openEditor(page);
    // Confirm line 3 (10–14 s, with a 1 s gap after line 2) with Next, then leave line 4 as it is
    await page.click('[data-cue="3"] button[title="Timeline Editor Mode"]');
    await page.waitForSelector("textarea");
    await page.clickButton("Next");
    await page.clickButton("Exit");
    await waitForReviewed(adminToken, id, [3], "line 3 confirmed");
    // Back on line 2: Next used to pull every later line up against it, undoing line 3
    await page.click('[data-cue="2"] button[title="Timeline Editor Mode"]');
    await page.waitForSelector("textarea");
    await page.clickButton("Next");
    await page.clickButton("Exit");
    await waitForReviewed(adminToken, id, [2, 3], "line 2 confirmed");
    await sleep(4000); // let the last autosave land
    const text = await draftText(adminToken, id);
    assert.ok(text.includes("3\n00:00:10,000 --> 00:00:14,000\nTest line 3"), "line 3 kept its confirmed times");
    // Another device (nothing kept on this one) still shows line 3 as reviewed
    await page.eval(`Object.keys(localStorage).filter((k) => k.startsWith("bdd_tx_unsaved_")).forEach((k) => localStorage.removeItem(k))`);
    await page.goto(`${APP}${editorPath()}`);
    await page.waitFor(`document.querySelector('[data-cue="3"] button')?.innerText.includes("✓")`, 60000, "line 3 marked reviewed");
  } finally { await page.close(); }
});

test("the phone Back gesture in Timeline Editor Mode applies the line instead of leaving the editor", async () => {
  const page = await browser.newPage();
  try {
    await openEditor(page);
    await page.click('[data-cue="6"] button[title="Timeline Editor Mode"]');
    await page.waitForSelector("textarea");
    await page.fill("textarea", "Line six fixed, then the Back gesture (E2E)");
    await page.eval("history.back()");
    await sleep(1500);
    assert.match(await page.url(), /\/proofread\/editor/, "still in the editor");
    await waitForDraft(adminToken, id, (t) => t.includes("Line six fixed, then the Back gesture (E2E)"), "line 6 applied by Back");
  } finally { await page.close(); }
});

test("deleting the line above in Timeline Editor Mode keeps the changes on the line being edited", async () => {
  const page = await browser.newPage();
  try {
    await openEditor(page);
    await page.click('[data-cue="9"] button[title="Timeline Editor Mode"]');
    await page.waitForSelector("textarea");
    await page.fill("textarea", "Line nine edited after deleting line eight (E2E)");
    // The trash icon on the card ABOVE the open line (line 8)
    await page.eval(`[...document.querySelectorAll('.fixed button[title="Delete cue"]')][0].click()`);
    await sleep(500);
    await page.clickButton("Exit");
    const text = await waitForDraft(adminToken, id, (t) => t.includes("Line nine edited after deleting line eight (E2E)"), "line 9 edit");
    assert.ok(text.includes("8\n00:00:40,000 --> 00:00:44,000\nLine nine edited after deleting line eight (E2E)"), "the edit is on the old line 9, now line 8");
    assert.ok(text.includes("9\n00:00:45,000 --> 00:00:49,000\nTest line 10 of the E2E lecture"), "the next line keeps its own text and times");
    assert.ok(!text.includes("Test line 8 of the E2E lecture"), "line 8 is deleted");
  } finally { await page.close(); }
});

test("an edit made offline is kept on the device and saved when the editor is opened again", async () => {
  const first = await browser.newPage();
  await openEditor(first);
  await first.setOffline(true);
  await editLine(first, 7, "Line seven edited while offline (E2E)");
  await sleep(4500); // autosave fails while offline
  const kept = await first.eval(`Object.keys(localStorage).some((k) => k.startsWith("bdd_tx_unsaved_"))`);
  assert.equal(kept, true, "the edit is kept on the device");
  assert.equal((await draftText(adminToken, id)).includes("Line seven edited while offline"), false, "not on the server yet");
  const second = await first.sibling(); // same device, the tab was closed and opened again later
  await first.closeTab();
  try {
    await second.goto(`${APP}${editorPath()}`);
    await second.waitForText("Unsaved changes restored", 60000);
    await waitForDraft(adminToken, id, (t) => t.includes("Line seven edited while offline (E2E)"), "offline edit");
  } finally { await second.close(); }
});

test("reopening the editor shows exactly the version that was left", async () => {
  const page = await browser.newPage();
  try {
    await openEditor(page);
    await editLine(page, 4, "Line four corrected (E2E)");
    await waitForDraft(adminToken, id, (t) => t.includes("Line four corrected (E2E)"), "line 4 edit");
    await page.goto(`${APP}/proofread`); // leave the editor
    await sleep(1500);
    await page.goto(`${APP}${editorPath()}`);
    await page.waitForSelector('[data-cue="5"]', 60000);
    await sleep(3000);
    const rows = (await activity(adminToken, id)).filter((r) => r.sessionId !== "server");
    const sessions = [...new Set(rows.map((r) => r.sessionId))];
    const prev = sessions[sessions.length - 2], last = sessions[sessions.length - 1];
    const leftWith = rows.filter((r) => r.sessionId === prev && r.stateHash).pop();
    const openedWith = rows.find((r) => r.sessionId === last && r.type === "SESSION_START");
    assert.ok(leftWith && openedWith, "both sessions were logged");
    assert.equal(openedWith.stateHash, leftWith.stateHash, "the editor opened exactly what was left");
  } finally { await page.close(); }
});

test("when the login ends mid-edit, the editor locks, and the work is saved after logging in again", async () => {
  const page = await browser.newPage();
  try {
    await openEditor(page);
    await page.eval(`localStorage.setItem("bdd_auth_token", "expired.e2e.token")`);
    await editLine(page, 9, "Line nine typed as the login ended (E2E)");
    await page.waitForText("You've been logged out", 30000);
    assert.match(await page.url(), /\/proofread\/editor/, "stayed on the editor (no work thrown away)");
    await page.clickButton("Log in again");
    await page.waitForSelector('input[type="email"]', 30000);
    await page.fill('input[type="email"]', PROOFREADER.email);
    await page.fill('input[type="password"]', PROOFREADER.password);
    await page.eval(`document.querySelector("form").requestSubmit()`);
    await page.waitFor(`location.pathname === "/proofread/editor"`, 30000, "back in the editor");
    await waitForDraft(adminToken, id, (t) => t.includes("Line nine typed as the login ended (E2E)"), "work done while logged out");
  } finally { await page.close(); }
});

test("restoring a step from the History puts back exactly that version", async () => {
  const page = await browser.newPage();
  try {
    await openEditor(page);
    await editLine(page, 3, "Keep this line three (E2E)");
    await waitForDraft(adminToken, id, (t) => t.includes("Keep this line three (E2E)"), "first edit");
    await editLine(page, 11, "Unwanted change to line eleven (E2E)");
    await waitForDraft(adminToken, id, (t) => t.includes("Unwanted change to line eleven"), "second edit");
    await page.close();

    const admin = await browser.newPage();
    try {
      await openAs(admin, adminToken, `/admin/history?id=${id}`);
      await admin.waitForText("editor session", 30000);
      await admin.clickButton("E2E Proofreader");
      await admin.waitForText("Keep this line three", 30000);
      await admin.eval(`[...document.querySelectorAll("button")].find((b) => b.innerText.includes("Keep this line three")).click()`);
      await admin.waitForText("Rebuilt and checked", 15000);
      await admin.clickButton("Restore into L1 draft");
      await admin.clickButton("Restore L1 draft");
      await admin.waitForText("Restored the L1 draft", 15000);
    } finally { await admin.close(); }
    const text = await draftText(adminToken, id);
    assert.ok(text.includes("Keep this line three (E2E)"), "the chosen version is back");
    assert.ok(!text.includes("Unwanted change to line eleven"), "the later change is gone from the draft");
    const rows = await activity(adminToken, id);
    assert.ok(rows.some((r) => r.action === "before-restore"), "the replaced draft was kept as a server copy");
  } finally { /* page already closed */ }
});
