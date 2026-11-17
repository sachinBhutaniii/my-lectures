// Tiny browser driver for the end-to-end tests: starts the installed Chrome headless and talks
// to it over the Chrome DevTools Protocol. No npm dependency (Node 22+ has WebSocket built in).
// Set E2E_CHROME to use another Chrome/Chromium binary.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function chromePath() {
  if (process.env.E2E_CHROME) return process.env.E2E_CHROME;
  const candidates = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
  ];
  const found = candidates.find((p) => existsSync(p));
  if (!found) throw new Error("Chrome not found. Install Google Chrome or set E2E_CHROME to a Chrome/Chromium binary.");
  return found;
}

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  const listeners = new Set();
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject, method } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(`${method}: ${msg.error.message}`));
      else resolve(msg.result);
    } else if (msg.method) {
      for (const l of listeners) l(msg);
    }
  });
  const ready = new Promise((res, rej) => { ws.addEventListener("open", res); ws.addEventListener("error", rej); });
  return {
    ready,
    send(method, params = {}, sessionId) {
      const id = nextId++;
      ws.send(JSON.stringify({ id, method, params, sessionId }));
      return new Promise((resolve, reject) => pending.set(id, { resolve, reject, method }));
    },
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    close() { ws.close(); },
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launchBrowser() {
  const userDataDir = mkdtempSync(join(tmpdir(), "e2e-chrome-"));
  const proc = spawn(chromePath(), [
    "--headless=new", "--remote-debugging-port=0", `--user-data-dir=${userDataDir}`,
    "--no-first-run", "--no-default-browser-check", "--window-size=420,900", "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });
  const wsUrl = await new Promise((resolve, reject) => {
    let buf = "";
    const t = setTimeout(() => reject(new Error(`Chrome did not start: ${buf.slice(-400)}`)), 30000);
    proc.stderr.on("data", (d) => {
      buf += d;
      const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) { clearTimeout(t); resolve(m[1]); }
    });
    proc.on("exit", (code) => reject(new Error(`Chrome exited (${code}): ${buf.slice(-400)}`)));
  });
  const cdp = connect(wsUrl);
  await cdp.ready;
  return {
    /** A fresh, isolated tab (own cookies / localStorage). */
    async newPage() {
      const { browserContextId } = await cdp.send("Target.createBrowserContext");
      const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank", browserContextId });
      const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
      return makePage(cdp, sessionId, targetId, browserContextId);
    },
    async close() {
      const exited = proc.exitCode !== null ? Promise.resolve() : new Promise((r) => proc.once("exit", r));
      try { await cdp.send("Browser.close"); } catch { /* already gone */ }
      cdp.close();
      await Promise.race([exited, sleep(5000)]);
      if (proc.exitCode === null) { proc.kill("SIGKILL"); await Promise.race([exited, sleep(2000)]); }
      rmSync(userDataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    },
  };
}

async function makePage(cdp, sessionId, targetId, browserContextId) {
  const send = (m, p) => cdp.send(m, p, sessionId);
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Network.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 420, height: 900, deviceScaleFactor: 1, mobile: false });
  const consoleLines = [];
  cdp.on((msg) => {
    if (msg.sessionId !== sessionId) return;
    if (msg.method === "Runtime.consoleAPICalled") {
      consoleLines.push(`[${msg.params.type}] ${msg.params.args.map((a) => a.value ?? a.description ?? "").join(" ")}`);
    }
  });

  const page = {
    consoleLines,
    async eval(expression) {
      const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(`In page: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
      return r.result.value;
    },
    async goto(url) {
      const r = await send("Page.navigate", { url });
      if (r.errorText) throw new Error(`Could not open ${url}: ${r.errorText}`);
      await sleep(300);
      await page.waitFor(`document.readyState === "complete"`, 30000, `load ${url}`);
    },
    /** Waits until the JS expression is truthy. */
    async waitFor(expression, timeoutMs = 15000, what = expression) {
      const end = Date.now() + timeoutMs;
      let lastError = "";
      while (Date.now() < end) {
        try { if (await page.eval(`!!(${expression})`)) return; } catch (e) { lastError = ` (last error: ${e.message})`; }
        await sleep(150);
      }
      throw new Error(`Timed out after ${timeoutMs} ms waiting for: ${what}${lastError}`);
    },
    async waitForSelector(selector, timeoutMs) {
      await page.waitFor(`document.querySelector(${JSON.stringify(selector)})`, timeoutMs, selector);
    },
    async waitForText(text, timeoutMs) {
      await page.waitFor(`document.body && document.body.innerText.includes(${JSON.stringify(text)})`, timeoutMs, `text "${text}"`);
    },
    async hasText(text) {
      return page.eval(`document.body.innerText.includes(${JSON.stringify(text)})`);
    },
    async click(selector) {
      await page.waitForSelector(selector);
      await page.eval(`document.querySelector(${JSON.stringify(selector)}).click()`);
    },
    /** Clicks the first button whose text starts with `label`. */
    async clickButton(label, within = "document") {
      const expr = `[...${within}.querySelectorAll("button")].find((b) => b.innerText.trim().startsWith(${JSON.stringify(label)}))`;
      await page.waitFor(expr, 15000, `button "${label}"`);
      await page.eval(`${expr}.click()`);
    },
    /** Types into an input/textarea the way React notices. */
    async fill(selector, value) {
      await page.waitForSelector(selector);
      await page.eval(`(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto, "value").set.call(el, ${JSON.stringify(value)});
        el.dispatchEvent(new Event("input", { bubbles: true }));
      })()`);
    },
    async url() { return page.eval("location.href"); },
    async setOffline(offline) {
      await send("Network.emulateNetworkConditions", { offline, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    },
    /** Answers matching requests with a fake response (e.g. a server error). */
    async fakeResponse({ urlPattern, method, status, body, origin }) {
      await send("Fetch.enable", { patterns: [{ urlPattern, requestStage: "Request" }] });
      cdp.on(async (msg) => {
        if (msg.sessionId !== sessionId || msg.method !== "Fetch.requestPaused") return;
        const { requestId, request } = msg.params;
        if (request.method !== method) return send("Fetch.continueRequest", { requestId });
        await send("Fetch.fulfillRequest", {
          requestId, responseCode: status, body: Buffer.from(JSON.stringify(body)).toString("base64"),
          responseHeaders: [
            { name: "Content-Type", value: "application/json" },
            { name: "Access-Control-Allow-Origin", value: origin },
          ],
        });
      });
    },
    /** Another tab in the same profile (shares localStorage), e.g. to reopen after closing. */
    async sibling() {
      const t = await cdp.send("Target.createTarget", { url: "about:blank", browserContextId });
      const a = await cdp.send("Target.attachToTarget", { targetId: t.targetId, flatten: true });
      return makePage(cdp, a.sessionId, t.targetId, browserContextId);
    },
    /** Closes this tab (like the user closing it). */
    async closeTab() {
      try { await cdp.send("Target.closeTarget", { targetId }); } catch { /* gone */ }
    },
    /** Closes the tab and throws away its profile. */
    async close() {
      await page.closeTab();
      try { await cdp.send("Target.disposeBrowserContext", { browserContextId }); } catch { /* gone */ }
    },
  };
  return page;
}
