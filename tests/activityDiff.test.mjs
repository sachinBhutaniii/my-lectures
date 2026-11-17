// Run: npm test   (node's built-in test runner; Node strips the TypeScript types itself)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeChange, applyChange, cuesHash, describeChange, logCuesToSrt, srtTimeToMs,
} from "../lib/activityDiff.ts";

const c = (s, e, t) => ({ s, e, t });
const base = [
  c("00:00:01,000", "00:00:02,000", "one"),
  c("00:00:03,000", "00:00:04,000", "two"),
  c("00:00:05,000", "00:00:06,000", "three"),
  c("00:00:07,000", "00:00:08,000", "four"),
];

test("no change gives null", () => {
  assert.equal(computeChange(base, base.map((x) => ({ ...x }))), null);
});

test("single text edit is the smallest block and replays exactly", () => {
  const next = base.map((x) => ({ ...x }));
  next[1] = { ...next[1], t: "TWO" };
  const ch = computeChange(base, next);
  assert.deepEqual(ch, { at: 1, removed: [base[1]], added: [next[1]] });
  assert.deepEqual(applyChange(base, ch), next);
  assert.match(describeChange("edit-line", ch), /Edited line — line 2: text "two" → "TWO"/);
});

test("merge, delete and insert replay exactly", () => {
  const merged = [base[0], c("00:00:03,000", "00:00:06,000", "two three"), base[3]];
  const m = computeChange(base, merged);
  assert.deepEqual(applyChange(base, m), merged);
  assert.match(describeChange("merge", m), /lines 2 and 3 joined/);

  const deleted = [base[0], base[2], base[3]];
  const d = computeChange(base, deleted);
  assert.deepEqual(applyChange(base, d), deleted);
  assert.match(describeChange("delete", d), /removed line 2: "two"/);

  const inserted = [base[0], c("00:00:02,000", "00:00:02,500", ""), ...base.slice(1)];
  const i = computeChange(base, inserted);
  assert.deepEqual(applyChange(base, i), inserted);
  assert.match(describeChange("insert", i), /1 new line after line 1/);
});

test("a pack-all-later-lines change reports how far lines moved", () => {
  const packed = [base[0], c("00:00:02,000", "00:00:03,000", "two"), c("00:00:03,000", "00:00:04,000", "three"), c("00:00:04,000", "00:00:05,000", "four")];
  const ch = computeChange(base, packed);
  assert.equal(ch.at, 1);
  assert.equal(ch.removed.length, 3);
  assert.match(describeChange("timeline-next", ch), /timing changed on 3 lines \(up to 3\.0s earlier\)/);
});

test("applying a change to the wrong version throws instead of rebuilding garbage", () => {
  const next = base.map((x) => ({ ...x }));
  next[2] = { ...next[2], t: "THREE" };
  const ch = computeChange(base, next);
  const other = base.map((x) => ({ ...x }));
  other[2] = { ...other[2], t: "something else" };
  assert.throws(() => applyChange(other, ch), /Line 3 is not what this change expected/);
  assert.throws(() => applyChange(base.slice(0, 1), ch), /does not fit/);
});

test("hash changes with any field and is stable", () => {
  const h = cuesHash(base);
  assert.equal(h, cuesHash(base.map((x) => ({ ...x }))));
  assert.match(h, /^4:[0-9a-z]+$/);
  assert.notEqual(h, cuesHash([...base.slice(0, 3), { ...base[3], e: "00:00:08,001" }]));
  assert.notEqual(h, cuesHash([...base.slice(0, 3), { ...base[3], t: "Four" }]));
});

test("random edit sequences always replay to the same transcript (fuzz)", () => {
  let seed = 42;
  const rnd = (n) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
  let state = Array.from({ length: 50 }, (_, k) => c(`00:00:${String(k).padStart(2, "0")},000`, `00:00:${String(k).padStart(2, "0")},900`, `line ${k}`));
  const start = state;
  const changes = [];
  for (let step = 0; step < 300; step++) {
    const next = state.map((x) => ({ ...x }));
    const op = rnd(5);
    const i = rnd(Math.max(1, next.length));
    if (op === 0 && next.length) next[i] = { ...next[i], t: next[i].t + "!" };
    else if (op === 1 && next.length > 1) next.splice(i, 1);
    else if (op === 2) next.splice(i, 0, c("00:01:00,000", "00:01:01,000", `new ${step}`));
    else if (op === 3 && next.length > i + 1) next.splice(i, 2, { ...next[i], t: next[i].t + " " + next[i + 1].t });
    else for (let k = i; k < next.length; k++) next[k] = { ...next[k], s: `00:02:${String(k % 60).padStart(2, "0")},000` };
    const ch = computeChange(state, next);
    if (ch) changes.push({ ch, hash: cuesHash(next) });
    state = next;
  }
  let replay = start;
  for (const { ch, hash } of changes) {
    replay = applyChange(replay, ch);
    assert.equal(cuesHash(replay), hash);
  }
  assert.deepEqual(replay, state);
});

test("SRT output numbers lines and keeps times", () => {
  assert.equal(logCuesToSrt(base.slice(0, 2)), "1\n00:00:01,000 --> 00:00:02,000\none\n\n2\n00:00:03,000 --> 00:00:04,000\ntwo\n");
  assert.equal(srtTimeToMs("00:06:20,500"), 380500);
  assert.ok(Number.isNaN(srtTimeToMs("garbage")));
});
