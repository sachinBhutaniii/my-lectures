// Run: npm test   (node's built-in test runner; Node strips the TypeScript types itself)
import { test } from "node:test";
import assert from "node:assert/strict";
import { confirmTimelineLine, msToSrtTime } from "../lib/timelineConfirm.ts";

const line = (s, e, text, reviewed) => ({
  startMs: s, endMs: e, startTime: msToSrtTime(s), endTime: msToSrtTime(e), text, ...(reviewed ? { reviewed: true } : {}),
});
const times = (cues) => cues.map((c) => [c.startMs, c.endMs]);

test("the reported bug: Next on line 1 no longer undoes the fix already made on line 2", () => {
  // Line 2 was fixed to 15.4–25.4 s and confirmed with Next (so line 3 followed on from it)
  const cues = [line(0, 4200, "one"), line(15400, 25400, "two", true), line(25400, 31300, "three")];
  // Back on line 1: its end is stretched to 12.7 s and Next is pressed
  const out = confirmTimelineLine(cues, 0, 0, 12700, "one", "next");
  assert.deepEqual(times(out), [[0, 12700], [15400, 25400], [25400, 31300]]);
});

test("Next still lets lines not yet reviewed follow on, up to the first reviewed line", () => {
  const cues = [
    line(0, 4000, "a"), line(10000, 13000, "b"), line(20000, 22000, "c"),
    line(30000, 35000, "d", true), line(40000, 41000, "e"),
  ];
  const out = confirmTimelineLine(cues, 0, 0, 5000, "a", "next");
  assert.deepEqual(times(out), [[0, 5000], [5000, 8000], [8000, 10000], [30000, 35000], [40000, 41000]]);
  assert.equal(out[0].reviewed, true, "the confirmed line is now reviewed");
  assert.equal(out[1].reviewed, undefined);
  assert.equal(out[1].startTime, "00:00:05,000");
});

test("Exit / Prev only push later lines that would overlap, and never a reviewed one", () => {
  const cues = [line(0, 4000, "a"), line(4000, 6000, "b"), line(6000, 9000, "c", true), line(20000, 21000, "d")];
  const out = confirmTimelineLine(cues, 0, 0, 7000, "a", "stay");
  // b overlapped → pushed to 7–9 s; c is reviewed → stays even though it now overlaps; d untouched
  assert.deepEqual(times(out), [[0, 7000], [7000, 9000], [6000, 9000], [20000, 21000]]);
});

test("earlier overlapping lines are pulled back, but not a reviewed one", () => {
  const cues = [line(0, 3000, "a", true), line(3000, 6000, "b"), line(6000, 9000, "c")];
  const out = confirmTimelineLine(cues, 2, 5000, 9000, "c", "next");
  assert.deepEqual(times(out), [[0, 3000], [2000, 5000], [5000, 9000]]);
  const out2 = confirmTimelineLine(cues, 1, 2000, 6000, "b", "next");
  assert.deepEqual(times(out2).slice(0, 2), [[0, 3000], [2000, 6000]], "reviewed line 1 is left as it is");
});

test("a line with broken timing (ends before it starts) stops the moving", () => {
  const cues = [line(0, 4000, "a"), line(10000, 9000, "broken"), line(500, 4000, "after")];
  const out = confirmTimelineLine(cues, 0, 0, 5000, "a", "next");
  assert.deepEqual(times(out), [[0, 5000], [10000, 9000], [500, 4000]]);
  assert.ok(out.every((c) => c.startMs >= 0 && c.endMs >= 0), "never negative times");
});

test("the confirmed text is kept and other lines' text and flags are untouched", () => {
  const cues = [line(0, 1000, "a", true), line(1000, 2000, "b"), line(2000, 3000, "c")];
  const out = confirmTimelineLine(cues, 1, 1000, 2000, "B fixed", "next");
  assert.equal(out[1].text, "B fixed");
  assert.equal(out[0].reviewed, true);
  assert.equal(out[2].reviewed, undefined);
  assert.notEqual(out, cues, "a new array (React state)");
});

test("Next always marks the line reviewed; Prev / Exit only when something changed", () => {
  const cues = [line(0, 1000, "a"), line(1000, 2000, "b")];
  assert.equal(confirmTimelineLine(cues, 0, 0, 1000, "a", "next")[0].reviewed, true, "Next = this line is done");
  assert.ok(!confirmTimelineLine(cues, 0, 0, 1000, "a", "stay")[0].reviewed, "opened and left unchanged");
  assert.equal(confirmTimelineLine(cues, 0, 0, 900, "a", "stay")[0].reviewed, true, "time changed");
  assert.equal(confirmTimelineLine(cues, 0, 0, 1000, "A", "stay")[0].reviewed, true, "text changed");
  const already = [line(0, 1000, "a", true)];
  assert.equal(confirmTimelineLine(already, 0, 0, 1000, "a", "stay")[0].reviewed, true, "stays reviewed");
});
