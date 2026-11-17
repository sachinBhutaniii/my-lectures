// Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { missingOriginalTail } from "../lib/draftRecovery.ts";

const orig = Array.from({ length: 720 }, (_, i) => ({ startMs: i * 5000, endMs: i * 5000 + 4000, text: `line ${i + 1}` }));

test("complete draft whose lines were moved earlier is NOT 'repaired' (Saroj's #116 case)", () => {
  // Next packed every line edge-to-edge: same lines, ends ~4 minutes early, one merge
  let t = 0;
  const shifted = orig.slice(0, 719).map((c) => { const d = { ...c, startMs: t, endMs: t + 4000 }; t += 4000; return d; });
  shifted[718] = { ...shifted[718], text: "line 720" }; // last line = original's last line
  assert.equal(shifted[shifted.length - 1].endMs < orig[719].endMs * 0.95, true, "ends before the old 95% threshold");
  assert.deepEqual(missingOriginalTail(shifted, orig), []);
});

test("draft cut short after line 300 gets lines 301-720 back", () => {
  const cut = orig.slice(0, 300);
  const tail = missingOriginalTail(cut, orig);
  assert.equal(tail.length, 420);
  assert.equal(tail[0].text, "line 301");
});

test("last line proofread (text changed): only a clearly short draft is repaired", () => {
  const edited = orig.slice(0, 700).map((c) => ({ ...c }));
  edited[699] = { ...edited[699], text: "Line 700, corrected" };
  assert.deepEqual(missingOriginalTail(edited, orig), [], "700 of 720 lines is not 'cut short'");
  const short = orig.slice(0, 200).map((c) => ({ ...c }));
  short[199] = { ...short[199], text: "edited" };
  assert.equal(missingOriginalTail(short, orig)[0].text, "line 201");
});

test("matching ignores case and spacing; repeated lines use the last occurrence", () => {
  const o = [{ startMs: 0, endMs: 1, text: "Hare Krishna" }, { startMs: 2, endMs: 3, text: "x" }, { startMs: 4, endMs: 5, text: "Hare Krishna" }];
  assert.deepEqual(missingOriginalTail([{ startMs: 0, endMs: 1, text: " hare  krishna " }], o), []);
});
