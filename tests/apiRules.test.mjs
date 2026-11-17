// Run: npm test — the app-wide rule for saves (login required unless whitelisted; fail loudly)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PUBLIC_WRITE_ENDPOINTS, isWrite, pathOf, isPublicWrite, isAuthCall, describeFailure, requestLabel,
} from "../lib/apiRulesCore.ts";

test("saves, updates and deletes are writes; reads are not", () => {
  for (const m of ["post", "PUT", "patch", "Delete"]) assert.equal(isWrite(m), true, m);
  for (const m of ["get", "GET", "head", "options", undefined]) assert.equal(isWrite(m), false, String(m));
});

test("only login / sign-up may be written without login", () => {
  assert.deepEqual(PUBLIC_WRITE_ENDPOINTS.map((e) => e.prefix), ["/api/auth/"]);
  assert.ok(PUBLIC_WRITE_ENDPOINTS.every((e) => e.reason.length > 0), "every whitelisted endpoint has a reason");
  assert.equal(isPublicWrite("/api/auth/login"), true);
  assert.equal(isPublicWrite("https://bddsm-production.up.railway.app/api/auth/register"), true);
  for (const p of ["/videos", "/api/transcripts/1/save-draft", "/api/users/streak", "/api/upload/audio", "/api/feedback", "/api/authx"]) {
    assert.equal(isPublicWrite(p), false, p);
  }
});

test("login calls never carry an old token", () => {
  assert.equal(isAuthCall("/api/auth/login"), true);
  assert.equal(isAuthCall("/api/users/me"), false);
});

test("failure messages are always specific", () => {
  assert.equal(describeFailure(400, { error: "Level must be 1 or 2" }), "Level must be 1 or 2 (HTTP 400)");
  assert.match(describeFailure(403, {}), /permission/);
  assert.match(describeFailure(500, null), /server had a problem \(HTTP 500\)/);
  assert.match(describeFailure(undefined, undefined), /No connection/);
  assert.equal(requestLabel("put", "/api/x?y=1"), "PUT /api/x");
  assert.equal(pathOf("https://h/api/a/b?c"), "/api/a/b");
});
