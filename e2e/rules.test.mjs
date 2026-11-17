// End-to-end tests for the app-wide rules (CLAUDE.md): saves need a login; failed saves are loud;
// listening stays public. Run: npm run test:e2e
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { launchBrowser } from "./lib/cdp.mjs";
import { login, openAs, APP } from "./lib/app.mjs";
import { LISTENER, API } from "./config.mjs";

let browser, listenerToken;
before(async () => {
  listenerToken = await login(LISTENER);
  browser = await launchBrowser();
});
after(async () => { await browser?.close(); });

test("someone just listening is never sent to the login page", async () => {
  const page = await browser.newPage();
  try {
    await page.goto(`${APP}/`);
    await new Promise((r) => setTimeout(r, 3000));
    assert.equal(new URL(await page.url()).pathname, "/");
  } finally { await page.close(); }
});

test("a save after the login ended goes to the login page, says why, and remembers the page", async () => {
  const page = await browser.newPage();
  try {
    await openAs(page, listenerToken, "/feedback");
    await page.waitForSelector("textarea", 30000);
    await page.fill("textarea", "Feedback written while the login ended (E2E)");
    await page.eval(`localStorage.setItem("bdd_auth_token", "expired.e2e.token")`);
    await page.clickButton("Submit Feedback");
    await page.waitFor(`location.pathname === "/login"`, 15000, "the login page");
    await page.waitForText("Your login has ended", 10000);
    const back = await page.eval(`localStorage.getItem("bdd_return_to")`);
    assert.match(back ?? "", /\/feedback/);
  } finally { await page.close(); }
});

test("a save that fails on the server shows a red notice with the reason", async () => {
  const page = await browser.newPage();
  try {
    await page.fakeResponse({ urlPattern: `${API}/api/feedback`, method: "POST", status: 500, body: { error: "Simulated outage (E2E)" }, origin: APP });
    await openAs(page, listenerToken, "/feedback");
    await page.waitForSelector("textarea", 30000);
    await page.fill("textarea", "This save will fail (E2E)");
    await page.clickButton("Submit Feedback");
    await page.waitForText("Could not save", 10000);
    assert.ok(await page.hasText("Simulated outage (E2E) (HTTP 500)"));
    assert.ok(await page.hasText("POST /api/feedback"));
  } finally { await page.close(); }
});
