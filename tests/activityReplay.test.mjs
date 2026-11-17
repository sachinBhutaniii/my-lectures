// Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeChange, cuesHash, replaySession, withTyping } from "../lib/activityDiff.ts";

const c = (s, e, t) => ({ s, e, t });
const v0 = [c("00:00:01,000", "00:00:02,000", "one"), c("00:00:03,000", "00:00:04,000", "two"), c("00:00:05,000", "00:00:06,000", "three")];
const v1 = [v0[0], c("00:00:03,000", "00:00:04,000", "TWO"), v0[2]];
const v2 = [v1[0], c("00:00:03,000", "00:00:06,000", "TWO three")];

let id = 100;
const row = (seq, type, payload, stateHash) => ({
  id: id++, sessionId: "sess-1", seq, type, action: null, summary: null, level: 1, mode: "l1",
  userId: 7, userName: "Saroj", device: null, clientTime: 1, serverTime: 1,
  stateHash: stateHash ?? null, cueCount: null, payloadJson: payload === undefined ? null : JSON.stringify(payload),
});

test("rebuilds every moment of a session and checks each against its fingerprint", () => {
  const rows = [
    row(1, "SESSION_START", { cues: v0 }, cuesHash(v0)),
    row(2, "TYPING", { line: 2, before: v0[1], typed: { ...v0[1], t: "TW" } }),
    row(3, "CHANGE", computeChange(v0, v1), cuesHash(v1)),
    row(4, "SAVE_OK", undefined, cuesHash(v1)),
    row(5, "CHANGE", computeChange(v1, v2), cuesHash(v2)),
  ];
  const pts = replaySession(rows.slice().reverse()); // order of arrival doesn't matter
  assert.deepEqual(pts.get(rows[0].id).cues, v0);
  assert.deepEqual(pts.get(rows[1].id).cues, v0);
  assert.equal(pts.get(rows[1].id).typing.typed.t, "TW");
  assert.deepEqual(pts.get(rows[2].id).cues, v1);
  assert.equal(pts.get(rows[3].id).verified, true);
  assert.deepEqual(pts.get(rows[4].id).cues, v2);
  assert.ok([...pts.values()].every((p) => p.verified));
  assert.deepEqual(withTyping(v0, pts.get(rows[1].id).typing)[1].t, "TW");
});

test("a missing step makes later moments unrebuildable until the next full copy", () => {
  const rows = [
    row(1, "SESSION_START", { cues: v0 }, cuesHash(v0)),
    // seq 2 never arrived
    row(3, "CHANGE", computeChange(v1, v2), cuesHash(v2)),
    row(4, "SNAPSHOT", { cues: v2 }, cuesHash(v2)),
    row(5, "SAVE_OK", undefined, cuesHash(v2)),
  ];
  const pts = replaySession(rows);
  const broken = pts.get(rows[1].id);
  assert.equal(broken.cues, null);
  assert.match(broken.problem, /Steps 2–2 .* never reached the server/);
  assert.ok(broken.change, "the change itself is still shown");
  assert.deepEqual(pts.get(rows[2].id).cues, v2);
  assert.equal(pts.get(rows[3].id).verified, true);
});

test("a change that doesn't match its fingerprint is flagged, never trusted", () => {
  const rows = [
    row(1, "SESSION_START", { cues: v0 }, cuesHash(v0)),
    row(2, "CHANGE", computeChange(v0, v1), "3:wrong"),
  ];
  const p = replaySession(rows).get(rows[1].id);
  assert.equal(p.cues, null);
  assert.equal(p.verified, false);
  assert.match(p.problem, /stopped matching/);
});

test("session without its opening copy says so", () => {
  const rows = [row(2, "CHANGE", computeChange(v0, v1), cuesHash(v1))];
  assert.match(replaySession(rows).get(rows[0].id).problem, /opening copy never reached/);
});
