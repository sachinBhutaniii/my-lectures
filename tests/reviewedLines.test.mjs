// Run: npm test   (node's built-in test runner; Node strips the TypeScript types itself)
import { test } from "node:test";
import assert from "node:assert/strict";
import { formatReviewedLines, parseReviewedLines, applyReviewedLines } from "../lib/reviewedLines.ts";

const lines = (flags) => flags.map((r, i) => ({ id: i + 1, reviewed: r }));

test("format: ranges, single lines and none", () => {
  assert.equal(formatReviewedLines(lines([true, true, true, false, true, false])), "6:1-3,5");
  assert.equal(formatReviewedLines(lines([false, false])), "2:");
  assert.equal(formatReviewedLines([]), "0:");
  assert.equal(formatReviewedLines(lines([false, true, true])), "3:2-3");
});

test("parse gives back exactly what was formatted", () => {
  const flags = [true, false, true, true, false, false, true];
  const value = formatReviewedLines(lines(flags));
  const marks = parseReviewedLines(value, flags.length);
  assert.deepEqual([...marks].sort((a, b) => a - b), [0, 2, 3, 6]);
});

test("marks saved for a different number of lines are ignored, never misplaced", () => {
  assert.equal(parseReviewedLines("528:1-176", 527).size, 0);
  assert.equal(parseReviewedLines("528:1-176", 528).size, 176);
});

test("missing or malformed values give no marks", () => {
  for (const v of [null, undefined, "", "abc", "5:1-x", "5:0", "5:3-2", "5:6", "5:1-2-3"]) {
    assert.equal(parseReviewedLines(v, 5).size, 0, `value ${String(v)}`);
  }
});

test("apply sets the flag on the marked lines only and leaves the rest untouched", () => {
  const cues = [{ id: 1 }, { id: 2 }, { id: 3 }];
  const out = applyReviewedLines(cues, "3:2");
  assert.equal(out[0].reviewed, undefined);
  assert.equal(out[1].reviewed, true);
  assert.equal(out[2].reviewed, undefined);
  assert.equal(applyReviewedLines(cues, "4:2"), cues, "does not fit → same array");
});
