// Lines the proofreader has confirmed in Timeline Editor Mode ("reviewed"). They are saved with
// every draft so Timeline Editor "Next" never moves them again — on any device.
// Stored as "<line count>:<line ranges>", e.g. "528:1-176,180" (1-based). The count lets the
// editor ignore marks that no longer fit the draft (e.g. lines added or removed by an older app).
// No imports, so it is tested with `node --test` (tests/reviewedLines.test.mjs).

export interface ReviewedFlag {
  reviewed?: boolean;
}

/** "<count>:<ranges>" for the reviewed lines (just "<count>:" when none are reviewed). */
export function formatReviewedLines(cues: ReviewedFlag[]): string {
  const ranges: string[] = [];
  let start = -1;
  for (let i = 0; i <= cues.length; i++) {
    const on = i < cues.length && !!cues[i].reviewed;
    if (on && start < 0) start = i;
    if (!on && start >= 0) {
      ranges.push(start === i - 1 ? `${start + 1}` : `${start + 1}-${i}`);
      start = -1;
    }
  }
  return `${cues.length}:${ranges.join(",")}`;
}

/**
 * Indexes (0-based) of the reviewed lines among `count` lines. Empty when there is no value, it
 * is malformed, or it was saved for a different number of lines (the marks can't be placed).
 */
export function parseReviewedLines(value: string | null | undefined, count: number): Set<number> {
  const none = new Set<number>();
  if (!value) return none;
  const m = /^(\d+):([\d,\s-]*)$/.exec(value.trim());
  if (!m || Number(m[1]) !== count) return none;
  const out = new Set<number>();
  for (const part of m[2].split(",")) {
    const p = part.trim();
    if (!p) continue;
    const bounds = p.split("-").map((x) => Number(x.trim()));
    if (bounds.length > 2) return none;
    const lo = bounds[0];
    const hi = bounds.length === 2 ? bounds[1] : bounds[0];
    if (!Number.isInteger(lo) || !Number.isInteger(hi) || lo < 1 || hi < lo || hi > count) return none;
    for (let n = lo; n <= hi; n++) out.add(n - 1);
  }
  return out;
}

/** The cues with their `reviewed` flag set from a saved value (unchanged when it doesn't fit). */
export function applyReviewedLines<T extends ReviewedFlag>(cues: T[], value: string | null | undefined): T[] {
  const marks = parseReviewedLines(value, cues.length);
  if (marks.size === 0) return cues;
  return cues.map((c, i) => (marks.has(i) ? { ...c, reviewed: true } : c));
}
